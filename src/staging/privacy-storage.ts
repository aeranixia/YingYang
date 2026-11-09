import { bookForVersion, bookVersion, type Book } from '../questionnaires'
import { fresh, key, restore, type Session } from '../engine'
import { productionPrivacyVersion } from '../production/contracts'
export const retentionMs = 7 * 86400000
export const receiptClockToleranceMs = 60_000
export const privacyVersion = import.meta.env.MODE==='production'?productionPrivacyVersion:'staging-clinic-privacy-6'
export const privacyKey = 'yingyang:staging:privacy'
export const metadataKey = 'yingyang:staging:retention'
export const epochKey = 'yingyang:staging:epoch'
export const proofKey = 'yingyang:staging:completion'
const kinds = ['acquired', 'innate'] as const
type Kind = typeof kinds[number]
const books: Book[] = ['legacy-50', 'sasang-80']
const entryKey = (kind: Kind, book: Book) => book === 'legacy-50' ? kind : book + ':' + kind
export const bookProofKey = (book: Book) => book === 'legacy-50' ? proofKey : proofKey + ':' + book
type Entry = { savedAt: number }
type Metadata = { version: 1; exams: Partial<Record<string, Entry>> }
export type PrivacyReceipt = { proof: string; at: number; expires: number }
type Consent = PrivacyReceipt & { version: string; epoch: string }
function read<T>(name: string): T | null {
 try { return JSON.parse(localStorage.getItem(name) || 'null') } catch { return null }
}
export function epoch() { try { return localStorage.getItem(epochKey) || '' } catch { return '' } }
function metadata(): Metadata { const data = read<Metadata>(metadataKey); return data?.version === 1 && data.exams && typeof data.exams === 'object' ? data : { version: 1, exams: {} } }
function validEntry(entry: Entry | undefined, now: number): entry is Entry { return !!entry && Number.isSafeInteger(entry.savedAt) && entry.savedAt > 0 && entry.savedAt <= now }
export function privacy(now = Date.now()): Consent | null {
 const data = read<Consent>(privacyKey)
 return data?.version === privacyVersion && data.epoch === epoch() && typeof data.proof === 'string' && Number.isSafeInteger(data.at) && data.at <= now + receiptClockToleranceMs && Number.isSafeInteger(data.expires) && data.expires > now && data.expires <= data.at + retentionMs ? data : null
}
export function requirePrivacy(expectedEpoch = epoch()) {
 const data = privacy()
 if (!data || !expectedEpoch || data.epoch !== expectedEpoch) throw Error('Privacy confirmation required')
 return data
}
export function hasLegacy(now = Date.now()) {
 const meta = metadata()
 return books.some(book => kinds.some(kind => localStorage.getItem(key(kind, book)) !== null && !validEntry(meta.exams[entryKey(kind, book)], now)))
}
export function expire(now = Date.now()) {
 const meta = metadata(); let changed = false
 for (const book of books) for (const kind of kinds) if (validEntry(meta.exams[entryKey(kind, book)], now) && now >= meta.exams[entryKey(kind, book)]!.savedAt + retentionMs) {
  localStorage.removeItem(key(kind, book)); delete meta.exams[entryKey(kind, book)]; localStorage.removeItem(bookProofKey(book)); changed = true
 }
 if (changed) {
  const consent = privacy(now), nextEpoch = crypto.randomUUID()
  localStorage.setItem(epochKey, nextEpoch)
  if (consent) localStorage.setItem(privacyKey, JSON.stringify({ ...consent, epoch: nextEpoch }))
  localStorage.setItem(metadataKey, JSON.stringify(meta))
 }
 return changed
}
export function deleteAll() {
 localStorage.setItem(epochKey, crypto.randomUUID())
 for (const name of [...books.flatMap(book => [key('acquired', book), key('innate', book), bookProofKey(book)]), privacyKey, metadataKey]) localStorage.removeItem(name)
}
export function acceptPrivacy(receipt: PrivacyReceipt, expectedEpoch: string, migrate: boolean, now = Date.now()) {
 if (epoch() !== expectedEpoch || typeof receipt.proof !== 'string' || !receipt.proof || receipt.proof.length > 2048 || !Number.isSafeInteger(receipt.at) || !Number.isSafeInteger(receipt.expires) || receipt.expires <= now || receipt.at > now + receiptClockToleranceMs || receipt.expires > receipt.at + retentionMs) throw Error('Stale consent')
 const meta = metadata()
 if (hasLegacy(now) && !migrate) throw Error('Migration choice required')
 if (migrate) for (const book of books) for (const kind of kinds) if (localStorage.getItem(key(kind, book)) !== null && !validEntry(meta.exams[entryKey(kind, book)], now)) meta.exams[entryKey(kind, book)] = { savedAt: now }
 localStorage.setItem(metadataKey, JSON.stringify(meta))
 books.forEach(book => localStorage.removeItem(bookProofKey(book)))
 localStorage.setItem(privacyKey, JSON.stringify({ ...receipt, version: privacyVersion, epoch: expectedEpoch }))
}
export function ensureEpoch() { if (!epoch()) localStorage.setItem(epochKey, crypto.randomUUID()); return epoch() }
export function assertStates(states: Record<Kind, Session>, expectedEpoch = epoch()) {
 requirePrivacy(expectedEpoch)
 if (expire() || hasLegacy()) throw Error('Expired or legacy data')
 const book = bookForVersion(states.acquired.version)
 if (states.innate.version !== states.acquired.version) throw Error('Mixed questionnaire versions')
 for (const kind of kinds) if (JSON.stringify(restore(kind, localStorage.getItem(key(kind, book)), book)) !== JSON.stringify(states[kind])) throw Error('Session changed')
}
export function completionExpiry(book: Book = 'legacy-50') {
 const consent = requirePrivacy(), meta = metadata()
 const values = kinds.map(kind => meta.exams[entryKey(kind, book)]?.savedAt)
 if (values.some(value => !Number.isSafeInteger(value))) throw Error('Missing retention data')
 const expires = Math.min(consent.expires, ...values.map(value => value! + retentionMs))
 if (expires <= Date.now()) throw Error('Expired')
 return expires
}
export function sessionStore(expectedEpoch: string, book: Book = 'legacy-50') {
 const snapshots: Partial<Record<Kind, string | null>> = {}
 return {
  read(kind: Kind) {
   try {
    requirePrivacy(expectedEpoch); expire(); requirePrivacy(expectedEpoch)
    if (hasLegacy()) return fresh(kind, book)
    snapshots[kind] = localStorage.getItem(key(kind, book))
    return restore(kind, snapshots[kind]!, book)
   } catch { return fresh(kind, book) }
  },
  save(state: Session) {
   if(state.version!==bookVersion(book))throw Error('Questionnaire mismatch')
   requirePrivacy(expectedEpoch)
   if (expire() || hasLegacy()) throw Error('Expired data')
   if (kindSnapshotChanged(state.kind)) throw Error('Another tab changed this exam')
   const meta = metadata(), before = localStorage.getItem(key(state.kind, book)); meta.exams[entryKey(state.kind, book)] = { savedAt: Date.now() }
   localStorage.setItem(key(state.kind, book), JSON.stringify(state))
   try { localStorage.setItem(metadataKey, JSON.stringify(meta)) }
   catch (error) { if (before === null) localStorage.removeItem(key(state.kind, book)); else localStorage.setItem(key(state.kind, book), before); throw error }
   snapshots[state.kind] = localStorage.getItem(key(state.kind, book))
  },
 }
 function kindSnapshotChanged(kind: Kind) { return kind in snapshots && snapshots[kind] !== localStorage.getItem(key(kind, book)) }
}

import { fresh, key, restore, type Session } from '../engine'
import { productionPrivacyVersion } from '../production/contracts'
export const retentionMs = 7 * 86400000
export const receiptClockToleranceMs = 60_000
export const privacyVersion = import.meta.env.MODE==='production'?productionPrivacyVersion:'staging-clinic-privacy-5'
export const privacyKey = 'yingyang:staging:privacy'
export const metadataKey = 'yingyang:staging:retention'
export const epochKey = 'yingyang:staging:epoch'
export const proofKey = 'yingyang:staging:completion'
const kinds = ['acquired', 'innate'] as const
type Kind = typeof kinds[number]
type Entry = { savedAt: number }
type Metadata = { version: 1; exams: Partial<Record<Kind, Entry>> }
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
 return kinds.some(kind => localStorage.getItem(key(kind)) !== null && !validEntry(meta.exams[kind], now))
}
export function expire(now = Date.now()) {
 const meta = metadata(); let changed = false
 for (const kind of kinds) if (validEntry(meta.exams[kind], now) && now >= meta.exams[kind]!.savedAt + retentionMs) {
  localStorage.removeItem(key(kind)); delete meta.exams[kind]; changed = true
 }
 if (changed) {
  const consent = privacy(now), nextEpoch = crypto.randomUUID()
  localStorage.setItem(epochKey, nextEpoch)
  if (consent) localStorage.setItem(privacyKey, JSON.stringify({ ...consent, epoch: nextEpoch }))
  localStorage.setItem(metadataKey, JSON.stringify(meta)); localStorage.removeItem(proofKey)
 }
 return changed
}
export function deleteAll() {
 localStorage.setItem(epochKey, crypto.randomUUID())
 for (const name of [key('acquired'), key('innate'), proofKey, privacyKey, metadataKey]) localStorage.removeItem(name)
}
export function acceptPrivacy(receipt: PrivacyReceipt, expectedEpoch: string, migrate: boolean, now = Date.now()) {
 if (epoch() !== expectedEpoch || typeof receipt.proof !== 'string' || !receipt.proof || receipt.proof.length > 2048 || !Number.isSafeInteger(receipt.at) || !Number.isSafeInteger(receipt.expires) || receipt.expires <= now || receipt.at > now + receiptClockToleranceMs || receipt.expires > receipt.at + retentionMs) throw Error('Stale consent')
 const meta = metadata()
 if (hasLegacy(now) && !migrate) throw Error('Migration choice required')
 if (migrate) for (const kind of kinds) if (localStorage.getItem(key(kind)) !== null && !validEntry(meta.exams[kind], now)) meta.exams[kind] = { savedAt: now }
 localStorage.setItem(metadataKey, JSON.stringify(meta))
 localStorage.removeItem(proofKey)
 localStorage.setItem(privacyKey, JSON.stringify({ ...receipt, version: privacyVersion, epoch: expectedEpoch }))
}
export function ensureEpoch() { if (!epoch()) localStorage.setItem(epochKey, crypto.randomUUID()); return epoch() }
export function assertStates(states: Record<Kind, Session>, expectedEpoch = epoch()) {
 requirePrivacy(expectedEpoch)
 if (expire() || hasLegacy()) throw Error('Expired or legacy data')
 for (const kind of kinds) if (JSON.stringify(restore(kind, localStorage.getItem(key(kind)))) !== JSON.stringify(states[kind])) throw Error('Session changed')
}
export function completionExpiry() {
 const consent = requirePrivacy(), meta = metadata()
 const values = kinds.map(kind => meta.exams[kind]?.savedAt)
 if (values.some(value => !Number.isSafeInteger(value))) throw Error('Missing retention data')
 const expires = Math.min(consent.expires, ...values.map(value => value! + retentionMs))
 if (expires <= Date.now()) throw Error('Expired')
 return expires
}
export function sessionStore(expectedEpoch: string) {
 const snapshots: Partial<Record<Kind, string | null>> = {}
 return {
  read(kind: Kind) {
   try {
    requirePrivacy(expectedEpoch); expire(); requirePrivacy(expectedEpoch)
    if (hasLegacy()) return fresh(kind)
    snapshots[kind] = localStorage.getItem(key(kind))
    return restore(kind, snapshots[kind]!)
   } catch { return fresh(kind) }
  },
  save(state: Session) {
   requirePrivacy(expectedEpoch)
   if (expire() || hasLegacy()) throw Error('Expired data')
   if (kindSnapshotChanged(state.kind)) throw Error('Another tab changed this exam')
   const meta = metadata(), before = localStorage.getItem(key(state.kind)); meta.exams[state.kind] = { savedAt: Date.now() }
   localStorage.setItem(key(state.kind), JSON.stringify(state))
   try { localStorage.setItem(metadataKey, JSON.stringify(meta)) }
   catch (error) { if (before === null) localStorage.removeItem(key(state.kind)); else localStorage.setItem(key(state.kind), before); throw error }
   snapshots[state.kind] = localStorage.getItem(key(state.kind))
  },
 }
 function kindSnapshotChanged(kind: Kind) { return kind in snapshots && snapshots[kind] !== localStorage.getItem(key(kind)) }
}

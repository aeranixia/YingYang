import { attachmentName, fingerprint, validateSubmission } from './submission'
import { createPdf } from './pdf'
import { completionDate } from './completion'
import type { Sender } from './sender'
import type { MockReceipt } from '../../src/staging/contracts'

export class ServiceError extends Error {
 constructor(public readonly code: 'already-exists' | 'aborted' | 'resource-exhausted' | 'unavailable') { super(code) }
}
type Entry = { digest: string; state: 'processing' | 'completed' | 'failed'; attempts: number; expiry: number }
export function createSubmissionService(sender: Sender, clock = Date.now, pdf = createPdf) {
 const entries = new Map<string, Entry>()
 let day = -1, count = 0
 return async (raw: unknown, uid: string, signingKey: string): Promise<MockReceipt> => {
  const input = validateSubmission(raw), now = clock()
  const completedAt = completionDate(input, uid, signingKey, now)
  for (const [id, entry] of entries) if (entry.expiry <= now) entries.delete(id)
  const id = `${uid}:${input.requestId}`, digest = fingerprint(input, signingKey)
  let entry = entries.get(id)
  if (entry) {
   if (entry.digest !== digest) throw new ServiceError('already-exists')
   if (entry.state === 'completed') return { status: 'mock-completed', requestId: input.requestId, duplicate: true }
   if (entry.state === 'processing') throw new ServiceError('aborted')
   if (entry.attempts >= 3) throw new ServiceError('resource-exhausted')
  }
  const currentDay = Math.floor(now / 86400000)
  if (currentDay !== day) { day = currentDay; count = 0 }
  if (count >= 50 || (!entry && entries.size >= 100)) throw new ServiceError('resource-exhausted')
  count++
  if (!entry) { entry = { digest, state: 'processing', attempts: 0, expiry: now + 10 * 60000 }; entries.set(id, entry) }
  entry.state = 'processing'; entry.attempts++
  let buffer: Buffer | undefined
  try {
   buffer = await pdf(input, completedAt)
   await sender.send({ filename: attachmentName(input), content: buffer }, { fail: input.scenario === 'fail-once' && entry.attempts === 1 })
   entry.state = 'completed'
   return { status: 'mock-completed', requestId: input.requestId, duplicate: false }
  } catch {
   entry.state = 'failed'
   throw new ServiceError('unavailable')
  } finally { buffer?.fill(0) }
 }
}

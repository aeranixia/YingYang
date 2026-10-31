import { createHmac, timingSafeEqual } from 'node:crypto'
import { fresh, isComplete } from '../../src/engine'
import type { Submission } from '../../src/staging/contracts'
import { InputError } from './submission'
import { verifyPrivacy } from './privacy'

const sign = (text: string, key: string) => createHmac('sha256', key).update(text).digest('hex')
type Answers = Pick<Submission, 'acquired' | 'innate'>
const scope = (data: Answers, uid: string, key: string) => sign(JSON.stringify([uid, data.acquired, data.innate]), key)
export function confirmCompletion(raw: unknown, uid: string, key: string, now = Date.now()) {
 const data = raw as Answers & { action: string; nonce: string; privacyProof: string; expires: number }
 if (!data || Object.keys(data).sort().join(',') !== 'acquired,action,expires,innate,nonce,privacyProof' || data.action !== 'confirm-completion' || typeof data.nonce !== 'string' || !/^[a-f0-9-]{36}$/.test(data.nonce)) throw new InputError('Invalid completion')
 const consent = verifyPrivacy(data.privacyProof, uid, key, now)
 if (!Number.isSafeInteger(data.expires) || data.expires <= now || data.expires > consent.expires) throw new InputError('Expired retention')
 for (const kind of ['acquired', 'innate'] as const) {
  if (!Array.isArray(data[kind]) || Array.from(data[kind]).some(value => !Number.isInteger(value)) || !isComplete({ ...fresh(kind), answers: data[kind] })) throw new InputError('Incomplete answers')
 }
 const encoded = Buffer.from(JSON.stringify({ at: now, expires: data.expires, nonce: data.nonce, scope: scope(data, uid, key) })).toString('base64url')
 return { proof: encoded + '.' + sign(encoded, key) }
}
export function completionDate(input: Answers & { completionProof?: string }, uid: string, key: string, now = Date.now()): Date | null {
 if (input.completionProof === undefined) return null
 try {
  if (typeof input.completionProof !== 'string' || input.completionProof.length > 1024) throw Error()
  const [encoded, signature, extra] = input.completionProof.split('.')
  if (extra || !/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(encoded, key)))) throw Error()
  const value = JSON.parse(Buffer.from(encoded, 'base64url').toString())
  if (!Number.isSafeInteger(value.at) || value.at < 0 || value.at > now || !Number.isSafeInteger(value.expires) || value.expires <= now || value.expires > value.at + 7 * 86400000 || value.scope !== scope(input, uid, key)) throw Error()
  return new Date(value.at)
 } catch { throw new InputError('Invalid completion proof') }
}

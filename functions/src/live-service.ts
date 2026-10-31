import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Submission } from '../../src/staging/contracts'
import { validateSubmission, attachmentName } from './submission'
import { createPdf } from './pdf'
import { completionDate } from './completion'
import { Conflict, type StateStore } from './mail-state'
import type { MailConfig } from './gmail-sender'
import type { Attachment } from './sender'

export class LiveError extends Error {
 constructor(public readonly code: 'invalid-argument' | 'already-exists' | 'aborted' | 'resource-exhausted' | 'failed-precondition' | 'unavailable', public readonly outcomeUnknown = false) { super(code) }
}
export const DAILY_MAIL_ATTEMPT_LIMIT = 50
const digest = (value: string, key: string) => createHmac('sha256', key).update(value).digest('hex')
const canonical = (input: Submission) => JSON.stringify([input.requestId,input.version,input.name,input.phone,input.acquired,input.innate,[input.consent.personal,input.consent.sensitive,input.consent.synthetic,input.consent.version],input.scenario,input.completionProof ?? null,input.privacyProof ?? null])
type Ticket = { operation: string; requestId: string; scope: string; expires: number }
type RecordState = { digest: string; state: 'preparing' | 'failed' | 'sending' | 'sent' | 'unknown'; attempts: number; leaseUntil: number; expires: number }
function scope(input: Submission, uid: string, config: MailConfig, key: string) { return digest(JSON.stringify([canonical(input),uid,config.sender,config.recipient]), key) }
export function prepareMailTicket(raw: unknown, uid: string, config: MailConfig, key: string, now = Date.now()) {
 const input = validateSubmission(raw,'staging-e-draft-1')
 completionDate(input, uid, key, now)
 if (input.scenario !== 'success') throw new LiveError('invalid-argument')
 const payload: Ticket = { operation: randomUUID(), requestId: input.requestId, scope: scope(input,uid,config,key), expires: now + 15 * 60000 }
 const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
 return { ticket: encoded + '.' + digest(encoded,key), expires: payload.expires, requestId: input.requestId }
}
function verifyTicket(ticket: unknown, input: Submission, uid: string, config: MailConfig, key: string, now: number): Ticket {
 try {
  if (typeof ticket !== 'string' || ticket.length > 2048) throw Error()
  const [encoded, signature, extra] = ticket.split('.')
  const expected = digest(encoded,key)
  if (extra || !/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) throw Error()
  const parsed = JSON.parse(Buffer.from(encoded,'base64url').toString()) as Ticket
  if (!/^[0-9a-f-]{36}$/.test(parsed.operation) || parsed.requestId !== input.requestId || parsed.scope !== scope(input,uid,config,key) || !Number.isFinite(parsed.expires) || parsed.expires <= now || parsed.expires > now + 15 * 60000) throw Error()
  return parsed
 } catch { throw new LiveError('invalid-argument') }
}
export function createLiveService(store: StateStore, dispatch: (config: MailConfig, attachment: Attachment, operation: string, accessToken: string) => Promise<void>, authorize: (config: MailConfig) => Promise<string>, clock = Date.now, pdf = (input: Submission, date: Date | null) => createPdf(input,date,'gmail-test')) {
 async function quota(now: number) {
  const date = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
  const name = `v1/days/${date}`
  for (let i=0;i<5;i++) {
   const prior = await store.read<{count:number}>(name)
   const count = prior ? prior.value.count : 0
   if (!Number.isInteger(count) || count < 0 || count >= DAILY_MAIL_ATTEMPT_LIMIT) throw new LiveError('resource-exhausted')
   try { await store.write(name,{count:count+1},prior?.generation||'0'); return } catch(error) { if (!(error instanceof Conflict)) throw error }
  }
  throw new LiveError('unavailable')
 }
 return async (raw: unknown, uid: string, config: MailConfig, key: string) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).sort().join(',') !== 'submission,ticket') throw new LiveError('invalid-argument')
  const request = raw as { submission: unknown; ticket: unknown }, input = validateSubmission(request.submission,'staging-e-draft-1'), now = clock()
  const completedAt = completionDate(input, uid, key, now)
  if (input.scenario !== 'success') throw new LiveError('invalid-argument')
  const ticket = verifyTicket(request.ticket,input,uid,config,key,now), name = `v1/operations/${ticket.operation}`
  const prior = await store.read<RecordState>(name)
  if (prior && (!prior.value || !['preparing','failed','sending','sent','unknown'].includes(prior.value.state) || !Number.isInteger(prior.value.attempts) || prior.value.attempts < 1 || prior.value.attempts > 3 || !Number.isFinite(prior.value.leaseUntil) || !Number.isFinite(prior.value.expires))) throw new LiveError('unavailable')
  if (prior && prior.value.digest !== ticket.scope) throw new LiveError('already-exists')
  if (prior?.value.state === 'sent') return { status:'gmail-accepted' as const,requestId:input.requestId,duplicate:true }
  if (prior && ['sending','unknown'].includes(prior.value.state)) throw new LiveError('failed-precondition',true)
  if (prior?.value.state === 'preparing' && prior.value.leaseUntil > now) throw new LiveError('aborted')
  if ((prior?.value.attempts || 0) >= 3) throw new LiveError('resource-exhausted')
  let record: RecordState = { digest:ticket.scope,state:'preparing',attempts:(prior?.value.attempts||0)+1,leaseUntil:now+45000,expires:now+86400000 }
  let generation: string
  try { generation=await store.write(name,record,prior?.generation||'0') } catch(error) { if(error instanceof Conflict) throw new LiveError('aborted'); throw new LiveError('unavailable') }
  let buffer: Buffer | undefined, sending=false
  try {
   buffer = await pdf(input,completedAt)
   const accessToken = await authorize(config)
   await quota(clock())
   record={...record,state:'sending'}
   generation=await store.write(name,record,generation)
   sending=true
   await dispatch(config,{filename:attachmentName(input),content:buffer},ticket.operation,accessToken)
   await store.write(name,{...record,state:'sent'},generation)
   return {status:'gmail-accepted' as const,requestId:input.requestId,duplicate:false}
  } catch(error) {
   if (!sending) {
    try { await store.write(name,{...record,state:'failed'},generation) } catch {}
    if(error instanceof LiveError) throw error
    throw new LiveError('unavailable')
   }
   try { await store.write(name,{...record,state:'unknown'},generation) } catch {}
   throw new LiveError('failed-precondition',true)
  } finally { buffer?.fill(0) }
 }
}

import type { Session } from '../engine'
import { assertStates, completionExpiry, epoch, requirePrivacy } from './privacy-storage'
type States = { acquired: Session; innate: Session }
type Request = { action: 'confirm-completion'; nonce: string; acquired: number[]; innate: number[]; privacyProof: string; expires: number }
type Confirm = (request: Request) => Promise<{ proof: string }>
export const completionKey = 'yingyang:staging:completion'
const signature = (states: States) => JSON.stringify([states.acquired.answers, states.innate.answers])
type Stored = { signature: string; nonce: string; proof?: string; expires: number }
function read(): Stored | null {
 try { return JSON.parse(localStorage.getItem(completionKey) || 'null') } catch { return null }
}
let running: { nonce: string; promise: Promise<void> } | undefined
export function completionProof(states: States): string | undefined {
 const stored = read()
 try { requirePrivacy(); if (completionExpiry() <= Date.now()) return undefined } catch { return undefined }
 return states.acquired.completed && states.innate.completed && stored && stored.expires > Date.now() && stored.signature === signature(states) ? stored.proof : undefined
}
export function markCompletion(states: States, newlyCompleted: boolean) {
 localStorage.removeItem(completionKey)
 if (newlyCompleted && states.acquired.completed && states.innate.completed) {
  localStorage.setItem(completionKey, JSON.stringify({ signature: signature(states), nonce: crypto.randomUUID(), expires: completionExpiry() }))
 }
}
export async function confirmPending(states: States, confirm: Confirm) {
 const stored = read()
 if (!stored || stored.proof || stored.expires <= Date.now() || stored.signature !== signature(states) || !states.acquired.completed || !states.innate.completed) return
 const currentEpoch = epoch(), consent = requirePrivacy(currentEpoch)
 assertStates(states, currentEpoch)
 if (running?.nonce === stored.nonce) return running.promise
 const promise = (async () => {
  const result = await confirm({ action: 'confirm-completion', nonce: stored.nonce, acquired: states.acquired.answers as number[], innate: states.innate.answers as number[], privacyProof: consent.proof, expires: Math.min(stored.expires, completionExpiry()) })
  assertStates(states, currentEpoch)
  const current = read()
  if (current?.nonce === stored.nonce && current.signature === stored.signature) localStorage.setItem(completionKey, JSON.stringify({ ...stored, proof: result.proof }))
 })()
 running = { nonce: stored.nonce, promise }
 try { await promise } finally { if (running?.promise === promise) running = undefined }
}

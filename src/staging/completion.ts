import type { Session } from '../engine'
type States = { acquired: Session; innate: Session }
type Request = { action: 'confirm-completion'; nonce: string; acquired: number[]; innate: number[] }
type Confirm = (request: Request) => Promise<{ proof: string }>
export const completionKey = 'yingyang:staging:completion'
const signature = (states: States) => JSON.stringify([states.acquired.answers, states.innate.answers])
type Stored = { signature: string; nonce: string; proof?: string }
function read(): Stored | null {
 try { return JSON.parse(localStorage.getItem(completionKey) || 'null') } catch { return null }
}
let running: { nonce: string; promise: Promise<void> } | undefined
export function completionProof(states: States): string | undefined {
 const stored = read()
 return states.acquired.completed && states.innate.completed && stored?.signature === signature(states) ? stored.proof : undefined
}
export function markCompletion(states: States, newlyCompleted: boolean) {
 localStorage.removeItem(completionKey)
 if (newlyCompleted && states.acquired.completed && states.innate.completed) {
  localStorage.setItem(completionKey, JSON.stringify({ signature: signature(states), nonce: crypto.randomUUID() }))
 }
}
export async function confirmPending(states: States, confirm: Confirm) {
 const stored = read()
 if (!stored || stored.proof || stored.signature !== signature(states) || !states.acquired.completed || !states.innate.completed) return
 if (running?.nonce === stored.nonce) return running.promise
 const promise = (async () => {
  const result = await confirm({ action: 'confirm-completion', nonce: stored.nonce, acquired: states.acquired.answers as number[], innate: states.innate.answers as number[] })
  const current = read()
  if (current?.nonce === stored.nonce && current.signature === stored.signature) localStorage.setItem(completionKey, JSON.stringify({ ...stored, proof: result.proof }))
 })()
 running = { nonce: stored.nonce, promise }
 try { await promise } finally { if (running?.promise === promise) running = undefined }
}

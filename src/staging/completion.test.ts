import { beforeEach, expect, it, vi } from 'vitest'
import { fresh } from '../engine'
import { completionKey, completionProof, confirmPending, markCompletion } from './completion'
const states = () => ({ acquired: { ...fresh('acquired'), completed: true, answers: Array(10).fill(1) }, innate: { ...fresh('innate'), completed: true, answers: Array(40).fill(2) } })
beforeEach(() => localStorage.clear())
it('legacy data stays unknown; final completion persists proof across reload and font changes', async () => {
 const data=states(),confirm=vi.fn(async()=>({proof:'signed-server-proof'}))
 await confirmPending(data,confirm);expect(confirm).not.toHaveBeenCalled()
 markCompletion(data,true);await confirmPending(data,confirm)
 expect(completionProof(data)).toBe('signed-server-proof')
 localStorage.setItem('yingyang:text-size','large')
 await confirmPending(states(),confirm);expect(confirm).toHaveBeenCalledTimes(1)
 expect(completionProof(states())).toBe('signed-server-proof')
})
it('retaking identical answers requires new confirmation; edited answers reject previous receipt',async()=>{
 const data=states(),confirm=vi.fn(async()=>({proof:'proof'}))
 markCompletion(data,true);await confirmPending(data,confirm)
 const edited=states();edited.innate.answers[0]=0;expect(completionProof(edited)).toBeUndefined()
 markCompletion({...data,innate:fresh('innate')},false);expect(localStorage.getItem(completionKey)).toBeNull()
 markCompletion(data,true);await confirmPending(data,confirm);expect(confirm).toHaveBeenCalledTimes(2)
 expect(confirm.mock.calls[0]).not.toEqual(confirm.mock.calls[1])
})
it('failed confirmation can resume; late reply after reset cannot restore obsolete proof',async()=>{
 const data=states();markCompletion(data,true)
 await expect(confirmPending(data,async()=>{throw Error()})).rejects.toThrow()
 let release!: (value:{proof:string})=>void
 const pending=confirmPending(data,()=>new Promise(resolve=>{release=resolve}))
 markCompletion({...data,innate:fresh('innate')},false)
 release({proof:'obsolete'});await pending
 expect(completionProof(data)).toBeUndefined()
 markCompletion(data,true);await confirmPending(data,async()=>({proof:'new'}));expect(completionProof(data)).toBe('new')
})

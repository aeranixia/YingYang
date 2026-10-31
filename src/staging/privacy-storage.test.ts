import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fresh, key } from '../engine'
import { seedPrivacy } from './test-privacy'
import { acceptPrivacy, assertStates, deleteAll, ensureEpoch, epoch, expire, hasLegacy, metadataKey, privacy, privacyKey, proofKey, retentionMs, sessionStore } from './privacy-storage'
beforeEach(()=>{localStorage.clear();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-31T00:00:00Z'))})
afterEach(()=>vi.useRealTimers())
it('legacy data untouched until explicit adoption; migration uses current time without forging completion',()=>{
 const raw=JSON.stringify({...fresh('acquired'),answers:Array(10).fill(2),completed:true})
 localStorage.setItem(key('acquired'),raw);localStorage.setItem(proofKey,'old-proof')
 expect(hasLegacy()).toBe(true);expire();expect(localStorage.getItem(key('acquired'))).toBe(raw)
 const current=ensureEpoch(),at=Date.now()
 expect(()=>acceptPrivacy({proof:'p',at,expires:at+retentionMs},current,false)).toThrow()
 acceptPrivacy({proof:'p',at,expires:at+retentionMs},current,true)
 expect(localStorage.getItem(key('acquired'))).toBe(raw);expect(hasLegacy()).toBe(false);expect(localStorage.getItem(proofKey)).toBeNull()
 expect(JSON.parse(localStorage.getItem(metadataKey)!).exams.acquired.savedAt).toBe(at)
})
it('exact seven-day boundary expires one exam and linked proof while preserving later exam',()=>{
 seedPrivacy();const first=Date.now();vi.setSystemTime(first+86400000)
 const current=epoch(),at=Date.now();acceptPrivacy({proof:'renewed',at,expires:at+retentionMs},current,false)
 const store=sessionStore(current);store.save({...fresh('innate'),answers:[2,...Array(39).fill(null)]})
 localStorage.setItem(proofKey,'proof');vi.setSystemTime(first+retentionMs-1);expect(expire()).toBe(false)
 vi.setSystemTime(first+retentionMs);expect(expire()).toBe(true)
 expect(localStorage.getItem(key('acquired'))).toBeNull();expect(localStorage.getItem(key('innate'))).not.toBeNull();expect(localStorage.getItem(proofKey)).toBeNull()
 expect(()=>store.save({...fresh('acquired'),answers:Array(10).fill(1)})).toThrow()
})
it('reads and font changes never extend savedAt; consent expiry denies further persistence',()=>{
 const store=seedPrivacy(),before=localStorage.getItem(metadataKey),at=Date.now()
 vi.setSystemTime(at+10000);store.read('acquired');localStorage.setItem('yingyang:text-size','large')
 expect(localStorage.getItem(metadataKey)).toBe(before)
 vi.setSystemTime(at+retentionMs);expect(privacy()).toBeNull();expect(()=>store.save(fresh('acquired'))).toThrow()
})
it('delete all preserves font and unrelated keys; old tab and delayed consent cannot recreate data',()=>{
 const store=seedPrivacy(),old=epoch(),at=Date.now();localStorage.setItem(proofKey,'proof');localStorage.setItem('yingyang:text-size','large');localStorage.setItem('unrelated','keep')
 deleteAll()
 for(const name of [key('acquired'),key('innate'),privacyKey,metadataKey,proofKey])expect(localStorage.getItem(name)).toBeNull()
 expect(localStorage.getItem('yingyang:text-size')).toBe('large');expect(localStorage.getItem('unrelated')).toBe('keep')
 expect(()=>store.save(fresh('acquired'))).toThrow();expect(()=>acceptPrivacy({proof:'late',at,expires:at+retentionMs},old,false)).toThrow()
})
it('another tab change blocks stale state writes and submission',()=>{
 const store=seedPrivacy(),states={acquired:store.read('acquired'),innate:store.read('innate')}
 localStorage.setItem(key('innate'),JSON.stringify({...fresh('innate'),current:1}))
 expect(()=>store.save(states.innate)).toThrow();expect(()=>assertStates(states)).toThrow()
})
it('completion response arriving after delete cannot recreate exam, proof or consent',async()=>{
 const data={acquired:{...fresh('acquired'),completed:true,answers:Array(10).fill(1)},innate:{...fresh('innate'),completed:true,answers:Array(40).fill(2)}}
 seedPrivacy(data)
 const {markCompletion,confirmPending}=await import('./completion')
 markCompletion(data,true)
 let release!:(value:{proof:string})=>void
 const pending=confirmPending(data,()=>new Promise(resolve=>{release=resolve}))
 deleteAll();release({proof:'late-response'})
 await expect(pending).rejects.toThrow()
 for(const name of [key('acquired'),key('innate'),proofKey,privacyKey])expect(localStorage.getItem(name)).toBeNull()
})

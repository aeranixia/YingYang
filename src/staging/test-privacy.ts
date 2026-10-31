import { fresh, key, type Session } from '../engine'
import { acceptPrivacy, ensureEpoch, sessionStore, retentionMs } from './privacy-storage'
export function seedPrivacy(states = { acquired: fresh('acquired'), innate: fresh('innate') }) {
 const current = ensureEpoch(), at = Date.now()
 acceptPrivacy({ proof: 'synthetic-privacy-proof', at, expires: at + retentionMs }, current, true)
 const store = sessionStore(current)
 for (const kind of ['acquired', 'innate'] as const) store.save(states[kind] as Session)
 return store
}

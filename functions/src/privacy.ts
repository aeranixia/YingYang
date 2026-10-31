import { createHmac, timingSafeEqual } from 'node:crypto'
export const privacyVersion = 'staging-clinic-privacy-2'
const duration = 7 * 86400000
const hmac = (text: string, key: string) => createHmac('sha256', key).update('privacy:' + text).digest('hex')
export function issuePrivacy(raw: unknown, uid: string, key: string, now = Date.now()) {
 const data = raw as Record<string, unknown>
 if (!data || Object.keys(data).sort().join(',') !== 'action,personal,sensitive,version' || data.action !== 'consent-privacy' || data.version !== privacyVersion || data.personal !== true || data.sensitive !== true) throw Error('Consent required')
 const value = { at: now, expires: now + duration, uid: hmac(uid, key), version: privacyVersion, personal: true, sensitive: true }
 const encoded = Buffer.from(JSON.stringify(value)).toString('base64url')
 return { proof: encoded + '.' + hmac(encoded, key), at: value.at, expires: value.expires }
}
export function verifyPrivacy(proof: unknown, uid: string, key: string, now = Date.now()) {
 if (typeof proof !== 'string' || proof.length > 2048) throw Error('Consent required')
 const [encoded, signature, extra] = proof.split('.')
 if (extra || !/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature), Buffer.from(hmac(encoded, key)))) throw Error('Invalid consent')
 const value = JSON.parse(Buffer.from(encoded, 'base64url').toString())
 if (value.uid !== hmac(uid, key) || value.version !== privacyVersion || value.personal !== true || value.sensitive !== true || !Number.isSafeInteger(value.at) || value.at > now || !Number.isSafeInteger(value.expires) || value.expires !== value.at + duration || value.expires <= now) throw Error('Expired consent')
 return { at: value.at as number, expires: value.expires as number }
}

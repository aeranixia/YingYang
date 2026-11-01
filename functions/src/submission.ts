import { createHmac } from 'node:crypto'
import { aggregate, fresh, VERSION } from '../../src/engine'
import { consentVersion, syntheticNames, syntheticPhones, type Submission } from '../../src/staging/contracts'
import { validPatientIdentity } from '../../src/production/contracts'
import { reportName } from './report-name'

export class InputError extends Error {}
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === keys.sort().join(',')
export function validateSubmission(raw: unknown, expectedConsentVersion = consentVersion, syntheticOnly=true): Submission {
 const fields = ['requestId', 'version', 'name', 'phone', 'acquired', 'innate', 'consent', 'scenario']
 if (raw && typeof raw === 'object' && Object.hasOwn(raw, 'completionProof')) fields.push('completionProof')
 if (raw && typeof raw === 'object' && Object.hasOwn(raw, 'privacyProof')) fields.push('privacyProof')
 if (!exact(raw, fields)) throw new InputError('Invalid fields')
 if ('completionProof' in raw && (typeof raw.completionProof !== 'string' || raw.completionProof.length > 1024)) throw new InputError('Invalid completion proof')
 if ('privacyProof' in raw && (typeof raw.privacyProof !== 'string' || raw.privacyProof.length > 2048)) throw new InputError('Invalid privacy proof')
 if (typeof raw.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.requestId)) throw new InputError('Invalid request id')
 if (raw.version !== VERSION || (syntheticOnly?typeof raw.name !== 'string'||!syntheticNames.some(n => n === raw.name)||typeof raw.phone !== 'string'||!syntheticPhones.some(p => p === raw.phone):!validPatientIdentity(raw.name,raw.phone))) throw new InputError('Invalid identity')
 if (!exact(raw.consent, ['personal', 'sensitive', 'synthetic', 'version']) || raw.consent.personal !== true || raw.consent.sensitive !== true || raw.consent.synthetic !== syntheticOnly || raw.consent.version !== expectedConsentVersion) throw new InputError('Consent required')
 for (const [kind, length, min, max] of [['acquired', 10, 1, 4], ['innate', 40, 0, 2]] as const) {
  const values = raw[kind]
  if (!Array.isArray(values) || values.length !== length || Array.from(values).some(v => !Number.isInteger(v) || v < min || v > max)) throw new InputError('Invalid answers')
 }
 if (raw.scenario !== 'success' && raw.scenario !== 'fail-once') throw new InputError('Invalid scenario')
 if(!syntheticOnly&&raw.scenario!=='success')throw new InputError('Invalid scenario')
 return raw as unknown as Submission
}
export function calculate(input: Submission) {
 return { acquired: aggregate({ ...fresh('acquired'), answers: input.acquired, completed: true }), innate: aggregate({ ...fresh('innate'), answers: input.innate, completed: true }) }
}
export function attachmentName(input: Pick<Submission, 'name' | 'phone'>,date=new Date()) {
 const name = input.name.normalize('NFC').replace(/[^\p{L}\p{N} -]/gu, '').trim().slice(0, 30)
 if (!name || !/^\d{10,11}$/.test(input.phone)) throw new InputError('Invalid filename identity')
 return reportName(name,input.phone.slice(-4),date)
}
export function fingerprint(input: Submission, key: string) {
 return createHmac('sha256', key).update(JSON.stringify(input)).digest('hex')
}

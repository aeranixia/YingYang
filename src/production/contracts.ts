export const productionPrivacyVersion='yingyang-privacy-questionnaires-2'
export const productionPdfConsentVersion='yingyang-pdf-1.2.0'
export function validPatientIdentity(name:unknown,phone:unknown){return typeof name==='string'&&name.length>=1&&name.length<=30&&name===name.trim()&&name===name.normalize('NFC')&&/^[\p{L}\p{N} -]+$/u.test(name)&&typeof phone==='string'&&/^0\d{9,10}$/.test(phone)}

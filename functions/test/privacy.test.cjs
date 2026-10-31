const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto')
const {issuePrivacy,verifyPrivacy,privacyVersion}=require('../lib/functions/src/privacy')
const {confirmCompletion,completionDate}=require('../lib/functions/src/completion')
const key='synthetic-privacy-test-key-32-characters',uid='synthetic-tester',at=Date.parse('2026-10-31T01:00:00Z'),week=7*86400000
const consent=()=>issuePrivacy({action:'consent-privacy',version:privacyVersion,personal:true,sensitive:true},uid,key,at)
const answers=()=>({acquired:Array(10).fill(1),innate:Array(40).fill(2)})
test('separate consents/version required; consent receipt carries no exam or identity and verifies account/time/signature',()=>{
 for(const input of [{action:'consent-privacy',version:privacyVersion,personal:true,sensitive:false},{action:'consent-privacy',version:'bad',personal:true,sensitive:true},{action:'consent-privacy',version:privacyVersion,personal:true,sensitive:true,acquired:[1]}])assert.throws(()=>issuePrivacy(input,uid,key,at))
 const r=consent();assert.deepEqual(verifyPrivacy(r.proof,uid,key,at+week-1),{at,expires:at+week})
 for(const [proof,who,time]of[[undefined,uid,at],[r.proof+'x',uid,at],[r.proof,'other',at],[r.proof,uid,at-1],[r.proof,uid,at+week]])assert.throws(()=>verifyPrivacy(proof,who,key,time))
 const decoded=Buffer.from(r.proof.split('.')[0],'base64url').toString();for(const value of [uid,'acquired','innate','phone','name'])assert.equal(decoded.includes(value),false)
})
test('completion requires prior consent and linked expiry; server rejects expired completion',()=>{
 const input={...answers(),action:'confirm-completion',nonce:randomUUID(),expires:at+3600000,privacyProof:consent().proof}
 assert.throws(()=>confirmCompletion({...input,privacyProof:undefined},uid,key,at))
 assert.throws(()=>confirmCompletion({...input,expires:at+week+1},uid,key,at))
 const proof=confirmCompletion(input,uid,key,at).proof
 assert.equal(completionDate({...answers(),completionProof:proof},uid,key,at+1000).getTime(),at)
 assert.throws(()=>completionDate({...answers(),completionProof:proof},uid,key,at+3600000))
})
test('deployed callable handlers reject missing consent before completion/mock and allow consent then mock without mail',async()=>{
 process.env.GCLOUD_PROJECT='yingyangtest';process.env.STAGING_ENV='stage-bc';process.env.MAIL_MODE='mock';process.env.SEND_ENABLED='false';process.env.STAGING_REQUEST_SIGNING_KEY=key
 const {stagingStatus,submitMockReport}=require('../lib/functions/src/index')
 const wrap=data=>({data,auth:{uid,token:{stagingTester:true}},app:{appId:'synthetic'},rawRequest:{rawBody:Buffer.alloc(0)}})
 await assert.rejects(stagingStatus.run(wrap({...answers(),action:'confirm-completion',nonce:randomUUID()})),e=>e.code==='invalid-argument')
 const r=await stagingStatus.run(wrap({action:'consent-privacy',version:privacyVersion,personal:true,sensitive:true}))
 assert.equal((await stagingStatus.run(wrap({action:'verify-privacy',privacyProof:r.proof}))).valid,true)
 const done=await stagingStatus.run(wrap({...answers(),action:'confirm-completion',nonce:randomUUID(),privacyProof:r.proof,expires:r.expires}))
 const submission={...answers(),requestId:randomUUID(),version:1,name:'가상테스터',phone:'01000001234',consent:{personal:true,sensitive:true,synthetic:true,version:'staging-clinic-submission-4'},scenario:'success',completionProof:done.proof}
 await assert.rejects(submitMockReport.run(wrap(submission)),e=>e.code==='failed-precondition')
 assert.equal((await submitMockReport.run(wrap({...submission,privacyProof:r.proof}))).status,'mock-completed')
})

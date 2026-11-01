const {test,mock}=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto')
process.env.GCLOUD_PROJECT='yingyangcheck'
process.env.YINGYANG_SIGNING_KEY='synthetic-production-signing-key-at-least-32'
process.env.YINGYANG_MAIL_CONFIG=JSON.stringify({enabled:false})
const handlers=require('../lib/functions/src/production'),{getAuth}=require('firebase-admin/auth'),{GoogleAuth}=require('google-auth-library')
const {AdminIdentity}=require('../lib/functions/src/admin-identity'),{ReportArchive}=require('../lib/functions/src/admin-reports')
const master='virtual-master@gmail.com',ordinary='virtual-user@gmail.com',store=new Map([['config.json',{googleEmail:master,googleUid:'master'}]])
let gmailCalls=0
mock.method(GoogleAuth.prototype,'getAccessToken',async()=> 'synthetic-token')
mock.method(getAuth(),'getUser',async uid=>({email:uid==='master'?master:ordinary,emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}]}))
mock.method(getAuth(),'getUserByEmail',async()=>({uid:'ordinary',disabled:false}))
mock.method(getAuth(),'revokeRefreshTokens',async()=>{})
mock.method(global,'fetch',async(url,options={})=>{
 url=String(url);if(url.includes('gmail.googleapis.com')){gmailCalls++;throw Error('No mail allowed')}
 assert.ok(url.includes('/b/yingyangcheck-admin-')||url.includes('/b/yingyangcheck-mail-state-'),'Cross-project storage access')
 const u=new URL(url),name=u.searchParams.get('name')||decodeURIComponent(u.pathname.split('/o/')[1]||'')
 if(options.method==='POST'){store.set(name,JSON.parse(typeof options.body==='string'?options.body:Buffer.from(options.body).toString()));return new Response('{}',{status:200})}
 if(u.searchParams.has('prefix'))return new Response(JSON.stringify({items:[]}),{status:200})
 return store.has(name)?new Response(JSON.stringify(store.get(name)),{headers:{'x-goog-generation':'1'}}):new Response('',{status:404})
})
const wrap=(data,uid='master',provider='google.com')=>({data,auth:{uid,token:{email:uid==='master'?master:ordinary,email_verified:true,auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_provider:provider}}},app:{appId:'production-synthetic'},rawRequest:{rawBody:Buffer.alloc(0)}})
test('production Google master and approved admins remain isolated from Staging and password auth',async()=>{
 assert.equal((await handlers.adminIdentity.run(wrap({action:'session'}))).role,'master')
 assert.equal((await handlers.adminIdentity.run(wrap({action:'session'},'ordinary'))).role,'none')
 await assert.rejects(handlers.listAdminReports.run(wrap({},'ordinary')),e=>e.code==='permission-denied')
 await handlers.adminIdentity.run(wrap({action:'accounts',operation:'approve',email:ordinary}))
 assert.ok(store.get('members/'+createHash('sha256').update(ordinary).digest('hex')+'.json').active)
 assert.equal((await handlers.adminIdentity.run(wrap({action:'session'},'ordinary'))).role,'admin')
 assert.deepEqual((await handlers.listAdminReports.run(wrap({},'ordinary'))).reports,[])
 assert.equal((await handlers.adminIdentity.run(wrap({action:'session'},'master','password'))).role,'none')
 await handlers.adminIdentity.run(wrap({action:'accounts',operation:'revoke',email:ordinary}))
 await assert.rejects(handlers.listAdminReports.run(wrap({},'ordinary')),e=>e.code==='permission-denied')
})
test('production requires Auth/App Check; submission stays closed and never invokes Gmail',async()=>{
 for(const request of [{...wrap({}),auth:undefined},{...wrap({}),app:undefined}])await assert.rejects(handlers.adminIdentity.run(request),e=>e.code==='permission-denied')
 const status=await handlers.examStatus.run(wrap({},'anonymous-test','anonymous'));assert.equal(status.projectId,'yingyangcheck');assert.equal(status.sendEnabled,false)
 await assert.rejects(handlers.examStatus.run(wrap({})),e=>e.code==='permission-denied')
 const {productionPrivacyVersion:privacyVersion}=require('../lib/src/production/contracts')
 const receipt=await handlers.examStatus.run(wrap({action:'consent-privacy',version:privacyVersion,personal:true,sensitive:true},'anonymous-test','anonymous'))
 assert.equal((await handlers.examStatus.run(wrap({action:'verify-privacy',privacyProof:receipt.proof},'anonymous-test','anonymous'))).valid,true)
 await assert.rejects(handlers.examStatus.run(wrap({action:'verify-privacy',privacyProof:receipt.proof},'different-user','anonymous')),e=>e.code==='invalid-argument')
 process.env.PRODUCTION_SEND_ENABLED='true'
 await assert.rejects(handlers.submitReport.run(wrap({})),e=>e.code==='failed-precondition');assert.equal(gmailCalls,0)
})
test('shared identity and report services reject cross-project contexts even when role is valid',async()=>{
 const identity=new AdminIdentity({read:async()=>null},{},'synthetic',Date.now,'yingyangcheck')
 await assert.rejects(identity.session({project:'yingyangtest',app:true,uid:'test'}),e=>e.code==='permission-denied')
 const archive=new ReportArchive({},Date.now,'yingyangcheck')
 await assert.rejects(archive.page({},{project:'yingyangtest',app:true,uid:'test',role:'master'},'synthetic'),e=>e.code==='permission-denied')
})

test('active production prepares a signed ticket only for anonymous consented valid submissions; no email sent',async()=>{
 process.env.PRODUCTION_SEND_ENABLED='true'
 process.env.YINGYANG_MAIL_CONFIG=JSON.stringify({enabled:true,projectId:'yingyangcheck',mode:'production',sender:'synthetic@gmail.com',recipient:'synthetic@naver.com',client_id:'231582543863-synthetic.apps.googleusercontent.com',client_secret:'synthetic',refresh_token:'synthetic'})
 store.set('v1/control/mail',{enabled:true})
 const {randomUUID}=require('node:crypto'),{productionPrivacyVersion,productionPdfConsentVersion}=require('../lib/src/production/contracts')
 const uid='anonymous-active',receipt=await handlers.examStatus.run(wrap({action:'consent-privacy',version:productionPrivacyVersion,personal:true,sensitive:true},uid,'anonymous'))
 assert.equal((await handlers.examStatus.run(wrap({},uid,'anonymous'))).sendEnabled,true)
 const data={requestId:randomUUID(),version:1,name:'Virtual Patient',phone:'01000001234',acquired:Array(10).fill(1),innate:Array(40).fill(2),consent:{personal:true,sensitive:true,synthetic:false,version:productionPdfConsentVersion},scenario:'success',privacyProof:receipt.proof}
 assert.ok((await handlers.prepareReport.run(wrap(data,uid,'anonymous'))).ticket)
 await assert.rejects(handlers.prepareReport.run(wrap({...data,recipient:'injected@naver.com'},uid,'anonymous')),e=>e.code==='invalid-argument')
 await assert.rejects(handlers.prepareReport.run(wrap(data)),e=>e.code==='permission-denied')
 assert.equal(gmailCalls,0)
})

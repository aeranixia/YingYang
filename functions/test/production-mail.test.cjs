const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto')
const {productionProtocol,validateProductionMail,activeProductionMail,composeProductionMail}=require('../lib/functions/src/production-mail')
const {createLiveService,prepareMailTicket}=require('../lib/functions/src/live-service')
const {Conflict}=require('../lib/functions/src/mail-state')
const now=Date.now(),key='synthetic-key',uid='virtual-patient'
const config=()=>({enabled:true,projectId:'yingyangcheck',mode:'production',sender:'synthetic@gmail.com',recipient:'synthetic@naver.com',client_id:'231582543863-synthetic.apps.googleusercontent.com',client_secret:'synthetic',refresh_token:'synthetic'})
const input=()=>({requestId:randomUUID(),version:1,name:'가상테스터',phone:'01000001234',acquired:Array(10).fill(1),innate:Array(40).fill(2),consent:{personal:true,sensitive:true,synthetic:false,version:'yingyang-pdf-1.2.0'},scenario:'success'})
class Memory{
 constructor(){this.map=new Map();this.serial=0}
 async read(name){return structuredClone(this.map.get(name)||null)}
 async write(name,value,generation){if((this.map.get(name)?.generation||'0')!==generation)throw new Conflict();const next=String(++this.serial);this.map.set(name,{value:structuredClone(value),generation:next});return next}
}
const request=(data,cfg=config())=>({submission:data,ticket:prepareMailTicket(data,uid,cfg,key,now,productionProtocol).ticket})
const pdf=async()=>Buffer.from('%PDF-synthetic')
test('production input rejects missing consents, malformed answers, identity and recipient injection',()=>{
 assert.equal(productionProtocol.validate(input()).consent.synthetic,false)
 for(const mutate of [x=>x.consent.personal=false,x=>x.consent.sensitive=false,x=>x.consent.synthetic=true,x=>x.name='bad\r\nheader',x=>x.phone='1234',x=>x.acquired.pop(),x=>x.innate[0]=3,x=>x.recipient='injected@naver.com',x=>x.scenario='fail-once']){const x=input();mutate(x);assert.throws(()=>productionProtocol.validate(x))}
})
test('production requires environment, credential and persistent control gates; expired credentials fail closed',async()=>{
 const store=new Memory();await assert.rejects(activeProductionMail(config(),true,store,now))
 await store.write('v1/control/mail',{enabled:true},'0')
 assert.equal((await activeProductionMail(config(),true,store,now)).projectId,'yingyangcheck')
 await assert.rejects(activeProductionMail(config(),false,store,now))
 for(const mutate of [c=>c.enabled=false,c=>c.projectId='yingyangtest',c=>c.refresh_token='',c=>c.client_id='495270334718-staging.apps.googleusercontent.com',c=>c.recipient='bad\r\nBcc:injected@naver.com',c=>c.allowSendUntil='1970-01-01',c=>c.refreshTokenExpiresAt='1970-01-01']){const c=config();mutate(c);assert.throws(()=>validateProductionMail(c,now))}
})
test('reload and renewed ticket do not resend; identity changes conflict; state excludes personal data',async()=>{
 const store=new Memory(),data=input();let calls=0
 const make=()=>createLiveService(store,async()=>calls++,async()=>'synthetic',()=>now,pdf,undefined,productionProtocol)
 await make()(request(data),uid,config(),key)
 const renewed={...data,requestId:randomUUID()}
 assert.equal((await make()(request(renewed),uid,config(),key)).duplicate,true)
 const changed={...renewed,name:'가상환자'}
 await assert.rejects(make()(request(changed),uid,config(),key),{code:'already-exists'})
 assert.equal(calls,1)
 const stored=JSON.stringify([...store.map.values()]);for(const text of ['가상테스터','01000001234','%PDF-','acquired','innate'])assert.ok(!stored.includes(text))
})
test('production known pre-send failure retries; unknown outcome survives renewed tickets and blocks retry',async()=>{
 const store=new Memory(),data=input();let calls=0,auth=0
 const service=createLiveService(store,async()=>calls++,async()=>{if(++auth===1)throw Error();return 'synthetic'},()=>now,pdf,undefined,productionProtocol)
 await assert.rejects(service(request(data),uid,config(),key),e=>!e.outcomeUnknown)
 await service(request({...data,requestId:randomUUID()}),uid,config(),key);assert.equal(calls,1)
 const uncertain=new Memory(),send=createLiveService(uncertain,async()=>{calls++;throw Error()},async()=>'synthetic',()=>now,pdf,undefined,productionProtocol)
 await assert.rejects(send(request(data),uid,config(),key),e=>e.outcomeUnknown)
 await assert.rejects(send(request({...data,requestId:randomUUID()}),uid,config(),key),e=>e.outcomeUnknown);assert.equal(calls,2)
})
test('production MIME keeps fixed envelope, private-neutral subject and Korean PDF filename',async()=>{
 const bytes=await composeProductionMail(config(),{filename:'261101_가상테스터_1234.pdf',content:Buffer.from('%PDF-synthetic')},randomUUID()),text=bytes.toString()
 assert.ok(text.includes('To: synthetic@naver.com'));assert.ok(text.includes('From: synthetic@gmail.com'));assert.ok(!/^Cc:|^Bcc:/mi.test(text));assert.ok(text.includes('application/pdf'));bytes.fill(0)
})
test('production PDF preserves A4 single-page Korean report without test or mock labels',async()=>{
 const {createPdf}=require('../lib/functions/src/pdf'),{getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs')
 const bytes=await createPdf(input(),new Date(now),'production'),loading=getDocument({data:new Uint8Array(bytes),isEvalSupported:false}),doc=await loading.promise,page=await doc.getPage(1)
 const text=(await page.getTextContent()).items.map(x=>x.str).join(' ')
 assert.equal(doc.numPages,1);assert.ok(text.includes('가상테스터'));assert.ok(text.includes('검사 결과'));assert.ok(!text.includes('STAGING'));assert.ok(!text.includes('실제 이메일 테스트'));assert.ok(!text.includes('모의 처리'));assert.ok(Math.abs(page.view[2]-595.28)<1)
 await loading.destroy();bytes.fill(0)
})

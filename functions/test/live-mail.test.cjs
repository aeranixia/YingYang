const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto')
const {prepareMailTicket,createLiveService}=require('../lib/functions/src/live-service')
const {Conflict,GcsStateStore}=require('../lib/functions/src/mail-state')
const {validateMailConfig,composeTestMail}=require('../lib/functions/src/gmail-sender')
const key='synthetic-test-signing-key',uid='synthetic-tester',epoch=Date.parse('2026-10-27T01:00:00Z')
const config=()=>({projectId:'yingyangtest',mode:'gmail-test',sender:'synthetic.sender@gmail.com',recipient:'synthetic.receiver@naver.com',allowSendUntil:new Date(epoch+1800000).toISOString(),client_id:'synthetic.apps.googleusercontent.com',client_secret:'synthetic-secret'})
const input=()=>({requestId:randomUUID(),version:1,name:'가상테스터',phone:'01000001234',acquired:Array(10).fill(1),innate:Array(40).fill(2),consent:{personal:true,sensitive:true,synthetic:true,version:'staging-e-draft-1'},scenario:'success'})
class Memory {
 constructor(){this.map=new Map();this.serial=0}
 async read(name){return structuredClone(this.map.get(name)||null)}
 async write(name,value,generation){if((this.map.get(name)?.generation||'0')!==generation)throw new Conflict();const next=String(++this.serial);this.map.set(name,{value:structuredClone(value),generation:next});return next}
}
const pdf=async()=>Buffer.from('%PDF-synthetic')
const request=(data,cfg=config())=>({submission:data,ticket:prepareMailTicket(data,uid,cfg,key,epoch).ticket})

test('live configuration fails closed outside staging, recipient type, or one-hour test window',()=>{
 assert.equal(validateMailConfig(config(),epoch).mode,'gmail-test')
 for(const mutate of [c=>c.projectId='yingyangcheck',c=>c.mode='live',c=>c.recipient='clinic@example.invalid',c=>c.recipient='bad\r\nBcc:a@naver.com',c=>c.sender='bad@example.invalid',c=>c.allowSendUntil='1970-01-01',c=>c.allowSendUntil=new Date(epoch+3600001).toISOString(),c=>c.client_id='invalid']){const c=config();mutate(c);assert.throws(()=>validateMailConfig(c,epoch))}
})
test('tickets reject tamper, expiry, other identity, receiver and payload; no client recipient field accepted',async()=>{
 const cfg=config(),data=input(),r=request(data),service=createLiveService(new Memory(),async()=>{},async()=>'',()=>epoch,pdf)
 for(const bad of [{...r,ticket:r.ticket+'x'},{...r,submission:{...data,phone:'01000005678'}},{...r,recipient:'injected@naver.com'}])await assert.rejects(service(bad,uid,cfg,key),{code:'invalid-argument'})
 await assert.rejects(service(r,'other',cfg,key),{code:'invalid-argument'})
 await assert.rejects(service(r,uid,{...cfg,recipient:'other@naver.com'},key),{code:'invalid-argument'})
 await assert.rejects(createLiveService(new Memory(),async()=>{},async()=>'',()=>epoch+900001,pdf)(r,uid,cfg,key),{code:'invalid-argument'})
 assert.throws(()=>prepareMailTicket({...data,scenario:'fail-once'},uid,cfg,key,epoch))
})
test('persistent sent marker survives new service instance; metadata stores no identity or PDF; buffer cleared',async()=>{
 const store=new Memory(),data=input(),r=request(data),cfg=config();let count=0,buffer
 const dispatch=async(c,a)=>{count++;buffer=a.content;assert.equal(a.filename,'가상테스터_1234.pdf')}
 const first=createLiveService(store,dispatch,async()=>'fake',()=>epoch,pdf)
 assert.equal((await first(r,uid,cfg,key)).duplicate,false)
 assert.equal((await createLiveService(store,dispatch,async()=>'fake',()=>epoch,pdf)(r,uid,cfg,key)).duplicate,true)
 assert.equal(count,1);assert.ok(buffer.every(x=>x===0))
 const stored=JSON.stringify([...store.map.values()]);for(const secret of ['가상테스터','01000001234','%PDF-','synthetic.receiver','acquired','innate'])assert.equal(stored.includes(secret),false)
})
test('simultaneous reservations on shared store dispatch once',async()=>{
 let release;const gate=new Promise(r=>release=r),store=new Memory(),cfg=config(),r=request(input());let sent=0
 const one=createLiveService(store,async()=>{sent++;await gate},async()=>'fake',()=>epoch,pdf),two=createLiveService(store,async()=>{sent++},async()=>'fake',()=>epoch,pdf)
 const pending=one(r,uid,cfg,key);await assert.rejects(two(r,uid,cfg,key),{code:'aborted'});release();await pending;assert.equal(sent,1)
})
test('authorization failure before sending retries same ticket; mail outcome ambiguity never auto-retries',async()=>{
 const cfg=config(),store=new Memory(),r=request(input());let auth=0,sent=0
 const service=createLiveService(store,async()=>sent++,async()=>{if(++auth===1)throw Error('private refresh error');return 'fake'},()=>epoch,pdf)
 await assert.rejects(service(r,uid,cfg,key),e=>e.code==='unavailable'&&!e.message.includes('refresh'))
 await service(r,uid,cfg,key);assert.equal(sent,1)
 const uncertainStore=new Memory(),uncertain=request(input());let calls=0
 const uncertainService=createLiveService(uncertainStore,async()=>{calls++;throw Error('network outcome unknown')},async()=>'fake',()=>epoch,pdf)
 await assert.rejects(uncertainService(uncertain,uid,cfg,key),e=>e.outcomeUnknown===true)
 await assert.rejects(createLiveService(uncertainStore,async()=>{calls++},async()=>'fake',()=>epoch,pdf)(uncertain,uid,cfg,key),e=>e.outcomeUnknown===true)
 assert.equal(calls,1)
})
test('fifty-per-Korea-day budget is shared across service restarts and corruption fails closed',async()=>{
 const cfg=config(),store=new Memory();let calls=0
 for(let i=0;i<50;i++)await createLiveService(store,async()=>calls++,async()=>'fake',()=>epoch,pdf)(request(input()),uid,cfg,key)
 await assert.rejects(createLiveService(store,async()=>calls++,async()=>'fake',()=>epoch,pdf)(request(input()),uid,cfg,key),{code:'resource-exhausted'});assert.equal(calls,50)
 const item=store.map.get('v1/days/2026-10-27');item.value.count=null
 await assert.rejects(createLiveService(store,async()=>calls++,async()=>'fake',()=>epoch,pdf)(request(input()),uid,cfg,key),{code:'resource-exhausted'});assert.equal(calls,50)
})
test('MIME attachment is PDF, fixed To/From, encoded Korean filename, no CC/BCC',async()=>{
 const data=Buffer.from('%PDF-synthetic'),bytes=await composeTestMail(config(),{filename:'가상테스터_1234.pdf',content:data},randomUUID()),text=bytes.toString()
 assert.ok(text.includes('To: synthetic.receiver@naver.com'));assert.ok(text.includes('From: synthetic.sender@gmail.com'))
 assert.ok(text.includes('application/pdf'));assert.ok(text.includes(data.toString('base64')))
 assert.ok(text.includes('%EA%B0%80'));assert.ok(!/^Bcc:|^Cc:/mi.test(text));bytes.fill(0)
})
test('production bucket cannot be constructed',()=>assert.throws(()=>new GcsStateStore('yingyangcheck')))

test('Gmail success followed by state write failure never creates an automatic second send',async()=>{
 for(const writeActuallySucceeded of [false,true]){
  const store=new Memory(),baseWrite=store.write.bind(store);let fail=true,calls=0
  store.write=async(name,value,gen)=>{if(value.state==='sent'&&fail){fail=false;if(writeActuallySucceeded)await baseWrite(name,value,gen);throw Error('State acknowledgment lost')}return baseWrite(name,value,gen)}
  const r=request(input()),service=createLiveService(store,async()=>calls++,async()=>'fake',()=>epoch,pdf)
  await assert.rejects(service(r,uid,config(),key),e=>e.outcomeUnknown===true)
  if(writeActuallySucceeded)assert.equal((await service(r,uid,config(),key)).duplicate,true)
  else await assert.rejects(service(r,uid,config(),key),e=>e.outcomeUnknown===true)
  assert.equal(calls,1)
 }
})

test('real-test PDF uses truthful email label and separate draft consent',async()=>{
 const {createPdf}=require('../lib/functions/src/pdf'),{getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs')
 const data=input(),bytes=await createPdf(data,new Date(epoch),'gmail-test')
 const loading=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});const doc=await loading.promise
 const text=(await (await doc.getPage(1)).getTextContent()).items.map(x=>x.str).join(' ')
 assert.ok(text.includes('실제 이메일 테스트'));assert.ok(!text.includes('실제 이메일은 발송되지 않으며'));assert.equal(doc.numPages,1)
 assert.throws(()=>prepareMailTicket({...data,consent:{...data.consent,version:'staging-bc-draft-1'}},uid,config(),key,epoch))
 await loading.destroy();bytes.fill(0)
})


test('KST midnight uses reservation time even if PDF preparation started the previous day',async()=>{
 const store=new Memory(),cfg=config();let now=Date.parse('2026-10-27T14:59:59.900Z'),calls=0
 const make=()=>{const data=input();return {submission:data,ticket:prepareMailTicket(data,uid,cfg,key,now).ticket}}
 await store.write('v1/days/2026-10-27',{count:50},'0')
 const service=createLiveService(store,async()=>calls++,async()=>'fake',()=>now,async()=>{now=Date.parse('2026-10-27T15:00:00.100Z');return Buffer.from('%PDF-test')})
 await service(make(),uid,cfg,key)
 assert.equal(store.map.get('v1/days/2026-10-27').value.count,50)
 assert.equal(store.map.get('v1/days/2026-10-28').value.count,1);assert.equal(calls,1)
})

test('concurrent distinct tickets at 49 reservations cannot exceed 50 across service instances',async()=>{
 const store=new Memory(),cfg=config();let calls=0
 await store.write('v1/days/2026-10-27',{count:49},'0')
 const results=await Promise.allSettled(Array.from({length:20},()=>createLiveService(store,async()=>calls++,async()=>'fake',()=>epoch,pdf)(request(input()),uid,cfg,key)))
 assert.equal(calls,1);assert.equal(store.map.get('v1/days/2026-10-27').value.count,50)
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1)
 for(const r of results.filter(x=>x.status==='rejected'))assert.ok(['resource-exhausted','unavailable'].includes(r.reason.code))
})

test('failed dispatch consumes attempt without refund; same uncertain ticket and completed duplicate do not consume again',async()=>{
 const cfg=config(),store=new Memory(),failed=request(input());let calls=0
 const service=createLiveService(store,async()=>{calls++;throw Error('Synthetic send failure')},async()=>'fake',()=>epoch,pdf)
 await assert.rejects(service(failed,uid,cfg,key),e=>e.outcomeUnknown)
 await assert.rejects(service(failed,uid,cfg,key),e=>e.outcomeUnknown)
 assert.equal(calls,1);assert.equal(store.map.get('v1/days/2026-10-27').value.count,1)
 const ok=createLiveService(store,async()=>calls++,async()=>'fake',()=>epoch,pdf),r=request(input())
 await ok(r,uid,cfg,key);assert.equal((await ok(r,uid,cfg,key)).duplicate,true)
 assert.equal(calls,2);assert.equal(store.map.get('v1/days/2026-10-27').value.count,2)
})

test('PDF and OAuth failures before reservation cost no attempt; post-reservation state failure is not refunded',async()=>{
 const cfg=config(),store=new Memory(),r=request(input());let calls=0
 await assert.rejects(createLiveService(store,async()=>calls++,async()=>'fake',()=>epoch,async()=>{throw Error()})(r,uid,cfg,key))
 assert.equal(store.map.has('v1/days/2026-10-27'),false)
 await assert.rejects(createLiveService(store,async()=>calls++,async()=>{throw Error()},()=>epoch,pdf)(r,uid,cfg,key))
 assert.equal(store.map.has('v1/days/2026-10-27'),false)
 const store2=new Memory(),write=store2.write.bind(store2)
 store2.write=async(name,value,gen)=>{if(value.state==='sending')throw Error('Synthetic state failure');return write(name,value,gen)}
 await assert.rejects(createLiveService(store2,async()=>calls++,async()=>'fake',()=>epoch,pdf)(request(input()),uid,cfg,key))
 assert.equal(calls,0);assert.equal(store2.map.get('v1/days/2026-10-27').value.count,1)
})

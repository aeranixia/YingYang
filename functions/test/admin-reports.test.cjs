const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto')
const {ReportArchive,ArchiveConflict,archiveDays,maskedName,mockOperation,GcsArchiveStore}=require('../lib/functions/src/admin-reports')
const {createSubmissionService}=require('../lib/functions/src/service')
const {mockSender}=require('../lib/functions/src/sender')
const {consentVersion}=require('../lib/src/staging/contracts')
const key='synthetic-admin-test-signing-key-32-characters'
const context={project:'yingyangtest',uid:'synthetic-admin',app:true,role:'admin'}
class Store {
 constructor(){this.data=new Map();this.n=0;this.reads=0}
 async read(name){this.reads++;const x=this.data.get(name);return x?{bytes:Buffer.from(x.bytes),generation:x.generation,filename:x.filename}:null}
 async write(name,bytes,type,generation,filename){const x=this.data.get(name);if((x?.generation||'0')!==generation)throw new ArchiveConflict();this.data.set(name,{bytes:Buffer.from(bytes),generation:String(++this.n),filename})}
 async remove(name){this.data.delete(name)}
 async list(prefix,cursor){const names=[...this.data.keys()].filter(x=>x.startsWith(prefix)).sort();return {names:names.slice(Number(cursor||0),Number(cursor||0)+2),...(names.length>Number(cursor||0)+2?{nextCursor:String(Number(cursor||0)+2)}:{})}}
}
const input=()=>({requestId:randomUUID(),version:1,name:'가상테스터',phone:'01000001234',acquired:Array(10).fill(1),innate:Array(40).fill(2),consent:{personal:true,sensitive:true,synthetic:true,version:consentVersion},scenario:'success'})
const pdf=()=>Buffer.from('%PDF-1.4 synthetic-only')
test('masked metadata excludes identity/answers; PDF is private separate object, retries never extend seven days',async()=>{
 assert.equal(maskedName('김길동'),'김*동');assert.equal(maskedName('김동'),'김*');assert.equal(maskedName('김'),'*')
 let now=Date.parse('2026-11-01T00:00:00Z');const store=new Store(),archive=new ReportArchive(store,()=>now),id=randomUUID(),data=input()
 await archive.capture(data,pdf(),id,'mock');await archive.update(id,'failed','mock-failed')
 const original=JSON.parse(store.data.get('logs/'+id+'.json').bytes.toString())
 assert.equal(original.expiresAt-original.createdAt,archiveDays)
 const json=JSON.stringify(original);for(const secret of [data.name,data.phone,'acquired','innate'])assert.equal(json.includes(secret),false)
 now+=5000;await archive.capture(data,pdf(),id,'mock');await archive.update(id,'success')
 const page=await archive.page({},context,key);assert.equal(page.reports[0].expiresAt,original.expiresAt);assert.equal(page.reports[0].createdAt,original.createdAt)
 assert.ok([...store.data.keys()].some(x=>x.startsWith('access/')))
 const audits=[...store.data].filter(([name])=>name.startsWith('access/'));assert.equal(JSON.stringify(audits.map(x=>x[1].bytes.toString())).includes(context.uid),false)
})
test('email and administrator use the same real-name filename and original KST date across midnight retry',async()=>{
 let now=Date.parse('2026-11-01T14:59:00Z'),names=[];const store=new Store(),archive=new ReportArchive(store,()=>now),data=input()
 const service=createSubmissionService({send:async a=>{names.push(a.filename);if(names.length===1)throw Error('Synthetic before-send failure')}},()=>now,async()=>pdf(),archive)
 await assert.rejects(service(data,context.uid,key));now+=120000;await service(data,context.uid,key)
 const page=await archive.page({},context,key),download=await archive.download({id:page.reports[0].id},context,key)
 assert.deepEqual(names,['261101_가상테스터_1234.pdf','261101_가상테스터_1234.pdf']);assert.equal(download.filename,names[0]);assert.equal(JSON.stringify(page).includes('가상테스터'),false)
})
test('server requires admin claim, staging project and App Check before reading archive',async()=>{
 const store=new Store(),archive=new ReportArchive(store)
 for(const c of [{...context,project:'yingyangcheck'},{...context,app:false},{...context,uid:undefined},{...context,role:undefined},{...context,role:'none'}]){
  await assert.rejects(archive.page({},c,key),e=>e.code==='permission-denied');await assert.rejects(archive.download({id:randomUUID()},c,key),e=>e.code==='permission-denied')
 }
 assert.equal(store.reads,0);assert.equal(store.data.size,0);assert.throws(()=>new GcsArchiveStore('yingyangcheck'))
})
test('failed PDF download expires at exact seven-day boundary, deletes expired object and records access',async()=>{
 let now=Date.now();const store=new Store(),archive=new ReportArchive(store,()=>now),id=randomUUID(),start=now
 await archive.capture(input(),pdf(),id,'mock');await archive.update(id,'failed','mock-failed')
 now=start+archiveDays-1;const got=await archive.download({id},context,key);assert.equal(Buffer.from(got.base64,'base64').subarray(0,5).toString(),'%PDF-');assert.match(got.filename,/^\d{6}_가상테스터_1234\.pdf$/);assert.equal(/[<>:"/\\|?*\x00-\x1f]/.test(got.filename),false);assert.equal(got.filename.includes('가상테스터'),true)
 now=start+archiveDays;await assert.rejects(archive.download({id},context,key),e=>e.code==='failed-precondition');assert.equal(store.data.has('pdf/'+id+'.pdf'),false)
 assert.equal((await archive.page({},context,key)).reports.length,0)
 assert.ok([...store.data].filter(([n])=>n.startsWith('access/')).some(([,v])=>JSON.parse(v.bytes.toString()).outcome==='expired'))
})
test('KST date/status filters and strict request validation prevent arbitrary object access',async()=>{
 const now=Date.parse('2026-10-31T15:00:00Z'),store=new Store(),archive=new ReportArchive(store,()=>now),id=randomUUID()
 await archive.capture(input(),pdf(),id,'mock');await archive.update(id,'failed','mock-failed')
 assert.equal((await archive.page({from:'2026-11-01',to:'2026-11-01',status:'failed'},context,key)).reports.length,1)
 assert.equal((await archive.page({to:'2026-10-31'},context,key)).reports.length,0)
 for(const q of [{from:'2026-02-30'},{from:'2026-11-02',to:'2026-11-01'},{status:'all'},[],{recipient:'x'},{cursor:'x'.repeat(2049)}])await assert.rejects(archive.page(q,context,key),e=>e.code==='invalid-argument')
 for(const q of [{id:'../../other'},{id,bucket:'other'},null])await assert.rejects(archive.download(q,context,key),e=>e.code==='invalid-argument')
})
test('mock failure and retry update a single archived report; completed duplicate never rearchives or sends',async()=>{
 let now=Date.now();const store=new Store(),archive=new ReportArchive(store,()=>now),data={...input(),scenario:'fail-once'}
 const service=createSubmissionService(mockSender,()=>now,async()=>pdf(),archive)
 await assert.rejects(service(data,context.uid,key));let page=await archive.page({},context,key);assert.equal(page.reports.length,1);assert.equal(page.reports[0].status,'failed')
 const expires=page.reports[0].expiresAt;now+=1000;assert.equal((await service(data,context.uid,key)).duplicate,false);assert.equal((await service(data,context.uid,key)).duplicate,true)
 page=await archive.page({},context,key);assert.equal(page.reports.length,1);assert.equal(page.reports[0].status,'success');assert.equal(page.reports[0].expiresAt,expires)
})
test('audit storage failure prevents PDF bytes returning; capture failure prevents mock sender dispatch',async()=>{
 const store=new Store(),archive=new ReportArchive(store),id=randomUUID();await archive.capture(input(),pdf(),id,'mock');await archive.update(id,'failed','mock-failed')
 const write=store.write.bind(store);store.write=async(n,...args)=>{if(n.startsWith('access/'))throw Error('synthetic audit failure');return write(n,...args)}
 await assert.rejects(archive.download({id},context,key))
 let sends=0;const service=createSubmissionService({send:async()=>{sends++}},Date.now,async()=>pdf(),{capture:async()=>{throw Error()},update:async()=>{}})
 await assert.rejects(service(input(),context.uid,key));assert.equal(sends,0)
})
test('live Gmail acceptance and uncertain failure archive correct states without duplicate sends',async()=>{
 const {prepareMailTicket,createLiveService}=require('../lib/functions/src/live-service'),{Conflict}=require('../lib/functions/src/mail-state')
 class State{constructor(){this.m=new Map();this.n=0}async read(n){return structuredClone(this.m.get(n)||null)}async write(n,v,g){if((this.m.get(n)?.generation||'0')!==g)throw new Conflict();const next=String(++this.n);this.m.set(n,{value:structuredClone(v),generation:next});return next}}
 const now=Date.now(),cfg={projectId:'yingyangtest',mode:'gmail-test',sender:'synthetic@gmail.com',recipient:'synthetic@naver.com',allowSendUntil:new Date(now+600000).toISOString(),client_id:'synthetic.apps.googleusercontent.com',client_secret:'synthetic'},data={...input(),consent:{personal:true,sensitive:true,synthetic:true,version:'staging-e-draft-1'}}
 for(const uncertain of [false,true]){
  const store=new Store(),archive=new ReportArchive(store,()=>now),state=new State();let sends=0
  const request={submission:{...data,requestId:randomUUID()}};request.ticket=prepareMailTicket(request.submission,context.uid,cfg,key,now).ticket
  const service=createLiveService(state,async()=>{sends++;if(uncertain)throw Error('synthetic')},async()=>'synthetic-token',()=>now,async()=>pdf(),archive)
  if(uncertain){await assert.rejects(service(request,context.uid,cfg,key),e=>e.outcomeUnknown===true);await assert.rejects(service(request,context.uid,cfg,key),e=>e.outcomeUnknown===true)}else{assert.equal((await service(request,context.uid,cfg,key)).duplicate,false);assert.equal((await service(request,context.uid,cfg,key)).duplicate,true)}
  const row=(await archive.page({},context,key)).reports[0];assert.equal(row.status,uncertain?'failed':'success');assert.equal(row.errorCode,uncertain?'outcome-unknown':'');assert.equal(sends,1)
 }
})
test('terminal archive status failure never turns accepted Gmail into an automatic resend',async()=>{
 const {prepareMailTicket,createLiveService}=require('../lib/functions/src/live-service')
 const now=Date.now(),cfg={projectId:'yingyangtest',mode:'gmail-test',sender:'synthetic@gmail.com',recipient:'synthetic@naver.com',allowSendUntil:new Date(now+600000).toISOString(),client_id:'synthetic.apps.googleusercontent.com',client_secret:'synthetic'},data={...input(),consent:{personal:true,sensitive:true,synthetic:true,version:'staging-e-draft-1'}}
 const memory=new Map();let serial=0,sends=0
 const state={read:async n=>structuredClone(memory.get(n)||null),write:async(n,v)=>{const g=String(++serial);memory.set(n,{value:structuredClone(v),generation:g});return g}}
 const archive={capture:async()=>{},update:async()=>{throw Error('synthetic archive status outage')}}
 const request={submission:data,ticket:prepareMailTicket(data,context.uid,cfg,key,now).ticket},service=createLiveService(state,async()=>{sends++},async()=>'synthetic',()=>now,async()=>pdf(),archive)
 assert.equal((await service(request,context.uid,cfg,key)).status,'gmail-accepted');assert.equal((await service(request,context.uid,cfg,key)).duplicate,true);assert.equal(sends,1)
})

const {test,mock}=require('node:test'),assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto')
const {DriveBackup,BackupError,drivePrefix}=require('../lib/functions/src/drive-backup'),{Conflict}=require('../lib/functions/src/mail-state')
const {GoogleDriveUpload,driveAccess}=require('../lib/functions/src/drive-api')
class Store{constructor(){this.data=new Map();this.seq=0}async read(k){return structuredClone(this.data.get(k)||null)}async write(k,value,g){if((this.data.get(k)?.generation||'0')!==g)throw new Conflict();const generation=String(++this.seq);this.data.set(k,{value:structuredClone(value),generation});return generation}}
function setup(){let now=Date.parse('2026-11-01T00:00:00Z'),config={enabled:true,mode:'mock',folderId:'virtual-private-folder',startAt:now-1,revision:'1'},creates=0,ids=0,folderOk=true,fail,uploads=new Map(),buffers=[];const store=new Store(),id=randomUUID(),pdf=Buffer.from('%PDF-virtual-only'),filename='261101_가상테스터_1234.pdf';let exists=true,generation='100'
 const source=async()=>{if(!exists)return null;const bytes=Buffer.from(pdf);buffers.push(bytes);return {bytes,filename,generation,createdAt:Date.parse('2026-11-01T00:00:00Z'),expiresAt:Date.parse('2026-11-08T00:00:00Z')}}
 const drive={checkFolder:async()=>{if(!folderOk)throw new BackupError('permission')},generateId:async()=>{ids++;return 'virtual-file-'+ids},get:async id=>uploads.get(id)||null,create:async(id,folderId,name,bytes)=>{creates++;if(fail==='before')throw new BackupError('transient');if(fail==='auth')throw new BackupError('authorization');uploads.set(id,{id,name,parents:[folderId],md5Checksum:createHash('md5').update(bytes).digest('hex'),size:String(bytes.length)});if(fail==='after')throw new BackupError('transient')}}
 const make=()=>new DriveBackup(store,source,async()=>config,async()=>drive,()=>now)
 return {store,id,make,uploads,buffers,drive,get creates(){return creates},get ids(){return ids},advance:n=>now+=n,set config(c){config={...config,...c}},set fail(v){fail=v},set exists(v){exists=v},set generation(v){generation=v},set folderOk(v){folderOk=v}}
}
test('new PDF backed up once across duplicate events, process restart and seven-day source expiry; no identity in state',async()=>{
 const x=setup();assert.equal((await x.make().run(x.id)).status,'succeeded');assert.equal((await x.make().run(x.id)).duplicate,true)
 x.exists=false;x.advance(8*86400000);assert.equal((await x.make().run(x.id)).duplicate,true);assert.equal(x.creates,1);assert.equal(x.ids,1)
 const states=JSON.stringify([...x.store.data]);for(const secret of ['가상','0100000','%PDF','filename'])assert.ok(!states.includes(secret));assert.ok(x.buffers.every(b=>b.every(v=>v===0)))
})
test('same ID resolves upload success followed by lost response without duplicate file or second create',async()=>{
 const x=setup();x.fail='after';assert.equal((await x.make().run(x.id)).status,'retry-wait');x.fail=undefined;x.advance(60000)
 assert.equal((await x.make().run(x.id)).status,'succeeded');assert.equal(x.creates,1);assert.equal(x.ids,1)
})
test('failed state acknowledgement after successful upload still resolves persisted file ID',async()=>{
 const x=setup(),write=x.store.write.bind(x.store);let failed=false;x.store.write=async(k,v,g)=>{if(v.status==='succeeded'&&!failed){failed=true;throw Error('Synthetic ack failure')}return write(k,v,g)}
 assert.equal((await x.make().run(x.id)).status,'retry-wait');x.advance(60000);assert.equal((await x.make().run(x.id)).status,'succeeded');assert.equal(x.creates,1)
})
test('concurrent workers reserve a single shared job',async()=>{
 const x=setup(),out=await Promise.allSettled([x.make().run(x.id),x.make().run(x.id)]);assert.equal(out.filter(x=>x.status==='fulfilled').length,1);assert.equal(x.creates,1)
})
test('disabled, existing old sources and expired source never upload',async()=>{
 const x=setup();x.config={enabled:false};assert.equal((await x.make().run(x.id)).status,'off');x.config={enabled:true,startAt:Date.parse('2026-11-02')};assert.equal((await x.make().run(x.id)).status,'excluded-existing');assert.equal(x.creates,0)
 const y=setup();y.exists=false;assert.equal((await y.make().run(y.id)).status,'source-expired');assert.equal(y.creates,0)
})
test('folder permission changes fail closed; authorization retry is explicit and no deletion API exists',async()=>{
 const x=setup();x.folderOk=false;assert.equal((await x.make().run(x.id)).status,'failed');assert.equal(x.creates,0)
 const y=setup();y.fail='auth';assert.equal((await y.make().run(y.id)).status,'reauthorization-required');assert.equal((await y.make().run(y.id)).status,'reauthorization-required');y.fail=undefined;assert.equal((await y.make().retry(y.id)).status,'succeeded')
 assert.equal(typeof y.drive.delete,'undefined');assert.equal(typeof y.make().delete,'undefined')
})
test('retry uses original ID, respects backoff and five-attempt cap; source generation change cannot overwrite',async()=>{
 const x=setup();x.fail='before';await x.make().run(x.id);await assert.rejects(x.make().run(x.id),{code:'conflict'});for(let i=0;i<5;i++){x.advance(4000000);await x.make().run(x.id)}assert.equal(x.creates,5);assert.equal(x.ids,1)
 const y=setup();y.fail='before';await y.make().run(y.id);y.advance(60000);y.generation='101';assert.equal((await y.make().run(y.id)).status,'source-changed');assert.equal(y.creates,1)
})
test('source expiry while waiting and tampered existing remote file never trigger replacement',async()=>{
 const x=setup();x.fail='before';await x.make().run(x.id);x.exists=false;x.advance(60000);assert.equal((await x.make().run(x.id)).status,'source-expired');assert.equal(x.creates,1)
 const y=setup();y.fail='after';await y.make().run(y.id);[...y.uploads.values()][0].md5Checksum='bad';y.advance(60000);assert.equal((await y.make().run(y.id)).status,'failed');assert.equal(y.creates,1)
})
test('backup failure does not change completed mail receipt or invoke the sender again',async()=>{
 const {createSubmissionService}=require('../lib/functions/src/service'),x=setup();let sent=0
 const mail=createSubmissionService({send:async()=>sent++},Date.now,async()=>Buffer.from('%PDF-virtual'))
 const input={requestId:randomUUID(),version:1,name:'가상테스터',phone:'01000001234',acquired:Array(10).fill(1),innate:Array(40).fill(2),consent:{personal:true,sensitive:true,synthetic:true,version:'staging-clinic-submission-4'},scenario:'success'}
 const receipt=await mail(input,'virtual','virtual-key');x.fail='auth';assert.equal((await x.make().run(x.id)).status,'reauthorization-required')
 assert.equal(receipt.status,'mock-completed');assert.equal((await mail(input,'virtual','virtual-key')).duplicate,true);assert.equal(sent,1)
})
test('Google adapter only POSTs OAuth/upload and GETs metadata, with fixed private owner and folder',async()=>{
 const requests=[];mock.method(global,'fetch',async(url,init={})=>{requests.push({url:String(url),method:init.method||'GET'});if(String(url).includes('oauth2'))return Response.json({access_token:'synthetic',scope:'https://www.googleapis.com/auth/drive.file'});if(String(url).includes('generateIds'))return Response.json({ids:['virtual-created-id']});if(String(url).includes('upload/'))return Response.json({id:'virtual-created-id'});return Response.json({name:'YingYang_검진결과_백업',mimeType:'application/vnd.google-apps.folder',shared:false,owners:[{emailAddress:'ukclinic.official@gmail.com'}],capabilities:{canAddChildren:true},permissions:[{type:'user',role:'owner',emailAddress:'ukclinic.official@gmail.com'}]})})
 try{const token=await driveAccess({projectId:'yingyangtest',ownerEmail:'ukclinic.official@gmail.com',client_id:'495270334718-virtual.apps.googleusercontent.com',client_secret:'synthetic',refresh_token:'synthetic'},'yingyangtest'),drive=new GoogleDriveUpload(token);await drive.checkFolder('virtual-private-folder');const id=await drive.generateId();await drive.create(id,'virtual-private-folder','261101_가상테스터_1234.pdf',Buffer.from('%PDF-test'));assert.ok(requests.every(r=>['GET','POST'].includes(r.method)));assert.ok(!requests.some(r=>r.url.includes('/permissions')))}finally{mock.restoreAll()}
})
test('Staging backup callable rejects ordinary admin, missing App Check, stale master and delete requests',async()=>{
 process.env.GCLOUD_PROJECT='yingyangtest'
 const {createDriveAdmin}=require('../lib/functions/src/staging-drive')
 const request=(data)=>({data,auth:{uid:'virtual-master',token:{auth_time:Math.floor(Date.now()/1000)}},app:{appId:'virtual'},rawRequest:{rawBody:Buffer.alloc(0)}})
 const admin=createDriveAdmin(async()=>({role:'admin'})),master=createDriveAdmin(async()=>({role:'master'}))
 await assert.rejects(admin.run(request({action:'status'})),e=>e.code==='permission-denied')
 await assert.rejects(master.run({...request({action:'status'}),app:undefined}),e=>e.code==='permission-denied')
 await assert.rejects(master.run(request({action:'delete',id:randomUUID()})),e=>e.code==='invalid-argument')
 await assert.rejects(master.run({...request({action:'retry',id:randomUUID()}),auth:{uid:'virtual',token:{auth_time:1}}}),e=>e.code==='failed-precondition')
 process.env.GCLOUD_PROJECT='yingyangcheck';await assert.rejects(master.run(request({action:'status'})),e=>e.code==='permission-denied')
})

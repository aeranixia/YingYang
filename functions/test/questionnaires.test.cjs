const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto')
const {validateSubmission,calculate}=require('../lib/functions/src/submission')
const {issuePrivacy,privacyVersion}=require('../lib/functions/src/privacy')
const {confirmCompletion,completionDate}=require('../lib/functions/src/completion')
const {createPdf}=require('../lib/functions/src/pdf')
const {readBooks,manageBooks,requireBook}=require('../lib/functions/src/book-policy')
const {ReportArchive,ArchiveConflict}=require('../lib/functions/src/admin-reports')
const {createSubmissionService}=require('../lib/functions/src/service')
const key='virtual-questionnaire-key-at-least-32-characters',uid='virtual-tester',at=Date.parse('2026-11-09T14:59:00Z')
const input=()=>({requestId:randomUUID(),version:2,questionnaire:'sasang-80',name:'가상테스터',phone:'01000001234',acquired:Array(40).fill(1),innate:[10,7,4,1].flatMap(n=>[...Array(n).fill(1),...Array(10-n).fill(0)]),consent:{personal:true,sensitive:true,synthetic:true,version:'staging-clinic-submission-4'},scenario:'success'})
class State{constructor(){this.items=new Map();this.n=0}async read(k){return structuredClone(this.items.get(k)||null)}async write(k,value,g){if((this.items.get(k)?.generation||'0')!==g)throw Error('CAS conflict');const generation=String(++this.n);this.items.set(k,{value:structuredClone(value),generation});return generation}}
class Archive{constructor(){this.items=new Map();this.n=0}async read(k){const v=this.items.get(k);return v?{...v,bytes:Buffer.from(v.bytes)}:null}async write(k,bytes,type,g,filename){if((this.items.get(k)?.generation||'0')!==g)throw new ArchiveConflict();this.items.set(k,{bytes:Buffer.from(bytes),generation:String(++this.n),filename})}async remove(k){this.items.delete(k)}async list(prefix){return {names:[...this.items.keys()].filter(k=>k.startsWith(prefix))}}}
test('80-question validation is strict, independent of legacy ranges, and scores match original grouping',()=>{
 const x=validateSubmission(input());assert.deepEqual(calculate(x).innate,[['태양',10],['태음',7],['소양',4],['소음',1]])
 assert.deepEqual(calculate(x).acquired.map(([,n])=>n),[10,10,10,10])
 for(const change of [{version:1},{questionnaire:undefined},{questionnaire:'unknown'},{acquired:Array(10).fill(1)},{innate:Array(40).fill(2)},{innate:Array(40).fill(null)},{recipient:'other@example.invalid'}])assert.throws(()=>validateSubmission({...x,...change}))
})
test('completion proof includes book scope and preserves KST time across reload without mixing versions',()=>{
 const x=input(),receipt=issuePrivacy({action:'consent-privacy',version:privacyVersion,personal:true,sensitive:true},uid,key,at)
 const done=confirmCompletion({action:'confirm-completion',questionnaire:x.questionnaire,acquired:x.acquired,innate:x.innate,nonce:randomUUID(),privacyProof:receipt.proof,expires:receipt.expires},uid,key,at)
 assert.equal(completionDate({...x,completionProof:done.proof},uid,key,at+60000).getTime(),at)
 assert.throws(()=>completionDate({...x,questionnaire:undefined,completionProof:done.proof},uid,key,at+60000))
})
test('book activation defaults new-only, requires recent master, CAS and at least one active book',async()=>{
 const store=new State();assert.deepEqual(await readBooks(store),{currentEnabled:true,legacyEnabled:false,revision:''})
 await assert.rejects(requireBook(store,{version:1}));await requireBook(store,{version:2,questionnaire:'sasang-80'})
 await assert.rejects(manageBooks(store,{},'admin',at/1000,at))
 await assert.rejects(manageBooks(store,{currentEnabled:true,legacyEnabled:true,revision:''},'master',at/1000-301,at))
 await assert.rejects(manageBooks(store,{currentEnabled:false,legacyEnabled:false,revision:''},'master',at/1000,at))
 const result=await manageBooks(store,{currentEnabled:true,legacyEnabled:true,revision:''},'master',at/1000,at)
 await requireBook(store,{version:1});assert.ok(result.books.revision)
 await assert.rejects(manageBooks(store,{currentEnabled:true,legacyEnabled:false,revision:''},'master',at/1000,at))
})
test('new PDF is one A4 page with two horizontal score tables and three diamond charts, Korean and date',async()=>{
 const bytes=await createPdf(input(),new Date(at),'production'),{getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs')
 const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false}),pdf=await task.promise
 try{assert.equal(pdf.numPages,1);const page=await pdf.getPage(1),items=(await page.getTextContent()).items.filter(i=>i.str);const text=items.map(i=>i.str).join(' ')
 for(const value of ['체질검사 결과','선천적 사상체질','후천적 사상페르소나','선천적·후천적 비교','가상테스터','01000001234','2026-11-09 23:59','공동 최고점','합산하지'])assert.ok(text.includes(value),value)
 for(const i of items){assert.ok(i.transform[4]>=0&&i.transform[4]+i.width<=596,i.str);assert.ok(i.transform[5]>=0&&i.transform[5]<=842,i.str)}
 assert.equal(items.filter(i=>i.str==='선천적·후천적 비교').length,1)
 }finally{await task.destroy();bytes.fill(0)}
})
test('80-question mock PDF, seven-day details and archive are versioned; duplicates never send twice',async()=>{
 let now=at,sends=0;const store=new Archive(),archive=new ReportArchive(store,()=>now),x=input(),service=createSubmissionService({send:async()=>sends++},()=>now,async()=>Buffer.from('%PDF-virtual'),archive)
 await service(x,uid,key);assert.equal((await service(x,uid,key)).duplicate,true);assert.equal(sends,1)
 const ctx={project:'yingyangtest',uid:'virtual-admin',app:true,role:'admin'},page=await archive.page({},ctx,key),id=page.reports[0].id
 assert.equal(page.reports[0].questionnaire,'sasang-80');assert.equal(JSON.stringify(page).includes('acquired'),false)
 const detail=await archive.detail({action:'detail',id},ctx,key);assert.deepEqual(detail.innate,x.innate);assert.deepEqual(detail.scores,calculate(x))
 await assert.rejects(archive.detail({action:'detail',id},{...ctx,app:false},key))
 const log=store.items.get('logs/'+id+'.json').bytes.toString();assert.ok(!log.includes(x.name));assert.ok(!log.includes(x.phone));assert.ok(!log.includes('innate'))
 now+=7*86400000;await assert.rejects(archive.detail({action:'detail',id},ctx,key));assert.equal(sends,1)
})

test('new report PDF is valid for existing email MIME and Drive duplicate-safe upload without an actual email',async()=>{
 const {composeProductionMail}=require('../lib/functions/src/production-mail'),{attachmentName}=require('../lib/functions/src/submission'),{DriveBackup}=require('../lib/functions/src/drive-backup'),{createHash}=require('node:crypto')
 const x=input(),bytes=await createPdf(x,new Date(at)),filename=attachmentName(x,new Date(at)),mail=await composeProductionMail({enabled:true,projectId:'yingyangcheck',mode:'production',sender:'virtual@gmail.com',recipient:'virtual@example.invalid',client_id:'231582543863-virtual.apps.googleusercontent.com',client_secret:'synthetic',refresh_token:'synthetic'},{filename,content:bytes},randomUUID())
 assert.ok(mail.toString().includes('application/pdf'));assert.ok(mail.toString().includes('To: virtual@example.invalid'));assert.ok(!/^Bcc:|^Cc:/mi.test(mail.toString()));mail.fill(0)
 const state=new State(),files=new Map(),id=randomUUID();let uploads=0
 const adapter={checkFolder:async()=>{},generateId:async()=> 'virtual-drive-file-id',get:async id=>files.get(id)||null,create:async(id,folder,name,content)=>{uploads++;files.set(id,{id,name,parents:[folder],md5Checksum:createHash('md5').update(content).digest('hex'),size:String(content.length)})}}
 const backup=new DriveBackup(state,async()=>({bytes:Buffer.from(bytes),filename,generation:'1',createdAt:at,expiresAt:at+7*86400000}),async()=>({enabled:true,mode:'mock',folderId:'virtual-folder-id',revision:'1',startAt:at}),async()=>adapter,()=>at)
 assert.equal((await backup.run(id)).status,'succeeded');assert.equal((await backup.run(id)).duplicate,true);assert.equal(uploads,1);assert.equal(files.get('virtual-drive-file-id').name,filename);bytes.fill(0)
})

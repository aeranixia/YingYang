const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto')
const {confirmCompletion,completionDate}=require('../lib/functions/src/completion')
const {formatCompletion,createPdf}=require('../lib/functions/src/pdf')
const {createSubmissionService}=require('../lib/functions/src/service')
const {issuePrivacy}=require('../lib/functions/src/privacy')
const key='synthetic-signing-key-for-completion-tests',at=Date.parse('2026-10-26T15:07:00Z')
const answers=()=>({acquired:[1,2,3,4,1,2,3,4,1,2],innate:Array(40).fill(2)})
const confirm=(data=answers())=>confirmCompletion({...data,action:'confirm-completion',nonce:randomUUID(),privacyProof:issuePrivacy({action:'consent-privacy',personal:true,sensitive:true,version:'staging-clinic-privacy-2'},'tester',key,at).proof,expires:at+7*86400000},'tester',key,at).proof

test('KST completion proof uses server time across midnight, not generation or resend time',async()=>{
 const input={...answers(),completionProof:confirm()}
 assert.equal(formatCompletion(completionDate(input,'tester',key,at+86400000)),'2026-10-27 00:07')
 assert.equal(completionDate(answers(),'tester',key,at),null)
 assert.match(formatCompletion(null),/기록 없음/)
 for(const change of [x=>x.completionProof+='x',x=>x.acquired[0]=4,x=>x.innate[0]=0]){
  const data={...answers(),completionProof:confirm()};change(data);assert.throws(()=>completionDate(data,'tester',key,at))
 }
 assert.throws(()=>completionDate(input,'another-user',key,at))
 assert.throws(()=>completionDate(input,'tester','wrong-key',at))
 assert.throws(()=>completionDate(input,'tester',key,at-1))
 const decoded=JSON.parse(Buffer.from(input.completionProof.split('.')[0],'base64url'))
 decoded.at+=60000
 const forged=Buffer.from(JSON.stringify(decoded)).toString('base64url')+'.'+input.completionProof.split('.')[1]
 assert.throws(()=>completionDate({...input,completionProof:forged},'tester',key,at+60000))
})

test('completion confirmation rejects partial answers and client timestamp fields',()=>{
 for(const mutate of [x=>x.acquired.pop(),x=>x.innate[1]=3,x=>x.acquired[0]=null,x=>x.at=at,x=>x.nonce='bad',x=>x.action='other']){
  const data={...answers(),action:'confirm-completion',nonce:randomUUID()};mutate(data);assert.throws(()=>confirmCompletion(data,'tester',key,at))
 }
})

test('mock PDF service verifies completion proof before processing and retains confirmed time',async()=>{
 let date,called=0
 const service=createSubmissionService({send:async()=>{called++}},()=>at+3600000,async(input,time)=>{date=time;return Buffer.from('%PDF-test')})
 const input={...answers(),completionProof:confirm(),requestId:randomUUID(),version:1,name:'가상테스터',phone:'01000001234',consent:{personal:true,sensitive:true,synthetic:true,version:'staging-bc-draft-1'},scenario:'success'}
 await service(input,'tester',key);assert.equal(date.getTime(),at)
 await assert.rejects(service({...input,requestId:randomUUID(),completionProof:input.completionProof+'x'},'tester',key))
 assert.equal(called,1)
})

test('PDF layout has aligned side-by-side tables, large fonts, bounded text and unknown legacy time',async()=>{
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs')
 for(const time of [new Date(at),null]){
  const bytes=await createPdf({...answers(),name:'테스트환자',phone:'01000005678'},time)
  const load=getDocument({data:new Uint8Array(bytes),isEvalSupported:false}),pdf=await load.promise
  assert.equal(pdf.numPages,1)
  const page=await pdf.getPage(1),items=(await page.getTextContent({disableNormalization:true})).items.filter(x=>x.str)
  const left=items.find(x=>x.str==='후천적 체질'),right=items.find(x=>x.str==='타고난 체질')
  assert.equal(left.transform[5],right.transform[5]);assert.ok(right.transform[4]>left.transform[4]+200)
  assert.ok(left.height>=20)
  for(const item of items){assert.ok(item.transform[4]>=39,item.str);assert.ok(item.transform[4]+item.width<=page.view[2]-35,item.str);assert.ok(item.transform[5]>=25&&item.transform[5]<=page.view[3]-25,item.str)}
  const text=items.map(x=>x.str).join(' ')
  assert.ok(text.includes(time?'2026-10-27 00:07':'기록 없음'));for(const value of ['①','②','③','④','10회','80점','테스트환자','01000005678'])assert.ok(text.includes(value),value)
  await load.destroy();bytes.fill(0)
 }
})

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { validateSubmission, calculate, attachmentName, InputError } = require('../lib/functions/src/submission')
const { createPdf } = require('../lib/functions/src/pdf')
const { createSubmissionService } = require('../lib/functions/src/service')
const { mockSender } = require('../lib/functions/src/sender')
const input = () => ({ requestId: randomUUID(), version: 1, name: '가상테스터', phone: '01000001234', acquired: [1,2,3,4,1,2,3,4,1,2], innate: Array(40).fill(2), consent: { personal: true, sensitive: true, synthetic: true, version: 'staging-clinic-submission-4' }, scenario: 'success' })
const key = 'test-only-key-not-a-real-secret'

test('reject malformed identity, consents, versions, answers and recipient injection', () => {
 const mutations = [x => { x.name='홍길동' }, x => { x.name='../가상테스터' }, x => { x.phone='01012345678' }, x => { x.version=2 }, x => { x.requestId='bad' }, x => { x.consent.personal=false }, x => { x.consent.sensitive=false }, x => { x.consent.synthetic=false }, x => { x.consent.version='approved' }, x => { x.acquired.pop() }, x => { x.innate.push(1) }, x => { x.acquired[0]=0 }, x => { x.innate[0]=3 }, x => { x.innate[1]=1.5 }, x => { x.innate[0]=null }, x => { delete x.innate[0] }, x => { x.recipient='injected@example.invalid' }, x => { x.scores=[999] }, x => { x.scenario='live' }, x => { x.consent.extra=true }]
 for(const mutate of mutations) { const data=input();mutate(data);assert.throws(()=>validateSubmission(data),InputError) }
 for(const data of [null, [], 'body', 1, {}]) assert.throws(()=>validateSubmission(data),InputError)
 assert.equal(validateSubmission(input()).name,'가상테스터')
})

test('server recalculates exact counts and original classification totals', () => {
 const scores=calculate(input())
 assert.deepEqual(scores.acquired,[['①',3],['②',3],['③',2],['④',2]])
 assert.deepEqual(scores.innate,[['가',22],['나',20],['다',20],['라',18]])
 const data=input();data.innate.fill(0);assert.deepEqual(calculate(data).innate.map(x=>x[1]),[0,0,0,0])
})

test('safe attachment name includes only name and phone last four', () => {
 assert.equal(attachmentName(input(),new Date('2026-11-01T00:00:00Z')),'261101_가상테스터_1234.pdf')
 assert.equal(attachmentName({name:'../가상\n테스터',phone:'01000005678'},new Date('2026-11-01T00:00:00Z')),'261101_가상테스터_5678.pdf')
 assert.throws(()=>attachmentName({name:'../',phone:'1234'}),InputError)
})

test('A4 one-page PDF embeds Korean, symbols, dates and both score tables', async () => {
 const { getDocument }=await import('pdfjs-dist/legacy/build/pdf.mjs')
 const bytes=await createPdf(input(),new Date('2026-10-26T15:30:00Z'))
 assert.equal(bytes.subarray(0,5).toString(),'%PDF-')
 const loading=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false})
 const pdf=await loading.promise
 assert.equal(pdf.numPages,1)
 assert.equal((await pdf.getMetadata()).info.Title,'체질검사 결과')
 const page=await pdf.getPage(1), text=(await page.getTextContent({disableNormalization:true})).items.map(x=>x.str).join(' ')
 for(const value of ['가상테스터','01000001234','2026-10-27','후천적 체질','타고난 체질','①','②','③','④','가','나','다','라','10회','80점','체질 판정을 제공하지 않습니다']) assert.ok(text.includes(value),value)
 assert.ok(Math.abs(page.view[2]-595.28)<1);assert.ok(Math.abs(page.view[3]-841.89)<1)
 await loading.destroy();bytes.fill(0)
})

test('mock sender receives PDF and safe filename; buffer discarded, receipt contains no identity or score', async () => {
 let buffer, filename
 const service=createSubmissionService({send:async a=>{buffer=a.content;filename=a.filename;assert.ok(a.content.length>1000)}})
 const data=input(),result=await service(data,'tester',key)
 assert.match(filename,/^\d{6}_가상테스터_1234\.pdf$/);assert.ok(buffer.every(x=>x===0))
 assert.deepEqual(result,{status:'mock-completed',requestId:data.requestId,duplicate:false})
})

test('retry known mock failure with same ID, completed duplicate skips send; changed payload rejected', async () => {
 let calls=0
 const service=createSubmissionService({send:async(a,o)=>{calls++;await mockSender.send(a,o)}})
 const data=input();data.scenario='fail-once'
 await assert.rejects(service(data,'tester',key),{code:'unavailable'})
 assert.equal((await service(data,'tester',key)).duplicate,false)
 assert.equal((await service(data,'tester',key)).duplicate,true);assert.equal(calls,2)
 await assert.rejects(service({...data,name:'테스트환자'},'tester',key),{code:'already-exists'})
})

test('concurrent duplicate is blocked and failed PDF buffer is cleared', async () => {
 let release;const waiting=new Promise(r=>{release=r}),data=input()
 const service=createSubmissionService({send:async()=>{await waiting}})
 const first=service(data,'tester',key)
 await assert.rejects(service(data,'tester',key),{code:'aborted'});release();await first
 let buffer
 const failed=createSubmissionService({send:async a=>{buffer=a.content;throw Error('private error')}})
 for(let i=0;i<3;i++) await assert.rejects(failed(data,'tester',key),{code:'unavailable'})
 assert.ok(buffer.every(x=>x===0));await assert.rejects(failed(data,'tester',key),{code:'resource-exhausted'})
})

test('memory receipt TTL and local daily budget are bounded; neither survives restart', async () => {
 let now=100000;const pdf=async()=>Buffer.from('%PDF-test'),service=createSubmissionService({send:async()=>{}},()=>now,pdf),data=input()
 await service(data,'tester',key);assert.equal((await service(data,'tester',key)).duplicate,true)
 now+=600001;assert.equal((await service(data,'tester',key)).duplicate,false)
 for(let i=0;i<48;i++) await service(input(),'tester',key)
 await assert.rejects(service(input(),'tester',key),{code:'resource-exhausted'})
 now+=86400000;await service(input(),'tester',key)
 assert.equal((await createSubmissionService(mockSender,()=>now,pdf)(data,'tester',key)).duplicate,false)
})

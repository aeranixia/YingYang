const { test } = require('node:test')
const assert = require('node:assert/strict')
const { fork } = require('node:child_process')
const { once } = require('node:events')
const { randomUUID } = require('node:crypto')
const { join } = require('node:path')
const { createSubmissionService } = require('../lib/functions/src/service')
const input = () => ({ requestId:randomUUID(),version:1,name:'가상테스터',phone:'01000001234',acquired:Array(10).fill(1),innate:Array(40).fill(0),consent:{personal:true,sensitive:true,synthetic:true,version:'staging-clinic-submission-2'},scenario:'success' })
function start(hang = false) { return fork(join(__dirname,'helpers/process-worker.cjs'),[],{env:{...process.env,TEST_HANG:hang?'1':'0'},stdio:['ignore','ignore','ignore','ipc']}) }
function result(child, data, started = false) { return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{child.off('message',receive);reject(Error('Local worker response deadline'))},3000)
 function receive(message){if(started?message.started:message.status){clearTimeout(timer);child.off('message',receive);resolve(message)}}
 child.on('message',receive);child.send(data)
}) }
async function stop(child){const exited=once(child,'exit');child.kill();await exited}
test('local process kill loses receipts; restarted service treats same ID as new',async()=>{
 const data=input();let child=start()
 try{assert.equal((await result(child,data)).duplicate,false);assert.equal((await result(child,data)).duplicate,true)}finally{await stop(child)}
 child=start();try{assert.equal((await result(child,data)).duplicate,false)}finally{await stop(child)}
})
test('local worker stuck in PDF stage can be terminated; restart does not retain in-progress reservation',async()=>{
 const data=input(),hung=start(true);try{await result(hung,data,true)}finally{await stop(hung)}
 const restarted=start();try{assert.equal((await result(restarted,data)).status,'mock-completed')}finally{await stop(restarted)}
})
test('bounded local burst accepts one in-flight ID and refuses nine concurrent duplicates',async()=>{
 let release;const blocked=new Promise(r=>{release=r});let sends=0
 const service=createSubmissionService({send:async()=>{sends++;await blocked}},Date.now,async()=>Buffer.from('%PDF-test'))
 const data=input(),first=service(data,'tester','test-key')
 const outcomes=await Promise.allSettled(Array.from({length:9},()=>service(data,'tester','test-key')))
 assert.ok(outcomes.every(x=>x.status==='rejected'&&x.reason.code==='aborted'))
 release();await first;assert.equal(sends,1)
})
test('PDF-stage exception is sanitized and allows a known failed operation to retry',async()=>{
 let calls=0
 const service=createSubmissionService({send:async()=>{}},Date.now,async()=>{if(++calls===1)throw Error('synthetic confidential payload');return Buffer.from('%PDF-test')})
 const data=input();await assert.rejects(service(data,'tester','test-key'),e=>e.code==='unavailable'&&!e.message.includes('confidential'))
 assert.equal((await service(data,'tester','test-key')).status,'mock-completed')
})

import { createHash, randomUUID } from 'node:crypto'
import { onCall, HttpsError, type CallableOptions, type CallableRequest } from 'firebase-functions/v2/https'
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { GcsStateStore, runtimeToken, type StateStore } from './mail-state'
import { GcsArchiveStore, adminBucket } from './admin-reports'
import { DriveBackup, BackupError, driveOwner, driveFolderName, drivePrefix, validReportId, validateDriveConfig, type DriveConfig, type DriveJob, type DriveUpload } from './drive-backup'
import { GoogleDriveUpload, driveAccess } from './drive-api'

const bucket='yingyangtest-mail-state-495270334718'
const state=new GcsStateStore(bucket),archive=new GcsArchiveStore()
const options:CallableOptions={region:'asia-northeast3',serviceAccount:'yingyang-staging-mail-runtime@yingyangtest.iam.gserviceaccount.com',minInstances:0,maxInstances:1,concurrency:1,memory:'512MiB',cpu:1,timeoutSeconds:120,enforceAppCheck:true,cors:['https://yingyangtest.web.app','https://yingyangtest.firebaseapp.com']}
const configPath=drivePrefix+'config'
export async function readDriveConfig():Promise<DriveConfig>{const stored=await state.read<DriveConfig>(configPath);return stored?validateDriveConfig(stored.value):{enabled:false,mode:'mock',folderId:'mock-folder-yingyang',startAt:0,revision:''}}
async function credential(){const r=await fetch('https://secretmanager.googleapis.com/v1/projects/yingyangtest/secrets/STAGING_DRIVE_CONFIG/versions/latest:access',{headers:{authorization:'Bearer '+await runtimeToken()},signal:AbortSignal.timeout(8000)});if(!r.ok)throw new BackupError('authorization');const b=await r.json() as {payload:{data:string}};return JSON.parse(Buffer.from(b.payload.data,'base64').toString())}
function mockUpload(store:StateStore):DriveUpload{
 return {
  checkFolder:async id=>{if(id!=='mock-folder-yingyang')throw new BackupError('permission')},generateId:async()=> 'mock_'+randomUUID(),
  get:async(id,name)=>{const r=await store.read<{parents:string[];md5Checksum:string;size:string;nameHash:string}>(drivePrefix+'mock/'+id);if(!r)return null;if(r.value.nameHash!==createHash('sha256').update(name).digest('hex'))throw new BackupError('permission');return {id,parents:r.value.parents,md5Checksum:r.value.md5Checksum,size:r.value.size,name}},
  create:async(id,folder,name,bytes)=>{await store.write(drivePrefix+'mock/'+id,{parents:[folder],md5Checksum:createHash('md5').update(bytes).digest('hex'),size:String(bytes.length),nameHash:createHash('sha256').update(name).digest('hex')},'0')},
 }
}
const backup=new DriveBackup(state,async id=>{
 const metadata=await archive.read('logs/'+id+'.json');if(!metadata)return null
 let report:{createdAt:number;expiresAt:number}
 try{report=JSON.parse(metadata.bytes.toString())}finally{metadata.bytes.fill(0)}
 if(!Number.isSafeInteger(report.createdAt)||!Number.isSafeInteger(report.expiresAt)||report.expiresAt!==report.createdAt+7*86400000||report.expiresAt<=Date.now())return null
 const pdf=await archive.read('pdf/'+id+'.pdf');if(!pdf)return null
 if(!pdf.filename){pdf.bytes.fill(0);return null}
 return {...pdf,filename:pdf.filename,createdAt:report.createdAt,expiresAt:report.expiresAt}
},readDriveConfig,async mode=>mode==='mock'?mockUpload(state):new GoogleDriveUpload(await driveAccess(await credential(),'yingyangtest')))

export function createDriveAdmin(authorize:(r:CallableRequest)=>Promise<{role:string}>){return onCall(options,async r=>{
 r.rawRequest.res?.setHeader('Cache-Control','no-store')
 if(process.env.GCLOUD_PROJECT!=='yingyangtest'||!r.auth||!r.app)throw new HttpsError('permission-denied','접근할 수 없습니다.')
 if(r.rawRequest.rawBody?.length>2048)throw new HttpsError('invalid-argument','요청을 확인해 주세요.')
 try{
  const role=await authorize(r);if(role.role!=='master')throw new HttpsError('permission-denied','마스터만 백업을 관리할 수 있습니다.')
  const data=r.data;if(!data||typeof data!=='object'||Array.isArray(data))throw new BackupError('invalid')
  const fields=Object.keys(data).sort().join(',')
  if(fields==='action'&&data.action==='status')return {config:await readDriveConfig(),owner:driveOwner,folderName:driveFolderName,retention:'unlimited',deletionAvailable:false}
  if(fields==='action,cursor'&&data.action==='list'){
   if(typeof data.cursor!=='string'||data.cursor.length>2048)throw new BackupError('invalid')
   const r=await fetch('https://storage.googleapis.com/storage/v1/b/'+bucket+'/o?prefix='+encodeURIComponent(drivePrefix+'jobs/')+'&maxResults=30'+(data.cursor?'&pageToken='+encodeURIComponent(data.cursor):''),{headers:{authorization:'Bearer '+await runtimeToken()},signal:AbortSignal.timeout(8000)});if(!r.ok)throw new BackupError('transient')
   const body=await r.json() as {items?:{name:string}[];nextPageToken?:string},jobs:DriveJob[]=[]
   for(const item of body.items||[]){const id=item.name.slice((drivePrefix+'jobs/').length);if(!validReportId(id))continue;const job=await state.read<DriveJob>(item.name);if(job)jobs.push(job.value)}
   return {jobs,nextCursor:body.nextPageToken||''}
  }
  const age=Date.now()/1000-Number(r.auth.token.auth_time)
  if(!Number.isFinite(age)||age<0||age>300)throw new HttpsError('failed-precondition','Google 본인 확인 후 다시 시도해 주세요.')
  if(fields==='action,enabled,folderId,mode,revision'&&data.action==='save'){
   const prior=await state.read<DriveConfig>(configPath),current=await readDriveConfig();if(data.revision!==current.revision)throw new BackupError('conflict')
   const c=validateDriveConfig({enabled:data.enabled,folderId:data.folderId,mode:data.mode,revision:randomUUID(),startAt:current.startAt||Date.now()})
   if(c.enabled){const drive=c.mode==='mock'?mockUpload(state):new GoogleDriveUpload(await driveAccess(await credential(),'yingyangtest'));await drive.checkFolder(c.folderId)}
   await state.write(configPath,c,prior?.generation||'0');return {config:c}
  }
  if(fields==='action,id'&&data.action==='retry'){return await backup.retry(data.id)}
  throw new BackupError('invalid')
 }catch(e){if(e instanceof HttpsError)throw e;if(e instanceof BackupError)throw new HttpsError(e.code==='conflict'?'aborted':e.code==='authorization'?'failed-precondition':e.code==='invalid'?'invalid-argument':'unavailable','백업 설정·인증 또는 처리 상태를 확인해 주세요.');throw new HttpsError('unavailable','백업 작업을 처리하지 못했습니다.')}
})}
export const stagingDriveBackup=onObjectFinalized({bucket:adminBucket,region:'asia-northeast3',serviceAccount:options.serviceAccount as string,minInstances:0,maxInstances:1,concurrency:1,memory:'512MiB',cpu:1,timeoutSeconds:120,retry:true},async event=>{
 if(process.env.GCLOUD_PROJECT!=='yingyangtest'||event.data.bucket!==adminBucket)return
 const match=/^pdf\/([a-f0-9-]{36})\.pdf$/.exec(event.data.name);if(!match||!validReportId(match[1]))return
 try{const result=await backup.run(match[1]);if(result.status==='retry-wait')throw new Error('Backup retry pending')}
 catch(e){if(e instanceof BackupError&&e.code!=='conflict'&&e.code!=='transient')return;throw new Error('Backup retry pending')}
})

import { createHash } from 'node:crypto'
import { Conflict, type StateStore } from './mail-state'
import { validReportName } from './report-name'

export const driveOwner='ukclinic.official@gmail.com'
export const driveFolderName='YingYang_검진결과_백업'
export const drivePrefix='v13/drive/'
export type DriveConfig={enabled:boolean;mode:'mock'|'google';folderId:string;startAt:number;revision:string}
export type DriveStatus='pending'|'uploading'|'succeeded'|'retry-wait'|'failed'|'reauthorization-required'|'source-expired'|'source-changed'
export type DriveJob={id:string;mode:'mock'|'google';status:DriveStatus;attempts:number;createdAt:number;updatedAt:number;nextAt:number;leaseUntil:number;sourceGeneration:string;sourceExpiresAt:number;md5:string;fileId?:string;error?:string}
export type BackupSource={bytes:Buffer;generation:string;filename:string;createdAt:number;expiresAt:number}
export type RemoteFile={id:string;parents:string[];md5Checksum:string;size:string;name:string;trashed?:boolean}
export interface DriveUpload {
 checkFolder(folderId:string):Promise<void>
 generateId():Promise<string>
 get(id:string,expectedName:string):Promise<RemoteFile|null>
 create(id:string,folderId:string,name:string,bytes:Buffer):Promise<void>
}
export class BackupError extends Error{constructor(public readonly code:'authorization'|'permission'|'quota'|'transient'|'invalid'|'conflict'){super(code)}}
export const validReportId=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)
function validJob(job:DriveJob,id:string){return job&&job.id===id&&['mock','google'].includes(job.mode)&&['pending','uploading','succeeded','retry-wait','failed','reauthorization-required','source-expired','source-changed'].includes(job.status)&&Number.isInteger(job.attempts)&&job.attempts>=1&&job.attempts<=5&&[job.createdAt,job.updatedAt,job.nextAt,job.leaseUntil,job.sourceExpiresAt].every(Number.isSafeInteger)&&/^\d+$/.test(job.sourceGeneration)&&/^[a-f0-9]{32}$/.test(job.md5)&&(!job.fileId||/^[A-Za-z0-9_-]{10,200}$/.test(job.fileId))}
export function validateDriveConfig(raw:unknown):DriveConfig{
 const c=raw as DriveConfig
 if(!c||Object.keys(c).sort().join(',')!=='enabled,folderId,mode,revision,startAt'||typeof c.enabled!=='boolean'||!['mock','google'].includes(c.mode)||typeof c.folderId!=='string'||c.folderId&&!/^[A-Za-z0-9_-]{10,200}$/.test(c.folderId)||c.enabled&&!c.folderId||!Number.isSafeInteger(c.startAt)||c.startAt<0||typeof c.revision!=='string')throw new BackupError('invalid')
 return c
}
export class DriveBackup {
 constructor(private store:StateStore,private source:(id:string)=>Promise<BackupSource|null>,private config:()=>Promise<DriveConfig>,private adapter:(mode:DriveConfig['mode'])=>Promise<DriveUpload>,private clock=Date.now){}
 async run(id:string){
  if(!validReportId(id))throw new BackupError('invalid')
  const c=validateDriveConfig(await this.config()),now=this.clock()
  if(!c.enabled)return {status:'off' as const}
  const path=drivePrefix+'jobs/'+id,prior=await this.store.read<DriveJob>(path)
  if(prior&&!validJob(prior.value,id))throw new BackupError('invalid')
  if(prior?.value.status==='succeeded')return {...prior.value,duplicate:true}
  if(prior&&(prior.value.leaseUntil>now||prior.value.nextAt>now))throw new BackupError('conflict')
  if(prior&&prior.value.mode!==c.mode)throw new BackupError('conflict')
  if(prior&&prior.value.attempts>=5)return prior.value
  if(prior&&['reauthorization-required','failed','source-expired','source-changed'].includes(prior.value.status))return prior.value
  const source=await this.source(id)
  if(!source){if(!prior)return {status:'source-expired' as const};const job={...prior.value,status:'source-expired' as const,updatedAt:now,leaseUntil:0};await this.store.write(path,job,prior.generation);return job}
  try{
   if(source.createdAt<c.startAt)return {status:'excluded-existing' as const}
   if(!validReportName(source.filename)||source.bytes.length>1048576||source.bytes.subarray(0,5).toString()!=='%PDF-'||!Number.isSafeInteger(source.expiresAt)||source.expiresAt<=now||source.expiresAt>source.createdAt+7*86400000)throw new BackupError('invalid')
   if(prior&&source.generation!==prior.value.sourceGeneration){const job={...prior.value,status:'source-changed' as const,updatedAt:now,leaseUntil:0};await this.store.write(path,job,prior.generation);return job}
   let job:DriveJob={id,mode:c.mode,status:'uploading',attempts:(prior?.value.attempts||0)+1,createdAt:prior?.value.createdAt||now,updatedAt:now,nextAt:0,leaseUntil:now+180000,sourceGeneration:source.generation,sourceExpiresAt:source.expiresAt,md5:createHash('md5').update(source.bytes).digest('hex'),...(prior?.value.fileId?{fileId:prior.value.fileId}:{})}
   let generation:string
   try{generation=await this.store.write(path,job,prior?.generation||'0')}catch(e){if(e instanceof Conflict)throw new BackupError('conflict');throw e}
   try{
    const drive=await this.adapter(c.mode);await drive.checkFolder(c.folderId)
    if(!job.fileId){job={...job,fileId:await drive.generateId()};generation=await this.store.write(path,job,generation)}
    const current=validateDriveConfig(await this.config())
    if(!current.enabled||current.revision!==c.revision||current.folderId!==c.folderId||current.mode!==c.mode)throw new BackupError('permission')
    if(this.clock()>=source.expiresAt)throw new BackupError('invalid')
    let remote=await drive.get(job.fileId!,source.filename)
    if(!remote){await drive.create(job.fileId!,c.folderId,source.filename,source.bytes);remote=await drive.get(job.fileId!,source.filename)}
    if(!remote||remote.trashed||remote.id!==job.fileId||remote.parents.length!==1||remote.parents[0]!==c.folderId||remote.md5Checksum!==job.md5||Number(remote.size)!==source.bytes.length||remote.name!==source.filename)throw new BackupError('permission')
    job={...job,status:'succeeded',updatedAt:this.clock(),leaseUntil:0,error:undefined}
    await this.store.write(path,job,generation)
    return job
   }catch(error){
    const code=error instanceof BackupError?error.code:'transient',retry=code==='transient'&&job.attempts<5
    const result:DriveJob={...job,status:code==='authorization'?'reauthorization-required':retry?'retry-wait':'failed',error:code,leaseUntil:0,updatedAt:this.clock(),nextAt:retry?this.clock()+Math.min(3600000,30000*2**(job.attempts-1)):0}
    try{await this.store.write(path,result,generation)}catch{}
    return result
   }
  }finally{source.bytes.fill(0)}
 }
 async retry(id:string){
  if(!validReportId(id))throw new BackupError('invalid')
  const path=drivePrefix+'jobs/'+id,prior=await this.store.read<DriveJob>(path)
  if(prior&&!validJob(prior.value,id))throw new BackupError('invalid')
  if(prior){if(prior.value.status==='succeeded')return {...prior.value,duplicate:true};if(prior.value.leaseUntil>this.clock()||prior.value.attempts>=5||['source-expired','source-changed'].includes(prior.value.status))throw new BackupError('conflict');await this.store.write(path,{...prior.value,status:'pending',nextAt:0},prior.generation)}
  return this.run(id)
 }
}

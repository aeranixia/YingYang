import { randomUUID } from 'node:crypto'
import { BackupError, driveFolderName, driveOwner, type DriveUpload, type RemoteFile } from './drive-backup'
import { validReportName } from './report-name'

type Credential={projectId:string;ownerEmail:string;client_id:string;client_secret:string;refresh_token:string}
export async function driveAccess(raw:unknown,project:string){
 const c=raw as Credential
 const number=project==='yingyangtest'?'495270334718':project==='yingyangcheck'?'231582543863':''
 if(!number||!c||c.projectId!==project||c.ownerEmail!==driveOwner||!c.client_id?.startsWith(number+'-')||!c.client_id.endsWith('.apps.googleusercontent.com')||!c.client_secret||!c.refresh_token)throw new BackupError('authorization')
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,refresh_token:c.refresh_token,grant_type:'refresh_token'}),signal:AbortSignal.timeout(8000)})
 if(!r.ok)throw new BackupError(r.status>=500?'transient':'authorization')
 const b=await r.json() as {access_token?:string;scope?:string}
 if(!b.access_token||!b.scope?.split(' ').includes('https://www.googleapis.com/auth/drive.file'))throw new BackupError('authorization')
 return b.access_token
}
export class GoogleDriveUpload implements DriveUpload{
 constructor(private token:string){}
 private async request(url:string,options:RequestInit={}){
  const r=await fetch(url,{...options,headers:{authorization:'Bearer '+this.token,...options.headers},signal:AbortSignal.timeout(30000)})
  if(!r.ok&&r.status!==404&&r.status!==409)throw new BackupError(r.status===401?'authorization':r.status===429||r.status>=500?'transient':r.status===403?'quota':'permission')
  return r
 }
 async checkFolder(id:string){
  if(!/^[A-Za-z0-9_-]{10,200}$/.test(id))throw new BackupError('invalid')
  const r=await this.request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,trashed,shared,owners(emailAddress),capabilities(canAddChildren),permissions(type,role,emailAddress)')
  if(!r.ok)throw new BackupError('permission')
  const f=await r.json() as {name:string;mimeType:string;trashed?:boolean;shared?:boolean;owners?:{emailAddress:string}[];capabilities?:{canAddChildren:boolean};permissions?:{type:string;role:string;emailAddress?:string}[]}
  if(f.name!==driveFolderName||f.mimeType!=='application/vnd.google-apps.folder'||f.trashed||f.shared||!f.capabilities?.canAddChildren||f.owners?.length!==1||f.owners[0].emailAddress!==driveOwner||!f.permissions?.length||f.permissions.some(p=>p.type!=='user'||p.role!=='owner'||p.emailAddress!==driveOwner))throw new BackupError('permission')
 }
 async generateId(){const r=await this.request('https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files');if(!r.ok)throw new BackupError('transient');const b=await r.json() as {ids:string[]};if(!/^[A-Za-z0-9_-]{10,200}$/.test(b.ids?.[0]))throw new BackupError('transient');return b.ids[0]}
 async get(id:string,_expectedName:string){if(!/^[A-Za-z0-9_-]{10,200}$/.test(id))throw new BackupError('invalid');const r=await this.request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,parents,md5Checksum,size,name,trashed');return r.status===404?null:await r.json() as RemoteFile}
 async create(id:string,folderId:string,name:string,bytes:Buffer){
  if(!validReportName(name)||bytes.length>1048576||!/^[A-Za-z0-9_-]{10,200}$/.test(id)||!/^[A-Za-z0-9_-]{10,200}$/.test(folderId))throw new BackupError('invalid')
  const boundary='yy-'+randomUUID(),body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({id,name,mimeType:'application/pdf',parents:[folderId]})+'\r\n--'+boundary+'\r\nContent-Type: application/pdf\r\n\r\n'),bytes,Buffer.from('\r\n--'+boundary+'--')])
  try{const r=await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'content-type':'multipart/related; boundary='+boundary},body:new Uint8Array(body)});if(!r.ok&&r.status!==409)throw new BackupError('transient')}finally{body.fill(0)}
 }
}

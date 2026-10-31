import { randomUUID, createHash, createHmac } from 'node:crypto'
import { runtimeToken } from './mail-state'
export const identityBucket = 'yingyangtest-admin-identity-495270334718'
export type StoredIdentity = { value: unknown; generation: string }
export interface IdentityStore { read(name: string): Promise<StoredIdentity | null>; write(name: string,value: unknown,generation: string): Promise<void>; list(prefix: string): Promise<unknown[]> }
export class IdentityConflict extends Error {}
export class IdentityError extends Error { constructor(public readonly code: 'permission-denied'|'failed-precondition'|'invalid-argument'|'resource-exhausted'|'unavailable') { super(code) } }
export type IdentityContext = { project?: string; app?: boolean; uid?: string; provider?: string; email?: string; emailVerified?: boolean; authTime?: number; claims?: Record<string,unknown> }
export type Role = 'master'|'admin'|'none'
export type Session = {role:Role}
export type Config = {googleEmail:string;googleUid?:string}
export type Member = {email:string;uid?:string;active:boolean;createdAt:number;updatedAt:number}
export interface IdentityAdapter { revoke(uid:string):Promise<void>; ensureGoogleUser(email:string):Promise<string>; googleUser(uid:string):Promise<{email?:string;verified:boolean;google:boolean;disabled:boolean}> }
function gmail(value:unknown):string { if(typeof value!=='string'||value.length>254||!/^[-a-zA-Z0-9._%+]+@gmail\.com$/.test(value.trim()))throw new IdentityError('invalid-argument');return value.trim().toLowerCase() }
function body(raw:unknown,keys:string[]) { if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).sort().join(',')!==keys.sort().join(','))throw new IdentityError('invalid-argument');return raw as Record<string,unknown> }
const memberKey=(email:string)=>'members/'+createHash('sha256').update(email).digest('hex')+'.json'
export class AdminIdentity {
 constructor(private store:IdentityStore,private adapter:IdentityAdapter,private key:string,private clock=Date.now){}
 private gate(c:IdentityContext){if(c.project!=='yingyangtest'||!c.app)throw new IdentityError('permission-denied')}
 private async config(){const r=await this.store.read('config.json'),v=r?.value as Config;if(!r||!v?.googleEmail)throw new IdentityError('unavailable');return {value:v,generation:r.generation}}
 private async audit(c:IdentityContext,action:string,outcome:string,email?:string){await this.store.write('audit/'+randomUUID()+'.json',{at:this.clock(),actor:c.uid?createHmac('sha256',this.key).update(c.uid).digest('hex'):'anonymous',action,outcome,...(email?{subject:createHmac('sha256',this.key).update(email).digest('hex')}:{})},'0')}
 private recent(c:IdentityContext){if(!Number.isSafeInteger(c.authTime)||this.clock()-c.authTime!*1000>300000||c.authTime!*1000>this.clock()+60000)throw new IdentityError('failed-precondition')}
 async session(c:IdentityContext):Promise<Session>{
  this.gate(c);const cfg=await this.config();const none:Session={role:'none'}
  if(!c.uid)return none
  if(c.provider!=='google.com'||c.emailVerified!==true||!c.email)return none
  const u=await this.adapter.googleUser(c.uid);if(u.disabled||!u.verified||!u.google||u.email?.toLowerCase()!==c.email.toLowerCase())throw new IdentityError('permission-denied')
  const email=gmail(c.email)
  if(email===cfg.value.googleEmail.toLowerCase()){
   if(cfg.value.googleUid&&cfg.value.googleUid!==c.uid)throw new IdentityError('permission-denied')
   if(!cfg.value.googleUid){await this.audit(c,'pin-google-master','requested');try{await this.store.write('config.json',{...cfg.value,googleUid:c.uid},cfg.generation)}catch(e){if(!(e instanceof IdentityConflict))throw e;const latest=await this.config();if(latest.value.googleUid!==c.uid)throw new IdentityError('permission-denied')}}
   return {role:'master'}
  }
  const record=await this.store.read(memberKey(email)),m=record?.value as Member
  if(!record||!m?.active||m.email!==email)return none
  if(m.uid&&m.uid!==c.uid)throw new IdentityError('permission-denied')
  if(!m.uid){try{await this.store.write(memberKey(email),{...m,uid:c.uid,updatedAt:this.clock()},record.generation)}catch(e){if(!(e instanceof IdentityConflict))throw e;const latest=(await this.store.read(memberKey(email)))?.value as Member;if(!latest?.active||latest.uid!==c.uid)throw new IdentityError('permission-denied')}}
  return {role:'admin'}
 }
 async authorize(c:IdentityContext,master=false){const s=await this.session(c);if(s.role==='none'||master&&s.role!=='master')throw new IdentityError('permission-denied');return s}
 async accounts(raw:unknown,c:IdentityContext){
  await this.authorize(c,true);this.recent(c)
  const d=raw as Record<string,unknown>;if(!d||typeof d!=='object'||Array.isArray(d))throw new IdentityError('invalid-argument')
  if(d.action==='list'){body(raw,['action']);const records=await this.store.list('members/');await this.audit(c,'account-list','allowed');return {accounts:records.map(x=>{const m=x as Member;return {email:m.email,active:m.active,bound:!!m.uid}})}}
  if(d.action==='approve'||d.action==='revoke'){
   body(raw,['action','email']);const email=gmail(d.email),cfg=await this.config();if(email===cfg.value.googleEmail.toLowerCase())throw new IdentityError('permission-denied')
   const name=memberKey(email),prior=await this.store.read(name),m=prior?.value as Member;await this.audit(c,'account-'+d.action,'requested',email)
   if(d.action==='approve'){const uid=await this.adapter.ensureGoogleUser(email);if(m?.uid&&m.uid!==uid)throw new IdentityError('permission-denied');await this.store.write(name,{email,active:true,uid,createdAt:m?.createdAt||this.clock(),updatedAt:this.clock()},prior?.generation||'0')}
   else{if(!prior)throw new IdentityError('invalid-argument');await this.store.write(name,{email,active:false,updatedAt:this.clock()},prior.generation);if(m.uid)await this.adapter.revoke(m.uid)}
   await this.audit(c,'account-'+d.action,'completed',email);return {ok:true}
  }
  throw new IdentityError('invalid-argument')
 }
}
export class GcsIdentityStore implements IdentityStore {
 constructor(private token=runtimeToken){}
 private url(name:string){if(!/^(config\.json|members\/[a-f0-9]{64}\.json|audit\/[a-f0-9-]+\.json)$/.test(name))throw Error('Invalid identity path');return 'https://storage.googleapis.com/storage/v1/b/'+identityBucket+'/o/'+encodeURIComponent(name)}
 private async request(url:string,init:RequestInit={}){return fetch(url,{...init,headers:{authorization:'Bearer '+await this.token(),...init.headers},signal:AbortSignal.timeout(8000)})}
 async read(name:string){const r=await this.request(this.url(name)+'?alt=media');if(r.status===404)return null;if(!r.ok)throw Error('Identity read unavailable');const generation=r.headers.get('x-goog-generation');if(!generation)throw Error('Missing identity version');return {value:await r.json(),generation}}
 async write(name:string,value:unknown,generation:string){this.url(name);const r=await this.request('https://storage.googleapis.com/upload/storage/v1/b/'+identityBucket+'/o?uploadType=media&name='+encodeURIComponent(name)+'&ifGenerationMatch='+generation,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});if(r.status===412)throw new IdentityConflict();if(!r.ok)throw Error('Identity write unavailable');await r.arrayBuffer()}
 async list(prefix:string){if(prefix!=='members/')throw Error('Invalid identity prefix');const r=await this.request('https://storage.googleapis.com/storage/v1/b/'+identityBucket+'/o?prefix=members%2F&maxResults=100');if(!r.ok)throw Error('Identity list unavailable');const b=await r.json() as {items?:{name:string}[];nextPageToken?:string};if(b.nextPageToken)throw new IdentityError('resource-exhausted');const values=[];for(const x of b.items||[]){const v=await this.read(x.name);if(v)values.push(v.value)}return values}
}

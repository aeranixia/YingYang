import { readBooks, requireBook, manageBooks } from './book-policy'
import { productionPrivacyVersion } from '../../src/production/contracts'
import { onCall, HttpsError, type CallableOptions, type CallableRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { AdminIdentity, GcsIdentityStore, IdentityError, IdentityConflict, type IdentityContext } from './admin-identity'
import { provisionGoogleAdmin } from './admin-auth-users'
import { ReportArchive, GcsArchiveStore, AdminError } from './admin-reports'
import { createLocalLimiter } from './policy'
import { issuePrivacy, verifyPrivacy } from './privacy'
import { confirmCompletion } from './completion'
import { GcsStateStore } from './mail-state'
import { createLiveService, prepareMailTicket, LiveError, DAILY_MAIL_ATTEMPT_LIMIT } from './live-service'
import { InputError } from './submission'
import { createPdf } from './pdf'
import { activeProductionMail, productionAccess, productionDispatch, productionProtocol } from './production-mail'

const project='yingyangcheck'
const signingKey=defineSecret('YINGYANG_SIGNING_KEY')
const mailConfig=defineSecret('YINGYANG_MAIL_CONFIG')
const options:CallableOptions={region:'asia-northeast3',serviceAccount:'231582543863-compute@developer.gserviceaccount.com',minInstances:0,maxInstances:1,concurrency:1,memory:'512MiB',cpu:1,timeoutSeconds:30,enforceAppCheck:true,cors:['https://yingyangcheck.web.app','https://yingyangcheck.firebaseapp.com'],secrets:[signingKey,mailConfig]}
const auth=getAuth(getApps()[0]||initializeApp({projectId:project}))
const archive=new ReportArchive(new GcsArchiveStore('yingyangcheck-admin-reports-231582543863',undefined,project),Date.now,project)
const mailState=new GcsStateStore('yingyangcheck-mail-state-231582543863')
const sending=()=>activeProductionMail(JSON.parse(mailConfig.value()),process.env.PRODUCTION_SEND_ENABLED==='true',mailState)
const deliver=createLiveService(mailState,async(c,a,o,t)=>{const current=await sending();if(current.sender!==c.sender||current.recipient!==c.recipient)throw Error('Configuration changed');await productionDispatch(current,a,o,t)},productionAccess,Date.now,(input,date)=>createPdf(input,date,'production'),archive,productionProtocol)
function context(r:CallableRequest):IdentityContext {
 const t=r.auth?.token
 return {project:process.env.GCLOUD_PROJECT,uid:r.auth?.uid,app:!!r.app,provider:t?.firebase?.sign_in_provider,email:t?.email,emailVerified:t?.email_verified===true,authTime:t?.auth_time,claims:t}
}
function identity(){return new AdminIdentity(new GcsIdentityStore(undefined,'yingyangcheck-admin-identity-231582543863'),{revoke:uid=>auth.revokeRefreshTokens(uid),ensureGoogleUser:email=>provisionGoogleAdmin(auth,email),googleUser:async uid=>{const u=await auth.getUser(uid);return {email:u.email,verified:u.emailVerified,google:u.providerData.some(p=>p.providerId==='google.com'),disabled:u.disabled}}},signingKey.value(),Date.now,project)}
function gate(r:CallableRequest,max=4096){r.rawRequest.res?.setHeader('Cache-Control','no-store');if(process.env.GCLOUD_PROJECT!==project||!r.auth||!r.app)throw new HttpsError('permission-denied','인증이 필요합니다.');if(r.rawRequest.rawBody?.length>max)throw new HttpsError('invalid-argument','요청 크기를 확인해 주세요.')}
function error(e:unknown):never{if(e instanceof IdentityError||e instanceof AdminError)throw new HttpsError(e.code,'권한 또는 본인 확인 상태를 확인해 주세요.');if(e instanceof IdentityConflict)throw new HttpsError('aborted','다른 요청과 충돌했습니다. 다시 확인해 주세요.');throw new HttpsError('unavailable','요청을 처리하지 못했습니다.')}
const allowAdmin=createLocalLimiter(30)
export const adminIdentity=onCall(options,async r=>{
 gate(r);if(!allowAdmin(Date.now()))throw new HttpsError('resource-exhausted','잠시 후 다시 시도해 주세요.')
 try{const raw=r.data;if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new IdentityError('invalid-argument');const {action,...data}=raw,c=context(r),service=identity();if(action==='questionnaires'){const role=await service.authorize(c);return await manageBooks(mailState,data,role.role,Number(r.auth?.token.auth_time))}if(action==='session'&&!Object.keys(data).length)return await service.session(c);if(action==='accounts'){const {operation,...fields}=data;return await service.accounts({...fields,action:operation},c)}throw new IdentityError('invalid-argument')}catch(e){return error(e)}
})
function reports(download:boolean){const limiter=createLocalLimiter();return onCall(options,async r=>{gate(r);if(!limiter(Date.now()))throw new HttpsError('resource-exhausted','잠시 후 다시 조회해 주세요.');try{const role=await identity().authorize(context(r)),c={project,uid:r.auth!.uid,app:true,role:role.role==='master'?'master' as const:'admin' as const};return download?await archive.download(r.data,c,signingKey.value()):r.data?.action==='detail'?await archive.detail(r.data,c,signingKey.value()):await archive.page(r.data,c,signingKey.value())}catch(e){return error(e)}})}
export const listAdminReports=reports(false)
export const downloadAdminReport=reports(true)
const allowExams=createLocalLimiter(30)
export const examStatus=onCall(options,async r=>{
 gate(r);if(r.auth!.token.firebase?.sign_in_provider!=='anonymous')throw new HttpsError('permission-denied','검사 세션이 필요합니다.');if(!allowExams(Date.now()))throw new HttpsError('resource-exhausted','잠시 후 다시 시도해 주세요.')
 try{const data=r.data,key=signingKey.value(),uid=r.auth!.uid;if(!data||typeof data!=='object'||Array.isArray(data))throw Error();if(!Object.keys(data).length)return {books:await readBooks(mailState),version:'1.3.0',projectId:project,sendEnabled:await sending().then(()=>true,()=>false),dailyMailAttemptLimit:DAILY_MAIL_ATTEMPT_LIMIT};if(data.action==='consent-privacy')return issuePrivacy(data,uid,key,Date.now(),productionPrivacyVersion);if(data.action==='verify-privacy'&&Object.keys(data).sort().join(',')==='action,privacyProof'){return {valid:true,...verifyPrivacy(data.privacyProof,uid,key,Date.now(),productionPrivacyVersion)}}verifyPrivacy(data.privacyProof,uid,key,Date.now(),productionPrivacyVersion);await requireBook(mailState,data);return confirmCompletion(data,uid,key,Date.now(),productionPrivacyVersion)}catch{throw new HttpsError('invalid-argument','동의·검사 응답을 확인해 주세요.')}
})
const allowMail=createLocalLimiter(5)
function mailHandler(prepare:boolean){return onCall(options,async r=>{
 gate(r,12000)
 let config
 try{config=await sending()}catch{throw new HttpsError('failed-precondition','Email sending is unavailable.',{outcomeUnknown:false})}
 if(r.auth!.token.firebase?.sign_in_provider!=='anonymous')throw new HttpsError('permission-denied','Exam session required.',{outcomeUnknown:false})
 if(!allowMail(Date.now()))throw new HttpsError('resource-exhausted','Please try later.',{outcomeUnknown:false})
 try{
  const raw=prepare?r.data:r.data?.submission
  verifyPrivacy(raw?.privacyProof,r.auth!.uid,signingKey.value(),Date.now(),productionPrivacyVersion)
  await requireBook(mailState,raw);return prepare?prepareMailTicket(raw,r.auth!.uid,config,signingKey.value(),Date.now(),productionProtocol):await deliver(r.data,r.auth!.uid,config,signingKey.value())
 }catch(e){
  if(e instanceof LiveError)throw new HttpsError(e.code,'Unable to confirm delivery.',{outcomeUnknown:e.outcomeUnknown})
  if(e instanceof InputError)throw new HttpsError('invalid-argument','Check input and consent.',{outcomeUnknown:false})
  throw new HttpsError('unavailable','Unable to process the request.',{outcomeUnknown:!prepare})
 }
})}
export const prepareReport=mailHandler(true)
export const submitReport=mailHandler(false)

import { createDriveRuntime } from './drive-runtime'
const driveRuntime=createDriveRuntime({project,bucket:'yingyangcheck-mail-state-231582543863',archiveBucket:'yingyangcheck-admin-reports-231582543863',secret:'YINGYANG_DRIVE_CONFIG',options:{...options,timeoutSeconds:120,secrets:[signingKey]}})
export const adminDriveBackup=driveRuntime.createDriveAdmin(r=>identity().authorize(context(r)))
export const productionDriveBackup=driveRuntime.storageBackup

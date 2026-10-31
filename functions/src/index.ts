import { onCall, HttpsError, type CallableOptions } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { allowedStage, createLocalLimiter, isEmptyStatusInput } from './policy'
import { InputError } from './submission'
import { createSubmissionService, ServiceError } from './service'
import { mockSender } from './sender'
import { GcsStateStore } from './mail-state'
import { readMailSecret, validateMailConfig, refreshGmailToken, dispatchGmail } from './gmail-sender'
import { prepareMailTicket, createLiveService, LiveError, DAILY_MAIL_ATTEMPT_LIMIT } from './live-service'
import { confirmCompletion } from './completion'
import { issuePrivacy, verifyPrivacy } from './privacy'
import { ReportArchive, GcsArchiveStore, AdminError } from './admin-reports'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { AdminIdentity, GcsIdentityStore, IdentityError, IdentityConflict, type IdentityContext } from './admin-identity'
import { provisionGoogleAdmin } from './admin-auth-users'

const signingKey = defineSecret('STAGING_REQUEST_SIGNING_KEY')
const allowLocalRequest = createLocalLimiter()
const callableOptions: CallableOptions = {
 serviceAccount: 'yingyang-staging-mail-runtime@yingyangtest.iam.gserviceaccount.com',
 region: 'asia-northeast3', minInstances: 0, maxInstances: 1, concurrency: 1,
 memory: '512MiB', cpu: 1, timeoutSeconds: 30,
 enforceAppCheck: true,
 cors: ['https://yingyangtest.web.app', 'https://yingyangtest.firebaseapp.com'],
 secrets: [signingKey],
}
export const stagingStatus = onCall(callableOptions, request => {
 if (!request.auth) throw new HttpsError('unauthenticated', '테스트 계정 로그인이 필요합니다.')
 if (!allowedStage(process.env.GCLOUD_PROJECT, request.auth.token.stagingTester)) throw new HttpsError('permission-denied', '승인된 Staging 계정만 접근할 수 있습니다.')
 if (!request.app) throw new HttpsError('failed-precondition', 'App Check 확인이 필요합니다.')
 if (!isEmptyStatusInput(request.data)) {
  if (process.env.STAGING_ENV !== 'stage-bc' || request.rawRequest.rawBody?.length > 4096) throw new HttpsError('invalid-argument', '완료 확인 요청을 확인해 주세요.')
  if (!allowLocalRequest(Date.now())) throw new HttpsError('resource-exhausted', '잠시 후 다시 확인해 주세요.')
  const key = signingKey.value()
  if (key.length < 32) throw new HttpsError('failed-precondition', '서버 설정을 확인해 주세요.')
  try {
   if (request.data?.action === 'consent-privacy') return issuePrivacy(request.data, request.auth.uid, key)
   if (request.data?.action === 'verify-privacy') {
    if (Object.keys(request.data).sort().join(',') !== 'action,privacyProof') throw Error()
    return { valid: true, ...verifyPrivacy(request.data.privacyProof, request.auth.uid, key) }
   }
   verifyPrivacy(request.data?.privacyProof, request.auth.uid, key)
   return confirmCompletion(request.data, request.auth.uid, key)
  }
  catch { throw new HttpsError('invalid-argument', '완료된 검진 응답을 확인해 주세요.') }
 }
 if (!allowLocalRequest(Date.now())) throw new HttpsError('resource-exhausted', '잠시 후 다시 확인해 주세요.')
 return { phase: 'BC', projectId: 'yingyangtest', mailMode: 'mock', secretReady: signingKey.value().length >= 32, dailyMailAttemptLimit: DAILY_MAIL_ATTEMPT_LIMIT }
})

const liveState = new GcsStateStore('yingyangtest-mail-state-495270334718')
const reportArchive = new ReportArchive(new GcsArchiveStore())
const deliveryArchive = process.env.STAGING_ADMIN_ARCHIVE_ENABLED==='true' ? reportArchive : undefined
const liveService = createLiveService(liveState, dispatchGmail, refreshGmailToken, Date.now, undefined, deliveryArchive)
const allowLive = createLocalLimiter()
const liveHandler = (prepare: boolean) => onCall(callableOptions, async request => {
 if (!request.auth || !request.app) throw new HttpsError('unauthenticated', '테스트 인증이 필요합니다.')
 if (request.auth.token.stagingMailTester !== true) throw new HttpsError('permission-denied', '실제 이메일 시험 권한이 필요합니다.')
 if (!allowedStage(process.env.GCLOUD_PROJECT, request.auth.token.stagingTester) || process.env.STAGING_ENV !== 'stage-bc') throw new HttpsError('permission-denied', '테스트 환경만 허용됩니다.')
 if (request.rawRequest.rawBody?.length > 12000) throw new HttpsError('invalid-argument', '입력 크기를 확인해 주세요.')
 if (!allowLive(Date.now())) throw new HttpsError('resource-exhausted', '잠시 후 다시 시도해 주세요.')
 let setupStage = 'configuration-read'
 try {
  const rawConfig = JSON.parse(await readMailSecret('STAGING_GMAIL_CLIENT'))
  setupStage = 'control-read'
  const control = await liveState.read<{ until: string }>('v1/control/mail')
  setupStage = 'window-validation'
  const config = validateMailConfig({ ...rawConfig, allowSendUntil: control?.value.until || '1970-01-01T00:00:00.000Z' })
  setupStage = 'ticket-or-submission'
  const key = signingKey.value()
  if (key.length < 32) throw new Error('Invalid signing configuration')
  const input = prepare ? request.data : request.data?.submission
  verifyPrivacy(input?.privacyProof, request.auth.uid, key)
  return prepare ? prepareMailTicket(request.data,request.auth.uid,config,key) : await liveService(request.data,request.auth.uid,config,key)
 } catch(error) {
  if (error instanceof InputError) throw new HttpsError('invalid-argument', '지정 가상 정보와 동의를 확인해 주세요.')
  if (error instanceof LiveError) throw new HttpsError(error.code, error.outcomeUnknown ? '발송 결과가 불명확합니다. 자동 재시도하지 말고 발신·수신 계정에서 확인해 주세요.' : '테스트 발송을 완료하지 못했습니다. 설정과 처리 상태를 확인해 주세요.', { outcomeUnknown:error.outcomeUnknown })
  throw new HttpsError('failed-precondition', '실제 테스트 발송이 비활성화되었거나 서버 설정을 확인할 수 없습니다.', { setupStage })
 }
})
export const prepareStagingReport = liveHandler(true)
export const submitStagingReport = liveHandler(false)

const processSubmission = createSubmissionService(mockSender, Date.now, undefined, deliveryArchive)
const allowSubmission = createLocalLimiter()
export const submitMockReport = onCall(callableOptions, async request => {
 if (!request.auth) throw new HttpsError('unauthenticated', '테스트 계정 로그인이 필요합니다.')
 if (!allowedStage(process.env.GCLOUD_PROJECT, request.auth.token.stagingTester) || process.env.STAGING_ENV !== 'stage-bc' || process.env.MAIL_MODE !== 'mock' || process.env.SEND_ENABLED !== 'false') throw new HttpsError('permission-denied', 'Staging 모의 처리만 허용됩니다.')
 if (!request.app) throw new HttpsError('failed-precondition', 'App Check 확인이 필요합니다.')
 if (request.rawRequest.rawBody?.length > 8192) throw new HttpsError('invalid-argument', '입력 크기를 확인해 주세요.')
 if (!allowSubmission(Date.now())) throw new HttpsError('resource-exhausted', '잠시 후 다시 시도해 주세요.')
 const key = signingKey.value()
 if (key.length < 32) throw new HttpsError('failed-precondition', '테스트 환경 설정을 확인해 주세요.')
 try { verifyPrivacy(request.data?.privacyProof, request.auth.uid, key) }
 catch { throw new HttpsError('failed-precondition', '검사 전 개인정보·민감정보 동의를 다시 확인해 주세요.') }
 try { return await processSubmission(request.data, request.auth.uid, key) }
 catch (error) {
  if (error instanceof InputError) throw new HttpsError('invalid-argument', '가상 정보, 동의, 검진 응답을 확인해 주세요.')
  if (error instanceof ServiceError) throw new HttpsError(error.code, '모의 처리를 완료하지 못했습니다. 실제 이메일은 발송되지 않았습니다.')
  throw new HttpsError('internal', '모의 처리를 완료하지 못했습니다.')
 }
})

const firebaseAdmin = getAuth(getApps()[0] || initializeApp({projectId:'yingyangtest'}))
function identity() {
 return new AdminIdentity(new GcsIdentityStore(), {
  revoke: uid=>firebaseAdmin.revokeRefreshTokens(uid),
  ensureGoogleUser: email=>provisionGoogleAdmin(firebaseAdmin,email),
  googleUser: async uid=>{const u=await firebaseAdmin.getUser(uid);return {email:u.email,verified:u.emailVerified,google:u.providerData.some(p=>p.providerId==='google.com'),disabled:u.disabled}},
 },signingKey.value())
}
function identityContext(request: {auth?: {uid:string;token:Record<string,unknown>};app?:unknown}):IdentityContext {
 const t=request.auth?.token,f=t?.firebase as {sign_in_provider?:string}|undefined
 return {project:process.env.GCLOUD_PROJECT,uid:request.auth?.uid,app:!!request.app,provider:f?.sign_in_provider,email:typeof t?.email==='string'?t.email:undefined,emailVerified:t?.email_verified===true,authTime:typeof t?.auth_time==='number'?t.auth_time:undefined,claims:t}
}
const allowIdentity=createLocalLimiter(30)
export const adminIdentity = onCall(callableOptions,async request=>{
 request.rawRequest.res?.setHeader('Cache-Control','no-store')
 if(process.env.GCLOUD_PROJECT!=='yingyangtest'||!request.app)throw new HttpsError('permission-denied','접근할 수 없습니다.')
 if(request.rawRequest.rawBody?.length>4096)throw new HttpsError('invalid-argument','요청을 확인해 주세요.')
 if(!allowIdentity(Date.now()))throw new HttpsError('resource-exhausted','잠시 후 다시 시도해 주세요.')
 try {
  const raw=request.data as Record<string,unknown>
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof raw.action!=='string')throw new IdentityError('invalid-argument')
  const {action,...data}=raw,c=identityContext(request),service=identity()
  if(action==='session'&&Object.keys(data).length===0)return await service.session(c)
  if(action==='accounts'){const {operation,...fields}=data;return await service.accounts({...fields,action:operation},c)}
  throw new IdentityError('invalid-argument')
 }catch(error){
  if(error instanceof IdentityError)throw new HttpsError(error.code,'관리자 인증·권한 또는 최근 본인 확인 상태를 확인해 주세요.')
  if(error instanceof IdentityConflict)throw new HttpsError('aborted','다른 요청과 충돌했습니다. 상태를 확인한 뒤 다시 시도해 주세요.')
  throw new HttpsError('unavailable','관리자 인증을 처리하지 못했습니다.')
 }
})
const allowAdmin = createLocalLimiter()
const adminHandler = (download: boolean) => onCall(callableOptions, async request => {
 request.rawRequest.res?.setHeader('Cache-Control','no-store')
 if (!deliveryArchive || !request.auth || !request.app) throw new HttpsError('permission-denied','관리자 권한이 필요합니다.')
 if (request.rawRequest.rawBody?.length>4096) throw new HttpsError('invalid-argument','요청을 확인해 주세요.')
 if (!allowAdmin(Date.now())) throw new HttpsError('resource-exhausted','잠시 후 다시 조회해 주세요.')
 try {
  const key=signingKey.value()
  if(key.length<32)throw Error()
  const session=await identity().authorize(identityContext(request))
  const context={project:process.env.GCLOUD_PROJECT,uid:request.auth.uid,app:true,role:session.role==='master'?'master' as const:'admin' as const}
  return download ? await reportArchive.download(request.data,context,key) : await reportArchive.page(request.data,context,key)
 } catch(error) {
  if(error instanceof AdminError||error instanceof IdentityError)throw new HttpsError(error.code,'관리자 권한·비밀번호 변경·PDF 만료 상태를 확인해 주세요.')
  throw new HttpsError('unavailable','관리자 저장소를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.')
 }
})
export const listAdminReports = adminHandler(false)
export const downloadAdminReport = adminHandler(true)

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
  try { return confirmCompletion(request.data, request.auth.uid, key) }
  catch { throw new HttpsError('invalid-argument', '완료된 검진 응답을 확인해 주세요.') }
 }
 if (!allowLocalRequest(Date.now())) throw new HttpsError('resource-exhausted', '잠시 후 다시 확인해 주세요.')
 return { phase: 'BC', projectId: 'yingyangtest', mailMode: 'mock', secretReady: signingKey.value().length >= 32, dailyMailAttemptLimit: DAILY_MAIL_ATTEMPT_LIMIT }
})

const liveState = new GcsStateStore('yingyangtest-mail-state-495270334718')
const liveService = createLiveService(liveState, dispatchGmail, refreshGmailToken)
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
  return prepare ? prepareMailTicket(request.data,request.auth.uid,config,key) : await liveService(request.data,request.auth.uid,config,key)
 } catch(error) {
  if (error instanceof InputError) throw new HttpsError('invalid-argument', '지정 가상 정보와 동의를 확인해 주세요.')
  if (error instanceof LiveError) throw new HttpsError(error.code, error.outcomeUnknown ? '발송 결과가 불명확합니다. 자동 재시도하지 말고 발신·수신 계정에서 확인해 주세요.' : '테스트 발송을 완료하지 못했습니다. 설정과 처리 상태를 확인해 주세요.', { outcomeUnknown:error.outcomeUnknown })
  throw new HttpsError('failed-precondition', '실제 테스트 발송이 비활성화되었거나 서버 설정을 확인할 수 없습니다.', { setupStage })
 }
})
export const prepareStagingReport = liveHandler(true)
export const submitStagingReport = liveHandler(false)

const processSubmission = createSubmissionService(mockSender)
const allowSubmission = createLocalLimiter()
export const submitMockReport = onCall(callableOptions, async request => {
 if (!request.auth) throw new HttpsError('unauthenticated', '테스트 계정 로그인이 필요합니다.')
 if (!allowedStage(process.env.GCLOUD_PROJECT, request.auth.token.stagingTester) || process.env.STAGING_ENV !== 'stage-bc' || process.env.MAIL_MODE !== 'mock' || process.env.SEND_ENABLED !== 'false') throw new HttpsError('permission-denied', 'Staging 모의 처리만 허용됩니다.')
 if (!request.app) throw new HttpsError('failed-precondition', 'App Check 확인이 필요합니다.')
 if (request.rawRequest.rawBody?.length > 8192) throw new HttpsError('invalid-argument', '입력 크기를 확인해 주세요.')
 if (!allowSubmission(Date.now())) throw new HttpsError('resource-exhausted', '잠시 후 다시 시도해 주세요.')
 const key = signingKey.value()
 if (key.length < 32) throw new HttpsError('failed-precondition', '테스트 환경 설정을 확인해 주세요.')
 try { return await processSubmission(request.data, request.auth.uid, key) }
 catch (error) {
  if (error instanceof InputError) throw new HttpsError('invalid-argument', '가상 정보, 동의, 검진 응답을 확인해 주세요.')
  if (error instanceof ServiceError) throw new HttpsError(error.code, '모의 처리를 완료하지 못했습니다. 실제 이메일은 발송되지 않았습니다.')
  throw new HttpsError('internal', '모의 처리를 완료하지 못했습니다.')
 }
})

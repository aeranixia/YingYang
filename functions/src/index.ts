import { onCall, HttpsError, type CallableOptions } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { allowedStage, createLocalLimiter, isEmptyStatusInput } from './policy'
import { InputError } from './submission'
import { createSubmissionService, ServiceError } from './service'
import { mockSender } from './sender'

const signingKey = defineSecret('STAGING_REQUEST_SIGNING_KEY')
const allowLocalRequest = createLocalLimiter()
const callableOptions: CallableOptions = {
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
 if (!isEmptyStatusInput(request.data)) throw new HttpsError('invalid-argument', '이 환경 확인에는 빈 객체만 허용됩니다.')
 if (!allowLocalRequest(Date.now())) throw new HttpsError('resource-exhausted', '잠시 후 다시 확인해 주세요.')
 return { phase: 'BC', projectId: 'yingyangtest', mailMode: 'mock', secretReady: signingKey.value().length >= 32 }
})

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

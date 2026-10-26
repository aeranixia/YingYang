import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { allowedStage, createLocalLimiter } from './policy'

const signingKey = defineSecret('STAGING_REQUEST_SIGNING_KEY')
const allowLocalRequest = createLocalLimiter()
export const stagingStatus = onCall({
 region: 'asia-northeast3', minInstances: 0, maxInstances: 1, concurrency: 1,
 memory: '512MiB', cpu: 1, timeoutSeconds: 30,
 enforceAppCheck: true,
 cors: ['https://yingyangtest.web.app', 'https://yingyangtest.firebaseapp.com'],
 secrets: [signingKey],
}, request => {
 if (!request.auth) throw new HttpsError('unauthenticated', '테스트 계정 로그인이 필요합니다.')
 if (!allowedStage(process.env.GCLOUD_PROJECT, request.auth.token.stagingTester)) throw new HttpsError('permission-denied', '승인된 Staging 계정만 접근할 수 있습니다.')
 if (!request.app) throw new HttpsError('failed-precondition', 'App Check 확인이 필요합니다.')
 if (Object.keys(request.data || {}).length !== 0) throw new HttpsError('invalid-argument', '이 환경 확인에는 입력 데이터가 필요하지 않습니다.')
 if (!allowLocalRequest(Date.now())) throw new HttpsError('resource-exhausted', '잠시 후 다시 확인해 주세요.')
 return { phase: 'A', projectId: 'yingyangtest', mailMode: 'disabled', secretReady: signingKey.value().length >= 32 }
})

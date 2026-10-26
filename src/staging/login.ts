export function loginErrorMessage(error: unknown): string {
 const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
 switch (code) {
  case 'auth/invalid-credential':
  case 'auth/invalid-login-credentials':
  case 'auth/user-not-found':
  case 'auth/wrong-password':
   return '계정 또는 비밀번호를 확인해 주세요. Secret Manager 최신 버전의 비밀 값만 복사해 입력하세요. 오류 코드: auth/invalid-credential'
  case 'auth/too-many-requests':
   return '로그인 시도가 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요. 오류 코드: auth/too-many-requests'
  case 'auth/network-request-failed':
   return '인증 서버에 연결하지 못했습니다. 네트워크와 브라우저의 차단 설정을 확인해 주세요. 오류 코드: auth/network-request-failed'
  case 'auth/user-disabled':
   return '테스트 계정이 비활성화되어 있습니다. 관리자에게 문의해 주세요. 오류 코드: auth/user-disabled'
  case 'auth/operation-not-allowed':
   return '테스트 로그인 제공자 설정 확인이 필요합니다. 관리자에게 문의해 주세요. 오류 코드: auth/operation-not-allowed'
  case 'auth/unauthorized-domain':
   return '허용된 테스트 주소 https://yingyangtest.web.app 에서 접속해 주세요. 오류 코드: auth/unauthorized-domain'
  default:
   return '로그인하지 못했습니다. 테스트 계정과 최신 비밀번호를 확인해 주세요. 계속 실패하면 사용 브라우저와 실패 단계를 관리자에게 알려 주세요. 비밀번호는 공유하지 마세요.'
 }
}

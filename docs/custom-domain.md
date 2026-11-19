# koreanmbti.com 도메인 연결

2026-11-20, 기존 Firebase 프로젝트와 Hosting 사이트 `yingyangcheck`에 맞춤 도메인을 연결한다. 새로운 프로젝트나 저장소를 만들지 않는다.

## 주소

- 기본 주소: https://koreanmbti.com
- 검사: https://koreanmbti.com/exam
- 관리자: https://koreanmbti.com/admin
- www.koreanmbti.com은 koreanmbti.com으로 이동한다.
- 기존 yingyangcheck.web.app과 firebaseapp.com 주소도 유지한다.

## 가비아 DNS

My가비아 → DNS 관리툴 → koreanmbti.com 설정 → 레코드 수정에서 Firebase가 발급한 값을 등록한다.

| 타입 | 호스트 | 값 |
|---|---|---|
| A | @ | 199.36.158.100 |
| TXT | @ | hosting-site=yingyangcheck |
| CNAME | www | yingyangcheck.web.app. |

다른 서비스의 동일 호스트 A/AAAA/CNAME이 있으면 충돌 여부를 확인한다. 기존 메일용 MX와 다른 TXT는 유지한다. DNS 전파와 Firebase SSL 인증서 발급이 완료돼야 HTTPS 연결이 끝난다.

## 앱과 인증

- 앱의 운영 호스트 검사와 Functions CORS가 기본 도메인 및 새 도메인을 정확히 허용한다. Staging·임의 하위 도메인·HTTP는 서버 허용 목록에 추가하지 않는다.
- Firebase Authentication 승인 도메인과 기존 reCAPTCHA Enterprise 허용 도메인에 새 주소를 추가한다. App Check 강제 적용과 기존 허용 주소는 유지한다.
- Google 관리자 로그인의 authDomain은 yingyangcheck.firebaseapp.com을 유지한다. 기존 Google OAuth 클라이언트와 Gmail/Drive 인증을 교체하지 않는다.
- 기존 API 키에 HTTP referrer 제한이 없어 키 설정 변경은 필요하지 않았다.
- 검진·메일·관리자·PDF7일·Drive 백업 설정과 기존 서버 데이터는 유지한다.

## 기존 이용자의 이어하기

브라우저 저장 데이터는 도메인별로 분리된다. 기존 주소에서 작성한 응답은 새 주소로 자동 이전되지 않는다. 기존 주소에서 이어하기와 결과 전송을 마칠 수 있도록 기존 주소를 강제로 리다이렉트하지 않는다.

## 확인 상태

- Firebase 맞춤 도메인2개와 www 리다이렉트를 등록했다.
- Authentication/reCAPTCHA의 새 도메인 허용 설정을 반영했다.
- DNS 등록·전파·인증서 발급 및 새 도메인 실제 로그인 검수는 진행 결과에 따라 기록한다. 등록만으로 연결 완료로 보고하지 않는다.

공식 안내: [Firebase 맞춤 도메인](https://firebase.google.com/docs/hosting/custom-domain), [가비아 DNS 관리](https://customer.gabia.com/faq/detail/2929/2932).

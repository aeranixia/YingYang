# v1.2 Staging A단계

2026-10-26, 이슈 [#4](https://github.com/aeranixia/YingYang/issues/4)의 A단계만 구축했다. B~G는 별도 승인 후 진행한다. 운영 앱 버전과 기존 태그는 v1.1.1까지 유지하며 v1.2.0 출시 태그는 만들지 않는다.

## 접속

- 주소: https://yingyangtest.web.app
- 가상 테스트 계정: `staging-tester@yingyangtest.invalid`
- 비밀번호: 프로젝트 권한이 있는 사용자만 [Secret Manager의 STAGING_TESTER_PASSWORD](https://console.cloud.google.com/security/secret-manager/secret/STAGING_TESTER_PASSWORD/versions?project=yingyangtest)에서 최신 버전을 확인한다. 비밀번호를 GitHub·이슈·채팅에 붙여 넣지 않는다.
- 로그인 후 ‘테스트 접근 권한과 서버 확인’을 누르면 Auth 테스트 권한, 실제 reCAPTCHA Enterprise App Check, Functions 및 서버 비밀 접근을 확인한다.
- 로그인은 메모리에만 유지하며 새로고침하면 해제된다. 공개 회원가입·사용자 직접 계정 삭제는 차단했다. 추가 테스터는 관리자가 가상 계정과 `stagingTester: true` custom claim을 함께 설정해야 한다. 이메일 가입만으로 서버 접근이 허용되지 않는다.

Hosting의 정적 로그인 화면과 공개 Firebase 클라이언트 설정은 누구나 내려받을 수 있다. 인증은 서버 호출을 보호한다. `noindex`는 접근 통제가 아니다. 현재 페이지에는 검진·환자 정보·PDF·발송 기능이 없다. 실제 개인정보를 사용하면 안 된다.

## 환경 분리와 배포

- 브랜치: `develop/v1.2`. 운영 `main`에 병합하지 않는다.
- `.firebaserc`: `staging=yingyangtest`, `production=yingyangcheck`. 암묵적인 `default` 별칭은 제거했다.
- 운영 `firebase.json`, `src/App.tsx`, 문항·집계·저장 방식은 변경하지 않았다.
- Staging 전용 진입점 `staging.html` / `src/staging`, 빌드 `dist-staging`, 설정 `firebase.staging.json`.
- STAGING 표시, robots 메타와 `X-Robots-Tag: noindex, nofollow, noarchive`, 캐시 금지 및 SPA rewrite를 적용했다.

```powershell
npm.cmd ci
npm.cmd --prefix functions ci
npm.cmd run deploy:staging
```

배포 스크립트는 테스트·Staging 빌드·Functions 빌드/테스트를 먼저 실행한다. 대상, 별칭, 전용 빌드 표시, 클라이언트 프로젝트, 색인 차단을 검사한 후 `yingyangtest`의 Hosting과 `yingyang-staging` 코드베이스만 배포한다. 추가 인자와 다른 프로젝트 환경변수는 거부한다. `deploy:production`은 차단한다. 이는 저장소의 실수 방지 장치이며, 프로젝트 소유자가 원시 CLI 명령으로 우회하는 것까지 IAM으로 막는 장치는 아니다. 기존 CLI 로그인을 사용하고 서비스 계정 키·GitHub Secret·자동 배포는 추가하지 않았다.

## 배포 리소스와 권한

프로젝트 ID `yingyangtest`, 번호 `495270334718`.

| 구성 | 설정 |
| --- | --- |
| Hosting | 테스트 사이트만 배포 |
| Functions 2세대 | `stagingStatus`, `asia-northeast3`, Node.js 22, 최소 0 / 최대 1 인스턴스, 동시성 1, 512 MiB, CPU 1, 제한 30초 |
| Firebase Authentication | 이메일/비밀번호, 관리자 등록 가상 테스트 계정 및 custom claim |
| App Check | reCAPTCHA Enterprise, 테스트 도메인만 등록, 함수에서 강제 검증 |
| Secret Manager | 테스트 비밀번호와 무작위 서버 키만 보관. Gmail 토큰 없음 |
| Artifact Registry | Functions 이미지, 1일 초과 이미지 삭제 정책 |
| Cloud Build / 소스 저장소 | Functions 배포에 필요한 빌드 및 자동 생성 소스 아티팩트 |
| 비용 알림 | 기존 테스트 프로젝트 전용 월 KRW 10,000 예산 및 50%·90%·100% 임계값 유지 |

활성화한 API: Cloud Functions, Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Firebase App Check, reCAPTCHA Enterprise, Compute Engine, Eventarc, Pub/Sub, Cloud Billing Budget. 기존 Firebase Hosting·Identity Toolkit API를 활용하고 Auth 초기 설정을 완료했다. Cloud Run은 Functions 2세대의 기반 리소스만 사용한다. 별도 Cloud Run 앱·VM·Pub/Sub 주제·Eventarc 트리거·Firestore·Redis·환자 파일용 버킷은 만들지 않았다. API 활성화 자체가 해당 서비스의 유료 리소스 생성은 아니다.

기존 기본 Compute 서비스 계정의 프로젝트 Editor 역할을 제거하고 `roles/cloudbuild.builds.builder`로 축소했다. 서버 키에는 해당 비밀에 한정한 Secret Accessor 역할을 부여했다. 테스트 비밀번호는 함수에 연결하지 않는다. 기본 계정이 빌드와 실행에 공유되므로, 실제 개인정보/Gmail 도입 전에는 키 없는 전용 실행 계정과 빌드 계정 분리를 별도로 검토한다.

상태 확인 함수는 승인된 Auth claim과 App Check를 모두 요구하고 임의 입력을 거부한다. 프로세스당 분당 5회 메모리 제한은 보조 장치이며 재시작·복수 리비전에 걸친 엄격한 전역 제한이 아니다. 메일이나 PDF 생성 경로는 없다. 중복 발송용 공유 저장소는 결정하지 않았고 생성하지 않았다. Gmail 연동 전 비공개 Cloud Storage 등 대안을 비교 보고한다.

## 비용과 알림

소수 가상 테스터가 월 1,000회 이하 확인하고 배포가 드물다는 가정에서는 무료 할당 내 0원 또는 소액을 예상한다. 보장된 견적은 아니며 Functions 실행·네트워크·Cloud Build·아티팩트/소스 저장·Secret 버전·reCAPTCHA 사용량과 결제 계정의 무료 할당 공유 여부에 따라 달라진다. 고정 실행 인스턴스나 유료 상시 서버는 두지 않았다.

Secret Manager는 결제 계정 기준 활성 버전 6개/월, 접근 10,000회/월 무료 할당이 있으며 이번 환경은 비밀 2개를 사용한다. App Check 자체와 공급자 과금은 구분해야 한다. [Firebase 가격](https://firebase.google.com/pricing), [Secret Manager 가격](https://cloud.google.com/secret-manager/pricing), [App Check 공급자 안내](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)를 참고한다.

월 KRW 10,000 예산의 프로젝트 필터가 테스트 프로젝트 하나로 지정된 것을 확인했다. 기존 기본 알림 수신 설정을 유지했다. [결제 예산 및 알림](https://console.cloud.google.com/billing?project=yingyangtest)에서 결제 관리자/사용자 수신 여부를 확인한다. 별도 이메일을 원하면 알림 채널 설정이 필요하다. 실제 알림 이메일 수신은 비용 임계값을 발생시키지 않아 검증하지 않았다. [예산 알림은 과금을 차단하지 않는다](https://docs.cloud.google.com/billing/docs/how-to/budgets).

## 실제 검증

- 기존 검진 Vitest 33개, 배포 보호 테스트 2개(잘못된 설정 8종 거부), Functions 정책 테스트 2개 통과.
- 운영 빌드, Staging 빌드 및 Functions TypeScript 빌드 성공. 양쪽 npm audit 취약점 0개.
- 테스트 Hosting HTTP 200, 색인 차단 헤더 확인. Functions ACTIVE, 최소 0 / 최대 1 / 동시성 1 확인.
- 실제 배포 주소에서 Chrome 로그인 및 실제 reCAPTCHA App Check로 상태 확인 성공. 디버그 토큰이나 검증 우회 사용 없음.
- 인증 누락 401, App Check 누락 401, 미승인 claim 계정 403, 임의 입력 400, 공개 회원가입 `ADMIN_ONLY_OPERATION` 차단 확인. 검사에 사용한 추가 가상 계정은 삭제했다.
- 320/390/768/820/1024/1440px에서 가로 넘침 없음. 390px 화면 캡처 검수, 표시된 버튼 높이 57px. 로그아웃 및 새로고침 후 세션 해제 확인.
- 운영 사이트 HTTP 200 및 작업 전후 HTML SHA-256 동일. 기존 운영 산출물 JS/CSS 파일명 동일. 운영 배포는 실행하지 않았다.

실제 iPad/iPhone/Android 기기와 Safari, 실제 예산 이메일 수신, 부하·남용 공격은 미검증이다. B~G 및 실제 개인정보 처리, PDF, Gmail OAuth, 수신자, 개인정보 문구 승인은 이 작업에 포함하지 않는다.

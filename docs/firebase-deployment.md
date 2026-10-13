# Firebase Hosting 배포

프로젝트: YingYangCheck / ID: `yingyangcheck` / 번호: `231582543863`

대상 Hosting 사이트: `yingyangcheck` / 주소: https://yingyangcheck.web.app

## 자동 배포 구성

`main`에 푸시하거나 GitHub Actions에서 `Deploy Firebase Hosting`을 수동 실행하면 `npm ci` → `npm test` → `npm run build` → 인증 확인 → live Hosting 배포 순으로 실행됩니다. 앞 단계가 실패하면 배포하지 않습니다. 수동 실행도 `main`에서만 배포합니다. 배포 작업은 동시에 실행하지 않습니다.

Firebase 공식 `FirebaseExtended/action-hosting-deploy`를 사용합니다. GitHub Actions의 저장소 Secret으로 서비스 계정 JSON을 전달합니다. 앱에는 Firebase SDK, Firestore, Cloud Run을 추가하지 않습니다.

## 사용자가 한 번 설정할 인증

아래 Google Cloud 권한 부여와 키 생성은 사용자가 직접 승인하여 수행해야 합니다. 키를 채팅에 붙여 넣거나 프로젝트 폴더에 저장하지 마세요.

1. [Google Cloud 서비스 계정](https://console.cloud.google.com/iam-admin/serviceaccounts?project=yingyangcheck)에서 프로젝트 ID가 `yingyangcheck`인지 확인합니다.
2. **서비스 계정 만들기**를 선택하고 이름과 ID를 `github-action-yingyang`으로 지정합니다. 생성되는 이메일은 `github-action-yingyang@yingyangcheck.iam.gserviceaccount.com`입니다.
3. 프로젝트 접근 권한에 **Firebase Hosting Admin** (`roles/firebasehosting.admin`)과 **API Keys Viewer** (`roles/serviceusage.apiKeysViewer`)를 부여합니다. 기본 Owner 또는 Editor 권한은 필요하지 않습니다. 이 구성에는 Auth preview domain 변경과 Cloud Run rewrite가 없어 해당 제품의 관리자 권한은 부여하지 않습니다.
4. 서비스 계정의 **키 → 키 추가 → 새 키 만들기 → JSON**을 선택합니다. 조직 정책이 키 생성을 금지한다면 정책을 임의로 완화하지 말고 OIDC 인증 구성으로 전환해야 합니다. 현재 워크플로는 JSON Secret 인증을 사용합니다.
5. [GitHub Actions Secrets](https://github.com/aeranixia/YingYang/settings/secrets/actions)에서 **New repository secret**을 선택합니다.
6. 이름은 정확히 `FIREBASE_SERVICE_ACCOUNT_YINGYANGCHECK`, 값은 다운로드한 JSON 파일의 **전체 내용**을 입력합니다. 파일 이름, 경로, 이메일만 입력하면 인증되지 않습니다. JSON을 base64로 변환하지 않습니다.
7. Secret 저장 후 키 파일은 프로젝트 밖에서 안전하게 관리하거나 로컬 복사본을 삭제합니다. Secret 값은 저장소 코드나 문서에 기록하지 않습니다.

Firebase CLI 배포에 필요한 역할은 [Firebase 공식 Action 서비스 계정 안내](https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/docs/service-account.md)를 기준으로 했습니다. 권한이 부족하면 Actions 로그의 해당 권한 오류를 확인하고 필요한 역할만 추가합니다.

## 첫 실제 배포

1. Secret 설정을 마친 뒤 [Actions](https://github.com/aeranixia/YingYang/actions)에서 **Deploy Firebase Hosting → Run workflow → main → Run workflow**를 실행합니다. 인증 전 실패한 실행을 다시 실행해도 됩니다.
2. Install dependencies, Test, Build, Deploy live Hosting site가 성공했는지 확인합니다.
3. https://yingyangcheck.web.app 에서 YingYang 홈 화면과 검진을 확인합니다. Actions 성공 전에는 이 주소를 배포 완료된 사이트로 간주하지 않습니다.

이후 `main`에 푸시할 때마다 자동으로 업데이트됩니다. 저장소 Settings → Actions → General에서 GitHub Actions와 사용된 Actions 실행이 허용되어 있어야 합니다.

## 수동 배포 대안

사용자가 로컬 Firebase 로그인을 승인해 완료한 경우에만 다음을 실행합니다.

```sh
npm ci
npm test
npm run build
npx firebase-tools login
npx firebase-tools deploy --only hosting --project yingyangcheck
```

Windows PowerShell 실행 정책이 npm 스크립트를 차단하면 `npm.cmd`, `npx.cmd`를 사용합니다. CLI 로그인 토큰을 GitHub 코드에 저장하지 않습니다.

## Hosting 설정과 SPA 검토

`firebase.json`의 공개 디렉터리는 `dist`이고 배포 대상 사이트를 명시했습니다. HTML은 재검증하도록 `no-cache`, Vite가 해시를 붙이는 `/assets/**` 파일은 장기 캐시하도록 설정했습니다. [Firebase Hosting 설정 문서](https://firebase.google.com/docs/hosting/full-config)를 참고하세요.

현재 앱은 URL 경로를 바꾸지 않고 React 상태로 화면을 전환하며 새로고침 시 홈에서 저장된 검진을 이어갑니다. 따라서 SPA catch-all rewrite가 필요하지 않아 추가하지 않았습니다. 존재하지 않는 경로는 404가 정상입니다. 현재 Vite의 `base: './'`에서 중첩 경로를 `/index.html`로 rewrite하면 상대 자산 URL이 잘못 해석될 수 있습니다. 향후 URL 라우터를 도입할 때 `base`와 rewrite를 함께 검토해야 합니다. 현재 UI·문항·계산 로직·응답 저장 키는 변경하지 않았습니다.

로컬 개발 주소의 localStorage와 실제 Hosting 주소의 localStorage는 서로 다릅니다. 기존 로컬 응답을 배포 주소로 자동 이전하지 않습니다.

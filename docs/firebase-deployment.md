# Firebase CLI 수동 배포

프로젝트: YingYangCheck / ID: `yingyangcheck` / 번호: `231582543863`

Hosting 주소: https://yingyangcheck.web.app

## 배포 방식

Firebase CLI에 사용자 Google 계정으로 로그인하여 Hosting만 수동 배포합니다. 서비스 계정 생성과 GitHub Actions Secret 등록은 필요하지 않습니다. 자동 배포 워크플로는 `docs/firebase-hosting.yml.disabled`로 보관하여 main 푸시와 Actions 수동 실행 모두 중지했습니다. 향후 자동 배포를 재개할 때만 인증 방식을 다시 검토합니다.

기존 `firebase.json`, `.firebaserc`를 유지합니다. 공개 디렉터리는 `dist`, 프로젝트 및 Hosting 사이트는 `yingyangcheck`입니다. Firebase SDK, Cloud Run, Firestore 등 추가 서비스는 사용하지 않습니다.

## 1. 사용자가 직접 로그인

프로젝트 폴더의 PowerShell에서 실행합니다. `npx`가 Firebase CLI 최초 다운로드를 묻으면 확인합니다. 앱 의존성에는 Firebase CLI를 추가하지 않습니다.

```powershell
Set-Location 'C:\Users\hoyun\Desktop\Github_Project\YingYang'
npx.cmd firebase-tools login
```

열리는 브라우저에서 `yingyangcheck`에 접근할 수 있는 Google 계정을 선택하고 Firebase CLI 인증을 승인합니다. CLI의 선택적 기능 및 사용 정보 수집 질문에는 원하는 선택을 합니다. 터미널에서 로그인 성공 메시지를 확인하세요. 토큰이나 인증 코드는 채팅에 붙여 넣지 않습니다.

브라우저가 열리지 않거나 localhost 인증 연결이 실패할 경우:

```powershell
npx.cmd firebase-tools login --no-localhost
```

CLI가 표시한 안내를 따라 사용자가 직접 인증합니다. 해당 절차의 URL이나 인증 코드는 공유하지 않습니다.

## 2. 로그인과 프로젝트 접근 확인

```powershell
npx.cmd firebase-tools login:list
npx.cmd firebase-tools projects:list
```

프로젝트 목록에 `yingyangcheck`가 있는지 확인합니다. 없으면 다른 계정으로 로그인했거나 프로젝트 접근 권한이 없는 것입니다. 올바른 계정으로 인증하거나 프로젝트 소유자에게 접근 권한을 요청합니다. 프로젝트를 새로 만들 필요는 없습니다.

## 3. 설치·테스트·빌드

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
```

각 명령이 성공했을 때 다음 명령으로 진행합니다. 테스트나 빌드가 실패하면 배포하지 않습니다.

## 4. Hosting만 배포

```powershell
npx.cmd firebase-tools deploy --only hosting --project yingyangcheck
```

성공 메시지와 Hosting URL을 확인하고 https://yingyangcheck.web.app 에 접속하여 YingYang 홈, 검진 시작, 응답 저장·이어하기를 확인합니다. 이 단계가 성공하기 전에는 배포 완료로 간주하지 않습니다.

이미 Hosting 설정 파일이 있으므로 `firebase init`은 다시 실행하지 않습니다. 이후 업데이트 때는 변경된 코드를 받고 테스트·빌드를 거쳐 같은 배포 명령을 실행합니다. GitHub 푸시만으로는 배포되지 않습니다.

## Hosting과 SPA 설정

HTML은 `no-cache`, 해시가 붙은 `/assets/**`는 장기 캐시하도록 구성했습니다. 현재 앱은 URL 라우터 없이 React 상태로 화면을 전환하므로 catch-all rewrite가 필요하지 않습니다. 향후 경로 라우터를 추가할 때 상대 자산 경로인 Vite `base: './'`와 rewrite를 함께 검토해야 합니다.

로컬 주소와 Hosting 주소의 localStorage는 서로 다르므로 기존 로컬 응답이 실제 사이트로 자동 이전되지는 않습니다.

공식 참고: [Firebase CLI 로그인](https://firebase.google.com/docs/cli#sign-in-test-cli), [Hosting 배포](https://firebase.google.com/docs/hosting/quickstart).

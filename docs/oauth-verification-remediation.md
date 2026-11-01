# Google OAuth 검증 반려 대응 — #8

2026-11-01 사용자 댓글6557383919에 따라 공개 홈페이지/정책부터 운영 Hosting에 수정한다. Drive 운영 연결 및 #4/#8 통합 시범 완료를 의미하지 않는다.

## 배포할 URL

- OAuth에 기존 등록된 홈페이지: https://yingyangcheck.firebaseapp.com/
- 개인정보처리방침: https://yingyangcheck.firebaseapp.com/privacy
- 이용약관: https://yingyangcheck.firebaseapp.com/terms
- 실제 검사: https://yingyangcheck.firebaseapp.com/exam
- 관리자: https://yingyangcheck.firebaseapp.com/admin
- 같은 운영 Hosting의 web.app 주소에서도 위 경로를 제공한다. 두 호스트의 Search Console 소유권을 동일한 것으로 추정하지 않는다.

## 반려 항목별 조치

1. **소유권 확인 — 사용자 직접 조작 대기.** OAuth 프로젝트를 관리하는 Google 계정에서 Search Console의 URL 접두어 속성 `https://yingyangcheck.firebaseapp.com/`를 정확히 추가하고 HTML 확인 파일을 받는다. 로컬 파일 경로를 제공하면 `public/google….html`에 정확한 내용으로 배포한다. 파일 URL의 HTTP200/원문 일치/리디렉션 없음 확인 후 소유자가 Search Console 확인을 누른다. 확인 성공 시각을 기록하고 Google이 요구한24시간이 지나기 전 재제출하지 않는다. Firebase 호스팅 권한이나 HTTP200을 Search Console 검증 완료라고 보고하지 않는다. 하위 도메인을 실제로 검증할 수 없다면 소유한 별도 도메인 유무를 확인하며 임의로 구매하거나 URL을 변경하지 않는다.
2. **정책 내용.** 수집 항목·사전/추가 동의·PDF 식별정보·Google API 용도·서버7일과 Drive무기한의 차이·메일/다운로드 사본·관리 주체·문의처·권리행사·제공자 및 국외 처리 사실을 공개 HTML에 기재한다. 운영 Drive가 아직 연결 검증 중이라는 상태도 표시한다. 법적 관계/국외 이전 요건을 검증 완료한 것처럼 확정하지 않는다. 기존 확정 운영 정보 외 새로운 법적 주체를 가정하지 않는다.
3. **로그인 이전 공개 홈페이지.** 루트는 정적 HTML로 소개·검사 진입·정책·약관·관리자 링크를 제공한다. Firebase SDK나 인증 호출을 하지 않는다. 기존 운영 React 앱은 exam.html로 보존하고 `/exam` 및 `/admin`만 연결한다. 인증/Auth/App Check/동의 절차는 해당 기능에 유지한다. JavaScript를 끈 브라우저에서도 공개 정책이 읽혀야 한다.
4. **앱 목적.** 체질검사10+40문항 집계→이용자가 요청한 PDF 작성→고정 한의원 이메일 전달→소유자 승인 후 비공개 Drive백업. 체질판정/AI진단 생성 기능은 없다. 환자의 Google 로그인은 필요 없고 Google 관리자는 사전 승인 후 접근한다.
5. **Google API 목적/NCII.** gmail.send는 고정 수신자 발송이며 받은편지함 읽기가 없다. drive.file은 앱 전용 폴더/PDF 백업과 무결성 확인에 사용한다. Google 데이터의 광고·판매·모델 학습 사용 경로가 없으며 AI이미지/영상 생성·편집/배포 API 또는 모델 의존성이 없다. 개인정보처리방침의 Google API 사용 제한에 이를 명시한다. 검색에서 발견되는 Cloud Storage의7일 원본 삭제는 Drive 삭제 기능과 구분한다.

## Google 검토팀용 설명 초안

YingYang is a pre-visit questionnaire service for a Korean medicine clinic. It aggregates a 10-question acquired questionnaire and a 40-question innate questionnaire, then creates a Korean PDF at the user's request. Gmail API sends the PDF to a fixed clinic recipient. After separate owner authorization and activation, Drive API backs up the same PDF into a clinic-owned private folder. Patients do not sign in with Google. Approved administrators use Google sign-in for restricted report access. The application has no AI image/video generation or editing functionality and does not use Google APIs to create or distribute non-consensual intimate imagery. Google user data is not used for advertising, sale, or model training.

이 초안은 앱 기능 설명이며 Google 검증 통과, 법률 적합성, 장기 토큰 유효성을 보장하지 않는다. 콘솔 링크/게시 상태/검증 상태/소유권은 실제 확인한 항목만 완료로 기록한다.

## 완료/대기 구분

- 로컬 공개 페이지 테스트: UI72+스크립트8=80개 통과, 기존 서버62개 통과. 운영 전용 빌드와 배포 보호 검사 성공.
- Chrome/WebKit 각각3개 페이지×6개 너비×3개 글자크기, 총108개 조합 가로 넘침 없음. 공개 페이지 외부 인증 요청0, JavaScript 비활성 정책 노출 및 글자 크기 재접속 유지 확인. 실제 기기/Safari는 미검증.
- 운영 배포/실제 HTTP·브라우저 검증은 실행 결과를 이슈 #8에 기록한다.
- Search Console HTML 파일·소유권 확인 성공·24시간 대기·OAuth 콘솔 링크/검증 상태·재제출은 사용자 직접 설정/확인 대기.
- 운영 Drive OAuth/비공개 폴더·전체 검사와 실제 이메일 수신·Drive 종단 시범은 기존 미완료 항목으로 유지한다.

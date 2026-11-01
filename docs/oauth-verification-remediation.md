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

## 공식 App Privacy Policy 안내 재대조 — 사용자 후속 지시

참고: https://support.google.com/cloud/answer/13806988?hl=ko

- 개인 발신 계정까지 공개 정책에 적은 것은 불필요한 노출이었다. 공개 페이지에서는 실제 운영 계정 주소를 제거하고 기능별 계정 역할만 설명한다. 서버 수신자·발신자·Drive 자격은 변경하지 않는다. 공개 HTML에 이메일 주소가 나타나면 회귀 검사에서 실패한다.
- 안내는 단순히 내용을 길게 쓰는 것이 아니라 Google 데이터의 접근 항목/용도/공유 상대/보호/보관과 삭제를 구체적으로 구분하라고 요구한다. 관리자 Google 로그인, Gmail 발송, Drive 백업마다 이 다섯 항목을 앱의 실제 동작에 맞춰 명시한다.
- 관리자 계정의 이름·이메일·사진 URL·식별자·확인 상태, Gmail이 처리하는 생성 메일/PDF와 발송 응답, Drive의 파일/폴더·공유/소유자·무결성 정보를 구분한다. 받은편지함/전체 Drive를 읽는다고 허위로 서술하지 않는다.
- 인증/승인 기록은 관리자 권한 회수만으로 자동 삭제되지 않는다는 점, 메일/토큰/서버 PDF/Drive 사본/중복 표식의 보관·삭제가 다르다는 점을 명시한다. 삭제 요청은 담당부서 연락처로 접수하고 계정 소유자가 Drive에서 직접 처리한다. 새로운 Drive 삭제 기능을 구현하지 않는다.
- 앱 브랜드를 정책 제목에 표시하고 정책 버전/변경 안내를 추가한다. 홈페이지의 정책 링크와 별도로 검사/관리자 앱에도 정책·약관 링크와 변경 안내를 로그인/서버 세션 성공 여부와 무관하게 표시한다. 정책은 독립 HTML 본문이며 PDF/iframe이 아니다.
- 목적 외 광고·판매·신용평가 및 범용/비개인화 AI·ML 모델 개발·개선·학습 사용과 전달을 하지 않는다고 명시한다. Google API 데이터의 사용과 전송에 Limited Use를 적용한다. 이 문구 추가를 Google 최종 심사 승인으로 간주하지 않는다.
- 소유권 확인은 사용자가2026-11-01 21:01:47 KST에 성공을 보고했다. Google이 요구한24시간을 보수적으로 적용해2026-11-02 21:02 KST 이후를 재제출 검토 시점으로 삼는다. 콘솔의 정책 URL은 홈페이지 루트와 다른 `/privacy`여야 하며, Google 안내상 기존 URL을 유지한 수정이라면 검증팀 메일에도 업데이트를 알린다. 검증팀에 메일 발송하거나 콘솔 재제출을 이 작업에서 임의로 수행하지 않는다.

## 완료/대기 구분

- 로컬 공개 페이지 테스트: UI72+스크립트8=80개 통과, 기존 서버62개 통과. 운영 전용 빌드와 배포 보호 검사 성공.
- Chrome/WebKit 각각3개 페이지×6개 너비×3개 글자크기, 총108개 조합 가로 넘침 없음. 공개 페이지 외부 인증 요청0, JavaScript 비활성 정책 노출 및 글자 크기 재접속 유지 확인. 실제 기기/Safari는 미검증.
- 운영 배포/실제 HTTP·브라우저 검증은 실행 결과를 이슈 #8에 기록한다.
- Search Console HTML 파일·소유권 확인 성공·24시간 대기·OAuth 콘솔 링크/검증 상태·재제출은 사용자 직접 설정/확인 대기.
- 운영 Drive OAuth/비공개 폴더·전체 검사와 실제 이메일 수신·Drive 종단 시범은 기존 미완료 항목으로 유지한다.

## 실제 운영 Hosting 반영

- 커밋 a83e293을 기존 운영 main에 반영하고 yingyangcheck Hosting만 배포했다. v1.3 Drive 개발 브랜치 전체를 main에 합치거나 Functions를 배포하지 않았다. 기존 Gmail 전송·관리자 권한·PDF7일 설정은 변경하지 않았다.
- firebaseapp.com 및 web.app 양쪽에서 `/`, `/privacy`, `/terms`, `/exam`, `/admin` 총10개 경로 모두 HTTP200, Location 헤더 없음 확인. 공개3경로는 정적 HTML이며 검사/관리자 경로는 기존 운영 앱으로 연결한다.
- 실제 firebaseapp.com의 비로그인 Chrome에서 홈페이지→개인정보처리방침 링크 이동·본문 노출 및 외부 인증 요청0을 확인했다. 검사 및 Google 관리자 로그인은 이번 공개 페이지 시험에서 실행하지 않았으므로 HTTP200만으로 전체 동작 정상이라고 보고하지 않는다.
- 로컬 Chrome/WebKit의 최종108개 화면 조합과 글자 크기 저장, JavaScript 비활성 정책 노출을 재확인했다. 실제 Safari/실제 기기 검증은 하지 않았다.
- 공개 페이지 수정의 기존 운영 기반 회귀는 UI72+스크립트8+서버62=142개 통과. v1.3 개발 브랜치의155개 결과와 검증 대상이 다르며 Drive 테스트를 제거한 배포가 아니다. 아직 운영에 적용하지 않은 Drive 코드는 develop/v1.3에 보존한다.
- 소유권 확인 파일은 아직 받지 않았다. 소유권 검증 성공 시각이 없으므로24시간 대기 시작이나 Google 검증 재제출 완료를 기록하지 않는다. 새 공개 페이지의 URL과 OAuth 동의 화면 링크 정합성은 콘솔 소유자 확인이 필요하다.

# 실제 서비스 처리경로·필수 고지 근거

2026-11-01. 이슈 #4 댓글6545884165. 코드·현재 Staging 설정·공식 자료를 대조한 결과다. 공개 자료의 일반 설명과 실제 적용 계약의 확인을 구분한다. 계약/국외 처리명세가 없는 부분을 채운 사실로 꾸미지 않는다.

## 기술 경로와 공개 문안에 반영한 사실

| 경로/근거 코드 | 처리 항목·목적·전송 시점/방법 | 확인한 위치·기간 | 법적/게시 결론 |
| --- | --- | --- | --- |
| Hosting / main.tsx | 접속IP·브라우저 정보, 사이트 제공·보안. 접속 시 HTTPS | 제공자 IP 수개월 보관. 국내 한정 위치선택으로 검증되지 않음 | 외부 처리 존재. 법정 위탁/국외 고지에서 제외하거나 ‘없음’ 기재 불가 |
| Firebase Authentication / main.tsx | 현재 테스트 계정 이메일·비밀번호 인증, UID·user agent/IP. 로그인 시 HTTPS | 공식적으로 미국. 로그IP 수 주, 다른 인증정보는 계정 삭제 요청까지/요청 뒤 서비스·백업 제거 최대180일 | 확인한 국가·항목·시점·목적·기간을 문안에 반영. 실제 계약/국외 법적 근거와 받는 자/연락처는 확정 요청서 대상 |
| App Check/reCAPTCHA / main.tsx, index.ts | 보안 증명·토큰·기기/접속 정보. 접속·보호 요청 시 | App Check TTL1시간. 증명 제공자의 보관은 별도. 전체 처리국가 명세 미확보 | Google 공식 processor 설명 확인. GDPR 역할과 한국법 적법근거 충족은 별개. Chrome403 추가 조사 없음 |
| Functions/PDF / index.ts, service.ts, pdf.ts | 동의 후 응답·이름·번호·집계·완료 증명, HTTPS 요청·메모리 PDF | 함수 서울. 업무 저장소 영구 저장/공개 업로드 없음 | 국내 처리 확인은 이 경로에 한정. 제공자의 지원/접속·감사처리를 전체 국내로 확장하지 않음 |
| GCS/Logging / mail-state.ts | 원문 대신 HMAC·임의요청ID·처리상태/시도 수. 보안·중복 방지 | GCS 서울, 생성2일 Delete lifecycle(비동기), versioning off·soft delete0. _Default global30일/_Required global400일 | 현재 설정 재조회 확인. global은 국가명 아님. 보관 설정과 정각 물리 삭제를 구분 |
| 개인 Gmail API / gmail-sender.ts | PDF 이름·전화번호·두 집계·시각·파일명. 승인 경로에서 HTTPS API 발송 | 실제 발신은 일반 Gmail, 현재 창 닫힘. 개인 Gmail 자체 보관·국외 처리와 삭제/백업 절차 존재 | Workspace 계약/관리자 자동 삭제를 적용하지 않음. 실제 계정에 해당하는 국외 처리명세 필요 |
| 한의원 네이버 메일 | 동일 한의원 고정 수신, PDF 접수. 브라우저 수신자 변경 불가 | 사용자가 업무수신·프론트/원장 접근 확인. 실제 계정의 모든 보관/동기화 설정 열람은 하지 않음 | 내부 접수 방침 유지. 네이버 서비스 제공자의 처리를 부정하지 않으며 수신기관과 제공자 역할 구분 |
| 수동 진료기록/전달 사본 | 한의원 직원이 자체 처리. PDF 자동 차트연동 없음 | 법정 종류별10/5년 등과 목적 달성 후 불필요 사본 파기 구분 | 파일형식만으로 원본 기록 분류를 확정하지 않음. 원장 관리의 수동 기준을 마련했으나 실행 완료/법적 분류 확정 아님 |

공식 수신자·발신자 유지 및 Secret/공유 발송 창 닫힘을 현재 설정에서 재확인했다. 실제 발송·자료 삭제·클라우드 보존 설정 변경은 하지 않았다.

## 공급자별 약관 확인으로 좁힌 부분

[Firebase 약관표](https://firebase.google.com/terms)는2026-09-24 개정 기준으로 Auth/App Check/Functions 등이 GCP 약관, Hosting은 Google APIs 약관·Firebase 처리조건 등의 적용을 받는다고 구분한다. 별도 오프라인 계약이 있으면 다른 계약이 우선할 수 있다. 따라서 한 종류의 Google 약관을 모두에 적용하지 않는다.

[Google 계약법인 표](https://cloud.google.com/terms/google-entity)는 청구주소·계약 종류·별도 합의에 따라 법인이 달라짐을 명시한다. 한국 청구주소의 GCP 표시와 계열사에 관한 각주도 있어, 한국에 거주한다는 사실만으로 실제 수탁/이전받는 법인을 정하지 않는다.

[Cloud Data Processing Addendum](https://cloud.google.com/terms/data-processing-addendum)은 고객지시·수탁자·처리시설·삭제/지원 책임을 규정하지만 실제 고객/계정 적용계약 증거를 대신하지 않는다. [GCP 하위처리자 목록](https://cloud.google.com/terms/subprocessors)은 서비스/리전/지원행위에 따라 해당성이 달라진다. 전체 목록의 모든 국가를 이 앱의 실제 전송국가로 복사하지 않는다.

[Firebase 개인정보 자료](https://firebase.google.com/support/privacy)의 Auth·Hosting·App Check 기간을 문안에 구체화했다. [Google 삭제 설명](https://policies.google.com/technologies/retention)은 삭제와 백업 제거 사이의 지연을 설명한다. [Gmail 개인계정 삭제 안내](https://support.google.com/mail/answer/7401?hl=ko)의 휴지통30일은 보내기 후 자동삭제 기간이 아니다. [네이버 방침](https://policy.naver.com/policy/privacy.html)과 [네이버 메일 안내](https://help.naver.com/service/30029/contents/21317?lang=ko&osType=COMMONOS)도 실제 수신계정 설정·기관의 문서 보관정책을 대신하지 않는다.

## 법적 근거 판단

- 국내 수집·이용/민감정보는 기존 검사 전·PDF 처리의 개별 동의를 유지한다. 이 동의가 국외 이전의 별도 동의를 자동 대체한다고 판단하지 않는다.
- [법 제26조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0026&lsiSeq=283839&urlMode=lsScJoRltInfoR)의 위탁 문서·고지/감독, [제28조의8](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=08&joNo=0028&lsiSeq=283839&urlMode=lsScJoRltInfoR)의 국외 이전 근거·고지 및 [시행령 제31조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0031&lsiSeq=289537&urlMode=lsScJoRltInfoR) 필수 내용을 채워야 한다. 계약 이행 필요 예외를 적용할지 별도 동의가 필요한지는 실제 관계·명세에 대한 결론이 없어 임의 선택하지 않았다.
- [법 제21조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0021&lsiSeq=283839&urlMode=lsScJoRltInfoR)의 목적 달성 후 파기/법정 보존 예외를 기준으로 전달 사본은 사건 기반 수동 파기로 구체화했다. [의료법 시행규칙 제15조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0015&lsiSeq=286963&urlMode=lsScJoRltInfoR)의 진료기록부10년·검사내용/소견5년 등은 분류별 기준으로 안내한다. PDF 일괄 보존기간을 만든 것은 아니다.

## 남는 실제 차단 요소

막연한 ‘모든 내용 미확정’ 대신 [비공개 확정 요청서](privacy-final-confirmation.md)에 **적용 계약/국외 처리 명세 및 의료기록·증빙 검토 회신1건**으로 묶었다. 어떤 자료가 없어 어떤 고지 열을 못 채우는지와 운영자의 단일 확인 행동을 적었다. 현재 공개 문안은 확인된 사실·운영 파기 기준까지 구체화한 Staging 문안이다. 이 회신 없이 전체 위탁/국외 고지가 완성됐다거나 실제 환자에게 최종 게시 가능하다고 주장하지 않는다.

[운영 파기 기준](privacy-operations-manual.md) · [배포 직전 체크리스트](production-preflight.md) · [공개 문안](privacy-policy-draft.md)

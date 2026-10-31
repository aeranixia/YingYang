# #4 개인정보 문안 일괄 정리·운영 배포 판단 — 2026-11-01

후속6545884165의 결과는 [실제 처리경로/근거](privacy-processing-register.md), [보관·파기 기준](privacy-operations-manual.md), [단일 비공개 확정 요청](privacy-final-confirmation.md), [배포 직전 점검](production-preflight.md)을 우선한다. 아래95개 테스트/697cce3 단계는 이전 검증 이력이며 반복 질문 목록으로 사용하지 않는다.


승인: 이슈 #4 댓글6545626047. develop/v1.2·yingyangtest만 대상. 운영 main/배포 승인 아님. 환자 문안과 내부 법적 미결 사항을 분리하며 법률 검토 완료를 주장하지 않는다.

## 완료 범위

- 정식 상호는 사용자 확정값 **유케이(UK)한의원**, 보호책임자는 대표원장, 권리행사 부서는 접수실(프론트), 접수 및 처리. 연락처1800-7544 / 1800-6544. 실명 재질문/공개 없음. 내부 실제 지정 확인은 운영자 책임.
- 예약하고 방문할 예정인 환자 대상. 링크 배포 방침을 예약자 인증 기능으로 표시하지 않는다.
- 정책·검사 전 개별 동의·PDF 개별 동의/전송 안내는 src/staging/privacy-copy.ts 공통 문안을 사용한다. 문서도 같은 문안에서 생성했다. 환자 화면에서 초안·미확정·확인 필요 및 내부 검토 목록을 제거했다.
- 방침은 로그인 전 첫 화면과 로그인 후 검사 화면에서 펼쳐볼 수 있다. 시행일은2026-11-01 Staging으로 한정하며 운영 시행일을 소급 확정하지 않는다.
- 후천적 체질/타고난 체질, PDF 디자인·문항·집계·이름_전화번호끝4자리.pdf·응답 키 유지. 84f4529 시계차이/진입 수정 유지. 개인정보 동의는 staging-clinic-privacy-3, PDF 모의 처리 동의는 staging-clinic-submission-2로 갱신하며 기존 응답/저장일 유지·새 동의 요구를 검증한다.
- 정확한7일 문구 유지. 브라우저 응답과 메일·의료기록·플랫폼 로그의 기간을 분리했다. 미확정 메일 사본 기간을7/30일로 정하지 않는다. 수동 차트 처리·취소/미내원·CRM/관리자/문자 논의를 재개하지 않는다.

[공개 문안·단계별 동의 전문](privacy-policy-draft.md) · [정책 컴포넌트 로컬 미리보기](previews/issue-4-privacy-policy.png)

## 실명 대신 부서 명칭 고지

현행 [개인정보 보호법 제30조제1항제6호](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0030&lsiSeq=283839&urlMode=lsScJoRltInfoR)는 보호책임자 성명 또는 개인정보 보호업무·고충을 처리하는 부서 명칭과 연락처를 고지하도록 규정한다. 따라서 접수실(프론트)+전화번호를 공개하고 대표원장 직책을 함께 안내하는 방식을 채택했다. 이것은 실제 내부 지정·접수 처리 체계가 검증됐다는 뜻은 아니다. 대표원장 성함은 요청하지 않는다.

## 코드·설정·공식 제공자 자료에서 확인한 사실

| 경로 | 확인 사실 | 단정하지 않은 사항 |
| --- | --- | --- |
| Hosting·Auth·App Check | main.tsx의 Firebase 초기화·테스트 계정·reCAPTCHA Enterprise. 접속·보안 처리는 검사 동의 전에도 발생. [Firebase 공식 자료](https://firebase.google.com/support/privacy#data_storage_and_processing_locations)는 Authentication 미국 처리를 명시하며 다른 제품은 위치 선택 없을 때 다양한 시설에서 처리 가능 | 서울 함수만으로 전 서비스 국내 처리를 보장하지 않음. 실제 계약 상대·각 하위 처리자·각 기간 추정 없음 |
| reCAPTCHA | [공식 FAQ](https://docs.cloud.google.com/recaptcha/docs/faq#data_processing)는2026-04-02 이후 Customer Data에 대해 고객=controller, Google=processor 설명. 보안 쿠키·기기 정보를 위한 고지는 유지 | GDPR 용어가 국내 위탁/이전 법적 근거를 자동 충족한다고 판단하지 않음 |
| 실제 메일 경로 | gmail-sender.ts의 Gmail API, 서버 고정 한의원 네이버 메일. [Google 방침](https://policies.google.com/privacy#infosharing)은 거주국 외 서버 처리 가능성을 설명. [네이버 방침](https://policy.naver.com/policy/privacy.html) 확인 | 일반 Gmail을 Workspace 계약으로 간주하지 않음. 공개 제공자 방침이 한의원의 실제 계약·메일 사본 기간을 대신하지 않음. 정확한 Gmail/네이버 처리국가 추정 없음 |
| 요청 처리·PDF | index.ts/service.ts/pdf.ts: 입력 검증·서명·서버 재집계·메모리 PDF, 공개 업로드 없음, 모의 표식은 메모리10분. live-service.ts: 원문 대신 요청 HMAC·상태·시도 수·만료 표식 | 메모리 문자열 즉시 물리 파기, 표식의 완전 익명성·법적 동의 장기 증빙을 주장하지 않음 |
| GCS·Logging 실제 설정 읽기 | 서울 GCS, age2일 Delete lifecycle·버전 관리off·soft delete0. Logging _Default global30일, _Required global400일·locked. 반환 페이지 누락 없음 | global을 특정 국가로 변환하지 않음. GCS 정각2일 물리 삭제·모든 로그30일·원 응답7일과 동일 기간으로 고지하지 않음 |
| 발송 안전 상태 | 공식 한의원 고정 수신자 일치, 발신자 유지, Secret·공유 발송 창 모두 닫힘을 비밀 값 없는 비교로 확인 | 신규 실제 발송 없음. 전체 IAM/모든 로그 본문 재검사로 표시하지 않음 |

## 운영 배포 차단 항목 — 필수 미확정만 통합

1. **실제 위탁/국외 처리 법적 근거와 고지 완성.** [법 제26조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0026&lsiSeq=283839&urlMode=lsScJoRltInfoR)는 해당 위탁업무·수탁자의 공개와 문서·감독 등을 요구한다. [법 제28조의8](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=08&joNo=0028&lsiSeq=283839&urlMode=lsScJoRltInfoR)과 [시행령 제31조제1항제2호](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0031&lsiSeq=289537&urlMode=lsScJoRltInfoR)는 해당 국외 이전의 근거·항목·국가/시기/방법·이전받는 자/연락처·목적/기간·거부 관련 고지를 다룬다. 실제 계정·계약 적용 범위와 각 경로의 정보를 확정하지 못했다. 필수 고지를 단순 삭제/없음 처리하거나 제공자 링크만으로 대체하지 않는다. 환자 문안은 확인된 서비스·Auth 미국 처리 사실을 표시했으나 현재 문안만으로 전체 법적 고지가 완성됐다고 보지 않는다.
2. **브라우저 외 정보의 필수 기간·파기 고지 및 동의 증빙 근거.** [법 제30조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0030&lsiSeq=283839&urlMode=lsScJoRltInfoR)의 보유기간·파기절차 고지에 맞게 실제 메일/다운로드/의료기록 및 플랫폼·동의 증빙의 해당 범위를 최종 법적 검토해야 한다. 기존 보류 결정을 다시 질문하거나 새 기간을 제안하지 않는다. 현재 브라우저/설정 사실만으로 실제 환자 서비스 전체 보유·파기 고지가 완성되지 않는다는 배포 차단 사실만 남긴다.
3. **운영자 실제 내부 지정/처리체계와 최종 문안 승인.** 책임자 직책·부서 고지는 구현했으나 실제 내부 지정·권리행사 처리 및 실제 운영 처리 근거를 확인한 것은 아니다. 실명 제출 요구 없이 운영자 내부 확인과 법적 적합성 검토가 필요하다. 현재 가상 정보 전용 테스트 계정을 환자 인증으로 고지하지 않으며 실제 환자 경로를 이번에 열지 않는다.

이는 선택 기능 추가 요청이 아니다. 미확정 정보를 환자 화면에 방치하지 않는 것과 필수 고지 없는 운영을 허용하는 것은 다르다. 현재 판정은 **Staging 반영 가능 / 실제 환자 운영 배포 보류**다. 명시적 운영 승인만으로 위 법적 필수 공백이 자동 해소되었다고 보지 않는다.

## Chrome403과 실제 사용자 영향

앞선 Cloud App Check/Enterprise/Logging 조회에서 등록·임계치·집계는 확인했으나 해당 자동화 실패의 개별 평가와 연결 근거는 확보하지 못했다. **원인 미확정**, 자동화 전용 확정 아님. 별도로 일반 사용자 Chrome 정상 진입 보고 및 동의 시계차이 수정 후 사용자 ‘넘어가’ 확인이 있다. 이번에는 새 평가·Chrome 재현·보안 완화·무한 재조사를 하지 않는다. 광범위 사용자 장애 또는 완전 해결을 단정하지 않는다.

## 검증·배포 기록

UI57+배포 보호2+서버36=95개 통과. 일반/Staging/Functions 빌드 성공. 이전 동의 버전 테스트 예시로 발생한 초기 실패는 예시 갱신 후 해소했다. 문서 상대 링크3개 파일 누락0, diff 형식 확인 통과.

yingyangtest Hosting/Functions 배포 완료 메시지와4개 함수 업데이트 성공을 확인했다. PowerShell 파이프 종료코드1이어서 메시지만으로 판단하지 않고 실제 Staging HTML/JS HTTP200·JS 로컬 빌드 해시 일치를 추가 확인했다. noindex/no-store 유지, 정책 가상 미리보기 HTTP200/image/png. 운영 HTML HTTP200·기존 기준 해시 일치.

변경 화면만 WebKit 자동화로 로그인 전 방침 열람, 내부 미결 문구 없음, 개별 동의0/1개 차단 및2개 후 새 서버 동의로 검진 선택 진입을 확인했다. 320/820/1440px 가로 넘침 없음. 실제 Safari/기기·일반 Chrome 시험으로 주장하지 않는다. 검사 응답 제출·PDF·메일 요청0이며 기존 전체 검증을 반복하지 않았다. 로컬 정책 렌더링과 실제 Staging 동의 화면을 육안 확인했다.

배포 뒤에도 공식 수신자·발신 설정 및 Secret/공유 발송 창 닫힘을 읽기 전용으로 재확인했다. 실제 이메일·발송 창 개방·운영 프로젝트·main/출시 태그·신규 유료 자원 변경 없음. 기존 전체 검사/PDF/메일 수동 검증을 다시 요구하지 않는다. 운영 배포 전 위 차단 항목과 사용자 명시 승인 필요. #4는 열린 상태로 유지한다.

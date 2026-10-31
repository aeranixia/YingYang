# YingYang v1.2.0 운영 전환

2026-11-01 사용자 운영 배포 승인 및 재개 지시. 운영 프로젝트 yingyangcheck, 기존 Staging yingyangtest는 분리한다. 실제 메일·실제 환자 시험 발송을 하지 않는다.

## 운영 구성

- src/production/main.tsx와 운영 SDK/App Check 설정으로 dist를 별도 생성한다. Staging 빌드를 복사하지 않는다. /admin SPA 경로를 설정한다.
- 운영 Functions는 yingyang-production 코드베이스이며 entry에서 프로젝트를 확인한다. 관리자 서비스·비공개 저장소·서명 키·CORS·동의 버전을 운영 전용으로 선택한다. Staging 기본값과 테스트는 유지한다.
- 관리자: 고정 Google 웹마스터 및 별도 승인 Google 계정. 일반 관리자 로그·PDF 조회, 마스터만 승인/회수. 별도 ID/비밀번호 없음.
- 검사: Google 가입을 요구하지 않는 익명 인증 세션. 브라우저 세션을 유지해 새로고침 시 증명/응답을 이어가며 7일이 지난 세션은 다시 생성한다. Auth 익명 계정은 30일 자동 정리 대상으로 설정한다. 응답의7일 만료 및 삭제/이어하기 규칙과 기존 저장 키는 유지한다.
- 사용자 점수표 직접 조회 대신 기존 검진/동의 흐름을 사용한다. 현재 결과 전송은 중지 상태이며 이름·전화번호를 입력받거나 실제 전송하지 않는다. 두 검사 완료 시 전송 중지 및 한의원 문의를 안내한다.
- 관리자 PDF는 생성 후7일 만료 검사와 비공개 저장소 lifecycle을 유지한다. 다운로드 이름은 마스킹 이름(끝4자리).pdf이며 Windows 호환 전각＊ 사용. Staging 자료를 운영으로 옮기지 않는다.

## 생성/설정한 자원

- 사용자가 yingyangcheck Blaze 연결 및 Google 제공자를 설정했고 API에서 확인했다.
- 운영 웹앱1개, 운영 도메인 전용 reCAPTCHA Enterprise/App Check, Auth 익명 세션 및 Google 제공자.
- 서울 STANDARD 비공개 버킷3개: PDF/마스킹 이력7일, 계정 설정 및 audit/7일, 공유 표식2일. Public Access Prevention enforced, uniform access, 버전 관리off·soft delete0. 계정 설정은 별도 보관하며 물리 lifecycle 삭제는 비동기이다.
- 운영 서명 키와 전송 중지 설정을 Secret Manager에 별도 생성했다. Staging OAuth 토큰·서명 키·개인자료를 복사하지 않았다. 고정 발신자/한의원 수신자 정보는 운영 비공개 설정에 반영했다.
- 기존 기본 실행 계정을 사용하고 새 서비스 계정·비밀키·GitHub Secret·Firestore·Redis는 만들지 않았다. 버킷별 objectAdmin·운영 Secret accessor·사용자 조회/생성/토큰 취소 최소 권한을 부여했다.
- Functions 최소0/최대1/동시1, 서울, Auth/App Check 확인. API·함수·저장/조회·인증은 사용량 과금이며 예산 알림은 비용 상한이 아니다.

## 발송 중지의 범위

운영 submitReport는 현재 항상 실패 상태로 전송 중지를 반환한다. 설정 플래그를 바꾸는 것만으로 열리지 않는다. 운영 신규 실제 발송 경로 확장은 자동 승인 심사에서 현재 승인 범위 밖으로 거부되어 제외했다. Staging의 기존 PDF·Gmail·중복/50회 제한 엔진과 승인된 PDF 양식은 유지한다. 운영 발송 재개에는 별도 승인과 운영 OAuth/전송 경로 검토가 필요하며, 본 배포를 실제 메일 서비스 개방 완료로 보고하지 않는다.

## 검증 및 롤백

- UI69 + 환경 보호4 + 서버55 =128개 통과. npm test, 일반/Staging/Functions 빌드 및 서버 테스트 성공. 운영 앱 ID·도메인·코드베이스·메일 중지 플래그 및 Staging 주소 혼입을 production-policy가 확인한다.
- 운영 Google 역할·승인/회수·Auth/App Check 필수·동의 증명의 계정 바인딩·환경간 저장소 접근 차단·실제 Gmail 호출0을 모의 테스트했다. 실제 계정 로그인/운영 화면 결과는 배포 후 검증 기록에 추가한다.
- 배포 직전 기존 Hosting release/version·HTML 해시를 비공개 로컬 기록으로 확보했다. 기존 v1.0.0/v1.1.0/v1.1.1 태그는 보존한다. 새 출시 태그는 생성하지 않는다.
- 검사 진입/이어하기 또는 관리자 인증/접근 제한 장애, 운영의 Staging 연결, 메일 차단 해제 발견 시 이전 Hosting version으로 복원한다. 메일 차단을 우선 유지하며 서버 장애는 별도로 점검한다. 기존 화면 복원은 새 서버/저장소의 자동 삭제를 의미하지 않는다.

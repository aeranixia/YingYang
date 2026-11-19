# Google OAuth 도메인 보완

대상 프로젝트: `yingyangcheck`. Google 심사팀의 홈페이지·개인정보처리방침 도메인 보완 요청에 대응한다.

## 콘솔에 저장할 값

[운영 브랜딩](https://console.cloud.google.com/auth/branding?project=yingyangcheck)에서 아래 값을 저장한다.

| 항목 | 값 |
|---|---|
| 애플리케이션 홈페이지 | https://koreanmbti.com/ |
| 개인정보처리방침 | https://koreanmbti.com/privacy |
| 서비스 약관 | https://koreanmbti.com/terms |
| 승인된 도메인 추가 | koreanmbti.com |

기존 로그인 OAuth 클라이언트·리디렉션 URI·Gmail/Drive 인증은 그대로 유지한다. 브랜딩의 소개 페이지 URL 변경과 로그인 콜백 변경은 별개다.

## 현재 상태 — 2026-11-20

- Search Console의 도메인 속성 확인은 사용자가 ‘소유권이 확인됨’을 확인했다. Google 확인용 TXT와 Firebase TXT는 유지한다.
- Firebase Hosting·앱 허용 호스트·Functions CORS·Authentication·reCAPTCHA에 새 도메인을 반영했다. 기존 운영 주소와 서비스는 유지한다.
- 새 도메인의 홈페이지/개인정보처리방침/약관은 기존 Hosting 배포에 포함돼 있다. HTTPS 인증서 발급이 끝나야 실제 새 URL의 접속 검증이 가능하다.
- 최신 점검의 HTTPS 상태는 인증서 이름 오류이며 Firebase는 CERT_PREPARING이다. 새 주소의 최종 접속 검수는 미완료다.
- 브랜딩 콘솔을 조작할 연결 도구가 없어 위 네 항목의 실제 저장을 사용자에게 요청했다. 콘솔 저장·재심사 제출을 완료했다고 기록하지 않는다.
- HTTPS가 정상화된 뒤 홈페이지와 개인정보처리방침의 로그인 없는 직접 접근, 같은 도메인의 정책 링크와 콘솔 저장값을 확인하고 재심사를 제출한다. 그 뒤 심사팀 메일에 회신한다.

## 회신 초안

아래 문구는 HTTPS 정상 접근·콘솔 URL 저장·재심사 제출을 모두 완료한 후에만 사용한다. 현재는 미발송 초안이다.

```text
Hello Google Verification Team,

We have moved the YingYang application homepage and privacy policy to our verified domain:

Homepage: https://koreanmbti.com/
Privacy policy: https://koreanmbti.com/privacy

We have verified ownership of koreanmbti.com through a DNS Domain property in Google Search Console using a Google account associated with our Cloud project. We have updated the application URLs and authorized domain in the Cloud Console and resubmitted the changes for verification.

Both pages are publicly accessible without signing in, and the homepage links to the privacy policy.

Please continue reviewing our application.

Thank you.
```

공식 안내: [홈페이지 요건](https://support.google.com/cloud/answer/13807376?hl=en), [도메인 소유권 확인](https://support.google.com/cloud/answer/13804266?hl=en).

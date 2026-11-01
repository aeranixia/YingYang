import { clinicName, policyEffectiveDate, policySections, policyReferences } from './privacy-copy'
export { retentionNotice } from './privacy-copy'

export function PrivacyPolicy({production=false}:{production?:boolean}={}) {
 const text=(value:string)=>!production?value:value.replace('모의 처리 화면에서는 지정된 가상 정보만 사용하며 실제 이메일을 발송하지 않습니다. 실제 발송은 별도 승인된 서버 경로에서만 가능하고 현재 허용 창은 닫혀 있습니다.','실제 발송은 동의 확인과 서버 설정이 허용하는 경우에만 가능합니다.').replace('생성 후 2일 삭제 정책','일일 횟수는 2일, 중복 방지 표식은 8일 삭제 정책').replace('정확히 2일 정각','설정된 날짜의 정각').replaceAll('현재 Staging의','운영 환경의').replaceAll('테스트 계정 접근 제한','관리자 Google 인증·검사 세션 분리').replace('이 내용은 현재 테스트 계정 인증에 관한 안내이며 환자 Google 계정 가입을 요구하지 않습니다.','환자에게 Google 가입을 요구하지 않으며 익명 검사 세션 식별자를 사용합니다. 익명 인증 계정은 30일 후 자동 정리 대상으로 설정합니다. 관리자 Google 계정과 검사 응답 보관 기간은 별도입니다.')
 return <details className="privacy-policy"><summary>{clinicName} 개인정보처리방침</summary>
  <p>시행일: {policyEffectiveDate}{!production&&' (Staging). 운영 사이트의 시행일은 운영 배포 시 별도로 공지합니다.'}</p>
  {policySections.map(section => <div key={section.title}><h2>{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{text(paragraph)}</p>)}</div>)}
  <h2>제공자 및 법령 안내</h2><ul>{policyReferences.map(reference => <li key={reference.url}><a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.label}</a></li>)}</ul>
 </details>
}

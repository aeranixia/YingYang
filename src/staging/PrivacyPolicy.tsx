import { clinicName, policyEffectiveDate, policySections } from './privacy-copy'
export { retentionNotice } from './privacy-copy'

export function PrivacyPolicy() {
 return <details className="privacy-policy"><summary>{clinicName} 개인정보처리방침</summary>
  <p>시행일: {policyEffectiveDate} (Staging). 운영 사이트의 시행일은 운영 배포 시 별도로 공지합니다.</p>
  {policySections.map(section => <div key={section.title}><h2>{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>)}
 </details>
}

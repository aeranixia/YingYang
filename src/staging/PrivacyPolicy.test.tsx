import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PrivacyPolicy } from './PrivacyPolicy'
import { retentionNotice, preExamPersonal, preExamSensitive, pdfPersonal, pdfSensitive, pdfDelivery } from './privacy-copy'

afterEach(cleanup)
it('공개 문안은 정식 상호·담당부서·연락처를 제공하고 내부 미결 문구를 노출하지 않는다', () => {
 const { container } = render(<PrivacyPolicy/>)
 const text = container.textContent || ''
 expect(screen.getByText('유케이(UK)한의원 개인정보처리방침')).toBeTruthy()
 expect(text).toContain('대표원장')
 expect(text).toContain('접수실(프론트)')
 expect(text).toContain('1800-7544 / 1800-6544')
 expect(text).toContain('시행일: 2026-11-01 (Staging)')
 expect(text).not.toMatch(/초안|\[확인 필요\]|미확정|02-1800|위탁 없음|국외 이전 없음/)
 expect(text).toContain('기술적인 예약자 인증을 의미하지 않습니다')
 expect(text).toContain('Google/Firebase')
})
it('검사 전·PDF 처리 안내는 같은 방침 문구를 사용하며 브라우저와 이메일 보관을 구분한다', () => {
 const { container } = render(<PrivacyPolicy/>)
 for (const copy of [retentionNotice, preExamPersonal, preExamSensitive, pdfPersonal, pdfSensitive, pdfDelivery]) expect(container.textContent).toContain(copy)
 expect(container.textContent).toContain('현재 허용 창은 닫혀 있습니다')
 expect(container.textContent).toContain('접수된 메일·다운로드 사본과 진료기록은 브라우저 응답의 7일 만료와 별도로 관리')
})
it('메일 수동 파기와 제공자 삭제 지연을 밝히고 PDF 전체에 법정기간을 일괄 적용하지 않는다', () => {
 const { container } = render(<PrivacyPolicy/>)
 const text = container.textContent || ''
 expect(text).toContain('이 앱은 메일함·단말 파일을 자동 삭제하지 않습니다')
 expect(text).toContain('계정 삭제 요청 전까지 유지')
 expect(text).toContain('최대 180일')
 expect(text).toContain('모든 PDF나 이메일을 일률적으로 5년 또는 10년 보관한다는 뜻은 아닙니다')
 expect(text).toContain('일반 로그 보관 설정은 30일, 필수 감사 로그는 400일')
 expect(screen.getByRole('link', { name: 'Firebase 개인정보 처리·보관·처리 위치', hidden: true }).getAttribute('href')).toBe('https://firebase.google.com/support/privacy')
})

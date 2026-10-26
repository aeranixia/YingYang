import PDFDocument from 'pdfkit'
import { join } from 'node:path'
import { calculate } from './submission'
import type { Submission } from '../../src/staging/contracts'

export async function createPdf(input: Submission, now: Date, mode: 'mock' | 'gmail-test' = 'mock'): Promise<Buffer> {
 const scores = calculate(input)
 const doc = new PDFDocument({ size: 'A4', margin: 48, font: join(__dirname, '../../../assets/NanumGothic-Regular.ttf'), info: { Title: 'YingYang STAGING report', Author: 'YingYang' } })
 doc.registerFont('korean', join(__dirname, '../../../assets/NanumGothic-Regular.ttf'))
 doc.registerFont('symbols', join(__dirname, '../../../assets/noto-symbols/NotoSansSymbols.ttf'))
 const chunks: Buffer[] = []
 const output = new Promise<Buffer>((resolve, reject) => {
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  doc.on('end', () => { const result = Buffer.concat(chunks); chunks.forEach(c => c.fill(0)); chunks.length = 0; resolve(result) })
  doc.on('error', () => { chunks.forEach(c => c.fill(0)); chunks.length = 0; reject(new Error('PDF generation failed')) })
 })
 try {
  doc.fontSize(11).fillColor('#98420e').text(mode === 'mock' ? 'STAGING · 가상 정보 · 모의 처리 전용' : 'STAGING · 가상 정보 · 실제 이메일 테스트')
  doc.moveDown().fontSize(21).fillColor('#203d34').text('YingYang 검사 결과지')
  doc.moveDown().fontSize(12).fillColor('#111111')
  doc.text(`이름: ${input.name}`).text(`전화번호: ${input.phone}`)
  doc.text(`검사일: ${new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)} (한국 시간)`)
  doc.fontSize(10).text('검사일은 두 검진 완료 후 서버가 모의 요청을 접수한 날짜입니다.')
  for (const [title, rows, unit] of [['후천적 검사', scores.acquired, '회'], ['타고난 검사', scores.innate, '점']] as const) {
   doc.moveDown(1.3).fontSize(16).text(title)
   doc.moveDown(.5).fontSize(12)
   const start = doc.y
   const allRows = [...rows, ['합계', rows.reduce((sum, [, score]) => sum + score, 0)] as [string, number]]
   allRows.forEach(([label, score], i) => {
    const y = start + i * 27
    doc.rect(48, y, 499, 27).strokeColor('#b8c9bf').stroke()
    doc.font(['①', '②', '③', '④'].includes(label) ? 'symbols' : 'korean').text(label, 62, y + 7, { width: 200 })
    doc.font('korean').text(`${score}${unit}`, 300, y + 7, { width: 220, align: 'right' })
   })
   doc.x = 48; doc.y = start + allRows.length * 27
  }
  doc.moveDown(1.3).fontSize(10).text('두 검사의 점수는 합산하지 않습니다. 체질 판정을 제공하지 않습니다.')
  doc.text(mode === 'mock' ? '실제 이메일은 발송되지 않으며 이 PDF는 서버에 영구 저장하지 않습니다.' : '가상 자료의 이메일 테스트용입니다. 서버 PDF 저장은 없으며 메일함 사본은 별도 정리합니다.')
  doc.end()
 } catch {
  doc.destroy(new Error('PDF generation failed'))
 }
 return output
}

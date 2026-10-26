import PDFDocument from 'pdfkit'
import { join } from 'node:path'
import { calculate } from './submission'
import type { Submission } from '../../src/staging/contracts'

export function formatCompletion(date: Date | null): string {
 if (!date) return '기록 없음 (이전 완료 데이터)'
 const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
 const get = (type: string) => parts.find(p => p.type === type)!.value
 return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}
export async function createPdf(input: Submission, completedAt: Date | null, mode: 'mock' | 'gmail-test' = 'mock'): Promise<Buffer> {
 const scores = calculate(input)
 const doc = new PDFDocument({ size: 'A4', margin: 40, font: join(__dirname, '../../../assets/NanumGothic-Regular.ttf'), info: { Title: 'YingYang STAGING report', Author: 'YingYang' } })
 doc.registerFont('korean', join(__dirname, '../../../assets/NanumGothic-Regular.ttf'))
 doc.registerFont('symbols', join(__dirname, '../../../assets/noto-symbols/NotoSansSymbols.ttf'))
 const chunks: Buffer[] = []
 const output = new Promise<Buffer>((resolve, reject) => {
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  doc.on('end', () => { const result = Buffer.concat(chunks); chunks.forEach(c => c.fill(0)); chunks.length = 0; resolve(result) })
  doc.on('error', () => { chunks.forEach(c => c.fill(0)); chunks.length = 0; reject(new Error('PDF generation failed')) })
 })
 try {
  const left = 40, width = doc.page.width - 80, gap = 20, tableWidth = (width - gap) / 2
  const text = (value: string, x: number, y: number, size: number, boxWidth: number, color = '#203d34', align: 'left' | 'right' | 'center' = 'left') => {
   doc.font('korean').fontSize(size).fillColor(color).text(value, x, y, { width: boxWidth, align, lineBreak: false })
  }
  text(mode === 'mock' ? 'STAGING · 가상 정보 · 모의 처리 전용' : 'STAGING · 가상 정보 · 실제 이메일 테스트', left, 40, 12, width, '#98420e')
  text('YingYang 검사 결과지', left, 76, 29, width)
  doc.moveTo(left, 124).lineTo(left + width, 124).strokeColor('#203d34').lineWidth(2).stroke()
  const details = [['이름', input.name], ['전화번호', input.phone], ['검사 완료 확인 일시 (KST)', formatCompletion(completedAt)]]
  details.forEach(([label, value], i) => {
   const y = 146 + i * 62
   text(label, left + 16, y, 12, width - 32, '#52635a')
   text(value, left + 16, y + 21, 22, width - 32, '#152c24')
  })
  text('서버가 두 검사의 완료를 확인한 시각입니다.', left + 16, 333, 11, width - 32, '#52635a')
  text('실제 클릭·PDF 생성·이메일 발송 시각과 다를 수 있습니다.', left + 16, 350, 11, width - 32, '#52635a')
  for (const [index, [title, rows, unit]] of ([['후천적 검사', scores.acquired, '회'], ['타고난 검사', scores.innate, '점']] as const).entries()) {
   const x = left + index * (tableWidth + gap), top = 394, header = 438, rowHeight = 47
   text(title, x, top, 22, tableWidth)
   doc.rect(x, header, tableWidth, 39).fill('#203d34')
   text(index === 0 ? '선택 번호' : '분류', x + 12, header + 11, 14, 100, '#ffffff')
   text(index === 0 ? '선택 횟수' : '총점', x + 114, header + 11, 14, tableWidth - 126, '#ffffff', 'right')
   const allRows = [...rows, ['합계', rows.reduce((sum, [, score]) => sum + score, 0)] as [string, number]]
   allRows.forEach(([label, score], i) => {
    const y = header + 39 + i * rowHeight
    doc.rect(x, y, tableWidth, rowHeight).fill(i === 4 ? '#dce9df' : i % 2 ? '#f3f6f2' : '#ffffff')
    doc.rect(x, y, tableWidth, rowHeight).lineWidth(.6).strokeColor('#b8c9bf').stroke()
    const symbol = ['①', '②', '③', '④'].includes(label)
    doc.font(symbol ? 'symbols' : 'korean').fontSize(21).fillColor('#152c24').text(label, x + 14, y + (symbol ? -1 : 12), { width: 95, lineBreak: false })
    text(`${score}${unit}`, x + 110, y + 12, 22, tableWidth - 124, '#152c24', 'right')
   })
  }
  text('두 검사의 점수는 합산하지 않습니다.', left, 743, 13, width)
  text('체질 판정을 제공하지 않습니다.', left, 765, 13, width)
  text(mode === 'mock' ? '실제 이메일 미발송 · 서버 PDF 영구 저장 없음' : '가상 이메일 시험 · 서버 PDF 저장 없음 · 메일함 사본 별도 정리', left, 791, 10, width, '#52635a')
  doc.end()
 } catch { doc.destroy(new Error('PDF generation failed')) }
 return output
}

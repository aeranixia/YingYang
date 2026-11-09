import PDFDocument from 'pdfkit'
import { join } from 'node:path'
import { calculate } from './submission'
import { constitutions, highestScores } from '../../src/questionnaires'
import type { Submission } from '../../src/staging/contracts'
import { formatPhone } from '../../src/phone'

export async function createSasangPdf(input: Submission, completed: string, production: boolean): Promise<Buffer> {
 const scores = calculate(input), doc = new PDFDocument({ size: 'A4', margin: 36, font: join(__dirname, '../../../assets/NanumGothic-Regular.ttf'), info: { Title: '체질검사 결과', Author: 'YingYang' } })
 const chunks: Buffer[] = [], output = new Promise<Buffer>((resolve, reject) => {
  doc.on('data', b => chunks.push(b)); doc.on('end', () => { const bytes = Buffer.concat(chunks); chunks.forEach(b => b.fill(0)); resolve(bytes) }); doc.on('error', () => { chunks.forEach(b => b.fill(0)); reject(Error('PDF generation failed')) })
 })
 const text = (s: string, x: number, y: number, size: number, width = 523, color = '#203d34', align: 'left' | 'center' = 'left') => doc.fontSize(size).fillColor(color).text(s, x, y, { width, lineBreak: false, align })
 const series = [{ title: '선천적 사상체질', rows: scores.innate, color: '#087f86' }, { title: '후천적 사상페르소나', rows: scores.acquired, color: '#c25d10' }]
 try {
  text(production ? 'YingYang · 80문항' : 'STAGING · 가상 정보 · 모의 처리', 36, 25, 11)
  text('체질검사 결과', 36, 48, 27)
  text('이름', 36, 94, 11); text(input.name, 36, 112, 20, 250)
  text('전화번호', 310, 94, 11); text(formatPhone(input.phone), 310, 112, 20, 250)
  text('검사 완료 확인 일시 (KST)', 36, 150, 11); text(completed, 36, 168, 16)
  text('문제집: 80문항 · 서버 완료 확인 시각이며 발송 시각과 다릅니다.', 36, 197, 10)
  series.forEach((s, i) => {
   const x = 36 + i * 274, w = 249
   text(s.title, x, 226, 17, w)
   constitutions.forEach((g, col) => {
    const cx = x + col * w / 4
    doc.rect(cx, 255, w / 4, 30).fill('#e9f0ed'); text(g, cx, 263, 13, w / 4, '#203d34', 'center')
    text(s.rows[col][1] + ' / 10', cx, 295, 15, w / 4, s.color, 'center')
   })
   const highest = highestScores(s.rows)
   text((highest.length > 1 ? '공동 최고점: ' : '최고점: ') + highest.join('·'), x, 324, 11, w)
  })
  function chart(label: string, cx: number, cy: number, r: number, selected: typeof series) {
   text(label, cx - r - 32, cy - r - 43, 14, (r + 32) * 2, '#203d34', 'center')
   const point = (axis: number, value: number) => { const d = [[0, -1], [1, 0], [0, 1], [-1, 0]][axis]; return [cx + d[0] * r * value / 10, cy + d[1] * r * value / 10] as [number, number] }
   for (const n of [2, 4, 6, 8, 10]) { doc.polygon(...constitutions.map((_, i) => point(i, n))).lineWidth(.5).strokeColor('#b7c8c2').stroke(); text(String(n), cx + 4, cy - r * n / 10, 7, 15) }
   constitutions.forEach((g, i) => { const p = point(i, 10); doc.moveTo(cx, cy).lineTo(...p).strokeColor('#b7c8c2').stroke(); text(g, p[0] - 21 + (i === 1 ? 22 : i === 3 ? -22 : 0), p[1] + (i === 0 ? -20 : i === 2 ? 6 : -6), 12, 42, '#203d34', 'center') })
   for (const s of selected) { doc.save().fillOpacity(.2).polygon(...s.rows.map(([, n], i) => point(i, n))).fill(s.color).restore(); doc.polygon(...s.rows.map(([, n], i) => point(i, n))).lineWidth(1.8).strokeColor(s.color).stroke(); s.rows.forEach(([, n], i) => doc.circle(...point(i, n), 2).fill(s.color)) }
   text('0', cx - 10, cy + 3, 8, 10)
  }
  chart(series[0].title, 160, 455, 65, [series[0]]); chart(series[1].title, 434, 455, 65, [series[1]])
  chart('선천적·후천적 비교', 297, 650, 65, series)
  text('청록: 선천적 사상체질', 46, 741, 11, 245, series[0].color); text('주황: 후천적 사상페르소나', 306, 741, 11, 249, series[1].color)
  text('공통 축 0~10점 · 두 검사는 합산하지 않습니다. 체질 확정 진단이 아닙니다.', 36, 769, 10)
  text('관리자 PDF 임시 보관 7일 · Drive 사본은 별도 정책 적용', 36, 791, 9)
  doc.end()
 } catch { doc.destroy(Error('PDF generation failed')) }
 return output
}

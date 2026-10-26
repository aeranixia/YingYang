const fs = require('node:fs'), path = require('node:path')
const { createPdf } = require('../functions/lib/functions/src/pdf')
async function render() {
 const input = { name: '가상테스터', phone: '01000001234', acquired: [1,2,3,4,1,2,3,4,1,2], innate: Array(40).fill(2) }
 const bytes = await createPdf(input, new Date('2026-10-26T15:30:00Z'))
 const { getDocument } = await import('../functions/node_modules/pdfjs-dist/legacy/build/pdf.mjs')
 const { createCanvas } = require('../functions/node_modules/@napi-rs/canvas')
 const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false })
 try {
  const pdf = await loading.promise
  if (pdf.numPages !== 1) throw Error('Expected one A4 page')
  const page = await pdf.getPage(1), viewport = page.getViewport({ scale: 1.6 })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise
  const output = path.join(__dirname, '../docs/previews/issue-5-pdf.png')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, canvas.toBuffer('image/png'))
  console.log('Synthetic PDF rendered: docs/previews/issue-5-pdf.png (fixed example time)')
 } finally { await loading.destroy(); bytes.fill(0) }
}
render().catch(() => { console.error('Synthetic PDF preview failed'); process.exitCode = 1 })

import { copyFileSync, mkdirSync } from 'node:fs'

mkdirSync('dist-staging/previews', { recursive: true })
copyFileSync('docs/previews/issue-5-pdf.png', 'dist-staging/previews/issue-5-pdf.png')
copyFileSync('docs/previews/issue-6-pdf.png', 'dist-staging/previews/issue-6-pdf.png')

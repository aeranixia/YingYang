import { copyFileSync, mkdirSync } from 'node:fs'

mkdirSync('dist-staging/previews', { recursive: true })
copyFileSync('docs/previews/issue-5-pdf.png', 'dist-staging/previews/issue-5-pdf.png')
copyFileSync('docs/previews/issue-6-pdf.png', 'dist-staging/previews/issue-6-pdf.png')
copyFileSync('docs/previews/issue-4-privacy-policy.png', 'dist-staging/previews/issue-4-privacy-policy.png')
copyFileSync('docs/previews/issue-7-admin-desktop.png', 'dist-staging/previews/issue-7-admin-desktop.png')
copyFileSync('docs/previews/issue-7-admin-mobile.png', 'dist-staging/previews/issue-7-admin-mobile.png')

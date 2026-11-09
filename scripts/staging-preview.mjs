import { copyFileSync, mkdirSync } from 'node:fs'

mkdirSync('dist-staging/previews', { recursive: true })
copyFileSync('docs/previews/issue-5-pdf.png', 'dist-staging/previews/issue-5-pdf.png')
copyFileSync('docs/previews/issue-6-pdf.png', 'dist-staging/previews/issue-6-pdf.png')
copyFileSync('docs/previews/issue-4-privacy-policy.png', 'dist-staging/previews/issue-4-privacy-policy.png')
copyFileSync('docs/previews/issue-7-admin-desktop.png', 'dist-staging/previews/issue-7-admin-desktop.png')
copyFileSync('docs/previews/issue-7-admin-mobile.png', 'dist-staging/previews/issue-7-admin-mobile.png')
copyFileSync('docs/previews/issue-8-pdf.png', 'dist-staging/previews/issue-8-pdf.png')
copyFileSync('docs/previews/issue-8-admin.png', 'dist-staging/previews/issue-8-admin.png')
for (const name of ['issue-9-pdf.png', 'issue-9-admin.png', 'issue-9-mobile.png']) copyFileSync('docs/previews/'+name, 'dist-staging/previews/'+name)

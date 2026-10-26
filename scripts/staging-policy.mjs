import fs from 'node:fs'

export const stagingProject = 'yingyangtest'
export function validateStaging({ project, config, aliases, html, publicConfig }) {
 if (project !== stagingProject) throw new Error('Staging 배포는 yingyangtest에만 허용됩니다.')
 if (aliases.projects?.default) throw new Error('기본 배포 프로젝트를 지정할 수 없습니다.')
 if (aliases.projects?.staging !== stagingProject || aliases.projects?.production !== 'yingyangcheck') throw new Error('환경 별칭이 일치하지 않습니다.')
 if (config.hosting?.site !== stagingProject || config.hosting?.public !== 'dist-staging') throw new Error('Staging Hosting 대상이 일치하지 않습니다.')
 if (config.functions?.length !== 1 || config.functions[0].source !== 'functions' || config.functions[0].codebase !== 'yingyang-staging') throw new Error('Staging Functions 코드베이스가 일치하지 않습니다.')
 if (!html.includes('name="yingyang-environment" content="staging"')) throw new Error('Staging 전용 빌드가 아닙니다.')
 if (!publicConfig.includes('"projectId": "yingyangtest"') || publicConfig.includes('yingyangcheck')) throw new Error('브라우저 프로젝트가 Staging이 아닙니다.')
 const headers = config.hosting.headers?.flatMap(rule => rule.headers || []) || []
 if (!headers.some(header => header.key === 'X-Robots-Tag' && header.value.includes('noindex'))) throw new Error('검색 색인 차단 설정이 필요합니다.')
 return true
}
export function checkFiles(root = process.cwd()) {
 const read = file => fs.readFileSync(new URL(file, `file:///${root.replaceAll('\\', '/')}/`), 'utf8')
 return validateStaging({ project: stagingProject, config: JSON.parse(read('firebase.staging.json')), aliases: JSON.parse(read('.firebaserc')), html: read('dist-staging/staging.html'), publicConfig: read('src/staging/public-config.ts') })
}

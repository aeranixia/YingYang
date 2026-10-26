import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateStaging } from './staging-policy.mjs'
const valid = () => ({
 project: 'yingyangtest', aliases: { projects: { staging: 'yingyangtest', production: 'yingyangcheck' } },
 config: { hosting: { site: 'yingyangtest', public: 'dist-staging', headers: [{ headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] }] }, functions: [{ source: 'functions', codebase: 'yingyang-staging' }] },
 html: '<meta name="yingyang-environment" content="staging">', publicConfig: '{"projectId": "yingyangtest"}',
 serverEnv: 'STAGING_ENV=stage-bc\nMAIL_MODE=mock\nSEND_ENABLED=false',
})
test('정상 테스트 대상만 허용', () => assert.equal(validateStaging(valid()), true))
test('운영 프로젝트·사이트·기본 대상·다른 빌드 차단', () => {
 for (const mutate of [
  x => { x.project = 'yingyangcheck' }, x => { x.config.hosting.site = 'yingyangcheck' },
  x => { x.aliases.projects.default = 'yingyangcheck' }, x => { x.config.hosting.public = 'dist' },
  x => { x.html = '<html>production</html>' }, x => { x.publicConfig = '{"projectId":"yingyangcheck"}' },
  x => { x.config.functions[0].codebase = 'production' }, x => { x.config.hosting.headers = [] },
  x => { x.serverEnv = 'STAGING_ENV=production\nMAIL_MODE=live\nSEND_ENABLED=true' },
  x => { x.serverEnv += '\nCLINIC_RECIPIENT_EMAIL=forbidden@example.invalid' },
 ]) { const x = valid(); mutate(x); assert.throws(() => validateStaging(x)) }
})

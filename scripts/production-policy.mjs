import fs from 'node:fs'
export function validateProduction({config,sdk,html,assets,env}) {
 if(config.hosting?.site!=='yingyangcheck'||config.hosting?.public!=='dist'||config.functions?.length!==1||config.functions[0].codebase!=='yingyang-production')throw Error('운영 배포 대상이 다릅니다.')
 if(sdk.projectId!=='yingyangcheck'||sdk.authDomain!=='yingyangcheck.firebaseapp.com'||!sdk.appId?.startsWith('1:231582543863:web:')||!sdk.recaptchaSiteKey)throw Error('운영 Firebase 설정을 확인해 주세요.')
 if(!html.includes('yingyang-environment" content="production')||html.includes('staging.html')||assets.includes('yingyangtest.firebaseapp.com')||assets.includes('asia-northeast3-yingyangtest.cloudfunctions.net'))throw Error('운영 빌드에 Staging 설정이 포함되어 있습니다.')
 const values=Object.fromEntries(env.trim().split(/\r?\n/).map(line=>line.split('=')))
 if(!['false','true'].includes(values.PRODUCTION_SEND_ENABLED)||values.YINGYANG_PROJECT_ID!=='yingyangcheck'||Object.keys(values).length!==2)throw Error('운영 전송 차단 설정을 확인해 주세요.')
 return true
}
export function checkProduction(){
 const read=p=>fs.readFileSync(p,'utf8'),source=read('src/production/public-config.ts'),sdk=JSON.parse(source.slice(source.indexOf('{'),source.lastIndexOf('}')+1))
 const assets=fs.readdirSync('dist/assets').filter(p=>p.endsWith('.js')).map(p=>read('dist/assets/'+p)).join('')
 const home=read('dist/index.html'),exam=read('dist/exam.html'),privacy=read('dist/privacy.html')
 if(!home.includes('href="/privacy"')||home.includes('type="module"')||!privacy.includes('개인정보처리방침')||!exam.includes('yingyang-environment" content="production'))throw Error('공개 홈페이지·정책·검사 진입 분리를 확인해 주세요.')
 return validateProduction({config:JSON.parse(read('firebase.json')),sdk,html:read('dist/index.html'),assets,env:read('functions/.env.yingyangcheck')})
}

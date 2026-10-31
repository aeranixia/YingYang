import {spawnSync} from 'node:child_process'
import {checkProduction} from './production-policy.mjs'
if(process.argv.length>2)throw Error('배포 대상 변경 인자는 허용하지 않습니다.')
if(spawnSync('git',['branch','--show-current'],{encoding:'utf8'}).stdout.trim()!=='main')throw Error('운영 배포는 main에서 실행해 주세요.')
function run(command,args){const r=spawnSync(command,args,{stdio:'inherit',shell:process.platform==='win32'});if(r.status!==0)process.exit(r.status||1)}
const npm=process.platform==='win32'?'npm.cmd':'npm'
for(const args of [['test'],['run','build'],['run','functions:build'],['run','functions:test']])run(npm,args)
checkProduction()
run(process.platform==='win32'?'npx.cmd':'npx',['firebase-tools','deploy','--only','hosting,functions:yingyang-production','--project','yingyangcheck','--config','firebase.json','--non-interactive'])

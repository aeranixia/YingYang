import { spawnSync } from 'node:child_process'
import { checkFiles, stagingProject } from './staging-policy.mjs'

if (process.argv.length > 2) throw new Error('배포 대상 변경 인자는 허용하지 않습니다.')
for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT']) {
 if (process.env[name] && process.env[name] !== stagingProject) throw new Error('외부 프로젝트 환경값이 Staging과 다릅니다.')
}
function run(command, args) {
 const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
 if (result.status !== 0) process.exit(result.status || 1)
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
run(npm, ['test'])
run(npm, ['run', 'build:staging'])
run(npm, ['run', 'functions:build'])
run(npm, ['run', 'functions:test'])
checkFiles()
run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['firebase-tools', 'deploy', '--only', 'hosting,functions:yingyang-staging', '--project', stagingProject, '--config', 'firebase.staging.json', '--non-interactive'])

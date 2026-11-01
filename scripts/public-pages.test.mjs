import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {publicPages} from './public-pages.mjs'

const content=JSON.parse(fs.readFileSync(new URL('../content/public-site.json',import.meta.url),'utf8'))
test('OAuth public pages include readable HTML and policy links without the Firebase application',()=>{
 const pages=publicPages(content)
 for(const page of Object.values(pages)){
  assert.ok(page.includes('<h1>')&&page.includes('href="/privacy"')&&page.includes('href="/terms"'))
  assert.ok(!page.includes('src/production')&&!page.includes('type="module"')&&!page.includes('firebaseapp.com'))
  assert.ok(!/[-\w.+]+@[-\w.]+\.[a-z]{2,}/i.test(page),'Public pages must not disclose operational account addresses')
 }
 assert.ok(pages.home.includes('href="/exam"')&&pages.home.includes('후천적')&&pages.home.includes('Google'))
})
test('policy distinguishes seven-day server copies, indefinite Drive copies and actual API purposes',()=>{
 const page=publicPages(content).privacy
 for(const phrase of ['서버 PDF와 Drive','7일','보관 기한을 정하지 않고','gmail.send','drive.file','받은편지함','AI 모델 학습','NCII','권리행사','1800-7544'])assert.ok(page.includes(phrase),phrase)
})
test('public content escapes markup instead of injecting operator-controlled HTML',()=>{
 const pages=publicPages({...content,operator:'<img src=x onerror=alert(1)>'})
 assert.ok(!pages.home.includes('<img src=x'))
 assert.ok(pages.home.includes('&lt;img'))
})

test('Google policy explains access, use, recipients, storage and deletion for every integration',()=>{
 assert.equal(content.googleData.length,3)
 for(const service of content.googleData)for(const field of ['service','access','use','share','storage','deletion'])assert.ok(typeof service[field]==='string'&&service[field].length>10,service.service+':'+field)
 const page=publicPages(content).privacy
 for(const field of ['YingYang 개인정보처리방침','프로필 사진 URL','공유·전달 대상','보관 기간과 삭제 방법','권한 회수만으로','Limited Use','범용 AI','정책 버전'])assert.ok(page.includes(field),field)
})

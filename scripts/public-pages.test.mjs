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
 for(const phrase of ['서버 PDF','7일','기한 제한 없이','Gmail','Google Drive','받은편지함','AI·기계학습','권리행사','1800-7544'])assert.ok(page.includes(phrase),phrase)
})
test('public content escapes markup instead of injecting operator-controlled HTML',()=>{
 const pages=publicPages({...content,operator:'<img src=x onerror=alert(1)>'})
 assert.ok(!pages.home.includes('<img src=x'))
 assert.ok(pages.home.includes('&lt;img'))
})

test('concise Google policy retains essential disclosures without operational details',()=>{
 const page=publicPages(content).privacy
 for(const field of ['YingYang 개인정보처리방침','Google 데이터의 접근과 사용','공유 대상과 사용 제한','보관 기간과 삭제','정보 보호','권리행사·동의 거부·문의','Limited Use','정책 버전'])assert.ok(page.includes(field),field)
 for(const detail of ['Secret Manager','체크섬','gmail.send','drive.file','프로필 사진 URL'])assert.ok(!page.includes(detail),detail)
})

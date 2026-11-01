import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const escape = text => String(text).replace(/[&<>"']/g, value => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[value]))
export function publicPages(content) {
 const section = (title, paragraphs) => `<section><h2>${escape(title)}</h2>${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</section>`
 const status = `<aside aria-label="Drive 제공 상태">${escape(content.driveStatus)}</aside>`
 const dataFields=[['access','접근하는 Google 데이터'],['use','사용 목적'],['share','공유·전달 대상'],['storage','보관 위치와 보호'],['deletion','보관 기간과 삭제 방법']]
 const googleData=`<section aria-labelledby="google-data"><h2 id="google-data">Google 사용자 데이터 처리 내역</h2>${content.googleData.map(item=>`<article><h3>${escape(item.service)}</h3><dl>${dataFields.map(([key,label])=>`<dt>${label}</dt><dd>${escape(item[key])}</dd>`).join('')}</dl></article>`).join('')}</section>`
 const links = '<nav aria-label="주요 메뉴"><a href="/">서비스 소개</a><a href="/privacy">개인정보처리방침</a><a href="/terms">이용약관</a><a href="/admin">관리자 로그인</a></nav>'
 const shell = (title, body) => `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="yingyang-environment" content="production"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="YingYang 체질검사와 PDF 결과 전달, 한의원 전용 Google Drive 백업 안내"><title>${escape(title)} | YingYang</title><link rel="stylesheet" href="/public-site.css"><script defer src="/public-site.js"></script></head><body><a class="skip" href="#content">본문으로 건너뛰기</a><div class="public-shell"><header><a class="brand" href="/">YingYang</a><div class="font-settings" role="group" aria-label="글자 크기"><span>글자 크기</span><button type="button" data-size="small" aria-label="글자 크기 소" aria-pressed="false">소</button><button type="button" data-size="medium" aria-label="글자 크기 중" aria-pressed="true">중</button><button type="button" data-size="large" aria-label="글자 크기 대" aria-pressed="false">대</button></div></header>${links}<main id="content"><h1>${escape(title)}</h1>${body}</main><footer><p>${escape(content.operator)} · ${escape(content.department)}<br>${escape(content.contact)}</p>${links}</footer></div></body></html>`
 return {
  home:shell('나를 알아보는 체질검사',`<p class="lead">YingYang은 ${escape(content.operator)}의 진료 준비를 돕는 사전 검사 서비스입니다.</p>${section('검사하고, 결과를 전달하세요',['후천적 체질검사 10문항과 타고난 체질검사 40문항에 응답하면 각 검사의 점수를 집계합니다. 이름·전화번호와 동의를 확인한 뒤 결과 PDF를 한의원의 고정 업무 이메일로 전달합니다. 임의의 체질 판정이나 AI 진단을 만들지 않습니다.'])}<a class="primary" href="/exam">검사 시작·이어하기</a>${section('PDF 보관과 한의원 전용 백업',['관리자는 승인된 Google 계정으로 로그인해 이력을 확인하고 생성 후7일 이내의 PDF를 다운로드합니다. Google Drive 백업을 활성화하면 한의원 소유의 비공개 폴더에 별도 사본을 무기한 보관합니다. 앱에는 Drive 자동 삭제·삭제 API·관리자 삭제 기능이 없습니다.'])}${status}${section('Google 계정은 언제 사용하나요?',['환자는 Google 로그인 없이 검사할 수 있습니다. 검사를 시작하면 보안을 위한 익명 검사 세션과 동의 확인을 진행합니다. Google 로그인은 승인된 관리자 인증에 사용하고, Gmail과 Drive OAuth는 계정 소유자가 서버의 PDF 전달·백업을 승인하는 데 사용합니다.'])}<p><a href="/privacy">수집 정보·Google API 사용·보관 및 삭제 정책 자세히 보기</a></p>`),
  privacy:shell('YingYang 개인정보처리방침',`<p>시행일: ${escape(content.effectiveDate)} · 정책 버전: ${escape(content.policyVersion)}</p><p>${escape(content.policyChangeNotice)}</p>${status}${googleData}${content.privacy.map(s=>section(s.title,s.paragraphs)).join('')}<section><h2>Google 공식 정책</h2><ul><li><a href="https://policies.google.com/privacy">Google 개인정보처리방침</a></li><li><a href="https://firebase.google.com/support/privacy">Firebase 개인정보 처리 안내</a></li><li><a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy 및 Limited Use</a></li><li><a href="https://developers.google.com/terms">Google APIs Terms of Service</a></li></ul></section>`),
  terms:shell('이용약관',`${section('제공하는 기능',['YingYang은 후천적10문항·타고난40문항의 검사, 응답 임시 저장·이어하기, 고정 규칙 집계와 요청한 PDF 결과 전달을 제공합니다. 관리자 기능은 승인된 Google 계정에 한해 제공하며 환자에게 관리자 가입을 요구하지 않습니다.'])}${section('이용자의 선택과 책임',['검사 전과 PDF 처리 시 각 안내와 동의를 확인해 주세요. 다른 사람의 개인정보를 임의로 입력하거나 접근 제한을 우회하지 마세요. 기기·메일·Drive에서 다운로드하거나 복사한 자료는 해당 관리자와 계정 소유자가 관리합니다.'])}${section('전송과 백업',['메일 발송 접수는 수신함 도착 확인과 다릅니다. 발송 결과가 불명확하면 자동 재발송을 제한합니다. Drive 백업은 메일 발송과 별도로 처리합니다. 서버 PDF7일 만료와 Drive 사본의 무기한 보관은 별도 정책입니다.'])}${status}${section('문의와 정책',['서비스 이용·전송 오류·개인정보 권리행사는 유케이(UK)한의원 접수실(프론트), 1800-7544 / 1800-6544로 연락해 주세요. 개인정보의 상세 처리는 개인정보처리방침에서 안내합니다.'])}<p><a href="/privacy">개인정보처리방침 보기</a></p>`)
 }
}
export function writePublicPages(directory='dist') {
 const content=JSON.parse(fs.readFileSync(new URL('../content/public-site.json',import.meta.url),'utf8'))
 const pages=publicPages(content),entry=directory+'/index.html'
 fs.copyFileSync(entry,directory+'/exam.html')
 fs.writeFileSync(entry,pages.home)
 for(const [path,page]of [['privacy',pages.privacy],['terms',pages.terms]])fs.writeFileSync(directory+'/'+path+'.html',page)
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)writePublicPages()

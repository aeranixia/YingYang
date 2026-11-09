import { defaultBooks, type BookSettings } from '../book-settings'
import { useEffect, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { initializeApp } from 'firebase/app'
import { initializeAuth, inMemoryPersistence, browserPopupRedirectResolver, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { getFunctions, httpsCallable } from 'firebase/functions'
import config from './public-config'
import { PrivacyGate } from './PrivacyGate'
import { PrivacyPolicy } from './PrivacyPolicy'
import { AdminPortal } from './AdminPortal'
import type { Submission, MockReceipt } from './contracts'
import { loginErrorMessage } from './login'
import { confirmPending } from './completion'
import { privacyVersion, type PrivacyReceipt } from './privacy-storage'
import '../style.css'
import './staging.css'
import './exam.css'

if (config.projectId !== 'yingyangtest') throw new Error('Staging 프로젝트 설정이 아닙니다.')
const app = initializeApp(config)
const auth = initializeAuth(app, { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver })
initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(config.recaptchaSiteKey), isTokenAutoRefreshEnabled: true })
const checkStatus = httpsCallable<Record<string, never>, { phase: string; projectId: string; mailMode: string; secretReady: boolean; books: BookSettings }>(getFunctions(app, 'asia-northeast3'), 'stagingStatus')
const submitReport = httpsCallable<Submission, MockReceipt>(getFunctions(app, 'asia-northeast3'), 'submitMockReport')
const sendReport = async (input: Submission) => (await submitReport(input)).data
const confirmReport = async (input: Parameters<Parameters<typeof confirmPending>[1]>[0]) => (await httpsCallable<typeof input, { proof: string }>(getFunctions(app, 'asia-northeast3'), 'stagingStatus')(input)).data
const authorizePrivacy = async () => (await httpsCallable<unknown, PrivacyReceipt>(getFunctions(app, 'asia-northeast3'), 'stagingStatus')({ action: 'consent-privacy', version: privacyVersion, personal: true, sensitive: true })).data
const verifyPrivacy = async (privacyProof: string) => (await httpsCallable(getFunctions(app, 'asia-northeast3'), 'stagingStatus')({ action: 'verify-privacy', privacyProof })).data

function Staging() {
 const [books,setBooks]=useState(defaultBooks)
 const [user, setUser] = useState<User | null>(null)
 const [email, setEmail] = useState(''), [password, setPassword] = useState('')
 const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [ready, setReady] = useState(false)
 useEffect(() => onAuthStateChanged(auth, current => { setUser(current); setReady(false); setNotice('') }), [])
 async function login(event: FormEvent) {
  event.preventDefault(); setBusy(true); setNotice('')
  try { await signInWithEmailAndPassword(auth, email.trim(), password.trim()); setPassword('') }
  catch (error) { setNotice(loginErrorMessage(error)) }
  finally { setBusy(false) }
 }
 async function verify() {
  setBusy(true); setNotice(''); setReady(false)
  try {
   const { data } = await checkStatus({})
   if (data.phase !== 'BC' || data.projectId !== 'yingyangtest' || data.mailMode !== 'mock' || !data.secretReady) throw new Error('Invalid environment')
   setBooks(data.books); setReady(true); setNotice('테스트 계정 권한·App Check·서버 비밀 설정 확인을 통과했습니다.')
  } catch { setNotice('환경 확인을 통과하지 못했습니다. 계정 권한과 브라우저의 보안 검증 설정을 확인한 뒤 다시 시도해 주세요.') }
  finally { setBusy(false) }
 }
 if (user && ready) return <><div className="staging-ribbon">STAGING · 가상 데이터 전용 · 실제 이메일 발송 없음 <button onClick={() => { void signOut(auth); setPassword('') }}>로그아웃</button><a href="/admin">관리자 페이지</a></div><PrivacyGate books={books} authorize={authorizePrivacy} verify={verifyPrivacy} send={sendReport} confirm={confirmReport}/></>
 return <div className="stage-shell"><header><strong>YingYang</strong><span className="stage-badge">STAGING · v1.2 개발 · B·C단계</span></header><main>
  <h1>접근이 제한된 테스트 환경</h1><p>가상 정보만 사용하세요. 운영 사이트와 연결되지 않습니다.</p>
  <aside>두 검진 완료 후 지정된 가상 이름·전화번호로 PDF 생성과 모의 처리를 테스트합니다. 실제 개인정보 입력과 실제 이메일 발송은 금지됩니다.</aside>
  <section aria-label="개인정보처리방침"><PrivacyPolicy/></section>
  {!user ? <form onSubmit={login}><h2>테스트 계정 로그인</h2><p>테스트 계정: staging-tester@yingyangtest.invalid</p><p id="password-help"><a href="https://console.cloud.google.com/security/secret-manager/secret/STAGING_TESTER_PASSWORD/versions?project=yingyangtest" target="_blank" rel="noopener noreferrer">Secret Manager에서 최신 비밀번호 확인</a> → 사용 설정된 최신 버전 → 비밀 값 보기/복사. 버전 번호나 리소스 이름 대신 비밀 값만 입력하세요. 앞뒤 공백은 자동 제거합니다. 비밀번호를 이슈나 채팅에 공유하지 마세요.</p><label>테스트 계정 이메일<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>비밀번호<input type="password" autoComplete="current-password" aria-describedby="password-help" required value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button></form> : <section><h2>Staging 환경 확인</h2><p>프로젝트: <strong>yingyangtest</strong></p><p>메일 발송: <strong>차단됨</strong></p><p>권한 확인 후 Staging 검진과 모의 전송 화면을 엽니다. 실제 이메일은 발송하지 않습니다.</p><button disabled={busy} onClick={verify}>{busy ? '확인 중…' : '테스트 접근 권한과 서버 확인'}</button>{ready && <p className="stage-ok">✓ A단계 서버 접근 확인 완료</p>}<button className="stage-secondary" disabled={busy} onClick={() => { void signOut(auth); setPassword('') }}>로그아웃</button></section>}
  {notice && <p role="status" className="stage-notice">{notice}</p>}
  <footer>로그인 상태는 새로고침하면 해제됩니다. 검진 응답·글자 크기·동의 증명과 보관 기간은 이 브라우저에 저장하며, 이름·전화번호는 저장하지 않습니다.</footer>
 </main></div>
}
createRoot(document.getElementById('root')!).render(location.pathname==='/admin'?<AdminPortal questionnaires driveBackup environmentLabel="v1.3.0 STAGING" auth={auth} functions={getFunctions(app,'asia-northeast3')}/>:<Staging />)

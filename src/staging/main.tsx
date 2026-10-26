import { useEffect, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { initializeApp } from 'firebase/app'
import { initializeAuth, inMemoryPersistence, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { getFunctions, httpsCallable } from 'firebase/functions'
import config from './public-config'
import './staging.css'

if (config.projectId !== 'yingyangtest') throw new Error('Staging 프로젝트 설정이 아닙니다.')
const app = initializeApp(config)
const auth = initializeAuth(app, { persistence: inMemoryPersistence })
initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(config.recaptchaSiteKey), isTokenAutoRefreshEnabled: true })
const checkStatus = httpsCallable<Record<string, never>, { phase: string; projectId: string; mailMode: string; secretReady: boolean }>(getFunctions(app, 'asia-northeast3'), 'stagingStatus')

function Staging() {
 const [user, setUser] = useState<User | null>(null)
 const [email, setEmail] = useState(''), [password, setPassword] = useState('')
 const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [ready, setReady] = useState(false)
 useEffect(() => onAuthStateChanged(auth, current => { setUser(current); setReady(false); setNotice('') }), [])
 async function login(event: FormEvent) {
  event.preventDefault(); setBusy(true); setNotice('')
  try { await signInWithEmailAndPassword(auth, email.trim(), password); setPassword('') }
  catch { setNotice('로그인하지 못했습니다. 승인된 테스트 계정과 비밀번호를 확인해 주세요.') }
  finally { setBusy(false) }
 }
 async function verify() {
  setBusy(true); setNotice(''); setReady(false)
  try {
   const { data } = await checkStatus({})
   if (data.phase !== 'A' || data.projectId !== 'yingyangtest' || data.mailMode !== 'disabled' || !data.secretReady) throw new Error('Invalid environment')
   setReady(true); setNotice('테스트 계정 권한·App Check·서버 비밀 설정 확인을 통과했습니다.')
  } catch { setNotice('환경 확인을 통과하지 못했습니다. 계정 권한과 브라우저의 보안 검증 설정을 확인한 뒤 다시 시도해 주세요.') }
  finally { setBusy(false) }
 }
 return <div className="stage-shell"><header><strong>YingYang</strong><span className="stage-badge">STAGING · v1.2 개발 · A단계</span></header><main>
  <h1>접근이 제한된 테스트 환경</h1><p>가상 정보만 사용하세요. 운영 사이트와 연결되지 않습니다.</p>
  <aside>현재는 환경 구축 단계입니다. 검진 변경, PDF 생성, 이메일 전송 기능은 아직 제공하지 않습니다. 실제 개인정보를 입력하지 마세요.</aside>
  {!user ? <form onSubmit={login}><h2>테스트 계정 로그인</h2><label>테스트 계정 이메일<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>비밀번호<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button></form> : <section><h2>Staging 환경 확인</h2><p>프로젝트: <strong>yingyangtest</strong></p><p>메일 발송: <strong>차단됨</strong></p><p>검진·PDF·모의 이메일 구현은 다음 단계 승인 후 진행합니다.</p><button disabled={busy} onClick={verify}>{busy ? '확인 중…' : '테스트 접근 권한과 서버 확인'}</button>{ready && <p className="stage-ok">✓ A단계 서버 접근 확인 완료</p>}<button className="stage-secondary" disabled={busy} onClick={() => { void signOut(auth); setPassword('') }}>로그아웃</button></section>}
  {notice && <p role="status" className="stage-notice">{notice}</p>}
  <footer>로그인 상태는 새로고침하면 해제됩니다. 이름·전화번호·검진 응답 입력란이 없는 A단계 전용 화면입니다.</footer>
 </main></div>
}
createRoot(document.getElementById('root')!).render(<Staging />)

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, reauthenticateWithPopup, signInWithPopup, signInWithCustomToken, signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth'
import { httpsCallable, type Functions } from 'firebase/functions'
import { AdminReports } from './AdminReports'
import type { AdminQuery, AdminPage, AdminDownload } from './admin-contracts'
import './admin.css'

type Session = { role: 'none' | 'admin' | 'master'; local: boolean; mustChange: boolean; canBootstrap: boolean }
type Account = { email: string; active: boolean; bound: boolean }
type Tab = 'reports' | 'accounts' | 'settings'
const empty: Session = { role: 'none', local: false, mustChange: false, canBootstrap: false }
function errorCode(error: unknown) {
 const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
 return /^(auth|functions)\/[a-z-]+$/.test(code) ? code : ''
}
export function AdminPortal({ auth, functions }: { auth: Auth; functions: Functions }) {
 const [session, setSession] = useState(empty), [signed, setSigned] = useState(false), [checking, setChecking] = useState(true)
 const [account, setAccount] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
 const [tab, setTab] = useState<Tab>('reports'), [needsReauth, setNeedsReauth] = useState(false)
 const [password, setPassword] = useState(''), [current, setCurrent] = useState(''), [next, setNext] = useState(''), [confirmation, setConfirmation] = useState('')
 const [setup, setSetup] = useState(false), [operatorEmail, setOperatorEmail] = useState(''), [operatorPassword, setOperatorPassword] = useState('')
 const [email, setEmail] = useState(''), [temporary, setTemporary] = useState(''), [accounts, setAccounts] = useState<Account[]>([])
 const [resetReady, setResetReady] = useState(false)
 const pending = useRef<(() => Promise<void>) | null>(null), working = useRef(false)
 const call = useCallback(async <T,>(data: Record<string, unknown>) => (await httpsCallable<Record<string, unknown>, T>(functions, 'adminIdentity')(data)).data, [functions])
 useEffect(() => {
  let generation = 0, previousUid: string | null | undefined
  const unsubscribe = onAuthStateChanged(auth, user => {
   const id = ++generation, changed = previousUid !== (user?.uid || null)
   previousUid = user?.uid || null
   setSigned(!!user); setAccount(user?.email || '별도 마스터'); if (changed) { setSession(empty); setAccounts([]); setTab('reports'); setMessage(''); setNeedsReauth(false); pending.current = null }
   if (!user) { setChecking(false); return }
   if (changed) setChecking(true)
   void call<Session>({ action: 'session' }).then(value => { if (id === generation) setSession(value) })
    .catch(() => { if (id === generation) setMessage('권한을 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.') })
    .finally(() => { if (id === generation) setChecking(false) })
  })
  return () => { generation++; unsubscribe() }
 }, [auth, call])
 async function run(work: () => Promise<void>, sensitive = false) {
  if (working.current) return
  working.current = true; setBusy(true); setMessage('')
  try { await work() }
  catch (error) {
   const code = errorCode(error)
   if (sensitive && code === 'functions/failed-precondition') { pending.current = work; setNeedsReauth(true); setMessage('계속하려면 본인 확인이 필요합니다.') }
   else setMessage(code === 'auth/popup-closed-by-user' ? '로그인 창이 닫혔습니다. 다시 시도할 수 있습니다.' :
    code === 'auth/admin-restricted-operation' ? '등록된 Google 계정이 아닙니다. 마스터에게 승인을 요청하세요.' :
    code === 'functions/resource-exhausted' ? '요청이 많습니다. 잠시 후 다시 시도해 주세요.' :
    '처리하지 못했습니다. 입력과 권한을 확인해 주세요.' + (code ? ' (' + code + ')' : ''))
  } finally { working.current = false; setBusy(false) }
 }
 const list = useCallback(async (query: AdminQuery) => (await httpsCallable<AdminQuery, AdminPage>(functions, 'listAdminReports')(query)).data, [functions])
 const download = useCallback(async (id: string) => (await httpsCallable<{ id: string }, AdminDownload>(functions, 'downloadAdminReport')({ id })).data, [functions])
 const loadAccounts = useCallback(async () => { const result = await call<{ accounts: Account[] }>({ action: 'accounts', operation: 'list' }); setAccounts(result.accounts) }, [call])
 useEffect(() => {
  if (tab === 'accounts' && session.role === 'master' && !session.mustChange) void run(loadAccounts, true)
 }, [tab, session.role, session.mustChange, loadAccounts])
 async function localReauth() {
  const result = await call<{ token: string }>({ action: 'reauthenticate', currentPassword: current })
  setCurrent(''); await signInWithCustomToken(auth, result.token)
 }
 async function verifyAgain(event: FormEvent) {
  event.preventDefault()
  await run(async () => {
   if (session.local) await localReauth()
   else await reauthenticateWithPopup(auth.currentUser!, new GoogleAuthProvider())
   setNeedsReauth(false)
   const work = pending.current; pending.current = null
   if (work) await work()
  })
 }
 async function login(event: FormEvent) {
  event.preventDefault()
  await run(async () => { const result = await call<{ token: string }>({ action: 'login', username: 'admin', password }); setPassword(''); await signInWithCustomToken(auth, result.token) })
 }
 async function change(event: FormEvent) {
  event.preventDefault()
  if (next !== confirmation) { setMessage('새 비밀번호가 서로 다릅니다.'); return }
  await run(async () => {
   await localReauth(); await call({ action: 'change-password', newPassword: next })
   setNext(''); setConfirmation(''); await signOut(auth); setMessage('비밀번호를 변경했습니다. 새 비밀번호로 로그인하세요.')
  })
 }
 async function manage(operation: string, fields: Record<string, unknown> = {}) {
  await call({ action: 'accounts', operation, ...fields })
  await loadAccounts()
 }
 function navigate(value: Tab) { setTab(value); setMessage(''); setNeedsReauth(false); pending.current = null }
 const tabs: { id: Tab; label: string }[] = [{ id: 'reports', label: '발송 이력' }, ...(session.role === 'master' ? [{ id: 'accounts' as const, label: '관리자 계정' }, { id: 'settings' as const, label: '설정' }] : [])]
 function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
  const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
  if (nextIndex < 0) return
  event.preventDefault(); navigate(tabs[nextIndex].id); document.getElementById('admin-tab-' + tabs[nextIndex].id)?.focus()
 }
 const notice = message && <p className="admin-notice" role="status">{message}</p>
 const localLogin = <form onSubmit={login} className="admin-form"><label>마스터 ID<input value="admin" readOnly autoComplete="username" /></label><label>마스터 비밀번호<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={busy}>마스터 로그인</button></form>
 const passwordForm = <form onSubmit={change} className="admin-form"><label>현재 비밀번호<input type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></label><label>새 비밀번호 (12자 이상)<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={next} onChange={e => setNext(e.target.value)} /></label><label>새 비밀번호 확인<input type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><button disabled={busy}>비밀번호 변경</button></form>
 const logout = <button className="admin-button-secondary" disabled={busy} onClick={() => void run(async () => { await signOut(auth); setPassword(''); setCurrent(''); setNext(''); setConfirmation(''); setTemporary(''); setResetReady(false) })}>로그아웃</button>
 const top = <header className="admin-top"><div><span className="admin-kicker">YingYang · STAGING</span><h1>관리자</h1></div>{signed && <div className="admin-account"><div><span className="admin-account-name">{session.local ? '별도 마스터' : account}</span><span className="admin-role">{session.role === 'master' ? '마스터' : session.role === 'admin' ? '일반 관리자' : '권한 확인'}</span></div>{logout}</div>}</header>
 if (checking) return <div className="admin-app">{top}<main className="admin-focus"><p role="status">로그인 상태를 확인하고 있습니다…</p></main></div>
 if (!signed) return <div className="admin-app">{top}<main className="admin-focus"><div className="admin-login"><span className="admin-kicker">관리자 전용</span><h2>로그인</h2><p>승인된 Google 계정으로 로그인하세요.</p>{notice}<button className="admin-google" disabled={busy} onClick={() => void run(async () => { await signInWithPopup(auth, new GoogleAuthProvider()) })}>Google로 로그인</button><details><summary>별도 마스터 ID 로그인</summary>{localLogin}</details><details open={setup} onToggle={e => setSetup(e.currentTarget.open)}><summary>최초 설정 담당자 인증</summary><form className="admin-form" onSubmit={e => { e.preventDefault(); void run(async () => { await signInWithEmailAndPassword(auth, operatorEmail.trim(), operatorPassword); setOperatorPassword(''); setSetup(false) }) }}><label>설정 담당자 이메일<input type="email" required value={operatorEmail} onChange={e => setOperatorEmail(e.target.value)} /></label><label>설정 담당자 비밀번호<input type="password" required value={operatorPassword} onChange={e => setOperatorPassword(e.target.value)} /></label><button disabled={busy}>설정 담당자 인증</button></form></details></div></main></div>
 if (session.mustChange) return <div className="admin-app">{top}<main className="admin-focus"><div className="admin-login"><span className="admin-kicker">첫 로그인 · 필수</span><h2>새 비밀번호 설정</h2><p role="alert">비밀번호를 변경해야 관리자 기능을 사용할 수 있습니다.</p>{notice}{passwordForm}</div></main></div>
 if (session.role === 'none') return <div className="admin-app">{top}<main className="admin-focus"><div className="admin-login">{session.canBootstrap ? <><h2>초기 마스터 설정</h2><p>설정 담당자 인증을 마쳤습니다.</p>{notice}{localLogin}</> : <><h2>관리자 승인 대기</h2><p>현재 계정은 승인된 관리자가 아닙니다. 마스터에게 승인을 요청하세요.</p>{notice}<button disabled={busy} onClick={() => void run(async () => setSession(await call<Session>({ action: 'session' })))}>승인 상태 새로고침</button></>}</div></main></div>
 return <div className="admin-app">{top}<nav className="admin-tabs" aria-label="관리자 메뉴" role="tablist">{tabs.map((item, index) => <button key={item.id} id={'admin-tab-' + item.id} role="tab" aria-selected={tab === item.id} aria-controls={'admin-panel-' + item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => navigate(item.id)} onKeyDown={e => tabKey(e, index)}>{item.label}</button>)}</nav><main className="admin-content">
  {notice}
  {needsReauth && <form onSubmit={verifyAgain} className="admin-reauth" aria-label="계정 관리 본인 확인"><div><h2>본인 확인</h2><p>계정 관리 작업을 계속하려면 확인해 주세요.</p></div>{session.local && <label>현재 비밀번호<input type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></label>}<button disabled={busy}>{session.local ? '본인 확인' : 'Google로 본인 확인'}</button></form>}
  <section role="tabpanel" id="admin-panel-reports" aria-labelledby="admin-tab-reports" hidden={tab !== 'reports'} tabIndex={0}><AdminReports list={list} download={download} /></section>
  {session.role === 'master' && <><section role="tabpanel" id="admin-panel-accounts" aria-labelledby="admin-tab-accounts" hidden={tab !== 'accounts'} tabIndex={0}><div className="admin-section-title"><h2>관리자 계정</h2><p>승인된 관리자는 발송 이력과 PDF를 확인할 수 있습니다.</p></div><form className="admin-add" onSubmit={e => { e.preventDefault(); void run(async () => { await manage('approve', { email: email.trim() }); setEmail('') }, true) }}><label>승인할 Gmail<input type="email" placeholder="example@gmail.com" required value={email} onChange={e => setEmail(e.target.value)} /></label><button disabled={busy || needsReauth}>관리자 추가</button></form><ul className="admin-member-list" aria-label="승인된 관리자">{accounts.map(item => <li key={item.email}><div><strong>{item.email}</strong><span className={'admin-state ' + (item.active ? 'state-success' : 'state-pending')}>{item.active ? '승인됨' : '권한 회수됨'}</span></div>{item.active && <button className="admin-button-secondary" disabled={busy || needsReauth} onClick={() => void run(async () => { await manage('revoke', { email: item.email }) }, true)} aria-label={item.email + ' 권한 회수'}>권한 회수</button>}</li>)}</ul>{!accounts.length && !busy && !needsReauth && <p className="admin-empty">추가된 관리자가 없습니다.</p>}</section>
  <section role="tabpanel" id="admin-panel-settings" aria-labelledby="admin-tab-settings" hidden={tab !== 'settings'} tabIndex={0}><div className="admin-settings"><h2>{session.local ? '마스터 비밀번호 변경' : '별도 마스터 비밀번호 초기화'}</h2>{session.local ? passwordForm : <><p>별도 ID 계정에만 적용됩니다. Google 계정은 변경되지 않습니다.</p><form className="admin-form" onSubmit={e => { e.preventDefault(); void run(async () => { await call({ action: 'accounts', operation: 'reset-local', temporaryPassword: temporary }); setTemporary(''); setResetReady(true); setMessage('초기화했습니다. 별도 마스터로 전환해 비밀번호를 변경하세요.') }, true) }}><label>일회용 임시 비밀번호<input type="password" autoComplete="new-password" minLength={5} maxLength={128} required value={temporary} onChange={e => setTemporary(e.target.value)} /></label><button disabled={busy || needsReauth}>별도 마스터 초기화</button></form>{resetReady && <details><summary>초기화한 마스터로 전환</summary>{localLogin}</details>}</>}</div></section></>}
 </main></div>
}

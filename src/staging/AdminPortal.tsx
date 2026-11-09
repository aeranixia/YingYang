import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, reauthenticateWithPopup, signInWithPopup, signOut, type Auth } from 'firebase/auth'
import { httpsCallable, type Functions } from 'firebase/functions'
import { AdminDrive } from './AdminDrive'
import { AdminReports } from './AdminReports'
import { AdminBooks } from './AdminBooks'
import type { AdminDetail } from './admin-contracts'
import type { AdminQuery, AdminPage, AdminDownload } from './admin-contracts'
import './admin.css'

type Session = { role: 'none' | 'admin' | 'master' }
type Account = { email: string; active: boolean; bound: boolean }
type Tab = 'reports' | 'accounts' | 'backup' | 'books'
const empty: Session = { role: 'none' }
function errorCode(error: unknown) {
 const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
 return /^(auth|functions)\/[a-z-]+$/.test(code) ? code : ''
}
export function AdminPortal({ auth, functions, environmentLabel='STAGING', driveBackup=false, questionnaires=false }: { auth: Auth; functions: Functions; environmentLabel?:string; driveBackup?:boolean; questionnaires?:boolean }) {
 const [session, setSession] = useState(empty), [signed, setSigned] = useState(false), [checking, setChecking] = useState(true)
 const [account, setAccount] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
 const [tab, setTab] = useState<Tab>('reports'), [needsReauth, setNeedsReauth] = useState(false)
 const [email, setEmail] = useState(''), [accounts, setAccounts] = useState<Account[]>([])
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
 const detail = useCallback(async (id:string)=>(await httpsCallable(functions,'listAdminReports')({action:'detail',id})).data as AdminDetail,[functions])
 const loadAccounts = useCallback(async () => { const result = await call<{ accounts: Account[] }>({ action: 'accounts', operation: 'list' }); setAccounts(result.accounts) }, [call])
 useEffect(() => {
  if (tab === 'accounts' && session.role === 'master') void run(loadAccounts, true)
 }, [tab, session.role, loadAccounts])
 async function verifyAgain(event: FormEvent) {
  event.preventDefault()
  await run(async () => {
   await reauthenticateWithPopup(auth.currentUser!, new GoogleAuthProvider())
   setNeedsReauth(false)
   const work = pending.current; pending.current = null
   if (work) await work()
  })
 }
 async function manage(operation: string, fields: Record<string, unknown> = {}) {
  await call({ action: 'accounts', operation, ...fields })
  await loadAccounts()
 }
 function navigate(value: Tab) { setTab(value); setMessage(''); setNeedsReauth(false); pending.current = null }
 const driveCall=async<T,>(data:Record<string,unknown>)=>(await httpsCallable<Record<string,unknown>,T>(functions,'adminDriveBackup')(data)).data
 const tabs: { id: Tab; label: string }[] = [{ id: 'reports', label: '발송 이력' }, ...(session.role === 'master' ? [{ id: 'accounts' as const, label: '관리자 계정' }] : []),...(session.role==='master'&&questionnaires?[{id:'books' as const,label:'문제집 관리'}]:[]),...(session.role==='master'&&driveBackup?[{id:'backup' as const,label:'Drive 백업'}]:[])]
 function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
  const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
  if (nextIndex < 0) return
  event.preventDefault(); navigate(tabs[nextIndex].id); document.getElementById('admin-tab-' + tabs[nextIndex].id)?.focus()
 }
 const notice = message && <p className="admin-notice" role="status">{message}</p>
 const logout = <button className="admin-button-secondary" disabled={busy} onClick={() => void run(async () => { await signOut(auth) })}>로그아웃</button>
 const top = <header className="admin-top"><div><span className="admin-kicker">YingYang · {environmentLabel}</span><h1>관리자</h1></div>{signed && <div className="admin-account"><div><span className="admin-account-name">{account}</span><span className="admin-role">{session.role === 'master' ? '마스터' : session.role === 'admin' ? '일반 관리자' : '권한 확인'}</span></div>{logout}</div>}</header>
 if (checking) return <div className="admin-app">{top}<main className="admin-focus"><p role="status">로그인 상태를 확인하고 있습니다…</p></main></div>
 if (!signed) return <div className="admin-app">{top}<main className="admin-focus"><div className="admin-login"><span className="admin-kicker">관리자 전용</span><h2>로그인</h2><p>승인된 Google 계정으로 로그인하세요.</p>{notice}<button className="admin-google" disabled={busy} onClick={() => void run(async () => { await signInWithPopup(auth, new GoogleAuthProvider()) })}>Google로 로그인</button></div></main></div>
 if (session.role === 'none') return <div className="admin-app">{top}<main className="admin-focus"><div className="admin-login"><h2>관리자 승인 대기</h2><p>현재 계정은 승인된 관리자가 아닙니다. 마스터에게 승인을 요청하세요.</p>{notice}<button disabled={busy} onClick={() => void run(async () => setSession(await call<Session>({ action: 'session' })))}>승인 상태 새로고침</button></div></main></div>
 return <div className="admin-app">{top}<nav className="admin-tabs" aria-label="관리자 메뉴" role="tablist">{tabs.map((item, index) => <button key={item.id} id={'admin-tab-' + item.id} role="tab" aria-selected={tab === item.id} aria-controls={'admin-panel-' + item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => navigate(item.id)} onKeyDown={e => tabKey(e, index)}>{item.label}</button>)}</nav><main className="admin-content">
  {notice}
  {needsReauth && <form onSubmit={verifyAgain} className="admin-reauth" aria-label="계정 관리 본인 확인"><div><h2>본인 확인</h2><p>계정 관리 작업을 계속하려면 확인해 주세요.</p></div><button disabled={busy}>Google로 본인 확인</button></form>}
  <section role="tabpanel" id="admin-panel-reports" aria-labelledby="admin-tab-reports" hidden={tab !== 'reports'} tabIndex={0}><AdminReports list={list} download={download} detail={questionnaires ? detail : undefined} /></section>
  {session.role === 'master' && <><section role="tabpanel" id="admin-panel-accounts" aria-labelledby="admin-tab-accounts" hidden={tab !== 'accounts'} tabIndex={0}><div className="admin-section-title"><h2>관리자 계정</h2><p>승인된 관리자는 발송 이력과 PDF를 확인할 수 있습니다.</p></div><form className="admin-add" onSubmit={e => { e.preventDefault(); void run(async () => { await manage('approve', { email: email.trim() }); setEmail('') }, true) }}><label>승인할 Gmail<input type="email" placeholder="example@gmail.com" required value={email} onChange={e => setEmail(e.target.value)} /></label><button disabled={busy || needsReauth}>관리자 추가</button></form><ul className="admin-member-list" aria-label="승인된 관리자">{accounts.map(item => <li key={item.email}><div><strong>{item.email}</strong><span className={'admin-state ' + (item.active ? 'state-success' : 'state-pending')}>{item.active ? '승인됨' : '권한 회수됨'}</span></div>{item.active && <button className="admin-button-secondary" disabled={busy || needsReauth} onClick={() => void run(async () => { await manage('revoke', { email: item.email }) }, true)} aria-label={item.email + ' 권한 회수'}>권한 회수</button>}</li>)}</ul>{!accounts.length && !busy && !needsReauth && <p className="admin-empty">추가된 관리자가 없습니다.</p>}</section></>}
 {questionnaires&&session.role==='master'&&tab==='books'&&<section role="tabpanel" id="admin-panel-books" aria-labelledby="admin-tab-books"><AdminBooks invoke={data=>call(data)} reauth={()=>reauthenticateWithPopup(auth.currentUser!,new GoogleAuthProvider())}/></section>}
 {driveBackup&&session.role==='master'&&tab==='backup'&&<section role="tabpanel" id="admin-panel-backup" aria-labelledby="admin-tab-backup"><AdminDrive invoke={driveCall} reauth={()=>reauthenticateWithPopup(auth.currentUser!,new GoogleAuthProvider())}/></section>}
 </main></div>
}

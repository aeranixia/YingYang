import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, reauthenticateWithPopup, signInWithPopup, signInWithCustomToken, signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth'
import { httpsCallable, type Functions } from 'firebase/functions'
import { AdminReports } from './AdminReports'
import type { AdminQuery, AdminPage, AdminDownload } from './admin-contracts'

type Session={role:'none'|'admin'|'master';local:boolean;mustChange:boolean;canBootstrap:boolean}
type Account={email:string;active:boolean;bound:boolean}
const empty:Session={role:'none',local:false,mustChange:false,canBootstrap:false}
export function AdminPortal({auth,functions}:{auth:Auth;functions:Functions}) {
 const [session,setSession]=useState(empty),[signed,setSigned]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const [password,setPassword]=useState(''),[current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirmation,setConfirmation]=useState('')
 const [setup,setSetup]=useState(false),[operatorEmail,setOperatorEmail]=useState(''),[operatorPassword,setOperatorPassword]=useState('')
 const [email,setEmail]=useState(''),[temporary,setTemporary]=useState(''),[accounts,setAccounts]=useState<Account[]>([])
 const call=async <T,>(data:Record<string,unknown>)=>(await httpsCallable<Record<string,unknown>,T>(functions,'adminIdentity')(data)).data
 async function refresh(){setSession(await call<Session>({action:'session'}))}
 useEffect(()=>{let generation=0;const unsubscribe=onAuthStateChanged(auth,user=>{const id=++generation;setSigned(!!user);setSession(empty);setAccounts([]);if(user)void call<Session>({action:'session'}).then(s=>{if(generation===id)setSession(s)}).catch(()=>{if(generation===id)setMessage('권한 확인에 실패했습니다. 다시 로그인해 주세요.')})});return()=>{generation++;unsubscribe()}},[auth,functions])
 async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('');try{await work()}catch(e){const code=e&&typeof e==='object'&&'code' in e?String(e.code):'';setMessage(code==='auth/popup-closed-by-user'?'Google 로그인 창이 닫혔습니다. 필요하면 다시 시도해 주세요. 기존 로그인 상태는 유지됩니다.':code==='auth/admin-restricted-operation'?'이 Google 계정은 아직 Staging에 등록되지 않았습니다. 마스터에게 계정 등록·승인을 요청하세요. '+code:'처리하지 못했습니다. 최근 본인 확인·권한·입력값을 확인해 주세요. '+(/^(auth|functions)\/[a-z-]+$/.test(code)?code:''))}finally{setBusy(false)}}
 const list=useCallback(async(query:AdminQuery)=>(await httpsCallable<AdminQuery,AdminPage>(functions,'listAdminReports')(query)).data,[functions])
 const download=useCallback(async(id:string)=>(await httpsCallable<{id:string},AdminDownload>(functions,'downloadAdminReport')({id})).data,[functions])
 async function login(e:FormEvent){e.preventDefault();await run(async()=>{const result=await call<{token:string}>({action:'login',username:'admin',password});setPassword('');await signInWithCustomToken(auth,result.token)})}
 async function reauth(){if(session.local){const result=await call<{token:string}>({action:'reauthenticate',currentPassword:current});setCurrent('');await signInWithCustomToken(auth,result.token)}else{await reauthenticateWithPopup(auth.currentUser!,new GoogleAuthProvider())}await refresh()}
 async function change(e:FormEvent){e.preventDefault();await run(async()=>{if(next!==confirmation)throw Error();await reauth();await call({action:'change-password',newPassword:next});setNext('');setConfirmation('');await signOut(auth);setMessage('비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해 주세요.')})}
 async function accountAction(action:string,fields:Record<string,unknown>={}){await call({action:'accounts',...fields,operation:action})}
 async function loadAccounts(){const value=await call<{accounts:Account[]}>({action:'accounts',operation:'list'});setAccounts(value.accounts)}
 return <div className="stage-shell"><header><strong>YingYang 관리자</strong><span className="stage-badge">STAGING</span></header><main>
  <h1>관리자 로그인</h1><p>일반 관리자는 Google 로그인 후 마스터 승인이 필요합니다. 승인된 관리자는 발송 로그와 보관 기간 내 PDF를 조회할 수 있습니다.</p>
  {message&&<p role="status" className="stage-notice">{message}</p>}
  <button disabled={busy} onClick={()=>void run(async()=>{await signInWithPopup(auth,new GoogleAuthProvider())})}>Google로 로그인</button>
  {signed&&<button disabled={busy} onClick={()=>void run(async()=>{await signOut(auth);setCurrent('');setNext('');setPassword('')})}>로그아웃</button>}
  {signed&&session.role==='none'&&!session.canBootstrap&&<p>현재 계정은 승인된 관리자가 아닙니다. 마스터에게 승인을 요청하세요.</p>}
  {!session.mustChange&&<details><summary>별도 마스터 ID 로그인</summary><form onSubmit={login}><p>일반 관리자용 ID·비밀번호는 제공하지 않습니다.</p><label>마스터 ID<input value="admin" readOnly autoComplete="username"/></label><label>마스터 비밀번호<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={128}/></label><button disabled={busy}>마스터 로그인</button></form>
   <button disabled={busy} onClick={()=>setSetup(!setup)}>최초 설정 담당자 인증</button>{setup&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{await signInWithEmailAndPassword(auth,operatorEmail.trim(),operatorPassword);setOperatorPassword('');setSetup(false)})}}><p>최초 일회용 비밀번호 사용 전 기존 Staging 설정 담당자 인증이 필요합니다.</p><label>설정 담당자 이메일<input type="email" required value={operatorEmail} onChange={e=>setOperatorEmail(e.target.value)}/></label><label>설정 담당자 비밀번호<input type="password" required value={operatorPassword} onChange={e=>setOperatorPassword(e.target.value)}/></label><button disabled={busy}>설정 담당자 인증</button></form>}
  </details>}
  {session.canBootstrap&&<p>설정 담당자 인증 완료. 일회용 마스터 로그인 후 새 비밀번호로 변경하세요.</p>}
  {session.mustChange&&<p role="alert">비밀번호를 변경하기 전에는 로그·PDF·계정 관리에 접근할 수 없습니다.</p>}
  {session.local&&session.role==='master'&&<form onSubmit={change}><h2>마스터 비밀번호 변경</h2><label>현재 비밀번호<input type="password" autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)}/></label><label>새 비밀번호 (12자 이상)<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={next} onChange={e=>setNext(e.target.value)}/></label><label>새 비밀번호 확인<input type="password" autoComplete="new-password" required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label><button disabled={busy}>본인 확인 후 변경</button></form>}
  {session.role!=='none'&&!session.mustChange&&<><p>{session.role==='master'?'마스터':'일반 관리자'} 권한으로 로그인했습니다. Google 계정 비밀번호는 Google에서 관리합니다.</p><AdminReports list={list} download={download}/></>}
  {session.role==='master'&&!session.mustChange&&<section><h2>관리자 승인·권한 회수</h2><p>계정 관리는 최근 5분 내 본인 확인이 필요합니다.</p>{session.local&&<label>본인 확인용 현재 비밀번호<input type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)}/></label>}<button disabled={busy} onClick={()=>void run(reauth)}>다시 본인 확인</button><button disabled={busy} onClick={()=>void run(loadAccounts)}>승인 목록 조회</button>
   <form onSubmit={e=>{e.preventDefault();void run(async()=>{await accountAction('approve',{email:email.trim()});setEmail('');await loadAccounts()})}}><label>승인할 Gmail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button disabled={busy}>관리자 승인</button></form>
   <ul>{accounts.map(a=><li key={a.email}>{a.email} · {a.active?'승인':'회수'} · {a.bound?'계정 연결됨':'첫 로그인 대기'} {a.active&&<button disabled={busy} onClick={()=>void run(async()=>{await accountAction('revoke',{email:a.email});await loadAccounts()})}>권한 회수</button>}</li>)}</ul>
   {!session.local&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{await accountAction('reset-local',{temporaryPassword:temporary});setTemporary('');setMessage('별도 마스터 비밀번호를 초기화했습니다. 현재 Google 세션에서 일회용 로그인 후 반드시 변경하세요.')})}}><h3>별도 마스터 비밀번호 초기화</h3><p>Google 로그인에는 영향을 주지 않습니다. Google 비밀번호는 변경하지 않습니다.</p><label>일회용 임시 비밀번호<input type="password" autoComplete="new-password" minLength={5} required value={temporary} onChange={e=>setTemporary(e.target.value)}/></label><button disabled={busy}>별도 마스터 초기화</button></form>}
  </section>}
  <p><a href="/">Staging 검진 화면</a></p>
 </main></div>
}

import { defaultBooks, type BookSettings } from '../book-settings'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { initializeApp } from 'firebase/app'
import { initializeAuth, browserLocalPersistence, inMemoryPersistence, browserPopupRedirectResolver, signInAnonymously, signOut, deleteUser } from 'firebase/auth'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { AdminPortal } from '../staging/AdminPortal'
import { PrivacyGate } from '../staging/PrivacyGate'
import { clinicName, privacyContact, privacyDepartment, pdfPersonal, pdfSensitive, adminArchiveNotice } from '../staging/privacy-copy'
import { privacyVersion, type PrivacyReceipt } from '../staging/privacy-storage'
import type { Submission, MockReceipt } from '../staging/contracts'
import config from './public-config'
import { isProductionHost } from './domains'
import { ProductionSubmission, type DeliveryReceipt } from './SubmissionForm'
import { PolicyLinks } from './PolicyLinks'
import '../style.css'
import '../staging/staging.css'
import '../staging/exam.css'

if(config.projectId!=='yingyangcheck'||!isProductionHost(location.hostname)&&location.hostname!=='127.0.0.1')throw Error('운영 환경 설정을 확인해 주세요.')
const admin=location.pathname==='/admin'
const app=initializeApp(config)
const auth=initializeAuth(app,{persistence:admin?inMemoryPersistence:browserLocalPersistence,popupRedirectResolver:browserPopupRedirectResolver})
initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(config.recaptchaSiteKey),isTokenAutoRefreshEnabled:true})
const functions=getFunctions(app,'asia-northeast3')
const call=async<T,>(data:unknown)=>(await httpsCallable<unknown,T>(functions,'examStatus')(data)).data
const authorize=()=>call<PrivacyReceipt>({action:'consent-privacy',version:privacyVersion,personal:true,sensitive:true})
const verify=(proof:string)=>call({action:'verify-privacy',privacyProof:proof})
const confirm=(data:unknown)=>call<{proof:string}>(data)
const send=async(input:Submission)=>(await httpsCallable<Submission,MockReceipt>(functions,'submitReport')(input)).data
function ClosedSubmission(){return <section className="panel submission-panel"><h1>검사를 모두 완료했습니다</h1><p role="status">현재 이메일 결과 전송이 중지되어 있습니다. 응답은 안내된 보관 기간 동안 이 브라우저에 유지됩니다.</p><p>이름·전화번호를 입력하거나 전송하지 않습니다. 전송 재개는 별도 안내합니다.</p><h2>결과 전송 시 개인정보 안내</h2><p>{pdfPersonal}</p><p>{pdfSensitive}</p><p>{adminArchiveNotice}</p><button className="primary" disabled>검사 결과 보내기 · 현재 중지</button><p>{clinicName} 문의: {privacyDepartment}, {privacyContact}</p></section>}
let ticketCache:{signature:string;ticket:string;expires:number}|undefined
async function sendProduction(input:Submission){
 const signature=JSON.stringify(input)
 if(!ticketCache||ticketCache.signature!==signature||ticketCache.expires<=Date.now()){
  try{const data=(await httpsCallable<Submission,{ticket:string;expires:number}>(functions,'prepareReport')(input)).data;ticketCache={signature,...data}}
  catch{throw {details:{outcomeUnknown:false}}}
 }
 return (await httpsCallable<unknown,DeliveryReceipt>(functions,'submitReport')({submission:input,ticket:ticketCache.ticket})).data
}
function Production(){
 const [books,setBooks]=useState(defaultBooks)
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[enabled,setEnabled]=useState(false)
 async function start(){setError('');try{await auth.authStateReady();let user=auth.currentUser;if(user&&(!user.isAnonymous||Date.now()-Date.parse(user.metadata.creationTime||'')>=7*86400000)){if(user.isAnonymous)try{await deleteUser(user)}catch{await signOut(auth)}else await signOut(auth);user=null}if(!user)await signInAnonymously(auth);const status=await call<{sendEnabled:boolean;books:BookSettings}>({});setBooks(status.books);setEnabled(status.sendEnabled===true);setReady(true)}catch{setError('검사 세션을 준비하지 못했습니다. 연결 또는 브라우저 보안 설정을 확인해 주세요.')}}
 useEffect(()=>{void start()},[])
 if(!ready)return <main className="shell"><h1>YingYang</h1><p role="status">{error||'검사 세션을 준비하고 있습니다…'}</p>{error&&<button className="primary" onClick={()=>void start()}>다시 시도</button>}</main>
 return <><PrivacyGate books={books} production authorize={authorize} verify={verify} confirm={confirm} send={send} renderSubmission={props=>enabled?<ProductionSubmission {...props} send={sendProduction}/>:<ClosedSubmission/>}/></>
}
createRoot(document.getElementById('root')!).render(<><PolicyLinks/>{admin?<AdminPortal questionnaires auth={auth} functions={functions} environmentLabel="v1.3.0" driveBackup/>:<Production/>}</>)

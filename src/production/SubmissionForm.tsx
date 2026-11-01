import { useRef, useState, type FormEvent } from 'react'
import type { Session } from '../engine'
import type { Submission } from '../staging/contracts'
import { completionProof, confirmPending } from '../staging/completion'
import { clinicName, privacyDepartment, privacyContact, pdfPersonal, pdfSensitive, pdfDelivery, mailCopyPolicy, adminArchiveNotice } from '../staging/privacy-copy'
import { productionPdfConsentVersion, validPatientIdentity } from './contracts'

export type DeliveryReceipt={status:'gmail-accepted';requestId:string;duplicate:boolean}
export function ProductionSubmission({states,send,confirm,guard}:{states:{acquired:Session;innate:Session};send:(input:Submission)=>Promise<DeliveryReceipt>;confirm?:Parameters<typeof confirmPending>[1];guard?:()=>string}){
 const [name,setName]=useState(''),[phone,setPhone]=useState(''),[personal,setPersonal]=useState(false),[sensitive,setSensitive]=useState(false)
 const [status,setStatus]=useState<'idle'|'sending'|'success'|'error'|'unknown'>('idle'),[message,setMessage]=useState('')
 const locked=useRef(false),request=useRef({id:'',signature:''})
 const valid=states.acquired.completed&&states.innate.completed&&validPatientIdentity(name.trim().normalize('NFC'),phone.replaceAll('-',''))&&personal&&sensitive
 async function submit(event:FormEvent){
  event.preventDefault();if(locked.current||!valid||status==='success'||status==='unknown')return
  locked.current=true;setStatus('sending');setMessage('PDF 작성과 이메일 발송을 진행 중입니다. 화면을 닫지 마세요.')
  let submitted=false
  try{
   guard?.();if(confirm)await confirmPending(states,confirm)
   const privacyProof=guard?.(),proof=completionProof(states)
   const data={version:states.acquired.version,name:name.trim().normalize('NFC'),phone:phone.replaceAll('-',''),acquired:states.acquired.answers as number[],innate:states.innate.answers as number[],consent:{personal,sensitive,synthetic:false,version:productionPdfConsentVersion},scenario:'success' as const,...(privacyProof?{privacyProof}:{}),...(proof?{completionProof:proof}:{})}
   const signature=JSON.stringify(data);if(request.current.signature!==signature)request.current={id:crypto.randomUUID(),signature}
   submitted=true
   const result=await send({...data,requestId:request.current.id})
   if(result.status!=='gmail-accepted'||result.requestId!==request.current.id)throw Error('Unexpected response')
   setStatus('success');setMessage(result.duplicate?'이미 발송 접수된 검사입니다. 추가 메일을 보내지 않았습니다.':'Gmail에서 발송을 접수했습니다. 한의원 수신함 도착은 별도 확인이 필요합니다.');setName('');setPhone('');setPersonal(false);setSensitive(false)
  }catch(error){
   const known=!!error&&typeof error==='object'&&'details' in error&&!!error.details&&typeof error.details==='object'&&'outcomeUnknown' in error.details&&error.details.outcomeUnknown===false
   const unknown=submitted&&!known
   setStatus(unknown?'unknown':'error');setMessage(unknown?'발송 결과를 확인하지 못했습니다. 중복 발송을 피하기 위해 재시도를 중지했습니다. 한의원에 확인해 주세요.':'발송 전에 처리를 완료하지 못했습니다. 입력·연결 상태를 확인하고 다시 시도해 주세요. 반복되면 한의원에 문의해 주세요.')
  }finally{locked.current=false}
 }
 return <section className="panel submission-panel"><form onSubmit={submit} aria-label="검사 결과 전송" aria-busy={status==='sending'}><fieldset disabled={status==='sending'||status==='success'||status==='unknown'}><legend>결과 전송 정보</legend>
  <label htmlFor="patient-name">이름</label><input id="patient-name" autoComplete="off" maxLength={30} required value={name} onChange={e=>setName(e.target.value)}/>
  <label htmlFor="patient-phone">전화번호</label><input id="patient-phone" type="tel" inputMode="tel" autoComplete="off" maxLength={13} required value={phone} onChange={e=>setPhone(e.target.value)}/><p>전화번호는 숫자 또는 하이픈으로 입력해 주세요.</p>
  <div className="consent-copy"><h2>개인정보 수집·이용 동의</h2><p>{pdfPersonal}</p><p>거부할 수 있으며 거부 시 PDF 작성 및 결과 전송은 이용할 수 없습니다.</p><label className="consent-check"><input type="checkbox" checked={personal} onChange={e=>setPersonal(e.target.checked)}/>개인정보 수집·이용에 동의합니다</label></div>
  <div className="consent-copy"><h2>건강 관련 민감정보 처리 동의</h2><p>{pdfSensitive}</p><p>거부할 수 있으며 거부 시 PDF 작성 및 결과 전송은 이용할 수 없습니다.</p><label className="consent-check"><input type="checkbox" checked={sensitive} onChange={e=>setSensitive(e.target.checked)}/>건강 관련 민감정보 처리에 별도로 동의합니다</label></div>
  <aside className="notice"><p>{pdfDelivery}</p><p>{adminArchiveNotice}</p><p>{mailCopyPolicy}</p><p>이름과 전화번호는 브라우저에 영구 저장하지 않습니다. PDF 시각은 서버에서 검사 완료를 확인한 한국 시각이며 발송 시각과 다릅니다.</p></aside>
  <button className="primary" type="submit" disabled={!valid}>{status==='sending'?'전송 중…':status==='success'?'발송 접수 완료':status==='unknown'?'한의원 확인 필요':status==='error'?'전송 재시도':'검사 결과 보내기'}</button>
 </fieldset></form>{message&&<p className="notice" role={status==='error'||status==='unknown'?'alert':'status'}>{message}</p>}<p>{clinicName} 문의: {privacyDepartment}, {privacyContact}</p></section>
}

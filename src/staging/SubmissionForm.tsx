import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session } from '../engine'
import { consentVersion, syntheticNames, syntheticPhones, type MockReceipt, type Submission, type MockScenario } from './contracts'
import { completionProof, confirmPending } from './completion'
import { clinicName, privacyDepartment, privacyContact, pdfPersonal, pdfSensitive, pdfDelivery, mailCopyPolicy, adminArchiveNotice } from './privacy-copy'

export function SubmissionForm({ states, send, confirm, guard }: { states: { acquired: Session; innate: Session }; send: (input: Submission) => Promise<MockReceipt>; confirm?: Parameters<typeof confirmPending>[1]; guard?: () => string }) {
 const [completionStatus, setCompletionStatus] = useState('')
 async function checkCompletion() {
  if (!confirm) return
  setCompletionStatus('완료 시각을 서버에서 확인 중입니다.')
  try { await confirmPending(states, confirm); setCompletionStatus(completionProof(states) ? '서버 완료 확인 시각을 기록했습니다. PDF에는 한국 시간으로 표시합니다.' : '이전 검진에는 완료 시각 기록이 없습니다. PDF에 기록 없음으로 표시합니다.') }
  catch { setCompletionStatus('완료 시각 확인에 실패했습니다. 다시 확인해 주세요. 재연결 시 서버가 확인한 시각을 기록합니다.') }
 }
 useEffect(() => { void checkCompletion() }, [states.acquired, states.innate])
 const [name, setName] = useState(''), [phone, setPhone] = useState('')
 const [personal, setPersonal] = useState(false), [sensitive, setSensitive] = useState(false), [synthetic, setSynthetic] = useState(false)
 const [scenario, setScenario] = useState<MockScenario>('success')
 const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle'), [message, setMessage] = useState('')
 const request = useRef({ id: '', signature: '' }), locked = useRef(false)
 const valid = states.acquired.completed && states.innate.completed && syntheticNames.some(n => n === name.trim()) && syntheticPhones.some(p => p === phone.replaceAll('-', '')) && personal && sensitive && synthetic
 async function submit(event: FormEvent) {
  event.preventDefault()
  if (locked.current || status === 'success' || !valid) return
  locked.current = true; setStatus('sending'); setMessage('PDF 생성과 모의 처리를 진행 중입니다. 실제 이메일은 발송하지 않습니다.')
  try {
   guard?.()
   if (confirm) await confirmPending(states, confirm)
   const privacyProof = guard?.()
   const proof = completionProof(states)
   const data = { ...(privacyProof ? { privacyProof } : {}), ...(proof ? { completionProof: proof } : {}), version: states.acquired.version, ...(states.acquired.version === 2 ? { questionnaire: 'sasang-80' as const } : {}), name: name.trim(), phone: phone.replaceAll('-', ''), acquired: states.acquired.answers as number[], innate: states.innate.answers as number[], consent: { personal, sensitive, synthetic, version: consentVersion }, scenario }
   const signature = JSON.stringify(data)
   if (request.current.signature !== signature) request.current = { id: crypto.randomUUID(), signature }
   const result = await send({ ...data, requestId: request.current.id })
   if (result.status !== 'mock-completed' || result.requestId !== request.current.id) throw new Error('Unexpected response')
   setStatus('success'); setMessage('PDF 생성과 모의 처리가 완료되었습니다. 실제 이메일은 발송되지 않았습니다.')
   setName(''); setPhone(''); setPersonal(false); setSensitive(false); setSynthetic(false); request.current = { id: '', signature: '' }
  } catch {
   setStatus('error'); setMessage('모의 처리를 완료하지 못했습니다. 실제 이메일은 발송되지 않았습니다. 입력을 확인한 뒤 다시 시도해 주세요. 반복되면 잠시 후 재시도하세요.')
  } finally { locked.current = false }
 }
 return <section className="panel submission-panel"><aside className="notice"><strong>STAGING · 가상 정보 전용 · 실제 이메일 발송 없음</strong><p>지정된 가상 정보만 입력해 주세요. 현재 화면은 PDF 생성과 모의 처리용입니다.</p></aside>
 {completionStatus && <aside className="notice"><p role="status">{completionStatus}</p><p>표시 시각은 실제 클릭·PDF 생성·이메일 발송 시각이 아닌 서버 완료 확인 시각입니다.</p><button type="button" className="secondary" disabled={status === 'sending'} onClick={() => void checkCompletion()}>완료 시각 다시 확인</button></aside>}
 <form onSubmit={submit} aria-label="모의 결과 전송" aria-busy={status === 'sending'}>
 <fieldset disabled={status === 'sending' || status === 'success'}><legend>가상 정보 입력</legend>
 <label htmlFor="test-name">이름</label><input id="test-name" autoComplete="off" maxLength={30} required value={name} onChange={e => setName(e.target.value)} aria-describedby="test-name-hint"/><p id="test-name-hint">허용된 가상 이름: {syntheticNames.join(', ')}</p>
 <label htmlFor="test-phone">전화번호</label><input id="test-phone" type="tel" inputMode="tel" autoComplete="off" maxLength={13} required value={phone} onChange={e => setPhone(e.target.value)} aria-describedby="test-phone-hint"/><p id="test-phone-hint">허용된 가상 번호: {syntheticPhones.join(', ')} (하이픈 입력 가능)</p>
 <div className="consent-copy"><h2>개인정보 수집·이용 동의</h2><p>{pdfPersonal}</p><p>현재는 가상 정보로 처리하며 거부 시 PDF 모의 처리를 이용할 수 없습니다.</p><label className="consent-check"><input type="checkbox" checked={personal} onChange={e => setPersonal(e.target.checked)}/>개인정보 수집·이용에 동의합니다</label></div>
 <div className="consent-copy"><h2>건강 관련 민감정보 처리 동의</h2><p>{pdfSensitive}</p><p>서버 처리 중에 사용하며 거부 시 PDF 모의 처리를 이용할 수 없습니다. 브라우저 검사 응답은 안내된 7일 보관 기준에 따릅니다.</p><label className="consent-check"><input type="checkbox" checked={sensitive} onChange={e => setSensitive(e.target.checked)}/>건강 관련 민감정보 처리에 별도로 동의합니다</label></div>
 <aside className="notice"><h2>결과 전송 안내</h2><p>{pdfDelivery}</p><p>{adminArchiveNotice}</p><p>{mailCopyPolicy}</p><p>현재 화면에서는 모의 처리만 하며 실제 이메일을 보내지 않습니다.</p></aside>
 <label className="consent-check"><input type="checkbox" checked={synthetic} onChange={e => setSynthetic(e.target.checked)}/>실제 개인정보가 아닌 지정된 가상 정보와 가상 응답만 사용했습니다</label>
 <label htmlFor="mock-scenario">모의 처리 시나리오</label><select id="mock-scenario" value={scenario} onChange={e => setScenario(e.target.value as MockScenario)}><option value="success">정상 처리</option><option value="fail-once">처음 실패 후 재시도 성공</option></select>
 <button className="primary" disabled={!valid} type="submit">{status === 'sending' ? '모의 처리 중…' : status === 'error' ? '모의 전송 재시도' : status === 'success' ? '모의 처리 완료' : '검사 결과 보내기 (모의)'}</button></fieldset>
 </form>{message && <p role={status === 'error' ? 'alert' : 'status'} className="notice">{message}</p>}
 <aside className="info"><p>{clinicName} 개인정보 문의: {privacyDepartment} (접수 및 처리), {privacyContact}. 현재 Staging에서는 실제 상담 접수나 이메일 발송을 제공하지 않습니다.</p></aside>
 </section>
}

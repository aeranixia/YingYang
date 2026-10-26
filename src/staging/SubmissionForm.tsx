import { useRef, useState, type FormEvent } from 'react'
import type { Session } from '../engine'
import { consentVersion, syntheticNames, syntheticPhones, type MockReceipt, type Submission, type MockScenario } from './contracts'

export function SubmissionForm({ states, send }: { states: { acquired: Session; innate: Session }; send: (input: Submission) => Promise<MockReceipt> }) {
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
   const data = { version: states.acquired.version, name: name.trim(), phone: phone.replaceAll('-', ''), acquired: states.acquired.answers as number[], innate: states.innate.answers as number[], consent: { personal, sensitive, synthetic, version: consentVersion }, scenario }
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
 return <section className="panel submission-panel"><aside className="notice"><strong>STAGING · 임시 동의 문구 · 실제 개인정보 입력 금지</strong><p>아래 문구는 기능 검증용 초안으로 운영에 사용할 수 없습니다. 실제 처리방침·동의와 한의원 책임자의 승인은 별도입니다.</p></aside>
 <form onSubmit={submit} aria-label="모의 결과 전송" aria-busy={status === 'sending'}>
 <fieldset disabled={status === 'sending' || status === 'success'}><legend>가상 정보 입력</legend>
 <label htmlFor="test-name">이름</label><input id="test-name" autoComplete="off" maxLength={30} required value={name} onChange={e => setName(e.target.value)} aria-describedby="test-name-hint"/><p id="test-name-hint">허용된 가상 이름: {syntheticNames.join(', ')}</p>
 <label htmlFor="test-phone">전화번호</label><input id="test-phone" type="tel" inputMode="tel" autoComplete="off" maxLength={13} required value={phone} onChange={e => setPhone(e.target.value)} aria-describedby="test-phone-hint"/><p id="test-phone-hint">허용된 가상 번호: {syntheticPhones.join(', ')} (하이픈 입력 가능)</p>
 <div className="consent-copy"><h2>개인정보 수집·이용 동의 — 임시</h2><p>가상 이름·전화번호를 테스트 PDF 생성 및 모의 전송 처리에 사용합니다. 서버에서는 처리 중 메모리에서만 사용하고 PDF를 저장하거나 실제 메일로 보내지 않습니다. 파일명은 이름_전화번호끝4자리.pdf입니다. 거부할 수 있으며 거부 시 모의 전송을 이용할 수 없습니다.</p><label className="consent-check"><input type="checkbox" checked={personal} onChange={e => setPersonal(e.target.checked)}/>개인정보 수집·이용에 동의합니다 (테스트용)</label></div>
 <div className="consent-copy"><h2>건강 관련 민감정보 처리 동의 — 임시</h2><p>가상 검진 응답 및 서버 집계 점수를 테스트 PDF 생성에 사용합니다. 서버 영구 저장은 하지 않습니다. 기존 검진 응답은 이 브라우저에 자동 저장되며, 재검진 시 해당 검진이 초기화됩니다. 거부할 수 있으며 거부 시 모의 전송을 이용할 수 없습니다.</p><label className="consent-check"><input type="checkbox" checked={sensitive} onChange={e => setSensitive(e.target.checked)}/>건강 관련 민감정보 처리에 별도로 동의합니다 (테스트용)</label></div>
 <label className="consent-check"><input type="checkbox" checked={synthetic} onChange={e => setSynthetic(e.target.checked)}/>실제 개인정보가 아닌 지정된 가상 정보와 가상 응답만 사용했습니다</label>
 <label htmlFor="mock-scenario">모의 처리 시나리오</label><select id="mock-scenario" value={scenario} onChange={e => setScenario(e.target.value as MockScenario)}><option value="success">정상 처리</option><option value="fail-once">처음 실패 후 재시도 성공</option></select>
 <button className="primary" disabled={!valid} type="submit">{status === 'sending' ? '모의 처리 중…' : status === 'error' ? '모의 전송 재시도' : status === 'success' ? '모의 처리 완료' : '검사 결과 보내기 (모의)'}</button></fieldset>
 </form>{message && <p role={status === 'error' ? 'alert' : 'status'} className="notice">{message}</p>}
 <aside className="info"><p>상담 안내: Staging에서는 한의원 상담 접수나 연락을 제공하지 않습니다. 한의원 공식 연락처와 실제 수신자는 아직 확정되지 않았습니다.</p></aside>
 </section>
}

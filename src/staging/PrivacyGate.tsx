import { useEffect, useMemo, useRef, useState } from 'react'
import App from '../App'
import { PrivacyPolicy, retentionNotice } from './PrivacyPolicy'
import { clinicName, privacyDepartment, privacyContact, preExamPersonal, preExamSensitive, adminArchiveNotice } from './privacy-copy'
import { SubmissionForm } from './SubmissionForm'
import type { Submission, MockReceipt } from './contracts'
import { markCompletion, confirmPending } from './completion'
import { acceptPrivacy, assertStates, deleteAll, ensureEpoch, epoch, expire, hasLegacy, metadataKey, privacy, privacyKey, requirePrivacy, sessionStore, type PrivacyReceipt } from './privacy-storage'

type Props = {
 authorize: () => Promise<PrivacyReceipt>
 verify: (proof: string) => Promise<unknown>
 confirm: Parameters<typeof confirmPending>[1]
 send: (input: Submission) => Promise<MockReceipt>
}
function failureCode(error: unknown) {
 const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
 return typeof code === 'string' && /^(functions|auth|appCheck)\/[a-z-]{1,40}$/.test(code) ? code : 'local-state-or-connection'
}
export function PrivacyGate({ authorize, verify, confirm, send }: Props) {
 const [ready, setReady] = useState(false), [checking, setChecking] = useState(true), [busy, setBusy] = useState(false)
 const [personal, setPersonal] = useState(false), [sensitive, setSensitive] = useState(false), [legacy, setLegacy] = useState(false)
 const verifiedProof = useRef(''), observedEpoch = useRef(epoch()), authorized = useRef(false)
 const consentRevision = useRef(0), accepting = useRef(false)
 const dialogRef = useRef<HTMLDivElement>(null)
 const [message, setMessage] = useState(''), [revision, setRevision] = useState(0), [removal, setRemoval] = useState(false)
 useEffect(() => {
  if (!removal) return
  const previous = document.activeElement as HTMLElement | null, buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button')
  buttons?.[0]?.focus()
  const keyboard = (event: KeyboardEvent) => {
   if (event.key === 'Escape') { event.preventDefault(); setRemoval(false) }
   if (event.key === 'Tab' && buttons?.length) {
    const target = event.shiftKey ? buttons[0] : buttons[buttons.length - 1]
    if (document.activeElement === target) { event.preventDefault(); (event.shiftKey ? buttons[buttons.length - 1] : buttons[0]).focus() }
   }
  }
  document.addEventListener('keydown', keyboard)
  return () => { document.removeEventListener('keydown', keyboard); previous?.focus() }
 }, [removal])
 useEffect(() => {
  let live = true
  async function check(initial = false, external = false) {
   if (accepting.current && !external) return
   const checkRevision = consentRevision.current
   try {
    ensureEpoch()
    const expired = expire(), changedEpoch = !!observedEpoch.current && observedEpoch.current !== epoch(), old = hasLegacy(), consent = privacy(); observedEpoch.current = epoch()
    if (!live) return
    setLegacy(old)
    if (expired || external || changedEpoch) { setRevision(v => v + 1); setMessage(expired ? '7일이 지난 검사와 관련 완료 증명을 삭제했습니다. 다른 유효 검사는 유지됩니다.' : '다른 탭의 검사 변경을 반영했습니다.') }
    if (!consent || old) {
     if (authorized.current) { setPersonal(false); setSensitive(false); authorized.current = false }
     setReady(false); setChecking(false); return
    }
    if ((initial || external) && verifiedProof.current !== consent.proof) {
     setReady(false); setChecking(true)
     const current = epoch()
     await verify(consent.proof)
     if (checkRevision !== consentRevision.current) return
     if (live && epoch() === current && privacy()?.proof === consent.proof && !hasLegacy()) { verifiedProof.current = consent.proof; authorized.current = true; setReady(true) }
    }
    if (live && verifiedProof.current === consent.proof && privacy()?.proof === consent.proof && !hasLegacy()) setReady(true)
    if (live) setChecking(false)
   } catch (error) { if (live && checkRevision === consentRevision.current) { setReady(false); setChecking(false); setMessage(`동의·저장 상태를 확인하지 못했습니다. 다시 동의하거나 브라우저 저장 설정을 확인해 주세요. [증명 확인: ${failureCode(error)}]`) } }
  }
  void check(true)
  const timer = window.setInterval(() => void check(), 1000)
  const visible = () => { if (document.visibilityState === 'visible') void check(true) }
  const storage = (event: StorageEvent) => { if (event.key === null || event.key.startsWith('yingyang:')) void check(true, true) }
  document.addEventListener('visibilitychange', visible); window.addEventListener('storage', storage)
  return () => { live = false; clearInterval(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('storage', storage) }
 }, [verify])
 async function accept(migrate: boolean) {
  if (!personal || !sensitive || accepting.current) return
  accepting.current = true; consentRevision.current += 1
  setBusy(true); setMessage('')
  let stage = '서버 동의 요청'
  try {
   const current = ensureEpoch(), receipt = await authorize()
   stage = '브라우저 동의 저장'
   acceptPrivacy(receipt, current, migrate); verifiedProof.current = receipt.proof; authorized.current = true
   setLegacy(false); setReady(true); setRevision(v => v + 1)
   setMessage(migrate ? '기존 자료를 명시적으로 이전했습니다. 저장일을 알 수 없는 검사는 지금부터 7일로 계산합니다. 이전 완료 시각은 새로 만들지 않습니다.' : '검사 전 동의를 확인했습니다.')
  } catch (error) { setMessage(`동의를 확인하지 못했습니다. 삭제·다른 탭 변경 또는 연결 상태를 확인하고 다시 시도해 주세요. [${stage}: ${failureCode(error)}]`) }
  finally { accepting.current = false; setBusy(false); setChecking(false) }
 }
 function remove() {
  consentRevision.current += 1
  try { deleteAll(); setReady(false); setLegacy(false); setPersonal(false); setSensitive(false); setRevision(v => v + 1); setRemoval(false); setMessage('이 브라우저의 검사·완료 증명·임시 동의 기록을 삭제했습니다. 글자 크기는 유지했습니다.') }
  catch { setMessage('일부 자료를 삭제하지 못했습니다. 브라우저 사이트 데이터 설정에서 확인해 주세요.'); setReady(false) }
 }
 const currentEpoch = epoch()
 const store = useMemo(() => sessionStore(currentEpoch), [currentEpoch, revision])
 return <>
  <section className="panel privacy-panel" aria-label="검사 개인정보 보호"><strong>STAGING · 가상 자료 전용 · 실제 이메일 발송 없음</strong>
   <p>공유 기기에는 검사 응답이 남을 수 있습니다. 로그아웃과 검사 데이터 삭제는 다릅니다.</p>
   <p>{retentionNotice}</p>
   <p>브라우저가 닫혀 있으면 다음 실행 때 만료를 확인하고 삭제합니다.</p>
   <PrivacyPolicy/>
   <button type="button" className="secondary" onClick={() => setRemoval(true)}>검사 데이터 모두 삭제</button>
   {message && <p role="status">{message}</p>}
  </section>
  {checking ? <p role="status">동의와 임시 저장 상태 확인 중…</p> : ready ? <App key={revision} sessionStore={store} onSessionsChange={(states, completed) => { assertStates(states, currentEpoch); markCompletion(states, completed); void confirmPending(states, confirm).catch(() => {}) }} submission={states => <SubmissionForm states={states} confirm={confirm} guard={() => { assertStates(states, currentEpoch); return requirePrivacy(currentEpoch).proof }} send={async input => { assertStates(states, currentEpoch); const result = await send(input); assertStates(states, currentEpoch); return result }}/>}/> : <section className="panel privacy-panel">
   <h1>검사 시작 전 안내와 동의</h1>
   <p>가상 응답의 자동 저장·이어하기, 서버 완료 확인·재집계, PDF 생성과 모의 처리에 사용합니다. 이름·전화번호는 검사 후 가상 정보만 입력하며 브라우저에 영구 저장하지 않습니다.</p>
   <p>검사 시작·이어하기와 응답의 서버 전송 전에 아래 두 항목에 각각 동의해 주세요. 서버 동의 확인 요청에는 검사 응답을 넣지 않습니다.</p>
   <p>{clinicName}에 예약하고 방문할 예정인 환자의 진료 준비를 위한 사전 검사입니다. 현재 Staging에서는 지정된 가상 정보만 사용합니다. 문의: {privacyDepartment} (접수 및 처리), {privacyContact}.</p>
   <h2>개인정보 수집·이용</h2><p>{preExamPersonal}</p>
   <h2>건강 관련 민감정보 처리</h2><p>{preExamSensitive}</p>
   <p>{adminArchiveNotice}</p>
   <p>이름·전화번호 및 PDF 처리 동의는 검사 후 별도로 확인합니다. 위 개인정보처리방침에서 보관·삭제와 권리행사 방법을 확인할 수 있습니다.</p>
   <p>거부할 수 있으며 거부 시 이 Staging 검사의 저장·이어하기·완료 확인·모의 전송은 이용할 수 없습니다. 다른 진료·상담 전체의 제한을 뜻하지 않습니다.</p>
   <label className="consent-check"><input type="checkbox" checked={personal} onChange={e => setPersonal(e.target.checked)} disabled={busy}/>개인정보 수집·이용에 동의합니다</label>
   <label className="consent-check"><input type="checkbox" checked={sensitive} onChange={e => setSensitive(e.target.checked)} disabled={busy}/>건강 관련 민감정보 처리에 별도로 동의합니다</label>
   {legacy && <aside className="notice"><h2>기존 저장 데이터가 있습니다</h2><p>기존 자료의 실제 저장일을 알 수 없습니다. 이전을 선택하면 해당 자료는 지금부터 7일로 계산합니다. 선택 전 임의로 이전하거나 삭제하지 않습니다.</p></aside>}
   <button className="primary" disabled={busy || !personal || !sensitive} onClick={() => void accept(legacy)}>{busy ? '동의 확인 중…' : legacy ? '이전해 이어하기' : '동의하고 검사 시작·이어하기'}</button>
   {legacy && <button className="secondary" disabled={busy} onClick={() => setRemoval(true)}>삭제하고 새로 시작</button>}
  </section>}
  {removal && <div className="modal-backdrop" ref={dialogRef}><section className="modal panel" role="alertdialog" aria-modal="true" aria-label="검사 데이터 삭제 확인"><h2>검사 데이터를 모두 삭제할까요?</h2><p>두 검사 응답·진행 상태·완료 증명·임시 동의와 입력 화면을 지우고 이어하기를 종료합니다. 글자 크기는 유지합니다. 이미 접수된 요청·메일·로그·백업은 삭제되거나 전송 취소되지 않습니다.</p><div className="actions"><button className="secondary" onClick={() => setRemoval(false)}>취소</button><button className="primary" onClick={remove}>모두 삭제 확인</button></div></section></div>}
 </>
}

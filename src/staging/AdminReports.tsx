import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AdminDownload, AdminPage, AdminQuery, AdminReport } from './admin-contracts'

type Props = { list: (query: AdminQuery) => Promise<AdminPage>; download: (id: string) => Promise<AdminDownload> }
const labels = {pending:'대기',success:'성공 (API 접수)',failed:'실패'}
function date(value: number) { return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'medium'}).format(value) }
function code(error: unknown) { const value=error&&typeof error==='object'&&'code' in error?error.code:'';return typeof value==='string'&&/^functions\/[a-z-]+$/.test(value)?value:'request-failed' }
export function AdminReports({list,download}: Props) {
 const [rows,setRows]=useState<AdminReport[]>([]),[cursor,setCursor]=useState<string>(),[query,setQuery]=useState<AdminQuery>({})
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[downloading,setDownloading]=useState('')
 const active=useRef(true),generation=useRef(0),lock=useRef(false)
 const applied=useRef<AdminQuery>({})
 async function load(next=false) {
  if(lock.current)return
  lock.current=true;setBusy(true);setMessage('');const current=++generation.current
  const selection=next?applied.current:query
  try {
   const page=await list({...selection,...(next&&cursor?{cursor}:{})})
   if(active.current&&current===generation.current){setRows(old=>next?[...old,...page.reports]:page.reports);setCursor(page.nextCursor);applied.current=selection}
  }catch(error){if(active.current)setMessage('발송 이력을 조회하지 못했습니다. '+code(error))}
  finally{lock.current=false;if(active.current)setBusy(false)}
 }
 useEffect(()=>{active.current=true;void load();return()=>{active.current=false;generation.current++}},[list])
 function filter(event: FormEvent){event.preventDefault();void load()}
 async function save(row: AdminReport) {
  if(downloading)return
  setDownloading(row.id);setMessage('')
  try {
   const file=await download(row.id)
   if(!active.current)return
   const bytes=Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob)
   try{const link=document.createElement('a');link.href=url;link.download=file.filename;link.click()}finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);bytes.fill(0)}
   setMessage('PDF 다운로드를 요청했습니다. 내려받은 사본은 관리자 책임으로 관리·삭제해 주세요.')
  }catch(error){if(active.current)setMessage('PDF를 받을 수 없습니다. 권한·7일 만료 상태를 확인해 주세요. '+code(error))}
  finally{if(active.current)setDownloading('')}
 }
 return <main className="stage-shell admin-shell"><h1>관리자 · 메일 발송 이력</h1>
  <aside>관리자 전용입니다. 모의 처리와 Gmail API 접수를 구분합니다. API 접수 성공은 수신함 도착 확인이 아닙니다. 대기는 처리 중이거나 최종 상태 기록이 확인되지 않은 경우입니다. 이 화면에서 재발송하지 않습니다. PDF는 생성 후 7일까지만 보관·다운로드하며 만료 후 서버가 차단합니다. 저장소 자동 삭제는 비동기 처리됩니다.</aside>
  <form onSubmit={filter} aria-label="발송 이력 검색"><fieldset disabled={busy}><legend>처리일 (한국 시간) · 상태 검색</legend>
   <label>시작일<input type="date" value={query.from||''} onChange={e=>setQuery({...query,from:e.target.value})}/></label>
   <label>종료일<input type="date" value={query.to||''} onChange={e=>setQuery({...query,to:e.target.value})}/></label>
   <label>발송 상태<select value={query.status||''} onChange={e=>setQuery({...query,status:e.target.value as AdminQuery['status']})}><option value="">전체</option><option value="pending">대기</option><option value="success">성공</option><option value="failed">실패</option></select></label>
   <button type="submit">{busy?'조회 중…':'검색·새로고침'}</button></fieldset></form>
  {message&&<p role="status" className="stage-notice">{message}</p>}
  {!busy&&!rows.length&&<p>조건에 맞는 이력이 없습니다.</p>}
  <ul className="admin-results" aria-label="발송 이력">{rows.map(row=><li key={row.id}><h2>{row.maskedName} ({row.phoneLast4})</h2>
   <p><strong>{row.mode==='mock'?'모의 처리 · 실제 발송 없음':'Gmail API'}</strong></p><dl><dt>처리 시각 (KST)</dt><dd>{date(row.updatedAt)}</dd><dt>상태</dt><dd>{row.mode==='mock'&&row.status==='success'?'모의 성공':labels[row.status]}</dd><dt>PDF 생성 시각</dt><dd>{date(row.createdAt)}</dd><dt>다운로드 만료</dt><dd>{date(row.expiresAt)}</dd></dl>
   {row.errorCode&&<p>오류 코드: {row.errorCode}{row.errorCode==='outcome-unknown'?' · 발송 결과 불명. 자동 재발송하지 마세요.':''}</p>}
   <button disabled={!row.pdfAvailable||!!downloading} onClick={()=>void save(row)}>{downloading===row.id?'다운로드 중…':row.status==='failed'?'실패 PDF 다운로드':'PDF 다운로드'}</button>
  </li>)}</ul>
  {cursor&&<button disabled={busy} onClick={()=>void load(true)}>다음 이력 더 보기</button>}
 </main>
}

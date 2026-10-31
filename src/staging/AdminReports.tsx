import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AdminDownload, AdminPage, AdminQuery, AdminReport } from './admin-contracts'

type Props = { list: (query: AdminQuery) => Promise<AdminPage>; download: (id: string) => Promise<AdminDownload> }
const labels = {pending:'대기',success:'성공 (API 접수)',failed:'실패'}
function date(value: number) { return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short'}).format(value) }
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
 return <div className="admin-reports"><div className="admin-section-title"><h2>발송 이력</h2><p>PDF는 생성 후 7일 동안 다운로드할 수 있습니다. 시간은 한국 시간 기준입니다.</p></div>
  <form onSubmit={filter} aria-label="발송 이력 검색" className="admin-filters"><fieldset disabled={busy}><legend className="admin-sr-only">처리일 · 상태 검색</legend>
   <label>시작일<input type="date" value={query.from||''} onChange={e=>setQuery({...query,from:e.target.value})}/></label>
   <label>종료일<input type="date" value={query.to||''} onChange={e=>setQuery({...query,to:e.target.value})}/></label>
   <label>발송 상태<select value={query.status||''} onChange={e=>setQuery({...query,status:e.target.value as AdminQuery['status']})}><option value="">전체</option><option value="pending">대기</option><option value="success">성공</option><option value="failed">실패</option></select></label>
   <button type="submit">{busy?'조회 중…':'검색·새로고침'}</button></fieldset></form>
  {message&&<p role="status" className="admin-notice">{message}</p>}
  {!busy&&!rows.length&&<p className="admin-empty">조건에 맞는 이력이 없습니다.</p>}
  {busy&&<p role="status" className="admin-muted">이력을 불러오고 있습니다…</p>}
  {rows.length>0&&<table className="admin-history"><caption className="admin-sr-only">발송 이력</caption><thead><tr><th scope="col">환자</th><th scope="col">처리 시각</th><th scope="col">상태</th><th scope="col">PDF 보관</th><th scope="col">다운로드</th></tr></thead><tbody>{rows.map(row=>{
   const expired=Date.now()>=row.expiresAt
   return <tr key={row.id}><th scope="row"><h3>{row.maskedName} ({row.phoneLast4})</h3><span className="admin-muted">{row.mode==='mock'?'모의 처리 · 실제 발송 없음':'Gmail API 접수'}</span></th><td data-label="처리 시각"><time dateTime={new Date(row.updatedAt).toISOString()}>{date(row.updatedAt)}</time></td><td data-label="상태"><span className={'admin-state state-'+row.status}>{row.mode==='mock'&&row.status==='success'?'모의 성공':labels[row.status]}</span>{row.errorCode&&<span className="admin-error-detail">{row.errorCode==='outcome-unknown'?'결과 불명 · 재발송 금지':row.errorCode}</span>}{row.status==='pending'&&<span className="admin-error-detail">처리 중 또는 최종 상태 미확인</span>}</td><td data-label="PDF 보관"><span className={expired?'admin-expired':''}>{expired?'보관 만료':date(row.expiresAt)+'까지'}</span>{!expired&&!row.pdfAvailable&&<span className="admin-error-detail">파일 없음</span>}</td><td><button className="admin-button-secondary" aria-label={row.maskedName+' ('+row.phoneLast4+') '+(row.status==='failed'?'실패 PDF 다운로드':'PDF 다운로드')} disabled={expired||!row.pdfAvailable||!!downloading} onClick={()=>void save(row)}>{expired?'만료됨':downloading===row.id?'다운로드 중…':row.status==='failed'?'실패 PDF 다운로드':'PDF 다운로드'}</button></td></tr>
  })}</tbody></table>}
  <p className="admin-footnote">API 접수는 수신 확인이 아닙니다. 내려받은 PDF는 관리자 책임으로 관리·삭제해 주세요.</p>
  {cursor&&<button disabled={busy} onClick={()=>void load(true)}>다음 이력 더 보기</button>}
 </div>
}

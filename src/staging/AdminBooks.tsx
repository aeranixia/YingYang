import { useEffect, useState } from 'react'
import { defaultBooks, type BookSettings } from '../book-settings'

export function AdminBooks({ invoke, reauth }: { invoke: (data: Record<string, unknown>) => Promise<{ books: BookSettings }>; reauth: () => Promise<unknown> }) {
 const [books, setBooks] = useState(defaultBooks), [busy, setBusy] = useState(true), [message, setMessage] = useState('')
 useEffect(() => { let live = true; void invoke({ action: 'questionnaires' }).then(r => { if (live) setBooks(r.books) }).catch(() => { if (live) setMessage('문제집 설정을 불러오지 못했습니다.') }).finally(() => { if (live) setBusy(false) }); return () => { live = false } }, [])
 async function save() {
  setBusy(true); setMessage('')
  try { await reauth(); const r = await invoke({ action: 'questionnaires', ...books }); setBooks(r.books); setMessage('문제집 설정을 저장했습니다. 기존 기록은 삭제하거나 재계산하지 않습니다.') }
  catch { setMessage('저장하지 못했습니다. 권한·연결을 확인하고 설정을 새로고침해 주세요.') } finally { setBusy(false) }
 }
 return <section><h2>문제집 관리</h2><p>이용자가 사용할 문제집을 선택합니다. 개별 환자 기록의 공개 설정이 아닙니다.</p>
  <label className="consent-check"><input type="checkbox" checked={books.currentEnabled} disabled={busy} onChange={e => setBooks({ ...books, currentEnabled: e.target.checked })}/>현재문항 · 80문항</label>
  <label className="consent-check"><input type="checkbox" checked={books.legacyEnabled} disabled={busy} onChange={e => setBooks({ ...books, legacyEnabled: e.target.checked })}/>문항 1.0 · 기존 50문항</label>
  <p>적어도 한 문제집은 활성화해야 합니다. 문항 1.0이 비활성화되면 이용자에게 문제집 탭을 표시하지 않습니다. 비활성 문제집의 기존 결과도 발송 이력에서 확인할 수 있습니다.</p>
  <button disabled={busy || !books.currentEnabled && !books.legacyEnabled} onClick={() => void save()}>설정 저장</button>{message && <p role="status">{message}</p>}
 </section>
}

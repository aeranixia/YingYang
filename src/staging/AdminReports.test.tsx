import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AdminReports } from './AdminReports'
import type { AdminPage } from './admin-contracts'
afterEach(()=>{cleanup();vi.restoreAllMocks()})
const row={id:'synthetic',maskedName:'김*동',phoneLast4:'1234',createdAt:Date.now(),updatedAt:Date.now(),expiresAt:Date.now()+604800000,status:'failed' as const,mode:'mock' as const,errorCode:'mock-failed',pdfAvailable:true}
it('masked history distinguishes mock from email receipt and sends filters without identity',async()=>{
 const list=vi.fn(async()=>({reports:[row]} as AdminPage)),download=vi.fn()
 render(<AdminReports list={list} download={download}/>);await screen.findByRole('heading',{name:'김*동 (1234)'})
 expect(screen.getByText('모의 처리 · 실제 발송 없음')).toBeTruthy()
 fireEvent.change(screen.getByLabelText('발송 상태'),{target:{value:'failed'}});fireEvent.submit(screen.getByRole('form',{name:'발송 이력 검색'}))
 await vi.waitFor(()=>expect(list).toHaveBeenCalledWith({status:'failed'}))
 expect(localStorage.length).toBe(0)
})
it('permission failures show only safe code; failed downloads can be retried',async()=>{
 const list=vi.fn(async()=>({reports:[row]})),download=vi.fn().mockRejectedValue({code:'functions/failed-precondition',message:'private-original-name'})
 render(<AdminReports list={list} download={download}/>);fireEvent.click(await screen.findByRole('button',{name:'실패 PDF 다운로드'}))
 await screen.findByText(/functions\/failed-precondition/);expect(screen.queryByText(/private-original-name/)).toBeNull()
 expect((screen.getByRole('button',{name:'실패 PDF 다운로드'}) as HTMLButtonElement).disabled).toBe(false)
})

import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdminDrive } from './AdminDrive'
afterEach(cleanup)
const config={enabled:false,mode:'mock',folderId:'mock-folder-yingyang',startAt:0,revision:''}
it('displays disabled mock setup, independent status and no deletion controls',async()=>{
 const invoke=vi.fn(async(data:Record<string,unknown>)=>data.action==='status'?{config}:{jobs:[{id:'virtual-job',mode:'mock',status:'succeeded',attempts:1,updatedAt:Date.now(),sourceExpiresAt:Date.now()+60000}],nextCursor:''})
 render(<AdminDrive invoke={invoke as never} reauth={vi.fn()}/>);await screen.findByText('백업 완료 (모의)')
 expect((screen.getByLabelText('새 PDF 자동 백업 사용') as HTMLInputElement).checked).toBe(false)
 expect(screen.queryByRole('button',{name:/삭제|파기/})).toBeNull();expect(screen.queryByLabelText(/토큰|비밀번호/)).toBeNull()
})
it('saves only the revision and allowed configuration; retry never invokes mail API',async()=>{
 const invoke=vi.fn(async(data:Record<string,unknown>)=>data.action==='status'?{config}:data.action==='save'?{config:{...config,enabled:true,revision:'2'}}:{jobs:[{id:'virtual-job',mode:'mock',status:'retry-wait',attempts:1,updatedAt:Date.now(),nextAt:Date.now(),sourceExpiresAt:Date.now()+60000}],nextCursor:''})
 render(<AdminDrive invoke={invoke as never} reauth={vi.fn()}/>);await screen.findByLabelText('새 PDF 자동 백업 사용')
 fireEvent.click(screen.getByLabelText('새 PDF 자동 백업 사용'));fireEvent.click(screen.getByRole('button',{name:'설정 저장'}))
 await waitFor(()=>expect(invoke).toHaveBeenCalledWith({action:'save',enabled:true,mode:'mock',folderId:'mock-folder-yingyang',revision:''}))
 await screen.findByText('백업 설정을 저장했습니다. 기존 PDF를 소급 전송하지 않습니다.')
 fireEvent.click(screen.getByRole('button',{name:'백업 재시도'}));await waitFor(()=>expect(invoke).toHaveBeenCalledWith({action:'retry',id:'virtual-job'}))
 expect(invoke.mock.calls.every(([d])=>['status','list','save','retry'].includes(String(d.action)))).toBe(true)
})

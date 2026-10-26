import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../App'
import { fresh, key, type Session } from '../engine'
import { SubmissionForm } from './SubmissionForm'
import type { Submission } from './contracts'
import { completionKey, markCompletion } from './completion'
beforeEach(() => { localStorage.clear(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const state = (kind: 'acquired' | 'innate'): Session => ({ ...fresh(kind), completed: true, answers: Array(kind === 'acquired' ? 10 : 40).fill(kind === 'acquired' ? 2 : 1) })
const states = () => ({ acquired: state('acquired'), innate: state('innate') })
function enter() {
 fireEvent.change(screen.getByLabelText('이름'), { target: { value: '가상테스터' } })
 fireEvent.change(screen.getByLabelText('전화번호'), { target: { value: '010-0000-1234' } })
 for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box)
}
it('separate consents and synthetic identity are required; no identity stored in localStorage', async () => {
 const send = vi.fn(async (data: Submission) => ({ status: 'mock-completed' as const, requestId: data.requestId, duplicate: false }))
 render(<SubmissionForm states={states()} send={send}/>)
 const button = screen.getByRole('button', { name: '검사 결과 보내기 (모의)' }) as HTMLButtonElement
 expect(button.disabled).toBe(true)
 enter(); expect(button.disabled).toBe(false)
 fireEvent.click(screen.getAllByRole('checkbox')[1]); expect(button.disabled).toBe(true)
 fireEvent.submit(screen.getByRole('form')); expect(send).not.toHaveBeenCalled()
 fireEvent.click(screen.getAllByRole('checkbox')[1]); fireEvent.click(button)
 await waitFor(() => expect(screen.getByRole('status').textContent).toContain('실제 이메일은 발송되지 않았습니다'))
 expect((screen.getByLabelText('이름') as HTMLInputElement).value).toBe('')
 expect((screen.getByLabelText('전화번호') as HTMLInputElement).value).toBe('')
 expect(localStorage.length).toBe(0)
})
it('blocks double submit and retries same request ID without losing answers', async () => {
 let reject!: (error: Error) => void
 const send = vi.fn<(data: Submission) => Promise<{ status: 'mock-completed'; requestId: string; duplicate: boolean }>>()
 send.mockImplementationOnce(() => new Promise((_, no) => { reject = no }))
 send.mockImplementation(async data => ({ status: 'mock-completed', requestId: data.requestId, duplicate: false }))
 const data = states(); render(<SubmissionForm states={data} send={send}/>); enter()
 fireEvent.submit(screen.getByRole('form')); fireEvent.submit(screen.getByRole('form'))
 expect(send).toHaveBeenCalledTimes(1)
 expect((screen.getByLabelText('이름') as HTMLInputElement).matches(':disabled')).toBe(true)
 expect(screen.getByRole('form').getAttribute('aria-busy')).toBe('true')
 reject(Error('simulated'))
 await screen.findByRole('alert')
 fireEvent.click(screen.getByRole('button', { name: '모의 전송 재시도' }))
 await waitFor(() => expect(send).toHaveBeenCalledTimes(2))
 expect(send.mock.calls[0][0].requestId).toBe(send.mock.calls[1][0].requestId)
 expect(data.acquired.answers).toEqual(Array(10).fill(2))
})
it('Staging hides all score tables and exposes submission only after both exams complete; text size preserves answers', () => {
 const data = states()
 for (const kind of ['acquired', 'innate'] as const) localStorage.setItem(key(kind), JSON.stringify(data[kind]))
 const before = localStorage.getItem(key('innate'))
 render(<App submission={s => <SubmissionForm states={s} send={vi.fn()}/>}/>)
 expect(screen.queryByRole('table')).toBeNull()
 fireEvent.click(screen.getByRole('button', { name: '결과 보내기 (모의) →' }))
 expect(screen.getByRole('form')).toBeTruthy(); expect(screen.queryByRole('table')).toBeNull()
 for (const label of ['소', '중', '대']) fireEvent.click(screen.getByRole('button', { name: `글자 크기 ${label}` }))
 expect(localStorage.getItem(key('innate'))).toBe(before)
 fireEvent.click(screen.getByRole('button', { name: '← 홈으로' }))
 fireEvent.click(screen.getAllByRole('button', { name: '완료 및 응답 보기' })[0])
 expect(screen.queryByRole('table')).toBeNull()
 fireEvent.click(screen.getByRole('button', { name: '다시 검진하기' })); fireEvent.click(screen.getByRole('button', { name: '확인' }))
 expect(screen.queryByRole('form')).toBeNull(); expect(screen.queryByText('타고난 체질 결과 보기')).toBeNull()
 expect(localStorage.getItem(key('innate'))).toBe(before)
})

it('recovers form controls when request ID creation fails before network transmission', async () => {
 const send = vi.fn()
 vi.spyOn(crypto, 'randomUUID').mockImplementationOnce(() => { throw new Error('Unavailable entropy') })
 render(<SubmissionForm states={states()} send={send}/>); enter()
 fireEvent.submit(screen.getByRole('form'))
 await screen.findByRole('alert')
 expect(send).not.toHaveBeenCalled()
 expect(screen.getByLabelText('이름').matches(':disabled')).toBe(false)
 expect(screen.getByRole('form').getAttribute('aria-busy')).toBe('false')
})

it('final exam completion requests server confirmation and retaking clears it without changing other exam', async () => {
 const data=states();data.innate.completed=false;data.innate.current=39
 for(const kind of ['acquired','innate'] as const)localStorage.setItem(key(kind),JSON.stringify(data[kind]))
 const confirm=vi.fn(async()=>({proof:'test-server-proof'})),send=vi.fn(async(input:Submission)=>({status:'mock-completed' as const,requestId:input.requestId,duplicate:false}))
 const changed=vi.fn(markCompletion)
 render(<App onSessionsChange={changed} submission={s=><SubmissionForm states={s} send={send} confirm={confirm}/>}/>)
 fireEvent.click(screen.getByRole('button',{name:'이어하기'}))
 fireEvent.click(screen.getByRole('button',{name:'검진 완료'}))
 await waitFor(()=>expect(confirm).toHaveBeenCalledTimes(1))
 expect(changed.mock.calls.at(-1)?.[1]).toBe(true)
 enter();fireEvent.click(screen.getByRole('button',{name:'검사 결과 보내기 (모의)'}))
 await waitFor(()=>expect(send).toHaveBeenCalledTimes(1))
 expect(send.mock.calls[0][0].completionProof).toBe('test-server-proof')
 fireEvent.click(screen.getByRole('button',{name:'← 홈으로'}))
 fireEvent.click(screen.getAllByRole('button',{name:'완료 및 응답 보기'})[1])
 fireEvent.click(screen.getByRole('button',{name:'다시 검진하기'}));fireEvent.click(screen.getByRole('button',{name:'확인'}))
 expect(localStorage.getItem(completionKey)).toBeNull()
 expect(JSON.parse(localStorage.getItem(key('acquired'))!).completed).toBe(true)
})

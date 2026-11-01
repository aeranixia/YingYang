import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { fresh } from '../engine'
import { ProductionSubmission, type DeliveryReceipt } from './SubmissionForm'
import type { Submission } from '../staging/contracts'
const states=()=>({acquired:{...fresh('acquired'),completed:true,answers:Array(10).fill(1)},innate:{...fresh('innate'),completed:true,answers:Array(40).fill(2)}})
beforeEach(()=>localStorage.clear())
afterEach(()=>{cleanup();vi.restoreAllMocks()})
function enter(){fireEvent.change(screen.getByLabelText('이름'),{target:{value:'가상테스터'}});fireEvent.change(screen.getByLabelText('전화번호'),{target:{value:'010-0000-1234'}});for(const box of screen.getAllByRole('checkbox'))fireEvent.click(box)}
const accepted=async(data:Submission):Promise<DeliveryReceipt>=>({status:'gmail-accepted',requestId:data.requestId,duplicate:false})
it('requires both consents, prevents double submit, clears identity without storing it and distinguishes inbox arrival',async()=>{
 let resolve!:(value:DeliveryReceipt)=>void
 const send=vi.fn<(data:Submission)=>Promise<DeliveryReceipt>>().mockImplementation(()=>new Promise(r=>resolve=r))
 render(<ProductionSubmission states={states()} send={send}/>)
 const button=screen.getByRole('button',{name:'검사 결과 보내기'}) as HTMLButtonElement
 expect(button.disabled).toBe(true);enter();fireEvent.click(screen.getAllByRole('checkbox')[1]);expect(button.disabled).toBe(true);fireEvent.submit(screen.getByRole('form'));expect(send).not.toHaveBeenCalled()
 fireEvent.click(screen.getAllByRole('checkbox')[1]);fireEvent.submit(screen.getByRole('form'));fireEvent.submit(screen.getByRole('form'));expect(send).toHaveBeenCalledTimes(1)
 resolve(await accepted(send.mock.calls[0][0]));await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('수신함 도착은 별도 확인'))
 expect((screen.getByLabelText('이름') as HTMLInputElement).value).toBe('');expect(localStorage.length).toBe(0)
})
it('known pre-send failure retries same request ID; network outcome uncertainty stops retry',async()=>{
 const send=vi.fn(accepted).mockRejectedValueOnce({details:{outcomeUnknown:false}})
 render(<ProductionSubmission states={states()} send={send}/>);enter();fireEvent.submit(screen.getByRole('form'));await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'전송 재시도'}))
 await waitFor(()=>expect(send).toHaveBeenCalledTimes(2));expect(send.mock.calls[0][0].requestId).toBe(send.mock.calls[1][0].requestId)
 cleanup();const uncertain=vi.fn(accepted).mockRejectedValue(Error('synthetic network failure'))
 render(<ProductionSubmission states={states()} send={uncertain}/>);enter();fireEvent.submit(screen.getByRole('form'));await screen.findByRole('alert');fireEvent.submit(screen.getByRole('form'));expect(uncertain).toHaveBeenCalledTimes(1);expect((screen.getByRole('button',{name:'한의원 확인 필요'}) as HTMLButtonElement).matches(':disabled')).toBe(true)
})

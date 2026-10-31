import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { fresh, key } from '../engine'
import { PrivacyGate } from './PrivacyGate'
import { deleteAll, metadataKey, privacyKey, retentionMs } from './privacy-storage'
import { seedPrivacy } from './test-privacy'
const receipt=()=>({proof:'synthetic-server-receipt',at:Date.now(),expires:Date.now()+retentionMs})
const callbacks=()=>({authorize:vi.fn(async()=>receipt()),verify:vi.fn(async()=>({valid:true})),confirm:vi.fn(async()=>({proof:'synthetic-completion'})),send:vi.fn()})
beforeEach(()=>{localStorage.clear();vi.spyOn(window,'scrollTo').mockImplementation(()=>{})})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
function agree(){for(const box of screen.getAllByRole('checkbox'))fireEvent.click(box)}
it('이전 동의 버전은 다시 확인하되 기존 응답과 저장 시각은 유지한다',async()=>{
 seedPrivacy({acquired:{...fresh('acquired'),answers:[2,...Array(9).fill(null)]},innate:fresh('innate')})
 const prior=JSON.parse(localStorage.getItem(privacyKey)!);prior.version='staging-clinic-privacy-2';localStorage.setItem(privacyKey,JSON.stringify(prior))
 const answers=localStorage.getItem(key('acquired')),saved=localStorage.getItem(metadataKey)
 const props=callbacks();render(<PrivacyGate {...props}/>);await screen.findByRole('heading',{name:'검사 시작 전 안내와 동의'})
 expect(props.verify).not.toHaveBeenCalled();agree();fireEvent.click(screen.getByRole('button',{name:'동의하고 검사 시작·이어하기'}))
 await screen.findByLabelText('검진 선택');expect(localStorage.getItem(key('acquired'))).toBe(answers);expect(localStorage.getItem(metadataKey)).toBe(saved)
})
it('server receipt slightly ahead of browser reaches exam card and first question',async()=>{
 const props=callbacks();props.authorize.mockImplementation(async()=>{const at=Date.now()+1000;return {proof:'ahead',at,expires:at+retentionMs}})
 render(<PrivacyGate {...props}/>);await screen.findByRole('heading',{name:'검사 시작 전 안내와 동의'});agree()
 fireEvent.click(screen.getByRole('button',{name:'동의하고 검사 시작·이어하기'}));await screen.findByLabelText('검진 선택')
 fireEvent.click(screen.getAllByRole('button',{name:/시작하기/})[0]);await screen.findByText('문항 1 / 10')
})
it('callable rejection shows safe stage/code and restores button for retry without clearing checks',async()=>{
 const props=callbacks();props.authorize.mockRejectedValueOnce({code:'functions/permission-denied',message:'private-token-never-show'})
 render(<PrivacyGate {...props}/>);await screen.findByRole('heading',{name:'검사 시작 전 안내와 동의'});agree()
 const start=screen.getByRole('button',{name:'동의하고 검사 시작·이어하기'}) as HTMLButtonElement
 fireEvent.click(start);await screen.findByText(/서버 동의 요청: functions\/permission-denied/)
 expect(start.disabled).toBe(false);expect(screen.queryByText(/private-token-never-show/)).toBeNull()
 fireEvent.click(start);await screen.findByLabelText('검진 선택')
})
it('separate pre-exam consent gates start and no responses sent before user accepts',async()=>{
 const props=callbacks();render(<PrivacyGate {...props}/>)
 await screen.findByRole('heading',{name:'검사 시작 전 안내와 동의'})
 expect(screen.getAllByText('검사 중 임시 저장된 응답은 마지막 저장일로부터 7일간 유지되며, 7일이 지나면 만료됩니다.').length).toBe(2)
 expect(screen.getByText('유케이(UK)한의원 개인정보처리방침')).toBeTruthy()
 expect(screen.queryByText(/최종 게시 전 확인 필요|검토본|미확정/)).toBeNull()
 expect(screen.queryByText('다른 탭의 검사 변경을 반영했습니다.')).toBeNull()
 const start=screen.getByRole('button',{name:'동의하고 검사 시작·이어하기'}) as HTMLButtonElement
 expect(start.disabled).toBe(true);fireEvent.click(screen.getAllByRole('checkbox')[0]);expect(start.disabled).toBe(true)
 expect(props.authorize).not.toHaveBeenCalled();expect(props.confirm).not.toHaveBeenCalled();expect(screen.queryByLabelText('검진 선택')).toBeNull()
 fireEvent.click(screen.getAllByRole('checkbox')[1]);fireEvent.click(start)
 await screen.findByLabelText('검진 선택');expect(props.authorize).toHaveBeenCalledTimes(1);expect(props.confirm).not.toHaveBeenCalled()
})
it('legacy resume never auto-imports; explicit adoption retains answers and delete keeps only font preference',async()=>{
 const raw=JSON.stringify({...fresh('acquired'),answers:Array(10).fill(1),completed:true});localStorage.setItem(key('acquired'),raw);localStorage.setItem('yingyang:text-size','large')
 const props=callbacks();render(<PrivacyGate {...props}/>);await screen.findByText('기존 저장 데이터가 있습니다')
 expect(localStorage.getItem(key('acquired'))).toBe(raw);expect(localStorage.getItem(metadataKey)).toBeNull()
 agree();fireEvent.click(screen.getByRole('button',{name:'이전해 이어하기'}));await screen.findByLabelText('검진 선택')
 expect(localStorage.getItem(key('acquired'))).toBe(raw);expect(JSON.parse(localStorage.getItem(metadataKey)!).exams.acquired.savedAt).toBeGreaterThan(0)
 fireEvent.click(screen.getByRole('button',{name:'검사 데이터 모두 삭제'}));fireEvent.click(screen.getByRole('button',{name:'모두 삭제 확인'}))
 await screen.findByRole('heading',{name:'검사 시작 전 안내와 동의'});expect(localStorage.getItem(privacyKey)).toBeNull();expect(localStorage.getItem(key('acquired'))).toBeNull();expect(localStorage.getItem('yingyang:text-size')).toBe('large')
})
it('another-tab deletion during pending consent cannot restore it',async()=>{
 let release!:(r:ReturnType<typeof receipt>)=>void
 const props=callbacks();props.authorize.mockImplementation(()=>new Promise(resolve=>{release=resolve}))
 render(<PrivacyGate {...props}/>);await screen.findByRole('heading',{name:'검사 시작 전 안내와 동의'});agree();fireEvent.click(screen.getByRole('button',{name:'동의하고 검사 시작·이어하기'}))
 deleteAll();window.dispatchEvent(new StorageEvent('storage',{key:privacyKey}));release(receipt())
 await waitFor(()=>expect(screen.getByText(/동의를 확인하지 못했습니다/)).toBeTruthy());expect(localStorage.getItem(privacyKey)).toBeNull();expect(screen.queryByLabelText('검진 선택')).toBeNull()
})

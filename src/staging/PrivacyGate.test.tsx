import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { fresh, key } from '../engine'
import { PrivacyGate } from './PrivacyGate'
import { deleteAll, metadataKey, privacyKey, retentionMs } from './privacy-storage'
const receipt=()=>({proof:'synthetic-server-receipt',at:Date.now(),expires:Date.now()+retentionMs})
const callbacks=()=>({authorize:vi.fn(async()=>receipt()),verify:vi.fn(async()=>({valid:true})),confirm:vi.fn(async()=>({proof:'synthetic-completion'})),send:vi.fn()})
beforeEach(()=>{localStorage.clear();vi.spyOn(window,'scrollTo').mockImplementation(()=>{})})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
function agree(){for(const box of screen.getAllByRole('checkbox'))fireEvent.click(box)}
it('separate pre-exam consent gates start and no responses sent before user accepts',async()=>{
 const props=callbacks();render(<PrivacyGate {...props}/>)
 await screen.findByRole('heading',{name:'검사 시작 전 안내와 동의'})
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

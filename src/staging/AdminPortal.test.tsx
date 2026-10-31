import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Auth } from 'firebase/auth'
import type { Functions } from 'firebase/functions'
import { AdminPortal } from './AdminPortal'
const mocks=vi.hoisted(()=>({session:{role:'none',local:false,mustChange:false,canBootstrap:false},call:vi.fn(),google:vi.fn(),signed:true}))
vi.mock('firebase/auth',()=>({GoogleAuthProvider:class {},onAuthStateChanged:(_a:unknown,f:(u:unknown)=>void)=>{f(mocks.signed?{uid:'virtual'}:null);return ()=>{}},signInWithPopup:mocks.google,reauthenticateWithPopup:vi.fn(),signInWithCustomToken:vi.fn(),signInWithEmailAndPassword:vi.fn(),signOut:vi.fn()}))
vi.mock('firebase/functions',()=>({httpsCallable:()=>async(data:unknown)=>({data:await mocks.call(data)})}))
vi.mock('./AdminReports',()=>({AdminReports:()=> <p>synthetic report</p>}))
afterEach(()=>{cleanup();vi.clearAllMocks();mocks.session={role:'none',local:false,mustChange:false,canBootstrap:false};mocks.signed=true})
const auth={} as Auth,functions={} as Functions
function show(session:Partial<typeof mocks.session>={}){Object.assign(mocks.session,session);mocks.call.mockImplementation(async(d)=>d.action==='session'?mocks.session:{accounts:[]});return render(<AdminPortal auth={auth} functions={functions}/>)}
it('unapproved Google account has no reports or account tools',async()=>{show();await screen.findByText(/현재 계정은 승인된/);expect(screen.queryByText('synthetic report')).toBeNull();expect(screen.queryByRole('heading',{name:'관리자 승인·권한 회수'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Google로 로그인'}));await vi.waitFor(()=>expect(mocks.google).toHaveBeenCalled())})
it('ordinary approved Google admin sees reports but no account/password tools',async()=>{show({role:'admin'});await screen.findByText('synthetic report');expect(screen.queryByRole('heading',{name:'관리자 승인·권한 회수'})).toBeNull();expect(screen.queryByLabelText('새 비밀번호 (12자 이상)')).toBeNull();expect(localStorage.length).toBe(0)})
it('forced local change blocks report and account tools; mismatched confirmation never calls server',async()=>{show({role:'master',local:true,mustChange:true});await screen.findByRole('alert');expect(screen.queryByText('synthetic report')).toBeNull();expect(screen.queryByRole('heading',{name:'관리자 승인·권한 회수'})).toBeNull();fireEvent.change(screen.getByLabelText('현재 비밀번호'),{target:{value:'virtual-current'}});fireEvent.change(screen.getByLabelText('새 비밀번호 (12자 이상)'),{target:{value:'virtual-new-password'}});fireEvent.change(screen.getByLabelText('새 비밀번호 확인'),{target:{value:'different-password'}});fireEvent.click(screen.getByRole('button',{name:'본인 확인 후 변경'}));await screen.findByRole('status');expect(mocks.call.mock.calls.every(([x])=>x.action==='session')).toBe(true)})
it('Google master has account approval and local-only reset, never a Google password change',async()=>{show({role:'master'});await screen.findByRole('heading',{name:'관리자 승인·권한 회수'});expect(screen.getByText('Google 로그인에는 영향을 주지 않습니다. Google 비밀번호는 변경하지 않습니다.')).toBeTruthy();fireEvent.change(screen.getByLabelText('승인할 Gmail'),{target:{value:'virtual-user@gmail.com'}});fireEvent.click(screen.getByRole('button',{name:'관리자 승인'}));await vi.waitFor(()=>expect(mocks.call).toHaveBeenCalledWith({action:'accounts',operation:'approve',email:'virtual-user@gmail.com'}))})


import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Auth } from 'firebase/auth'
import type { Functions } from 'firebase/functions'
import { AdminPortal } from './AdminPortal'
const mocks = vi.hoisted(() => ({
 session: { role: 'none', local: false, mustChange: false, canBootstrap: false },
 call: vi.fn(), google: vi.fn(), reauth: vi.fn(), signed: true,
 listener: undefined as undefined | ((u: { uid: string; email?: string } | null) => void),
}))
vi.mock('firebase/auth', () => ({
 GoogleAuthProvider: class {},
 onAuthStateChanged: (_a: unknown, f: typeof mocks.listener) => { mocks.listener = f; f?.(mocks.signed ? { uid: 'virtual', email: 'virtual@gmail.com' } : null); return () => { mocks.listener = undefined } },
 signInWithPopup: mocks.google, reauthenticateWithPopup: mocks.reauth,
 signInWithCustomToken: vi.fn(), signInWithEmailAndPassword: vi.fn(), signOut: vi.fn(),
}))
vi.mock('firebase/functions', () => ({ httpsCallable: () => async (data: unknown) => ({ data: await mocks.call(data) }) }))
vi.mock('./AdminReports', () => ({ AdminReports: () => <p>synthetic report</p> }))
beforeEach(() => {
 mocks.session = { role: 'none', local: false, mustChange: false, canBootstrap: false }; mocks.signed = true
 mocks.call.mockImplementation(async d => d.action === 'session' ? mocks.session : { accounts: [] })
})
afterEach(() => { cleanup(); vi.resetAllMocks() })
const auth = { currentUser: { uid: 'virtual' } } as Auth, functions = {} as Functions
function show(session: Partial<typeof mocks.session> = {}) { Object.assign(mocks.session, session); return render(<AdminPortal auth={auth} functions={functions} />) }
it('signed out page has login only, no report or tabs', async () => {
 mocks.signed = false; show()
 expect(await screen.findByRole('button', { name: 'Google로 로그인' })).toBeTruthy()
 expect(screen.queryByText('synthetic report')).toBeNull(); expect(screen.queryByRole('tab')).toBeNull()
 expect(screen.queryByText('최초 설정 담당자 인증')).toBeNull()
 expect(screen.queryByLabelText('설정 담당자 이메일')).toBeNull()
 expect(screen.queryByLabelText('설정 담당자 비밀번호')).toBeNull()
 expect(document.querySelector('input[type=password]')).toBeNull()
 expect(screen.queryByText('별도 마스터 ID 로그인')).toBeNull()
})
it('unapproved signed-in account shows approval state without duplicate login', async () => {
 show(); await screen.findByRole('heading', { name: '관리자 승인 대기' })
 expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
 expect(screen.queryByText('synthetic report')).toBeNull()
})
it('auth check never flashes a login form', async () => {
 let resolve!: (value: unknown) => void
 mocks.call.mockImplementation(() => new Promise(r => { resolve = r }))
 show(); expect(screen.getByRole('status').textContent).toContain('로그인 상태')
 expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
 resolve({ role: 'admin', local: false, mustChange: false, canBootstrap: false }); await screen.findByText('synthetic report')
})
it('signed-in ordinary admin has only history tab, no login/password/account tools', async () => {
 show({ role: 'admin' }); await screen.findByText('synthetic report')
 expect(screen.getAllByRole('tab').map(x => x.textContent)).toEqual(['발송 이력'])
 expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
 expect(screen.queryByText('별도 마스터 ID 로그인')).toBeNull()
 expect(screen.queryByLabelText('현재 비밀번호')).toBeNull(); expect(localStorage.length).toBe(0)
})
it('master tabs switch with arrows/Home/End and load accounts automatically', async () => {
 show({ role: 'master' }); await screen.findByText('synthetic report')
 expect(screen.getAllByRole('tab').map(x=>x.textContent)).toEqual(['발송 이력','관리자 계정'])
 expect(document.querySelector('input[type=password]')).toBeNull()
 const history = screen.getByRole('tab', { name: '발송 이력' })
 expect(history.getAttribute('aria-selected')).toBe('true')
 fireEvent.keyDown(history, { key: 'ArrowRight' })
 await screen.findByRole('heading', { name: '관리자 계정' })
 expect(document.activeElement).toBe(screen.getByRole('tab', { name: '관리자 계정' }))
 await vi.waitFor(() => expect(mocks.call).toHaveBeenCalledWith({ action: 'accounts', operation: 'list' }))
 fireEvent.keyDown(document.activeElement!, { key: 'End' })
 expect(screen.getByRole('tab', { name: '관리자 계정' }).getAttribute('aria-selected')).toBe('true')
 fireEvent.keyDown(document.activeElement!, { key: 'Home' })
 expect(history.getAttribute('aria-selected')).toBe('true')
 expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
})
it('master adds Gmail from accounts tab without permanent reauth prompts', async () => {
 show({ role: 'master' }); await screen.findByText('synthetic report')
 fireEvent.click(screen.getByRole('tab', { name: '관리자 계정' }))
 await vi.waitFor(() => expect(mocks.call).toHaveBeenCalledWith({ action: 'accounts', operation: 'list' }))
 expect(screen.queryByRole('button', { name: 'Google로 본인 확인' })).toBeNull()
 fireEvent.change(screen.getByLabelText('승인할 Gmail'), { target: { value: 'virtual-user@gmail.com' } })
 await vi.waitFor(() => expect((screen.getByRole('button', { name: '관리자 추가' }) as HTMLButtonElement).disabled).toBe(false))
 fireEvent.click(screen.getByRole('button', { name: '관리자 추가' }))
 await vi.waitFor(() => expect(mocks.call).toHaveBeenCalledWith({ action: 'accounts', operation: 'approve', email: 'virtual-user@gmail.com' }))
})
it('expired sensitive action offers contextual reauth, then retries the pending action', async () => {
 let expired = true
 mocks.call.mockImplementation(async d => {
  if (d.action === 'session') return mocks.session
  if (expired) throw { code: 'functions/failed-precondition' }
  return { accounts: [] }
 })
 mocks.reauth.mockImplementation(async () => { expired = false })
 show({ role: 'master' }); await screen.findByText('synthetic report')
 expect(screen.queryByRole('form', { name: '계정 관리 본인 확인' })).toBeNull()
 fireEvent.click(screen.getByRole('tab', { name: '관리자 계정' }))
 fireEvent.click(await screen.findByRole('button', { name: 'Google로 본인 확인' }))
 await screen.findByText('추가된 관리자가 없습니다.')
 expect(mocks.reauth).toHaveBeenCalledTimes(1)
 expect(screen.queryByRole('form', { name: '계정 관리 본인 확인' })).toBeNull()
})
it('unknown Google account and popup cancellation show short safe messages', async () => {
 mocks.signed = false; mocks.google.mockRejectedValueOnce({ code: 'auth/admin-restricted-operation', message: 'private-detail' }).mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' })
 show(); const login = await screen.findByRole('button', { name: 'Google로 로그인' })
 fireEvent.click(login); await screen.findByText('등록된 Google 계정이 아닙니다. 마스터에게 승인을 요청하세요.')
 expect(screen.queryByText(/private-detail/)).toBeNull()
 fireEvent.click(login); await screen.findByText('로그인 창이 닫혔습니다. 다시 시도할 수 있습니다.')
})

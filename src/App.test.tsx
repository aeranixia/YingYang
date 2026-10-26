import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import App from './App'
import { fresh, key } from './engine'
import { textSizeKey } from './preferences'
beforeEach(() => { localStorage.clear(); vi.spyOn(window,'scrollTo').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function seedCompleted(kind: 'acquired' | 'innate') {
 localStorage.setItem(key(kind), JSON.stringify({ ...fresh(kind), answers: Array(kind === 'acquired' ? 10 : 40).fill(kind === 'acquired' ? 3 : 2), completed: true }))
}
it('글자 크기 기본 중, 소·중·대 전환과 새로고침 복구', () => {
 const app = render(<App/>)
 expect(screen.getByRole('button', { name: '글자 크기 중' }).getAttribute('aria-pressed')).toBe('true')
 for (const [label, value] of [['소','small'],['중','medium'],['대','large']]) {
  fireEvent.click(screen.getByRole('button', { name: `글자 크기 ${label}` }))
  expect(app.container.firstElementChild?.getAttribute('data-text-size')).toBe(value)
  expect(localStorage.getItem(textSizeKey)).toBe(value)
 }
 app.unmount(); render(<App/>)
 expect(screen.getByRole('button', { name: '글자 크기 대' }).getAttribute('aria-pressed')).toBe('true')
})
it('진행·결과 화면에서 글자 크기를 바꿔도 기존 검진 데이터 유지', () => {
 seedCompleted('innate')
 render(<App/>); fireEvent.click(screen.getByText('시작하기'))
 fireEvent.click(screen.getAllByRole('radio')[1]); fireEvent.click(screen.getByRole('button', { name: '다음 →' }))
 const acquired = localStorage.getItem(key('acquired')), innate = localStorage.getItem(key('innate'))
 fireEvent.click(screen.getByRole('button', { name: '글자 크기 대' }))
 expect(screen.getByText('문항 2 / 10')).toBeTruthy()
 expect(localStorage.getItem(key('acquired'))).toBe(acquired)
 expect(localStorage.getItem(key('innate'))).toBe(innate)
 fireEvent.click(screen.getByRole('button', {name:'← 홈으로'})); fireEvent.click(screen.getByText('결과 보기'))
 fireEvent.click(screen.getByRole('button', { name: '글자 크기 소' }))
 expect(screen.getByRole('table').textContent).toContain('80점')
 expect(localStorage.getItem(key('acquired'))).toBe(acquired)
 expect(localStorage.getItem(key('innate'))).toBe(innate)
})
it('글자 설정 저장 실패도 현재 크기 적용 및 기존 응답 보존', () => {
 const original = JSON.stringify({ ...fresh('innate'), answers: [0, ...Array(39).fill(null)] })
 localStorage.setItem(key('innate'), original)
 const app = render(<App/>)
 vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
 fireEvent.click(screen.getByRole('button', { name: '글자 크기 대' }))
 expect(app.container.firstElementChild?.getAttribute('data-text-size')).toBe('large')
 expect(screen.getByRole('alert').textContent).toContain('글자 크기 설정')
 expect(localStorage.getItem(key('innate'))).toBe(original)
})
it.each(['acquired','innate'] as const)('완료된 %s 결과만 기본 접힘으로 제공하고 토글 시 진행·응답 유지', completed => {
 seedCompleted(completed)
 const app = render(<App/>); fireEvent.click(screen.getByText('시작하기'))
 fireEvent.click(screen.getAllByRole('radio')[0]); fireEvent.click(screen.getByRole('button', {name:'다음 →'}))
 const before = [localStorage.getItem(key('acquired')), localStorage.getItem(key('innate'))]
 const details = app.container.querySelector('details')!
 expect(details.open).toBe(false)
 expect(details.querySelector('summary')?.textContent).toBe(`${completed === 'acquired' ? '후천적' : '타고난'} 체질 결과 보기`)
 fireEvent.click(details.querySelector('summary')!)
 expect(details.open).toBe(true)
 expect(details.querySelector('tfoot td')?.textContent).toBe(completed === 'acquired' ? '10회' : '80점')
 fireEvent.click(details.querySelector('summary')!)
 expect(details.open).toBe(false)
 expect(screen.getByText(`문항 2 / ${completed === 'acquired' ? 40 : 10}`)).toBeTruthy()
 expect([localStorage.getItem(key('acquired')), localStorage.getItem(key('innate'))]).toEqual(before)
})
it('두 검진 미완료 시 중간 결과 영역 없음', () => {
 const app = render(<App/>); fireEvent.click(screen.getAllByText('시작하기')[0])
 fireEvent.click(screen.getAllByRole('radio')[0])
 expect(app.container.querySelector('details')).toBeNull()
 expect(screen.queryByRole('table')).toBeNull()
})
it('완료 검진 재검진 후 다른 검진에서 해당 결과를 숨김', () => {
 seedCompleted('innate')
 const app = render(<App/>); fireEvent.click(screen.getByText('시작하기'))
 expect(app.container.querySelector('details')).toBeTruthy()
 fireEvent.click(screen.getAllByRole('radio')[0]); const acquired = localStorage.getItem(key('acquired'))
 fireEvent.click(screen.getByRole('button', {name:'← 홈으로'})); fireEvent.click(screen.getByText('결과 보기'))
 fireEvent.click(screen.getByText('다시 검진하기')); fireEvent.click(screen.getByText('확인'))
 fireEvent.click(screen.getByRole('button', {name:'← 홈으로'})); fireEvent.click(screen.getByText('이어하기'))
 expect(app.container.querySelector('details')).toBeNull()
 expect(localStorage.getItem(key('acquired'))).toBe(acquired)
})
it('미응답 진행 차단, 뒤로 이동과 선택 복구, 새로고침 이어하기', () => {
 const rendered = render(<App/>); fireEvent.click(screen.getAllByText('시작하기')[0])
 expect((screen.getByRole('button',{name:'다음 →'}) as HTMLButtonElement).disabled).toBe(true)
 fireEvent.click(screen.getAllByRole('radio')[2]); fireEvent.click(screen.getByRole('button',{name:'다음 →'}))
 fireEvent.click(screen.getByRole('button',{name:'← 이전'})); expect((screen.getAllByRole('radio')[2] as HTMLInputElement).checked).toBe(true)
 fireEvent.click(screen.getAllByRole('radio')[0]); fireEvent.click(screen.getByRole('button',{name:'다음 →'}))
 rendered.unmount(); render(<App/>); fireEvent.click(screen.getByText('이어하기')); expect(screen.getByText('문항 2 / 10')).toBeTruthy()
 expect(screen.queryByText('다시 검진하기')).toBeNull()
})
it('40개 0점 답변을 UI에서 완료', () => {
 render(<App/>); fireEvent.click(screen.getAllByText('시작하기')[1])
 for(let i=0;i<40;i++){fireEvent.click(screen.getByRole('radio',{name:/0점/}));fireEvent.click(screen.getByRole('button',{name:i===39?'결과 확인':'다음 →'}))}
 expect(screen.getByRole('table')).toBeTruthy(); expect(screen.getAllByText('0점')).toHaveLength(5)
 expect(JSON.parse(localStorage.getItem(key('innate'))!).completed).toBe(true)
})
it('종합 결과, 읽기 전용 응답, 재검진 취소와 독립 초기화', () => {
 for(const kind of ['acquired','innate'] as const) localStorage.setItem(key(kind),JSON.stringify({...fresh(kind),answers:Array(kind==='acquired'?10:40).fill(kind==='acquired'?1:2),completed:true}))
 render(<App/>); fireEvent.click(screen.getByText('종합 결과 확인 →')); expect(screen.getAllByRole('table')).toHaveLength(2)
 fireEvent.click(screen.getAllByText('개별 결과 및 응답 보기')[0]); fireEvent.click(screen.getByText('이전 답변 확인')); expect(screen.queryAllByRole('radio')).toHaveLength(0)
 fireEvent.click(screen.getByText('다시 검진하기')); fireEvent.click(screen.getByText('취소')); expect(screen.getByRole('table')).toBeTruthy()
 fireEvent.click(screen.getByText('다시 검진하기')); fireEvent.click(screen.getByText('확인')); expect(screen.getByText('문항 1 / 10')).toBeTruthy()
 expect(JSON.parse(localStorage.getItem(key('innate'))!).completed).toBe(true)
 expect(JSON.parse(localStorage.getItem(key('acquired'))!).answers).toEqual(Array(10).fill(null))
})
it('저장 오류 표시', () => {
 render(<App/>); fireEvent.click(screen.getAllByText('시작하기')[0]); vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => {throw new Error('quota')})
 fireEvent.click(screen.getAllByRole('radio')[0]); expect(screen.getByRole('alert').textContent).toContain('자동 저장')
})
it('후천적 10문항 완료 후 합계 10회', () => {
 render(<App/>); fireEvent.click(screen.getAllByText('시작하기')[0])
 for(let i=0;i<10;i++){fireEvent.click(screen.getAllByRole('radio')[1]);fireEvent.click(screen.getByRole('button',{name:i===9?'결과 확인':'다음 →'}))}
 expect(screen.getAllByText('10회')).toHaveLength(2)
 const resetButton = screen.getByRole('button',{name:'다시 검진하기'})
 resetButton.focus(); fireEvent.click(resetButton); expect(screen.getByRole('button',{name:'취소'})).toBe(document.activeElement)
 fireEvent.keyDown(document,{key:'Escape'}); expect(screen.queryByRole('alertdialog')).toBeNull()
 expect(document.activeElement).toBe(resetButton)
})

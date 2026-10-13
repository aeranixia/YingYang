import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import App from './App'
import { fresh, key } from './engine'
beforeEach(() => { localStorage.clear(); vi.spyOn(window,'scrollTo').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
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
 fireEvent.click(screen.getByText('다시 검진하기')); expect(screen.getByRole('button',{name:'취소'})).toBe(document.activeElement)
 fireEvent.keyDown(document,{key:'Escape'}); expect(screen.queryByRole('alertdialog')).toBeNull()
})

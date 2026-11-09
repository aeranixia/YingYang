import { afterEach, beforeEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import { fresh, key } from './engine'
import { SasangResults } from './SasangResults'
beforeEach(()=>{localStorage.clear();window.scrollTo=()=>{}})
afterEach(cleanup)
it('new book has forty O/X questions in each exam, no visible constitution, and resumes independent data',()=>{
 const old={...fresh('acquired'),answers:Array(10).fill(4),completed:true};localStorage.setItem(key('acquired'),JSON.stringify(old))
 const {unmount}=render(<App book="sasang-80"/>)
 fireEvent.click(screen.getAllByRole('button',{name:/시작하기/})[0])
 expect((screen.getByRole('button',{name:'다음 →'}) as HTMLButtonElement).disabled).toBe(true)
 expect(screen.queryByText('태양')).toBeNull()
 fireEvent.click(screen.getByRole('radio',{name:/O · 그렇습니다/}));fireEvent.click(screen.getByRole('button',{name:'다음 →'}))
 fireEvent.click(screen.getByRole('button',{name:'← 이전'}));fireEvent.click(screen.getByRole('radio',{name:/X · 그렇지 않습니다/}))
 unmount();render(<App book="sasang-80"/>);fireEvent.click(screen.getByRole('button',{name:/이어하기/}))
 expect((screen.getByRole('radio',{name:/X · 그렇지 않습니다/}) as HTMLInputElement).checked).toBe(true)
 expect(JSON.parse(localStorage.getItem(key('innate','sasang-80'))!).answers[0]).toBe(0)
 expect(localStorage.getItem(key('acquired'))).toBe(JSON.stringify(old))
})
it('renders two score tables and three independent, accessible diamond charts with all ties',()=>{
 render(<SasangResults innate={Array(40).fill(0)} acquired={Array(40).fill(1)}/>)
 expect(screen.getAllByRole('table')).toHaveLength(2);expect(screen.getAllByRole('img')).toHaveLength(3)
 expect(within(screen.getAllByRole('table')[0]).getAllByRole('columnheader').map(n=>n.textContent)).toEqual(['태양','태음','소양','소음'])
 expect(screen.getAllByText(/공동 최고점/)).toHaveLength(2)
 expect(screen.getByRole('img',{name:/선천적·후천적 비교/}).querySelectorAll('polygon[fill-opacity]')).toHaveLength(2)
})

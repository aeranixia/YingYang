import { describe, expect, it } from 'vitest'
import { aggregate, answer, fresh, isComplete, key, next, restore, save } from './engine'
import { classification, questions } from './questions'
describe('문항과 집계', () => {
 it('10문항과 40문항, 분류 중복 및 누락 없음', () => {
  expect(questions.acquired).toHaveLength(10); expect(questions.innate).toHaveLength(40)
  const ids = Object.values(classification).flat()
  expect(new Set(ids).size).toBe(40)
  expect([...ids].sort((a,b) => a-b)).toEqual(Array.from({length:40}, (_,i) => i+1))
  expect(Object.values(classification).map(a => a.length)).toEqual([11,10,10,9])
 })
 it.each([1,2,3,4])('동일 번호 %i를 10번 선택', value => {
  const state = {...fresh('acquired'), answers: Array(10).fill(value)}
  expect(aggregate(state).map(r => r[1])).toEqual([1,2,3,4].map(n => n === value ? 10 : 0))
 })
 it('응답 변경 즉시 빈도 재집계', () => {
  const state = {...fresh('acquired'), answers: [1,1,1,2,2,3,3,3,3,4]}
  expect(aggregate(state).map(r => r[1])).toEqual([3,2,4,1])
  expect(aggregate(answer(state, 4)).map(r => r[1])).toEqual([2,2,4,2])
 })
 it.each([0,2])('타고난 모든 응답 %i점', value => {
  const state = {...fresh('innate'), answers: Array(40).fill(value)}
  expect(isComplete(state)).toBe(true)
  expect(aggregate(state).map(r => r[1])).toEqual([11,10,10,9].map(n => n*value))
  expect(aggregate(state).reduce((s,r) => s+r[1],0)).toBe(value*40)
 })
 it('타고난 이전 응답 변경 반영', () => {
  const state = {...fresh('innate'), answers: Array(40).fill(2)}
  expect(aggregate(answer(state,0))[0][1]).toBe(20)
 })
 it('미응답 진행 차단, 0점 진행 허용, 완료 후 수정 차단', () => {
  expect(next(fresh('innate')).current).toBe(0)
  expect(next(answer(fresh('innate'),0)).current).toBe(1)
  const state = next({...fresh('innate'), current:39, answers:Array(40).fill(0)})
  expect(state.completed).toBe(true); expect(answer(state,2)).toEqual(state)
  expect(() => aggregate(fresh('innate'))).toThrow()
 })
})
describe('저장과 복구', () => {
 it('응답, 위치, 완료 복구', () => {
  const state = {...fresh('acquired'), current:9, answers:Array(10).fill(3), completed:true}
  expect(restore('acquired',JSON.stringify(state))).toEqual(state)
 })
 it('0점과 null 구분', () => {
  const state = {...fresh('innate'), current:1, answers:[0,...Array(39).fill(null)]}
  expect(restore('innate', JSON.stringify(state))).toEqual(state)
 })
 it('손상된 JSON, 버전, 종류, 누락된 데이터 방어', () => {
  for (const raw of ['oops','null','{}',JSON.stringify({...fresh('innate'), version:0}),JSON.stringify(fresh('acquired'))]) expect(restore('innate',raw)).toEqual(fresh('innate'))
 })
 it('잘못된 응답과 위치, 허위 완료 상태 정리', () => {
  const recovered = restore('innate',JSON.stringify({...fresh('innate'), answers:[0,3,'2',false],current:100,completed:true}))
  expect(recovered.answers.slice(0,4)).toEqual([0,null,null,null]); expect(recovered.current).toBe(1); expect(recovered.completed).toBe(false)
 })
 it('검진별 저장과 재검진 독립성', () => {
  const storage = new Map<string,string>(), adapter = {setItem:(k:string,v:string) => {storage.set(k,v)}}
  const innate = {...fresh('innate'), answers:Array(40).fill(0), completed:true}
  save(adapter, innate); save(adapter, {...fresh('acquired'), answers:Array(10).fill(1),completed:true}); save(adapter, fresh('acquired'))
  expect(restore('innate',storage.get(key('innate'))!)).toEqual(innate)
  expect(restore('acquired',storage.get(key('acquired'))!)).toEqual(fresh('acquired'))
 })
})

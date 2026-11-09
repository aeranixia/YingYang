import { describe, it, expect } from 'vitest'
import { answer, next, fresh, aggregate, restore, key } from './engine'
import { bookQuestions, constitutions, highestScores, sasangScores } from './questionnaires'
import source from './sasang-source.json'
import { radarPoint } from './SasangResults'

describe('versioned questionnaires', () => {
 it('preserves all 80 source strings including spacing and assigns eight groups of ten', () => {
  expect(source).toHaveLength(8)
  for (const kind of ['innate', 'acquired'] as const) {
   const questions = bookQuestions('sasang-80')[kind]
   expect(questions).toHaveLength(40)
   expect(questions.map(q => q.content[0].text)).toEqual(source.filter(g => g.kind === kind).flatMap(g => g.questions))
   for (const group of constitutions) expect(questions.filter(q => q.constitution === group)).toHaveLength(10)
   expect(questions.every(q => q.options.map(o => o.value).join(',') === '1,0')).toBe(true)
  }
  expect(bookQuestions('sasang-80').innate[13].content[0].text).toContain('흘려야  몸이')
  expect(bookQuestions('sasang-80').acquired[8].content[0].text.endsWith('   ')).toBe(true)
 })
 it('uses exact O=1/X=0 scores with ties, all zero and all ten', () => {
  const answers = [10, 7, 4, 1].flatMap(n => [...Array(n).fill(1), ...Array(10-n).fill(0)])
  expect(sasangScores(answers, 'innate')).toEqual([['태양',10],['태음',7],['소양',4],['소음',1]])
  expect(highestScores(sasangScores(Array(40).fill(0),'acquired'))).toEqual([...constitutions])
  expect(sasangScores(Array(40).fill(1),'acquired').map(([,n])=>n)).toEqual([10,10,10,10])
  for (const data of [Array(39).fill(1),Array(40).fill(2),Array(40).fill(null)]) expect(()=>sasangScores(data,'innate')).toThrow()
 })
 it('blocks missing answers, saves edited values and never interprets legacy answers as new', () => {
  let s=fresh('innate','sasang-80')
  expect(next(s)).toEqual(s)
  s=next(answer(s,1));s=answer({...s,current:0},0)
  expect(s.answers[0]).toBe(0)
  expect(key('innate','sasang-80')).not.toBe(key('innate'))
  const old={...fresh('innate'),answers:Array(40).fill(2),completed:true}
  expect(restore('innate',JSON.stringify(old),'sasang-80')).toEqual(fresh('innate','sasang-80'))
  expect(aggregate(old).reduce((n,[,score])=>n+score,0)).toBe(80)
  expect(restore('innate',JSON.stringify(s),'sasang-80')).toEqual(s)
 })
 it('maps identical 0..10 axes to top/right/bottom/left without summing series', () => {
  expect([0,1,2,3].map(i=>radarPoint(i,10))).toEqual([[120,40],[200,120],[120,200],[40,120]])
  expect([0,1,2,3].map(i=>radarPoint(i,0))).toEqual(Array(4).fill([120,120]))
 })
})

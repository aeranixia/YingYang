import { questions, type Kind, type Group } from './questions'
export const VERSION = 1
export type Session = { kind: Kind; version: number; current: number; answers: (number | null)[]; completed: boolean }
export const key = (kind: Kind) => `yingyang:${kind}`
export const fresh = (kind: Kind): Session => ({ kind, version: VERSION, current: 0, answers: questions[kind].map(() => null), completed: false })
export const isComplete = (state: Session) => state.answers.length === questions[state.kind].length && state.answers.every((a, i) => questions[state.kind][i].options.some(o => o.value === a))
export function restore(kind: Kind, raw: string | null): Session {
 const fallback = fresh(kind)
 try {
  const data = JSON.parse(raw ?? 'null')
  if (!data || data.version !== VERSION || data.kind !== kind || !Array.isArray(data.answers)) return fallback
  const answers = fallback.answers.map((_, i) => questions[kind][i].options.some(o => o.value === data.answers[i]) ? data.answers[i] as number : null)
  const current = Number.isInteger(data.current) && data.current >= 0 && data.current < answers.length ? data.current : answers.findIndex(a => a === null)
  const state = { ...fallback, answers, current: Math.max(0, current) }
  return { ...state, completed: data.completed === true && isComplete(state) }
 } catch { return fallback }
}
export function answer(state: Session, value: number): Session {
 if (state.completed || !questions[state.kind][state.current].options.some(o => o.value === value)) return state
 return { ...state, answers: state.answers.map((a, i) => i === state.current ? value : a) }
}
export function next(state: Session): Session {
 if (state.completed || state.answers[state.current] === null) return state
 if (state.current < state.answers.length - 1) return { ...state, current: state.current + 1 }
 return isComplete(state) ? { ...state, completed: true } : { ...state, current: state.answers.findIndex(a => a === null) }
}
export function aggregate(state: Session): [string, number][] {
 if (!isComplete(state)) throw new Error('모든 문항에 응답해야 결과를 확인할 수 있습니다.')
 if (state.kind === 'acquired') return ['①', '②', '③', '④'].map((label, i) => [label, state.answers.filter(a => a === i + 1).length])
 return (['가', '나', '다', '라'] as Group[]).map(g => [g, state.answers.reduce<number>((sum, a, i) => sum + (questions.innate[i].group === g ? a! : 0), 0)])
}
export const save = (storage: Pick<Storage, 'setItem'>, state: Session) => storage.setItem(key(state.kind), JSON.stringify(state))

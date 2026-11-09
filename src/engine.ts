import { questions, type Kind, type Group } from './questions'
import { bookForVersion, bookQuestions, bookVersion, sasangScores, type Book } from './questionnaires'
export const VERSION = 1
export type Session = { kind: Kind; version: number; questionnaire?: Book; current: number; answers: (number | null)[]; completed: boolean }
export const key = (kind: Kind, book: Book = 'legacy-50') => book === 'legacy-50' ? `yingyang:${kind}` : `yingyang:${book}:${kind}`
export const fresh = (kind: Kind, book: Book = 'legacy-50'): Session => ({ kind, version: bookVersion(book), ...(book === 'sasang-80' ? { questionnaire: book } : {}), current: 0, answers: bookQuestions(book)[kind].map(() => null), completed: false })
export const sessionQuestions = (state: Session) => bookQuestions(bookForVersion(state.version))[state.kind]
export function isComplete(state: Session) { try { const items = sessionQuestions(state); return state.answers.length === items.length && Array.from(state.answers).every((a, i) => items[i].options.some(o => o.value === a)) } catch { return false } }
export function restore(kind: Kind, raw: string | null, book: Book = 'legacy-50'): Session {
 const fallback = fresh(kind, book), items = bookQuestions(book)[kind]
 try {
  const data = JSON.parse(raw ?? 'null')
  if (!data || data.version !== bookVersion(book) || data.questionnaire !== undefined && data.questionnaire !== book || data.kind !== kind || !Array.isArray(data.answers)) return fallback
  const answers = fallback.answers.map((_, i) => items[i].options.some(o => o.value === data.answers[i]) ? data.answers[i] as number : null)
  const current = Number.isInteger(data.current) && data.current >= 0 && data.current < answers.length ? data.current : answers.findIndex(a => a === null)
  const state = { ...fallback, answers, current: Math.max(0, current) }
  return { ...state, completed: data.completed === true && isComplete(state) }
 } catch { return fallback }
}
export function answer(state: Session, value: number): Session {
 if (state.completed || !sessionQuestions(state)[state.current].options.some(o => o.value === value)) return state
 return { ...state, answers: state.answers.map((a, i) => i === state.current ? value : a) }
}
export function next(state: Session): Session {
 if (state.completed || state.answers[state.current] === null) return state
 if (state.current < state.answers.length - 1) return { ...state, current: state.current + 1 }
 return isComplete(state) ? { ...state, completed: true } : { ...state, current: state.answers.findIndex(a => a === null) }
}
export function aggregate(state: Session): [string, number][] {
 if (!isComplete(state)) throw new Error('모든 문항에 응답해야 결과를 확인할 수 있습니다.')
 if (state.version === 2) return sasangScores(state.answers, state.kind)
 if (state.kind === 'acquired') return ['①', '②', '③', '④'].map((label, i) => [label, state.answers.filter(a => a === i + 1).length])
 return (['가', '나', '다', '라'] as Group[]).map(g => [g, state.answers.reduce<number>((sum, a, i) => sum + (questions.innate[i].group === g ? a! : 0), 0)])
}
export const save = (storage: Pick<Storage, 'setItem'>, state: Session) => storage.setItem(key(state.kind, bookForVersion(state.version)), JSON.stringify(state))

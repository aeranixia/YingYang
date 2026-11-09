import source from './sasang-source.json'
import { questions as legacyQuestions, titles as legacyTitles, type Kind, type Question } from './questions'

export type Book = 'legacy-50' | 'sasang-80'
export const currentBook: Book = 'sasang-80'
export const constitutions = ['태양', '태음', '소양', '소음'] as const
export type Constitution = typeof constitutions[number]
export type BookQuestion = Question & { constitution?: Constitution }
const ox = [{ value: 1, content: [{ text: 'O · 그렇습니다' }] }, { value: 0, content: [{ text: 'X · 그렇지 않습니다' }] }]
export const sasangQuestions = Object.fromEntries((['acquired', 'innate'] as Kind[]).map(kind => [kind, source.filter(g => g.kind === kind).flatMap(g => g.questions.map(text => ({ content: [{ text }], options: ox, constitution: g.group as Constitution }))).map((q, i) => ({ ...q, id: i + 1 }))])) as Record<Kind, BookQuestion[]>
export const bookForVersion = (version: number): Book => { if (version === 1) return 'legacy-50'; if (version === 2) return 'sasang-80'; throw Error('Unknown questionnaire version') }
export const bookVersion = (book: Book) => book === 'sasang-80' ? 2 : 1
export const bookQuestions = (book: Book): Record<Kind, BookQuestion[]> => book === 'sasang-80' ? sasangQuestions : legacyQuestions
export const bookTitles = (book: Book): Record<Kind, string> => book === 'sasang-80' ? { innate: '선천적 사상체질', acquired: '후천적 사상페르소나' } : legacyTitles
export function sasangScores(answers: (number | null)[], kind: Kind): [Constitution, number][] {
 if (answers.length !== 40 || Array.from(answers).some(a => a !== 0 && a !== 1)) throw Error('Complete O/X answers required')
 return constitutions.map(group => [group, sasangQuestions[kind].reduce((sum, q, i) => sum + (q.constitution === group ? answers[i]! : 0), 0)])
}
export function highestScores(rows: [string, number][]) { const max = Math.max(...rows.map(([, n]) => n)); return rows.filter(([, n]) => n === max).map(([label]) => label) }

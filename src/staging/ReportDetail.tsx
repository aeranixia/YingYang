import { bookQuestions, bookTitles, constitutions } from '../questionnaires'
import { SasangResults } from '../SasangResults'
import type { AdminDetail } from './admin-contracts'

export function ReportDetail({ detail }: { detail: AdminDetail }) {
 const items = bookQuestions(detail.questionnaire), titles = bookTitles(detail.questionnaire)
 return <section className="answer-details"><h2>{detail.questionnaire === 'sasang-80' ? '80문항' : '문항 1.0'} 상세</h2>
  {detail.questionnaire === 'sasang-80' ? <SasangResults acquired={detail.acquired} innate={detail.innate}/> : (['acquired', 'innate'] as const).map(k => <table key={k}><caption>{titles[k]}</caption><tbody>{detail.scores[k].map(([g, n]) => <tr key={g}><th>{g}</th><td>{n}</td></tr>)}</tbody></table>)}
  {(['innate', 'acquired'] as const).map(kind => <section key={kind}><h3>{titles[kind]} · 문항 응답</h3>{(detail.questionnaire === 'sasang-80' ? constitutions : [undefined]).map(group => <details key={group || 'legacy'}><summary>{group ? group + ' · 10문항' : '기존 문항 응답'}</summary><ol>{items[kind].map((q, i) => (!group || q.constitution === group) && <li key={q.id} value={q.id}>{q.content.map(s => s.text).join('')}<br/><strong>{detail.questionnaire === 'sasang-80' ? detail[kind][i] === 1 ? 'O' : 'X' : q.options.find(o => o.value === detail[kind][i])?.content.map(s => s.text).join('')}</strong></li>)}</ol></details>)}</section>)}
 </section>
}

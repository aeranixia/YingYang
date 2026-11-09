import { constitutions, highestScores, sasangScores } from './questionnaires'
import type { Kind } from './questions'
import './sasang.css'

export const radarPoint = (axis: number, value: number, radius = 80, center = 120) => {
 const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]]
 return [center + directions[axis][0] * radius * value / 10, center + directions[axis][1] * radius * value / 10]
}
export function Diamond({ title, series }: { title: string; series: { label: string; scores: number[]; color: string }[] }) {
 const points = (scores: number[]) => scores.map((score, i) => radarPoint(i, score).join(',')).join(' ')
 return <figure className="diamond"><figcaption>{title}</figcaption><svg viewBox="0 0 240 240" role="img" aria-label={title + ' · ' + series.map(s => s.label + ': ' + s.scores.map((n, i) => constitutions[i] + ' ' + n + '점').join(', ')).join(' / ')}>
  {[2, 4, 6, 8, 10].map(n => <g key={n}><polygon points={points([n, n, n, n])} fill="none" stroke="#b7c8c2"/><text x="124" y={120 - 8 * n} fontSize="9" fill="#465951">{n}</text></g>)}
  {constitutions.map((_, i) => <line key={i} x1="120" y1="120" x2={radarPoint(i, 10)[0]} y2={radarPoint(i, 10)[1]} stroke="#b7c8c2"/>)}
  <text x="120" y="20" textAnchor="middle">태양</text><text x="215" y="125" textAnchor="middle">태음</text><text x="120" y="228" textAnchor="middle">소양</text><text x="24" y="125" textAnchor="middle">소음</text><text x="111" y="132" fontSize="9">0</text>
  {series.map(s => <g key={s.label}><polygon points={points(s.scores)} fill={s.color} fillOpacity=".2" stroke={s.color} strokeWidth="2.5"/>{s.scores.map((n, i) => <circle key={i} cx={radarPoint(i, n)[0]} cy={radarPoint(i, n)[1]} r="3" fill={s.color}/>)}</g>)}
 </svg><div className="radar-legend">{series.map(s => <span key={s.label}><i style={{ background: s.color }}/>{s.label}</span>)}</div><p>각 축 0~10점 · 두 검사 점수는 합산하지 않습니다.</p></figure>
}
export function SasangResults({ acquired, innate }: { acquired: number[]; innate: number[] }) {
 const scores = { acquired: sasangScores(acquired, 'acquired'), innate: sasangScores(innate, 'innate') }
 const titles = { innate: '선천적 사상체질', acquired: '후천적 사상페르소나' }
 const series = [{ label: titles.innate, scores: scores.innate.map(([, n]) => n), color: '#087f86' }, { label: titles.acquired, scores: scores.acquired.map(([, n]) => n), color: '#c25d10' }]
 return <section className="sasang-results" aria-label="문제집별 검사 점수">
  {(['innate', 'acquired'] as Kind[]).map(kind => <div key={kind}><table><caption>{titles[kind]}</caption><thead><tr>{constitutions.map(g => <th key={g} scope="col">{g}</th>)}</tr></thead><tbody><tr>{scores[kind].map(([g, n]) => <td key={g}>{n} / 10</td>)}</tr></tbody></table><p>{highestScores(scores[kind]).length > 1 ? '공동 최고점' : '최고점'}: {highestScores(scores[kind]).join(' · ')} · 체질 확정 진단이 아닙니다.</p></div>)}
  <div className="diamonds"><Diamond title={titles.innate} series={[series[0]]}/><Diamond title={titles.acquired} series={[series[1]]}/><Diamond title="선천적·후천적 비교" series={series}/></div>
 </section>
}

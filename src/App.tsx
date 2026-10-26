import { useEffect, useRef, useState } from 'react'
import { questions, titles, type Kind, type Segment } from './questions'
import { aggregate, answer, fresh, key, next, restore, save, type Session } from './engine'
import { readTextSize, textSizeKey, textSizes, type TextSize } from './preferences'
type View = 'home' | 'combined' | Kind
const kinds: Kind[] = ['acquired', 'innate']
function Rich({ content }: { content: Segment[] }) { return <>{content.map((s, i) => s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>)}</> }
function read(kind: Kind) { try { return restore(kind, localStorage.getItem(key(kind))) } catch { return fresh(kind) } }
function Result({ state }: { state: Session }) {
 const rows = aggregate(state), unit = state.kind === 'acquired' ? '회' : '점'
 return <table><caption>{titles[state.kind]} 결과</caption><thead><tr><th scope="col">{state.kind === 'acquired' ? '선택 번호' : '분류'}</th><th scope="col">{unit === '회' ? '선택 횟수' : '총점'}</th></tr></thead><tbody>{rows.map(([label, score]) => <tr key={label}><th scope="row">{label}</th><td>{score}{unit}</td></tr>)}</tbody><tfoot><tr><th scope="row">합계</th><td>{rows.reduce((n, r) => n + r[1], 0)}{unit}</td></tr></tfoot></table>
}
function CompletedResult({ state }: { state: Session }) {
 return <details className="completed-result"><summary>{state.kind === 'acquired' ? '후천적' : '타고난'} 체질 결과 보기</summary><div className="panel"><Result state={state}/></div></details>
}
export default function App() {
 const [states, setStates] = useState<Record<Kind, Session>>(() => ({ acquired: read('acquired'), innate: read('innate') }))
 const [view, setView] = useState<View>('home'), [warning, setWarning] = useState('')
 const [review, setReview] = useState(false), [reset, setReset] = useState<Kind | null>(null)
 const [textSize, setTextSize] = useState(readTextSize)
 const [sizeWarning, setSizeWarning] = useState('')
 function changeTextSize(size: TextSize) {
  setTextSize(size)
  try { localStorage.setItem(textSizeKey, size); setSizeWarning('') }
  catch { setSizeWarning('글자 크기 설정을 저장하지 못했습니다. 현재 화면에는 적용되지만 다시 접속하면 유지되지 않을 수 있습니다.') }
 }
 const modalRef = useRef<HTMLDivElement>(null)
 useEffect(() => {
  if (!reset) return
  const previous = document.activeElement as HTMLElement | null
  const buttons = modalRef.current?.querySelectorAll<HTMLButtonElement>('button')
  buttons?.[0]?.focus()
  function handleKey(event: KeyboardEvent) {
   if (event.key === 'Escape') { event.preventDefault(); setReset(null) }
   if (event.key === 'Tab' && buttons?.length) {
    const first = buttons[0], last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
   }
  }
  document.addEventListener('keydown', handleKey)
  return () => { document.removeEventListener('keydown', handleKey); previous?.focus() }
 }, [reset])
 function update(state: Session) {
  try { save(localStorage, state); setWarning('') } catch { setWarning('자동 저장을 사용할 수 없습니다. 브라우저 저장 공간 설정을 확인해 주세요. 페이지를 닫으면 응답이 사라질 수 있습니다.') }
  setStates(prev => ({ ...prev, [state.kind]: state }))
 }
 function navigate(target: View) { setView(target); setReview(false); window.scrollTo(0, 0) }
 const complete = kinds.every(k => states[k].completed)
 const active = view === 'acquired' || view === 'innate' ? states[view] : null
 const otherKind: Kind | null = active ? active.kind === 'acquired' ? 'innate' : 'acquired' : null
 return <div className="shell" data-text-size={textSize}><header><button className="brand" onClick={() => navigate('home')} aria-label="YingYang 홈"><span className="symbol">☯</span> YingYang</button><div className="header-tools"><span className="edition">체질 진단 · v1.1</span><div className="text-settings" role="group" aria-label="글자 크기"><span>글자 크기</span><div className="text-size-buttons">{textSizes.map(size => <button key={size.value} type="button" aria-label={`글자 크기 ${size.label}`} aria-pressed={textSize === size.value} onClick={() => changeTextSize(size.value)}>{size.label}</button>)}</div></div></div></header><main>
 {sizeWarning && <p role="alert" className="notice">{sizeWarning}</p>}
 {warning && <p role="alert" className="notice">{warning}</p>}
 {view === 'home' ? <><section className="hero"><span className="eyebrow">나를 이해하는 첫걸음</span><h1>나의 체질을 알아보는<br/><em>두 가지 진단</em></h1><p>지금의 나와 타고난 나를 차분히 살펴보세요.<br/>각 진단은 원하는 순서로 진행할 수 있습니다.</p></section><section className="cards" aria-label="검진 선택">{kinds.map((kind, i) => {
 const state = states[kind], count = state.answers.filter(a => a !== null).length
 return <article className={`card card-${kind}`} key={kind}><div className="card-top"><span className="card-number">0{i + 1}</span><span className="badge">{state.completed ? '✓ 완료' : count ? '진행 중' : '미시작'}</span></div><div className="card-icon" aria-hidden="true">{i ? '◈' : '❋'}</div><h2>{titles[kind]}</h2><p>{i ? '타고난 몸의 특징과 평소 반응을 살펴봅니다.' : '일상의 생각과 행동, 마음의 모습을 살펴봅니다.'}</p><div className="meta"><span>{questions[kind].length}문항</span><span>{i ? '0~2점 선택' : '4지선다'}</span></div><div className="card-progress"><span>응답 {count} / {state.answers.length}</span><progress value={count} max={state.answers.length}/></div><button className="primary" onClick={() => navigate(kind)}>{state.completed ? '결과 보기' : count ? '이어하기' : '시작하기'} <span aria-hidden="true">→</span></button></article>
 })}</section>{complete && <button className="combined primary" onClick={() => navigate('combined')}>종합 결과 확인 →</button>}<aside className="info"><span aria-hidden="true">ⓘ</span><div><strong>응답은 자동으로 저장됩니다.</strong><p>같은 브라우저에서 언제든 이어서 진행할 수 있습니다. 현재 버전은 응답 수와 점수를 집계하며, 체질 판정은 제공하지 않습니다.</p></div></aside></> : view === 'combined' ? <><button className="back" onClick={() => navigate('home')}>← 홈으로</button><span className="eyebrow">두 가지 진단을 한눈에</span><h1>종합 결과</h1><p className="sub">두 검진의 결과를 각각 표시합니다.</p><div className="results">{complete && kinds.map(k => <section className="panel" key={k}><Result state={states[k]}/><button className="secondary" onClick={() => navigate(k)}>개별 결과 및 응답 보기</button></section>)}</div></> : active && <><button className="back" onClick={() => navigate('home')}>← 홈으로</button><span className="eyebrow">{view === 'acquired' ? '01' : '02'} · {titles[active.kind]}</span>{active.completed ? <><h1>{titles[active.kind]} 결과</h1><p className="sub">모든 응답을 바탕으로 집계한 결과입니다. 체질 판정은 제공하지 않습니다.</p><section className="panel"><Result state={active}/><div className="actions"><button className="secondary" onClick={() => setReview(!review)} aria-expanded={review}>{review ? '응답 접기' : '이전 답변 확인'}</button><button className="primary" onClick={() => setReset(active.kind)}>다시 검진하기</button></div></section>{review && <section className="review" aria-label="이전 답변">{questions[active.kind].map((q, i) => <article className="panel" key={q.id}><h3>{q.id}. <Rich content={q.content}/></h3><p><span className="answer-label">선택한 답변 · {active.kind === 'acquired' ? ['①', '②', '③', '④'][active.answers[i]! - 1] : `${active.answers[i]}점`}</span> <Rich content={q.options.find(o => o.value === active.answers[i])!.content}/></p></article>)}</section>}</> : <>{otherKind && states[otherKind].completed && <CompletedResult key={active.kind} state={states[otherKind]}/>}<div className="question-progress"><span>문항 {active.current + 1} / {active.answers.length}</span><span>응답 {active.answers.filter(a => a !== null).length}개</span></div><progress aria-label="응답 진행률" value={active.answers.filter(a => a !== null).length} max={active.answers.length}/><section className="question panel"><fieldset><legend><span className="question-index">Q{String(active.current + 1).padStart(2, '0')}</span><span><Rich content={questions[active.kind][active.current].content}/></span></legend><p className="hint">가장 잘 맞는 답변 하나를 선택해 주세요.</p><div className="options">{questions[active.kind][active.current].options.map(o => <label className={`option ${active.answers[active.current] === o.value ? 'selected' : ''}`} key={o.value}><input type="radio" name={`question-${active.current}`} value={o.value} checked={active.answers[active.current] === o.value} onChange={() => update(answer(active, o.value))}/><span className="option-number">{active.kind === 'acquired' ? ['①', '②', '③', '④'][o.value - 1] : `${o.value}점`}</span><span><Rich content={o.content}/></span>{active.answers[active.current] === o.value && <span className="check" aria-label="선택됨">✓</span>}</label>)}</div></fieldset><div className="actions"><button className="secondary" disabled={active.current === 0} onClick={() => update({ ...active, current: active.current - 1 })}>← 이전</button><button className="primary" disabled={active.answers[active.current] === null} onClick={() => update(next(active))}>{active.current === active.answers.length - 1 ? '결과 확인' : '다음 →'}</button></div><p className="save-note" role="status">{warning ? '저장 상태를 확인해 주세요.' : '응답과 진행 위치가 이 브라우저에 자동 저장됩니다.'}</p></section></>}</>}
 </main><footer><span>YingYang</span><span>나를 알아가는 시간</span></footer>{reset && <div className="modal-backdrop" ref={modalRef}><section className="modal panel" role="alertdialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">다시 검진하시겠습니까?</h2><p>기존 검진 결과가 초기화됩니다. 다시 진행하시겠습니까?</p><div className="actions"><button className="secondary" onClick={() => setReset(null)}>취소</button><button className="primary" onClick={() => { update(fresh(reset)); setReview(false); setReset(null); window.scrollTo(0, 0) }}>확인</button></div></section></div>}</div>
}

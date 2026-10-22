// The board: every entity with the whole window, ranked, then the ones still
// inside it. One dense row each; a tap opens the panel under the row. Long
// lists page, and the open row is always on the page.
import { useState } from 'react'
import { rowName, seqWords, testsWords } from '../lib/words.ts'
import { statByKey } from '../lib/stats.ts'
import { seasonWords, spanWords } from '../lib/ledger.ts'
import { eraBound } from '../lib/query.ts'

const PAGE = 25

/** the DOM id of a row, for a deep link to land on it */
export const rowId = (key) => `row-${key}`

function ValueCell({ r, q }) {
  if (r.value == null) return <span className="bval soft">—<small>{r.reached} {seqWords(q.seq, r.reached)}</small></span>
  const n = r.value
  return (
    <span className={'bval' + (r.complete ? '' : ' otl')}>
      {n.toLocaleString('en-US')}
      <small>{q.how === 'reach' ? `${seqWords(q.seq, n)}${r.age != null ? ` · age ${r.age}` : ''}` : r.complete ? (q.how === 'every' ? `of ${q.n}` : '') : `thru ${r.reached}`}</small>
    </span>
  )
}

// the open row's panel sits right under it, so opening a row far down the
// list shows the detail where the reader is looking
function Rows({ rows, q, open, onOpen, panel, start = 0 }) {
  return rows.map((r, i) => (
    <div key={r.key} id={rowId(r.key)} className={'brow-wrap' + (open === r.key ? ' open' : '')}>
      <button className={'brow' + (open === r.key ? ' hi' : '')} onClick={() => onOpen(r.key)} aria-pressed={open === r.key} aria-expanded={open === r.key}>
        <span className={'brank' + (r.rank === 1 ? ' one' : '')}>{r.complete ? `${r.tied ? 'T' : ''}${r.rank}` : start + i + 1}</span>
        <span className="bname">
          <b>{rowName(r)}</b>
          <small>{r.season != null ? (r.complete && r.reached < q.n ? `${r.team} · all ${r.reached} games` : `${r.team} · ${r.reached} of ${q.n} games`) : spanWords(r.from, r.to)}</small>
        </span>
        <ValueCell r={r} q={q} />
      </button>
      {open === r.key && panel}
    </div>
  ))
}

export function Board({ board, query, open, onOpen, panel }) {
  const [shown, setShown] = useState(PAGE)
  const [shownWay, setShownWay] = useState(6)
  const q = query
  // the open row is always on the page, however far down it ranks
  const openAt = open ? board.ranked.findIndex((r) => r.key === open) : -1
  const openWayAt = open && openAt < 0 ? board.onTheWay.findIndex((r) => r.key === open) : -1
  const showN = openAt >= shown ? openAt + 1 : shown
  const showWayN = openWayAt >= shownWay ? openWayAt + 1 : shownWay
  const stat = statByKey(q.stat)
  const ranked = board.ranked
  const way = board.onTheWay
  const unit = q.seq === 'teamGames' ? 'player-seasons' : 'careers'
  return (
    <section className="board" aria-label="The board">
      <div className="board-h">
        <span>{ranked.length.toLocaleString('en-US')} {unit} with the whole window</span>
        <span>{q.how === 'reach' ? seqWords(q.seq, 2) : q.how === 'sum' ? stat.noun : q.how === 'streak' ? `straight games of ${testsWords(q.tests)}` : `games of ${testsWords(q.tests)}`}</span>
      </div>
      {board.gapped > 0 && <p className="gapped">{board.gapped} {board.gapped === 1 ? 'career sits' : 'careers sit'} out: a game nobody can name the starters of falls inside the window.</p>}
      {board.censored > 0 && q.since == null && <p className="gapped">{board.censored} careers began before {seasonWords(board.first)} and have no first {seqWords(q.seq, 2)} here.</p>}
      {board.early > 0 && eraBound(q, board) === board.since && q.since == null && <p className="gapped">{board.early.toLocaleString('en-US')} {unit} from before {seasonWords(board.since)} sit out: the box score didn't record {q.how === 'sum' || q.how === 'reach' ? stat.noun : testsWords(q.tests).replace(/\d+\+ /g, '')} in every game until then.</p>}
      {board.partial > 0 && <p className="gapped">{board.partial.toLocaleString('en-US')} {unit} sit out: a game inside the window has no {q.how === 'sum' || q.how === 'reach' ? stat.noun : 'line'} recorded.</p>}
      {ranked.length === 0 && <p className="empty">Nobody has {q.how === 'reach' ? 'got there' : 'the whole window'} yet. Shorten it.</p>}
      <Rows rows={ranked.slice(0, showN)} q={q} open={open} onOpen={onOpen} panel={panel} />
      {ranked.length > showN && <button className="morebtn" onClick={() => setShown(showN + PAGE * 2)}>see more · {ranked.length - showN} below</button>}
      {way.length > 0 && (
        <>
          <div className="board-h" style={{ marginTop: 18 }}>
            <span>{way.length.toLocaleString('en-US')} still inside the window</span>
            <span>so far</span>
          </div>
          <Rows rows={way.slice(0, showWayN)} q={q} open={open} onOpen={onOpen} panel={panel} />
          {way.length > showWayN && <button className="morebtn" onClick={() => setShownWay(showWayN + PAGE)}>see more · {way.length - showWayN} below</button>}
        </>
      )}
    </section>
  )
}

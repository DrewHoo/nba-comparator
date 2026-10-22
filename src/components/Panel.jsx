// The open player: the claim the row makes, a peer to read it against (the
// leader by default; `vs` in the URL names another), where their curves
// crossed, what the subject needs over the next games to match the peer,
// and the window's games. The reading itself is src/lib/compare.ts, which
// share.ts reads too, so a link's words say what the panel shows.
import { useMemo, useState } from 'react'
import { Picker } from './Picker.jsx'
import { CloseIcon } from './Icons.jsx'
import { holds, careerSpan, eraBound } from '../lib/query.ts'
import { compare, crossingWords, matchWords, peerOf, peersOf } from '../lib/compare.ts'
import { statByKey } from '../lib/stats.ts'
import { rowName, rowWords, rankWords, testsWords, eraWords } from '../lib/words.ts'
import { fmtDate, gameAt, spanWords } from '../lib/ledger.ts'

const BASE = import.meta.env.BASE_URL

function Chart({ me, them, n, names }) {
  const len = Math.max(me.length, them.length, n)
  const top = Math.max(1, ...me.slice(0, len), ...them.slice(0, len))
  const W = 560, H = 200, L = 36, R = 12, T = 12, B = 22
  const x = (i) => L + ((i) / Math.max(1, len - 1)) * (W - L - R)
  const y = (v) => T + (1 - v / top) * (H - T - B)
  const path = (c) => c.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const ticks = [0, Math.round(top / 2), top]
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${names[0]} and ${names[1]}, cumulative by game`}>
      <line className="axis" x1={L} y1={y(0)} x2={W - R} y2={y(0)} />
      {ticks.map((t) => <text key={t} className="tick" x={L - 6} y={y(t) + 3} textAnchor="end">{t.toLocaleString('en-US')}</text>)}
      <text className="tick" x={x(0)} y={H - 6} textAnchor="start">1</text>
      <text className="tick" x={x(len - 1)} y={H - 6} textAnchor="end">{len}</text>
      {n <= len && <line className="win" x1={x(n - 1)} y1={T} x2={x(n - 1)} y2={y(0)} />}
      <path className="them" d={path(them)} />
      <path className="me" d={path(me)} />
      <text className="lab me" x={x(Math.min(me.length, len) - 1)} y={y(me[Math.min(me.length, len) - 1] ?? 0) - 5} textAnchor="end">{names[0]}</text>
      <text className="lab" x={x(Math.min(them.length, len) - 1)} y={y(them[Math.min(them.length, len) - 1] ?? 0) + 12} textAnchor="end">{names[1]}</text>
    </svg>
  )
}

function Ledger({ L, r, q }) {
  const [all, setAll] = useState(false)
  const stat = statByKey(q.stat)
  const isTest = q.how === 'count' || q.how === 'every' || q.how === 'streak'
  const games = [...r.games].reverse()
  const shown = all ? games : games.slice(0, 10)
  return (
    <div className="ledger">
      <div className="xrow xhead"><span>#</span><span>date</span><span>game</span><span>{isTest ? testsWords(q.tests) : stat.noun}</span></div>
      {shown.map((i, k) => {
        const g = gameAt(L, i)
        const idx = games.length - k
        const res = g.result === 2 ? 'W' : 'L'
        const ok = isTest && holds(L, i, q.tests)
        return (
          <div key={i} className="xrow">
            <span className="xn">{q.seq === 'teamGames' ? g.tgn : idx}</span>
            <span className="xd">{fmtDate(g.date)}</span>
            <span className="xg"><span className={res === 'W' ? 'w' : 'l'}>{res}</span> {g.team} {g.home ? 'v' : '@'} {L.opp ? g.opp : '…'}{g.post ? ' · playoff' : ''}{g.started === false && q.seq !== 'starts' ? ' · off the bench' : ''}</span>
            <span className={'xv' + (isTest ? (ok ? ' yes' : ' no') : '')}>{isTest ? (ok ? '✓' : '✗') + ' ' + q.tests.map((t) => statByKey(t.stat).read(L, i)).join(' / ') : stat.read(L, i)}</span>
          </div>
        )
      })}
      {games.length > shown.length && <button className="morebtn" onClick={() => setAll(true)}>all {games.length} games</button>}
    </div>
  )
}

export function Panel({ L, row, board, query, peerKey = null, onPeer, onClose, hasPage = false }) {
  const q = query
  const field = board.ranked.length
  const career = q.seq !== 'teamGames'
  const others = useMemo(() => peersOf(board, row), [board, row])
  const peer = useMemo(() => peerOf(board, row, peerKey), [board, row, peerKey])
  const cmp = useMemo(() => (career && peer ? compare(L, row, peer, q) : null), [L, career, peer, q, row])
  const xs = cmp ? cmp.xs : []
  const age = row.player.born ? ` · born ${row.player.born.slice(0, 4)}` : ''
  const [from, to] = careerSpan(L, row.player)
  const srcWords = { espn: 'ESPN', roster: 'the NBA roster' }

  return (
    <section className="panel" aria-label={`${row.player.name}'s comparison`}>
      <div className="panel-head">
        <div className="panel-id">
          <span className="panel-name">{rowName(row)}</span>
          <span className="panel-meta" title={row.player.posSrc ? `position from ${srcWords[row.player.posSrc]}` : undefined}>
            {row.player.pos ?? 'position unlisted'} · {spanWords(from, to)}{age}
            {hasPage && <> · <a className="plink" href={`${BASE}player/${encodeURIComponent(row.player.id)}/`}>what he leads →</a></>}
          </span>
        </div>
        <button className="ico panel-close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
      </div>
      <p className="claim">
        <b>{row.player.name}</b> has {rowWords(row, q)}{row.complete && row.value != null ? <>, <b>{rankWords(row, field)}</b> {q.seq === 'teamGames' ? 'player-seasons' : 'careers'}{eraWords(eraBound(q, board))}.</> : row.value == null ? '.' : <>, still inside the window.</>}
      </p>
      {peer && (
        <div className="peer">
          <span>against</span>
          <Picker value={peer.key} options={others.map((r) => ({ value: r.key, label: rowName(r), hint: r.value == null ? '' : String(r.value) }))} onChange={onPeer} ariaLabel="The peer" />
          <span>{peer.value == null ? '' : `(${rowWords(peer, q)})`}</span>
        </div>
      )}
      {cmp && xs.length > 0 && (
        <ul className="xings">
          {xs.map((c) => <li key={c.n}>{crossingWords(c, peer, q)}</li>)}
        </ul>
      )}
      {cmp && xs.length === 0 && <p className="track">Their curves never met{cmp.me.length < 2 ? '' : ` in ${Math.min(cmp.me.length, cmp.them.length)} ${q.seq === 'starts' ? 'starts' : 'games'}`}.</p>}
      {cmp && matchWords(row, peer, cmp, q) && <p className="track">{matchWords(row, peer, cmp, q)}</p>}
      {cmp && <Chart me={cmp.me} them={cmp.them} n={cmp.n} names={[row.player.name, peer.player.name]} />}
      <Ledger L={L} r={row} q={q} />
    </section>
  )
}

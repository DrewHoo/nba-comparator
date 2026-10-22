// A team page: the best players of one position for one franchise
// (src/lib/groups.ts), ranked by the position's first metric, with one
// cumulative line per player for each metric and the table of every
// qualifying player. The data is computed by the prerender and embedded in
// the page (#player-data), so the client needs no ledger. The College
// Football Comparator's group page, over the 30 franchises.
import { useEffect } from 'react'
import { CoffeeIcon, ShareIcon } from './Icons.jsx'
import { PlayerFinder } from './PlayerFinder.jsx'
import { KOFI_URL } from './Notes.jsx'
import { useShare } from '../hooks/useShare.ts'
import { track } from '../lib/analytics.ts'
import { seasonWords, spanWords } from '../lib/ledger.ts'
import { statByKey } from '../lib/stats.ts'
import { POS_WORDS } from '../lib/words.ts'
import { groupH1, groupLead, groupTitle, gameAt, CURVES, MIN_GAMES, GROUP_POS, POS_SLUG, FRANCHISES } from '../lib/groups.ts'
import { SITE } from '../lib/share.ts'

const BASE = import.meta.env.BASE_URL
const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'))
const short = (name) => { const parts = name.split(' '); return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name }
const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0])

/** one cumulative line per player, the metric's leader in cream, the rest faint; a hover lifts a line */
function Curves({ data, m, stat }) {
  const lines = data.rows.filter((r) => r.curves?.[m]).sort((a, b) => b.totals[m] - a.totals[m]).slice(0, CURVES)
  if (!lines.length) return null
  const len = Math.max(...lines.map((r) => r.games))
  const top = Math.max(1, ...lines.map((r) => r.curves[m][r.curves[m].length - 1]))
  const W = 560, H = 220, L = 42, R = 110, T = 12, B = 24
  const x = (g) => L + ((g - 1) / Math.max(1, len - 1)) * (W - L - R)
  const y = (v) => T + (1 - v / top) * (H - T - B)
  const path = (r) => r.curves[m].map((v, k) => `${k ? 'L' : 'M'}${x(gameAt(data, r, k)).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const ticks = [0, Math.round(top / 2), top]
  // the names in a column at the right edge, in the order the lines end, nudged apart
  const ends = lines.map((r, k) => ({ k, y: y(r.curves[m][r.curves[m].length - 1]) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 11) ends[i].y = ends[i - 1].y + 11
  // then up from the floor, so a crowd at the bottom stacks rather than overlaps
  if (ends.length && ends[ends.length - 1].y > H - B) ends[ends.length - 1].y = H - B
  for (let i = ends.length - 2; i >= 0; i--) if (ends[i + 1].y - ends[i].y < 11) ends[i].y = ends[i + 1].y - 11
  const labelY = new Map(ends.map((e) => [e.k, e.y]))
  return (
    <figure className="gchart">
      <figcaption>{stat.noun} · by game</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${stat.noun}, cumulative by game, ${lines.map((r) => r.name).join(', ')}`}>
        <line className="axis" x1={L} y1={y(0)} x2={W - R} y2={y(0)} />
        {ticks.map((t) => <text key={t} className="tick" x={L - 6} y={y(t) + 3} textAnchor="end">{fmt(t)}</text>)}
        <text className="tick" x={x(1)} y={H - 6} textAnchor="start">1</text>
        <text className="tick" x={x(len)} y={H - 6} textAnchor="end">{fmt(len)}</text>
        {lines.map((r, k) => (
          <g key={r.id} className={'gl' + (k === 0 ? ' lead' : '')}>
            <path d={path(r)} />
            <line className="lead-line" x1={x(r.games)} y1={y(r.curves[m][r.curves[m].length - 1])} x2={W - R + 4} y2={labelY.get(k)} />
            <text x={W - R + 7} y={labelY.get(k) + 3}>{short(r.name)}</text>
          </g>
        )).reverse()}
      </svg>
    </figure>
  )
}

export function GroupPage({ id, pos, preload }) {
  const data = preload ?? null
  const { copied, share: send } = useShare()
  useEffect(() => { track('team page', { team: id, pos }) }, [id, pos])
  useEffect(() => { if (data) document.title = groupTitle(data, SITE) }, [data])
  const share = () => {
    send(data ? groupLead(data) || groupH1(data) : window.location.href, window.location.href)
    track('share team', { team: id, pos })
  }
  const acts = (
    <span className="dateline-acts">
      <PlayerFinder />
      <a className="ico" href={KOFI_URL} onClick={() => track('kofi', { from: 'icons team' })} aria-label="Buy me a coffee"><CoffeeIcon /></a>
      <button className="ico" onClick={share} aria-label="Share this page"><ShareIcon /></button>
      {copied && <span className="toast">copied</span>}
    </span>
  )
  if (!data) {
    return (
      <main>
        <div className="dateline"><span><a href={BASE}>← the board</a> · drewhoover.com</span>{acts}</div>
        <h1>No page here</h1>
        <p className="baserate">No page for {POS_WORDS[pos] ?? 'that position'} at <code>{id}</code>. Every franchise is on <a href={`${BASE}team/`}>the team list</a>.</p>
      </main>
    )
  }
  const metrics = data.metrics.map((k) => statByKey(k))
  const marked = data.rows.some((r) => r.missing.some((n, m) => n > 0 && r.totals[m] != null))
  const blank = data.rows.some((r) => r.totals.some((v) => v == null))
  const late = metrics.filter((s) => s.since > data.since)
  const others = GROUP_POS.filter((p) => p !== data.pos)
  return (
    <main>
      <div className="dateline">
        <span><a href={BASE}>← the board</a> · drewhoover.com · {spanWords(data.since, data.currentSeason)}</span>
        {acts}
      </div>
      <h1><span className="h1-site">NBA Comparator</span><span className="h1-words">{groupH1(data).replace(/ since \S+$/, '')} since <span className="nowrap">{seasonWords(data.since)}</span></span></h1>
      <p className="landing-line">{groupLead(data)}</p>
      <p className="baserate">
        Every {POS_WORDS[data.pos].replace(/s$/, '')} with {MIN_GAMES} or more regular-season games for the {data.name} since {seasonWords(data.since)}, ranked by {metrics[0].noun}.
        The lines are each player's total game by game, the top {CURVES} of each drawn.
        {data.former.length > 0 && <> The franchise's games as the {list(data.former)} count.</>}
        {data.note && <> {data.note}</>}
      </p>
      <div className="gcharts">
        {metrics.map((s, m) => <Curves key={s.key} data={data} m={m} stat={s} />)}
      </div>
      <section className="board" aria-label="The ranking">
        <div className="board-h"><span>{data.rows.length} {POS_WORDS[data.pos]} with {MIN_GAMES}+ games</span><span>{metrics[0].noun}</span></div>
        <table className="gtable">
          <thead><tr><th>#</th><th>player</th><th>seasons</th><th className="num">games</th>{metrics.map((s) => <th key={s.key} className="num">{s.noun}</th>)}</tr></thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={r.id}>
                <td className="xn">{i + 1}</td>
                <td className="gname">{r.page ? <a href={`${BASE}player/${encodeURIComponent(r.id)}/`}>{r.name}</a> : <span>{r.name}</span>}</td>
                <td className="xd">{spanWords(r.from, r.to)}</td>
                <td className="num xd">{fmt(r.games)}</td>
                {r.totals.map((v, m) => (
                  <td key={m} className={'num' + (m === 0 ? ' lead' : '')} title={r.missing[m] ? `${fmt(r.missing[m])} of his games here have no ${metrics[m].noun} in the box score` : undefined}>
                    {fmt(v)}{v != null && r.missing[m] > 0 && <sup>*</sup>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="notes" style={{ marginTop: 24 }}>
        {marked && <>* The box score lacks the stat in some of his games here; the total is the games that have it. </>}
        {blank && <>— The box score lacks the stat in more than a tenth of his games here. </>}
        {late.length > 0 && <>The box score has {list(late.map((s) => `${s.noun} in nearly every game from ${seasonWords(s.since)}`))}; the <a href={`${BASE}#method`}>Method</a> has the rest. </>}
        A position is the NBA roster's, else ESPN's, one for the whole career.
      </p>
      <p className="notes">
        Also for the {data.name}: {others.map((p, i) => <span key={p}>{i > 0 && ', '}<a href={`${BASE}team/${data.id}/${POS_SLUG[p]}/`}>{POS_WORDS[p]}</a></span>)}. <a href={`${BASE}team/`}>Every franchise</a>.
      </p>
    </main>
  )
}

/** the index of every team page: the franchises with a line of positions each */
export function GroupIndex() {
  return (
    <main>
      <div className="dateline">
        <span><a href={BASE}>← the board</a> · drewhoover.com</span>
        <span className="dateline-acts"><PlayerFinder /></span>
      </div>
      <h1><span className="h1-site">NBA Comparator</span><span className="h1-words">Every NBA franchise's best guards, forwards and centers</span></h1>
      <p className="baserate">The best players of each position for each of the 30 franchises, the franchise's older names included, each with the players' totals drawn game by game.</p>
      <ul className="gindex">
        {FRANCHISES.map((f) => (
          <li key={f.id}><b>{f.name}</b> {GROUP_POS.map((p) => <a key={p} href={`${BASE}team/${f.id}/${POS_SLUG[p]}/`}>{POS_WORDS[p]}</a>)}</li>
        ))}
      </ul>
    </main>
  )
}

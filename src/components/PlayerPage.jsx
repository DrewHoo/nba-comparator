// A player's page: every comparison he leads among all players, from his
// records file (scripts/build-records.mjs), scored and folded at load with
// RECORDS' knobs (src/lib/records.ts). Families by stat, the face of each
// expanded, the rest behind "more"; every row links to its board. `?tune=1`
// opens the tuner: a field per knob, the term table on every row, the knobs
// as a RECORDS literal to paste. The tuner re-scores and re-folds; it never
// re-words a row (the build picked each row's N under the shipped knobs).
import { useEffect, useMemo, useState } from 'react'
import { CoffeeIcon, ShareIcon } from './Icons.jsx'
import { PlayerFinder } from './PlayerFinder.jsx'
import { KOFI_URL } from './Notes.jsx'
import { useShare } from '../hooks/useShare.ts'
import { playerLead, playerText } from '../lib/share.ts'
import { track } from '../lib/analytics.ts'
import { seasonWords, spanWords } from '../lib/ledger.ts'
import { RECORDS, KNOB_PATHS, decodePlayer, knobAt, page, withKnob, statOf } from '../lib/records.ts'
import { statByKey } from '../lib/stats.ts'
import { POS_WORDS, breakerWords, placeWords, recordWords, runWords } from '../lib/words.ts'
import { hrefOf } from '../lib/url.ts'

const BASE = import.meta.env.BASE_URL

const KIND_WORDS = { held: 'leads', set: 'set it' }

function Terms({ r }) {
  return (
    <span className="terms">
      {Object.entries(r.terms).map(([k, v]) => <span key={k}><i>{k}</i> {v >= 0 ? '+' : '−'}{Math.abs(v).toFixed(1)}</span>)}
      <span><i>=</i> {r.score.toFixed(1)}</span>
    </span>
  )
}

/** the unit under a row's value: a reach counts games (or starts), a sum its stat, a count or streak games */
const unitWords = (r) => (r.shape.how === 'reach' ? (r.shape.seq === 'starts' ? 'starts' : 'games') : r.shape.how === 'sum' ? statByKey(r.shape.stat).noun : 'games')

function Row({ r, tune, minN }) {
  // a named board's path when the claim is one (landing.ts), else the query string
  const href = `${BASE}${hrefOf({ query: { ...r.shape, n: r.at }, open: r.key }).slice(1)}`
  const run = runWords(r, minN)
  return (
    <div className={'rrow' + (r.live ? ' live' : '')}>
      <span className={'rkind ' + r.kind}>{r.live ? 'live' : KIND_WORDS[r.kind]}</span>
      <span className="rbody">
        <a className="rclaim" href={href} onClick={() => track('record', { player: r.player.name, words: recordWords(r) })}>{recordWords(r)}</a>
        <small>
          {placeWords(r)}{run ? ` · ${run}` : ''}{r.breaker ? ` · ${breakerWords(r)}` : ''}
          {r.folded.length > 0 && <span className="ralso"> · said {r.folded.length} other {r.folded.length === 1 ? 'way' : 'ways'}</span>}
        </small>
        {tune && <Terms r={r} />}
      </span>
      <span className={'rval' + (r.live ? ' otl' : '')}>
        {r.value.toLocaleString('en-US')}
        <small>{unitWords(r)}</small>
      </span>
    </div>
  )
}

function FamilyBlock({ f, tune, minN }) {
  const [open, setOpen] = useState(false)
  const stat = statByKey(statOf(f.best))
  return (
    <section className="fam" aria-label={stat.noun}>
      <div className="fam-h"><span>{stat.noun}{f.best.season != null ? ' · a season' : ''}</span>{tune && <span>{f.best.score.toFixed(1)}</span>}</div>
      <Row r={f.best} tune={tune} minN={minN} />
      {open && f.rest.map((r, i) => <Row key={i} r={r} tune={tune} minN={minN} />)}
      {f.rest.length > 0 && !open && <button className="morebtn" onClick={() => setOpen(true)}>{f.rest.length} more</button>}
    </section>
  )
}

function Tuner({ knobs, onChange }) {
  const changed = KNOB_PATHS.filter((p) => knobAt(knobs, p) !== knobAt(RECORDS, p))
  const copy = async () => {
    const lines = changed.map((p) => `  ${p}: ${knobAt(knobs, p)},`).join('\n')
    try { await navigator.clipboard.writeText(`// RECORDS overrides from the tuner\n{\n${lines}\n}`) } catch {}
  }
  return (
    <section className="tuner" aria-label="The tuner">
      <div className="fam-h"><span>tuner · the score's knobs</span><span>{changed.length ? `${changed.length} changed` : 'defaults'}</span></div>
      <div className="knobs">
        {KNOB_PATHS.map((p) => (
          <label key={p} className={'knob' + (changed.includes(p) ? ' on' : '')}>
            <span>{p}</span>
            <input type="number" step="0.5" value={knobAt(knobs, p)} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(withKnob(knobs, p, v)) }} />
          </label>
        ))}
      </div>
      <div className="tuner-acts">
        <button className="morebtn" onClick={() => onChange(RECORDS)}>reset</button>
        <button className="morebtn" onClick={copy}>copy as RECORDS</button>
      </div>
    </section>
  )
}

/** the rows' field is every player, whatever his own position */
const FIELD = 'ALL'

export function PlayerPage({ id, preload, firstSeason }) {
  const [file, setFile] = useState(preload ?? null)
  const [knobs, setKnobs] = useState(RECORDS)
  const [tune, setTune] = useState(false)
  const { copied, share: send } = useShare()

  useEffect(() => {
    if (file) return
    let live = true
    fetch(`${BASE}players/${id}.json`).then((r) => (r.ok ? r.json() : 'missing')).catch(() => 'missing').then((f) => { if (live) setFile(f) })
    return () => { live = false }
  }, [id])

  // the tuner and its knobs: URL after mount, then localStorage, never during render
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('tune')
      if (p === '1') localStorage.setItem('tune', '1')
      if (p === '0') localStorage.removeItem('tune')
      if (localStorage.getItem('tune') === '1') setTune(true)
      const saved = JSON.parse(localStorage.getItem('tune.knobs') ?? 'null')
      if (saved) setKnobs(Object.entries(saved).reduce((k, [p, v]) => withKnob(k, p, v), RECORDS))
    } catch {}
    track('player page', { player: id })
  }, [id])
  const changeKnobs = (k) => {
    setKnobs(k)
    try {
      const over = Object.fromEntries(KNOB_PATHS.filter((p) => knobAt(k, p) !== knobAt(RECORDS, p)).map((p) => [p, knobAt(k, p)]))
      localStorage.setItem('tune.knobs', JSON.stringify(over))
    } catch {}
  }

  const has = file && file !== 'missing'
  const rows = useMemo(() => (has ? decodePlayer(file, knobs) : []), [file, knobs])
  const fams = useMemo(() => (has ? page(rows, id) : []), [rows, id, file])
  // the tab's title, after mount (the prerender wrote the shipped one); the shipped knobs' face, not the tuner's
  useEffect(() => {
    if (!has) return
    const face = page(decodePlayer(file), id)[0]?.best
    document.title = playerText(file.name, FIELD, face, firstSeason).title
  }, [file, id, firstSeason])
  // the share sheet, or "text url" on the clipboard: the page's lead line
  const share = () => {
    send(has ? playerLead(file.name, FIELD, fams[0]?.best, firstSeason) : window.location.href, window.location.href)
    track('share player', { player: id })
  }

  const n = fams.reduce((s, f) => s + 1 + f.rest.length, 0)
  return (
    <main>
      <div className="dateline">
        <span><a href={BASE}>← the board</a> · drewhoover.com</span>
        <span className="dateline-acts">
          <PlayerFinder current={id} />
          <a className="ico" href={KOFI_URL} onClick={() => track('kofi', { from: 'icons player' })} aria-label="Buy me a coffee"><CoffeeIcon /></a>
          <button className="ico" onClick={share} aria-label="Share this page"><ShareIcon /></button>
          {copied && <span className="toast">copied</span>}
        </span>
      </div>
      {file === 'missing' && <><h1>No page here</h1><p className="baserate">No player file for <code>{id}</code>: he leads nothing at any point, or the records haven't been built (<code>npm run records</code>).</p></>}
      {!file && <p className="loading">loading…</p>}
      {has && (
        <>
          <h1>{file.name}</h1>
          <p className="pmeta">{POS_WORDS[file.pos ?? 'ALL'].replace(/s$/, '')} · {spanWords(file.from, file.to)} · {file.teams.join(', ')} · {file.games.toLocaleString('en-US')} games{file.active ? ' · active' : ''}</p>
          <p className="baserate">
            Every comparison <b>{file.name}</b> leads among {POS_WORDS[FIELD]} since {seasonWords(firstSeason)}: {n} {n === 1 ? 'claim' : 'claims'} in {fams.length} {fams.length === 1 ? 'family' : 'families'}, the best first.
            A row leads its field now, or set a record that was later broken. Each links to its board.
          </p>
          {tune && <Tuner knobs={knobs} onChange={changeKnobs} />}
          {fams.map((f) => <FamilyBlock key={f.key} f={f} tune={tune} minN={knobs.minN[f.best.shape.seq]} />)}
          {fams.length === 0 && <p className="empty">Nothing he leads at any point.</p>}
          <p className="notes" style={{ marginTop: 28 }}>
            A lead is an interval: the stretch of N where he is first, worded at one N inside it. "One of 4" is a tie for first. A record "when he got there" was first among the careers that had reached that point by then.
            Fields are careers that began in {seasonWords(firstSeason)} or later, or player-seasons where he played the window (started half the team’s games or averaged {RECORDS.minutesAvg} minutes). The method is in the <a href={`${BASE}#method`}>board's notes</a>.
          </p>
        </>
      )}
    </main>
  )
}

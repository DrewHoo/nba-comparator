import { useEffect, useMemo, useRef, useState } from 'react'
import { Sentence } from './components/Sentence.jsx'
import { Board, rowId } from './components/Board.jsx'
import { Panel } from './components/Panel.jsx'
import { Notes, KOFI_URL } from './components/Notes.jsx'
import { PlayerPage } from './components/PlayerPage.jsx'
import { PlayerFinder, loadIndex } from './components/PlayerFinder.jsx'
import { CoffeeIcon, ShareIcon } from './components/Icons.jsx'
import { useShare } from './hooks/useShare.ts'
import { hasCols, spanWords } from './lib/ledger.ts'
import { ensureCols } from './lib/load.ts'
import { evaluate, normalize, queryCols, eraBound, DEFAULT_QUERY } from './lib/query.ts'
import { parseAddress, hrefOf, toUrl } from './lib/url.ts'
import { landingFor, landingFromPath, landingTitle } from './lib/landing.ts'
import { Landings } from './components/Landings.jsx'
import { rowName, rowWords } from './lib/words.ts'
import { queryWords } from './lib/words.ts'
import { peerOf } from './lib/compare.ts'
import { shareText, shareTitle, SITE } from './lib/share.ts'
import { track } from './lib/analytics.ts'
import { writeUrl } from './urlState.js'
import { ledgerFile, colUrl } from './ledger-client.js'

/** the open row's top, clear of the index site's sticky back bar */
const BACK_BAR = 64

/** the route from a pathname: the board, or a player's page at player/<id>/ */
export function parseRoute(path) {
  const base = import.meta.env.BASE_URL
  const rel = (path ?? '').startsWith(base) ? path.slice(base.length) : (path ?? '').replace(/^\//, '')
  const m = /^player\/([^/]+)\/?$/.exec(rel)
  if (m) return { kind: 'player', id: decodeURIComponent(m[1]) }
  return { kind: 'board', landing: landingFromPath(`/${rel}`) }
}

/** `path`, `preload` and `ledger` come from the prerender or main.jsx, never from window during render */
export default function App({ path = '', preload = null, ledger = null }) {
  const route = parseRoute(path)
  if (route.kind === 'player') return <PlayerPage id={route.id} preload={preload} firstSeason={ledgerFile.firstSeason} />
  return <BoardApp L={ledger} initial={route.landing?.query ?? DEFAULT_QUERY} />
}

function BoardApp({ L, initial }) {
  // a named board's path seeds its query, so the prerender and the hydrate agree; the address's query string reads on top after mount
  const [query, setQuery] = useState(initial)
  const [open, setOpen] = useState(null)
  const [vs, setVs] = useState(null)
  // bumps when a column the query reads arrives
  const [, setLoaded] = useState(0)
  const [pages, setPages] = useState(null)
  const { copied, share } = useShare()
  // a `t=` deep link lands on its row once the board has rendered it
  const landOn = useRef(null)
  const booted = useRef(false)
  // the prerendered title, for the bare address
  const rootTitle = useRef(null)
  const lastBoard = useRef(null)

  // URL state after mount, never during render: the prerender has no window
  useEffect(() => {
    const s = parseAddress(window.location.pathname, window.location.search, import.meta.env.BASE_URL)
    setQuery(s.query)
    setOpen(s.open)
    setVs(s.vs)
    landOn.current = s.open
    rootTitle.current = document.title
    booted.current = true
    track('query', { words: queryWords(s.query) })
  }, [])

  // who has a page, so the panel links only where one exists
  useEffect(() => { let live = true; loadIndex().then((list) => { if (live) setPages(new Set(list.filter((p) => p.n > 0).map((p) => p.id))) }); return () => { live = false } }, [])

  // the columns this query reads (and the opponent, for an open row's ledger), fetched as needed
  const need = useMemo(() => [...queryCols(query), ...(open ? ['opp'] : [])], [query, open])
  const ready = hasCols(L, queryCols(query))
  useEffect(() => {
    if (hasCols(L, need)) return
    let live = true
    ensureCols(L, colUrl, need).then(() => { if (live) setLoaded((n) => n + 1) }).catch((e) => console.error(e))
    return () => { live = false }
  }, [L, need])

  // the board stays put while its next columns load
  const board = useMemo(() => (ready ? (lastBoard.current = evaluate(L, query)) : lastBoard.current), [L, query, ready])
  const bound = board ? eraBound(query, board) : query.since
  const row = useMemo(() => (board && open ? [...board.ranked, ...board.onTheWay].find((r) => r.key === open) ?? null : null), [board, open])
  const peer = useMemo(() => (row ? peerOf(board, row, vs) : null), [board, row, vs])

  useEffect(() => {
    if (!landOn.current || !row) return
    landOn.current = null
    const el = document.getElementById(rowId(row.key))
    if (el) requestAnimationFrame(() => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - BACK_BAR }))
  }, [row])

  // the tab says what the share worker would: the sentence, or the open comparison; the page's own title at the bare address
  useEffect(() => {
    if (!booted.current) return
    const l = landingFor(query)
    document.title = l && !row ? landingTitle(l, bound, SITE) : toUrl({ query, open: row?.key ?? null, vs }) ? shareTitle(query, row, peer, bound) : rootTitle.current
  }, [query, row, peer, vs, bound])

  const change = (q) => {
    const next = normalize(q)
    // a position change that drops the open player out of the field closes him
    const drops = row != null && next.pos !== 'ALL' && row.player.pos !== next.pos
    setQuery(next)
    if (drops) { setOpen(null); setVs(null) }
    writeUrl(hrefOf({ query: next, open: drops ? null : open, vs: drops ? null : vs }), 'replace')
    track('query', { words: queryWords(next) })
  }
  const openRow = (key) => {
    const next = open === key ? null : key
    setOpen(next)
    setVs(null)
    writeUrl(hrefOf({ query, open: next }), 'replace')
    if (next) track('open', { player: next })
  }
  // the finder, for a player with no page: open his row and land on it, wherever it is on the board; a player-season board opens his latest season
  const findPlayer = (p) => {
    const key = query.seq === 'teamGames' ? [...(board?.ranked ?? []), ...(board?.onTheWay ?? [])].filter((r) => r.player.id === p.id).sort((a, b) => b.season - a.season)[0]?.key ?? null : p.id
    if (!key) return
    landOn.current = key
    setOpen(key)
    setVs(null)
    writeUrl(hrefOf({ query, open: key }), 'replace')
    track('open', { player: key, from: 'finder' })
  }
  // the peer the panel reads against, in the URL so a shared link opens the same comparison
  const setPeer = (key) => {
    setVs(key)
    writeUrl(hrefOf({ query, open, vs: key }), 'replace')
    track('peer', { player: open, vs: key })
  }
  const onShare = () => {
    share(shareText(query, board, row), window.location.href)
    track('share', { words: queryWords(query), player: open, vs: peer?.key ?? null })
  }

  const since = bound ?? L.firstSeason
  const landing = landingFor(query)
  const leader = board?.ranked[0] && board.ranked[0].value != null ? board.ranked[0] : null
  return (
    <main>
      <div className="dateline">
        <span>{`drewhoover.com · ${spanWords(L.firstSeason, L.currentSeason)}`}<span className="dateline-upd"> · updated {String(L.builtAt).slice(0, 10)}</span></span>
        <span className="dateline-acts">
          <PlayerFinder current={row?.player.id ?? null} onPick={findPlayer} />
          <a className="ico" href={KOFI_URL} onClick={() => track('kofi', { from: 'icons board' })} aria-label="Buy me a coffee"><CoffeeIcon /></a>
          <button className="ico" onClick={onShare} aria-label="Share this board"><ShareIcon /></button>
          {copied && <span className="toast">copied</span>}
        </span>
      </div>
      <h1 className={landing ? 'landing-h1' : undefined}>{landing ? landing.h1 : 'NBA Comparator'}</h1>
      {landing && leader && <p className="landing-line">{rowName(leader)} leads with {rowWords(leader, query)}.</p>}
      <Sentence query={query} ledger={L} bound={bound} onChange={change} />
      <p className="baserate">
        {!landing && <span className="sr-only">{queryWords(query, bound)}. </span>}
        Same point in the career, every {query.seq === 'teamGames' ? 'season' : 'career'} since {spanWords(since, since)}.
        {leader && <> The leader: <b>{leader.player.name}</b>, {leader.value.toLocaleString('en-US')}.</>}
        {!ready && <span className="dateline-upd"> loading…</span>}
      </p>
      {board
        ? <Board board={board} query={query} open={open} onOpen={openRow} panel={row && <Panel key={row.key} L={L} row={row} board={board} query={query} peerKey={vs} onPeer={setPeer} hasPage={pages?.has(row.player.id) ?? false} onClose={() => openRow(row.key)} />} />
        : <p className="loading">loading…</p>}
      <Landings current={landing?.slug ?? null} />
      <Notes ledger={L} />
      <footer>
        <a href="https://drewhoover.com/">drewhoover.com</a> · data rebuilt daily in season ·{' '}
        <a href="https://github.com/DrewHoo/nba-comparator">source & receipts</a> ·{' '}
        <a href={KOFI_URL} onClick={() => track('kofi', { from: 'footer' })}>buy me a coffee</a>
      </footer>
    </main>
  )
}

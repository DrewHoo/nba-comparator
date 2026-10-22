// The words a shared address carries: a board's title and description, a
// comparison's, a player page's, the share button's text, the rows a card
// draws. Pure, so the share worker (workers/share), the share button, the
// tab title, the prerender and the tests all say the same thing; the worker
// adds the data. The comparison itself (curves, crossings, the to-match
// line) is compare.ts; the record words are words.ts.
import { spanWords, type Ledger, type Pos } from './ledger.ts'
import type { Board, Query, Row } from './query.ts'
import { DEFAULT_QUERY, eraBound } from './query.ts'
import { compare, crossingWords, matchWords } from './compare.ts'
import type { RecordRow } from './records.ts'
import { statByKey } from './stats.ts'
import { POS_WORDS, eraWords, placeWords, queryWords, recordWords, rowName, rowWords, rankWords, seqWords, testsWords } from './words.ts'

export const SITE = 'NBA Comparator'

export interface ShareText { title: string; description: string }

const unitWords = (q: Query) => (q.seq === 'teamGames' ? 'player-seasons' : 'careers')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** the row's claim as one sentence: "Zion Williamson has 2,524 points through his first 100 games, 1st of 1,811 careers since 1993-94." */
export function claimWords(q: Query, board: Board, row: Row): string {
  const tail = row.complete && row.value != null ? `, ${rankWords(row, board.ranked.length)} ${unitWords(q)}${eraWords(eraBound(q, board))}` : row.value == null ? '' : ', still inside the window'
  return `${row.player.name} has ${rowWords(row, q)}${tail}.`
}

/** what the share button sends with the board's address: the open row's claim, else the sentence */
export const shareText = (q: Query, board: Board | null, row: Row | null) => (board && row ? claimWords(q, board, row) : `${cap(queryWords(q, board ? eraBound(q, board) : null))}.`)

/** whether the address says more than the root page does: any slot off its default, or a player open */
export function isShared(q: Query, open: string | null): boolean {
  if (open) return true
  const d = DEFAULT_QUERY
  return q.pos !== d.pos || q.stat !== d.stat || q.how !== d.how || q.n !== d.n || q.seq !== d.seq || q.scope !== d.scope || q.since !== d.since || q.dir !== d.dir || q.tests.length > 0
}

/** "Players with the most points through their first 100 games · NBA Comparator"; with a row open, "Victor Wembanyama vs Zion Williamson: most points through the first 100 games · NBA Comparator" */
export function shareTitle(q: Query, open: Row | null = null, peer: Row | null = null, bound: number | null = null): string {
  if (open) return `${rowName(open)}${peer ? ` vs ${rowName(peer)}` : ''}: ${cardHeading(q)} · ${SITE}`
  return `${cap(queryWords(q, bound))} · ${SITE}`
}

/** the description: the leader when the board is known; the open player's claim, read against his peer, when one is */
export function shareDescription(q: Query, L: Ledger | null, board: Board | null, open: Row | null, firstSeason: number, peer: Row | null = null): string {
  const unit = q.seq === 'teamGames' ? 'player-season' : 'career'
  const bound = board ? eraBound(q, board) : q.since
  const parts: string[] = []
  if (open) {
    parts.push(board ? claimWords(q, board, open) : `${open.player.name} has ${rowWords(open, q)}.`)
    if (peer && L) {
      if (peer.value != null) parts.push(`${rowName(peer)}: ${rowWords(peer, q)}.`)
      const cmp = compare(L, open, peer, q)
      if (cmp) {
        parts.push(cmp.xs[0] ? `${open.player.name} ${crossingWords(cmp.xs[0], peer, q)}.` : 'Their curves never met.')
        const m = matchWords(open, peer, cmp, q)
        if (m) parts.push(m)
      }
    }
  } else if (board?.ranked[0] && board.ranked[0].value != null) parts.push(`${rowName(board.ranked[0])} leads with ${rowWords(board.ranked[0], q)}.`)
  parts.push(`Every NBA ${unit}${eraWords(bound ?? firstSeason)} ranked at the same point: ${queryWords(q, bound)}. Open a row to read it against a peer.`)
  return parts.join(' ')
}

/** what the card's heading says: "MOST POINTS THROUGH THE FIRST 100 GAMES" */
export function cardHeading(q: Query): string {
  const stat = statByKey(q.stat)
  const win = q.seq === 'teamGames' ? `a team's first ${q.n} games` : `the first ${q.n} ${seqWords(q.seq, q.n)}`
  if (q.how === 'sum') return `${q.dir} ${stat.noun} through ${win}`
  if (q.how === 'reach') return `${q.dir === 'fewest' ? 'fastest' : 'slowest'} to ${q.n.toLocaleString('en-US')} ${stat.noun}`
  const t = testsWords(q.tests)
  if (q.how === 'every') return `${t} in each of ${win}`
  if (q.how === 'streak') return `longest streak of ${t} in ${win}`
  return `${q.dir} games of ${t} in ${win}`
}

export interface CardRow {
  rank: string
  name: string
  /** "2013-14 – 2016-17", or "thru 93" for a row still inside the window */
  span: string
  value: string
  /** the row still inside the window: the value in rust */
  live: boolean
  /** the open player's row */
  hi: boolean
}

/** the card's rows: the top of the board, with the open player's row in place of the last when he is further down */
export function cardRows(board: Board, q: Query, open: string | null, n = 6): CardRow[] {
  const all = [...board.ranked, ...board.onTheWay]
  const top = board.ranked.slice(0, n)
  const openRow = open ? all.find((r) => r.key === open) ?? null : null
  if (openRow && !top.includes(openRow)) top.splice(Math.max(0, Math.min(top.length, n - 1)), top.length >= n ? 1 : 0, openRow)
  const way = (r: Row) => r.season == null && !r.complete
  return top.map((r) => ({
    rank: r.complete && r.value != null ? `${r.tied ? 'T' : ''}${r.rank}` : '—',
    name: rowName(r),
    span: way(r) ? `thru ${r.reached}` : r.season != null ? (r.reached < q.n ? `all ${r.reached}` : `${r.reached} of ${q.n}`) : spanWords(r.from, r.to),
    value: r.value == null ? '—' : q.how === 'reach' ? `${r.value}` : r.value.toLocaleString('en-US'),
    live: way(r),
    hi: r.key === open,
  }))
}

// ---- a player page

/** the page's one line: his best row, else what the page is */
export function playerLead(name: string, pos: Pos | null, face: RecordRow | null | undefined, firstSeason: number): string {
  return face ? `${name}: ${recordWords(face)}, ${placeWords(face)}.` : `Every comparison ${name} leads among ${POS_WORDS[pos ?? 'ALL']} at the same point in the career${eraWords(firstSeason)}.`
}

/** a player page's head; the title is the fact people type: "LeBron James: every comparison he leads at the same point in a career · NBA Comparator" */
export function playerText(name: string, pos: Pos | null, face: RecordRow | null | undefined, firstSeason: number, site = SITE): ShareText {
  const lead = playerLead(name, pos, face, firstSeason)
  const rest = ` Every comparison he leads among ${POS_WORDS[pos ?? 'ALL']} at the same point in the career${eraWords(firstSeason)}.`
  return { title: `${name}: every comparison he leads at the same point in a career · ${site}`, description: face ? `${lead}${rest}` : lead }
}

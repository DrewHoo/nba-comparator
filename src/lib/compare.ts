// The comparison: an open row read against a peer. The panel and the share
// words (share.ts) both use it, so a shared link's description says what the
// panel shows. Pure: rows in, curves and words out. The same module as the
// NFL and WNBA Comparators', over the columnar ledger.
import type { Ledger } from './ledger.ts'
import { crossings, curve, toMatch, type Board, type Crossing, type Query, type Row } from './query.ts'
import { countWords, statByKey } from './stats.ts'
import { seqWords } from './words.ts'

/** the games ahead the "to match" line reads over */
export const K = 5

/** the peers a row can be read against: the rest of the board, forty at most */
export const peersOf = (board: Board, row: Row): Row[] => [...board.ranked, ...board.onTheWay].filter((r) => r.key !== row.key).slice(0, 40)

/** the peer a `vs` key names, else the first peer (the leader, or the next row) */
export const peerOf = (board: Board, row: Row, vs: string | null | undefined): Row | null => {
  const others = peersOf(board, row)
  return others.find((r) => r.key === vs) ?? others[0] ?? null
}

export interface Comparison {
  me: number[]
  them: number[]
  /** the last six crossings inside the window, latest first */
  xs: Crossing[]
  /** what the subject needs over the next K to match the peer there */
  match: { need: number; at: number } | null
  /** the chart's window */
  n: number
}

/** null for a player-season board or a test board: no curve to draw */
export function compare(L: Ledger, row: Row, peer: Row, q: Query): Comparison | null {
  if (q.seq === 'teamGames' || q.how === 'every' || q.how === 'count' || q.how === 'streak') return null
  const cq = q.how === 'reach' ? { ...q, how: 'sum' as const } : q
  const me = curve(L, row.player, cq), them = curve(L, peer.player, cq)
  const xs = crossings(me, them).filter((c) => c.n <= Math.max(q.n, me.length)).slice(-6).reverse()
  const match = q.how === 'sum' ? toMatch(me.slice(0, Math.max(row.reached, Math.min(me.length, q.n))), them, K) : null
  const n = q.how === 'reach' ? Math.max(row.value ?? 0, peer.value ?? 0) : q.n
  return { me, them, xs, match, n }
}

/** "passed Zion Williamson at game 46, 1,021 points" */
export const crossingWords = (c: Crossing, peer: Row, q: Query) => `${c.kind} ${peer.player.name} at ${seqWords(q.seq, 1)} ${c.n}, ${countWords(c.value, statByKey(q.stat))}`

/** "To match Zion Williamson's 2,524 points at game 100, Victor Wembanyama needs 313 points over his next 5 games." */
export function matchWords(row: Row, peer: Row, cmp: Comparison, q: Query): string | null {
  if (!cmp.match) return null
  const stat = statByKey(q.stat)
  const m = cmp.match
  return `To match ${peer.player.name}'s ${countWords(cmp.them[m.at - 1], stat)} at ${seqWords(q.seq, 1)} ${m.at}, ${row.player.name} needs ${countWords(Math.max(0, m.need), stat)} over his next ${K} ${seqWords(q.seq, K)}${m.need <= 0 ? ' (he is already past it)' : ''}.`
}

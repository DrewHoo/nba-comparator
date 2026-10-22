// The query engine. A query is the five slots of the sentence (who · did
// what · how much · over which games · against whom), and evaluating it over
// the ledger gives every entity a value at the window, ranked. Entities are
// careers (one row per player) unless the sequence is the team's games of a
// season, where they are player-seasons.
//
// The readings a factoid makes (rank, one of K, tied or passed a peer at the
// same ordinal, fastest to M, on track to match) are all functions of the
// rows this returns; `crossings` and `toMatch` below are the peer ones.
//
// A game is an index into the ledger's columns (src/lib/ledger.ts); a row's
// `games` are indexes. `queryCols` names the columns a query reads, so the
// page can load them before it evaluates.

import { F_POST, F_START, F_STARTKNOWN, ageAt, missingCols, type ColName, type Ledger, type Player, type Pos } from './ledger.ts'
import { statByKey, UNKNOWN, type Stat, type StatKey } from './stats.ts'

/** which games are counted, in order: a career's games, its starts, its seasons, or a season's games counted by the team's schedule */
export type Seq = 'games' | 'starts' | 'seasons' | 'teamGames'
/** how the per-game numbers add up over the window */
export type How = 'sum' | 'count' | 'every' | 'streak' | 'reach'
export type Scope = 'reg' | 'all'
export type Dir = 'most' | 'fewest'

/** a per-game test: the stat is at least `min` (and at most `max` when set; `min: 0, max: 0` reads "no turnovers") */
export interface Test { stat: StatKey; min: number; max?: number }

export interface Query {
  /** the field: every player or one position group */
  pos: Pos
  /** the stat a sum or a reach counts */
  stat: StatKey
  /** the per-game test a count, every or streak reads (a conjunction) */
  tests: Test[]
  how: How
  /** the window: the first n of the sequence; for `reach`, the target the stat has to reach */
  n: number
  seq: Seq
  scope: Scope
  /** the era: careers that began, or seasons played, in this season (by the year it ends) or later; null for the whole ledger */
  since: number | null
  dir: Dir
}

export const DEFAULT_QUERY: Query = { pos: 'ALL', stat: 'pts', tests: [], how: 'sum', n: 100, seq: 'games', scope: 'reg', since: null, dir: 'most' }

export interface Row {
  key: string
  player: Player
  /** the season, for a player-season entity */
  season: number | null
  value: number | null
  /** how far along the sequence the entity is (its games or starts so far, up to the window) */
  reached: number
  /** the entity has the whole window (or, for reach, got there) */
  complete: boolean
  /** every: the test held in every game of the window */
  all: boolean
  /** the window's games, as indexes into the ledger, for the panel */
  games: number[]
  /** the first and last season of the window */
  from: number
  to: number
  /** the team of a player-season */
  team: string | null
  /** the player's age at the window's last game; null without a birth date */
  age: number | null
  rank: number
  /** competition rank with ties: "T-3rd" */
  tied: boolean
}

export interface Board {
  /** entities with the whole window, ranked */
  ranked: Row[]
  /** entities still inside the window, by value */
  onTheWay: Row[]
  /** careers that sit out a starts field: a game nobody can name the starters of falls inside their window */
  gapped: number
  /** careers that sit out the career fields: they began before the ledger's first season */
  censored: number
  /** careers (or player-seasons) that began before the stat was recorded in every game, and sit out */
  early: number
  /** entities with a game inside the window where the stat wasn't recorded, and sit out */
  partial: number
  /** the first season of the ledger */
  first: number
  /** the era the data forces on this query: the ledger's first season, or the season its stat is recorded from */
  since: number
  /** the first season with the starter flag */
  startsSince: number
}

/** fixes a query the pickers can't make */
export function normalize(q: Query): Query {
  const out = { ...q }
  if (out.how === 'reach') out.seq = out.seq === 'seasons' || out.seq === 'teamGames' ? 'games' : out.seq
  if ((out.how === 'count' || out.how === 'every' || out.how === 'streak') && out.tests.length === 0) {
    const s = statByKey(out.stat)
    out.tests = [{ stat: s.key, min: s.thresholds[Math.min(1, s.thresholds.length - 1)] }]
  }
  if (out.n < 1) out.n = 1
  return out
}

/** the columns a query reads: its stat's, its tests', and the minutes when a clean-game test needs the floor */
export function queryCols(raw: Query): ColName[] {
  const q = normalize(raw)
  const out = new Set<ColName>()
  if (q.how === 'sum' || q.how === 'reach') for (const c of statByKey(q.stat).cols) out.add(c)
  else for (const t of q.tests) { for (const c of statByKey(t.stat).cols) out.add(c); if (t.max === 0) out.add('min') }
  return [...out]
}

/** the first season the query's stats are all recorded in every game: the era bound the words carry */
export function querySince(raw: Query): number {
  const q = normalize(raw)
  const stats = q.how === 'sum' || q.how === 'reach' ? [statByKey(q.stat)] : q.tests.map((t) => statByKey(t.stat))
  let since = Math.max(...stats.map((s) => s.since))
  if (q.how !== 'sum' && q.how !== 'reach' && q.tests.some((t) => t.max === 0)) since = Math.max(since, statByKey('min').since)
  return since
}

/** the era a board's words carry: the reader's, else the one the data forces when it is later than the ledger's start */
export const eraBound = (q: Query, board: Pick<Board, 'first' | 'since'>): number | null => q.since ?? (board.since > board.first ? board.since : null)

/** the minutes a game needs for a clean line (no turnovers, no fouls) to mean something */
export const PLAYED_MIN = 10

/** the player was on the floor long enough for a clean line to mean something: a two-minute cameo passes no clean test (and a game with no minutes recorded passes none) */
export const played = (L: Ledger, i: number): boolean => { const m = statByKey('min').read(L, i); return m >= PLAYED_MIN }

/** the per-game tests all hold; a test with max 0 ("no turnovers") also needs the game played; an unrecorded stat holds nothing */
export const holds = (L: Ledger, i: number, tests: Test[]): boolean =>
  tests.every((t) => { const v = statByKey(t.stat).read(L, i); return v >= t.min && (t.max == null || (v <= t.max && (t.max > 0 || played(L, i)))) })

/** every stat the tests read is recorded in the game */
export const known = (L: Ledger, i: number, tests: Test[]): boolean => tests.every((t) => statByKey(t.stat).read(L, i) !== UNKNOWN && (t.max !== 0 || statByKey('min').read(L, i) !== UNKNOWN))

const inScope = (L: Ledger, i: number, scope: Scope) => scope === 'all' || (L.flags[i] & F_POST) === 0
export const started = (L: Ledger, i: number) => (L.flags[i] & F_START) !== 0
export const startKnown = (L: Ledger, i: number) => (L.flags[i] & F_STARTKNOWN) !== 0

const inField = (p: Player, pos: Pos) => pos === 'ALL' || p.pos === pos

/** the sequence items of a career: games, starts, or seasons (each a list of game indexes) */
export function items(L: Ledger, p: Player, q: Pick<Query, 'seq' | 'scope'>): number[][] {
  const out: number[][] = []
  if (q.seq === 'seasons') {
    let cur: number[] | null = null, curSeason = -1
    for (let i = p.lo; i < p.hi; i++) {
      if (!inScope(L, i, q.scope)) continue
      if (L.season[i] !== curSeason) { curSeason = L.season[i]; cur = []; out.push(cur) }
      cur!.push(i)
    }
    return out
  }
  for (let i = p.lo; i < p.hi; i++) {
    if (!inScope(L, i, q.scope)) continue
    if (q.seq === 'starts' && !started(L, i)) continue
    out.push([i])
  }
  return out
}

function longestRun(flags: boolean[]): number {
  let best = 0, run = 0
  for (const f of flags) { run = f ? run + 1 : 0; if (run > best) best = run }
  return best
}

type Measure = Pick<Row, 'value' | 'reached' | 'complete' | 'all' | 'games'> & { partial?: boolean }
const PARTIAL: Measure = { value: null, reached: 0, complete: false, all: false, games: [], partial: true }

/** value, reached and completeness of one entity over its window; `partial` when a game inside it has no recorded value */
function measure(L: Ledger, seqItems: number[][], q: Query, stat: Stat, complete: boolean): Measure {
  if (q.how === 'reach') {
    let cum = 0
    for (let i = 0; i < seqItems.length; i++) {
      for (const g of seqItems[i]) { const v = stat.read(L, g); if (v === UNKNOWN) return PARTIAL; cum += v }
      if (cum >= q.n) return { value: i + 1, reached: i + 1, complete: true, all: false, games: seqItems.slice(0, i + 1).flat() }
    }
    return { value: null, reached: seqItems.length, complete: false, all: false, games: seqItems.flat() }
  }
  const win = seqItems.slice(0, q.n)
  const games = win.flat()
  const reached = win.length
  // a season window is complete once the season is over
  const done = complete && (q.seq !== 'seasons' || reached < q.n || (win[q.n - 1]?.[0] != null ? L.season[win[q.n - 1][0]] : 0) < L.currentSeason)
  if (q.how === 'sum') { let s = 0; for (const g of games) { const v = stat.read(L, g); if (v === UNKNOWN) return PARTIAL; s += v }; return { value: s, reached, complete: done, all: false, games } }
  for (const g of games) if (!known(L, g, q.tests)) return PARTIAL
  const flags = win.map((it) => it.some((g) => holds(L, g, q.tests)))
  const count = flags.filter(Boolean).length
  if (q.how === 'count') return { value: count, reached, complete: done, all: count === q.n, games }
  if (q.how === 'every') return { value: count, reached, complete: done, all: done && count === q.n, games }
  return { value: longestRun(flags), reached, complete: done, all: false, games }
}

/** the starts sequence can't be read: a game nobody can name the starters of comes before the window's last start (or anywhere, when the window isn't filled) */
function startsUnknown(L: Ledger, p: Player, q: Query, m: Pick<Row, 'complete' | 'games'>): boolean {
  if (q.seq !== 'starts') return false
  if (p.debut < L.startsSince) return true
  const end = m.complete ? L.date[m.games[m.games.length - 1]] : Infinity
  for (let i = p.lo; i < p.hi; i++) if (!startKnown(L, i) && L.date[i] <= end && inScope(L, i, q.scope)) return true
  return false
}

function rankRows(rows: Row[], dir: Dir): Row[] {
  const sign = dir === 'most' ? -1 : 1
  rows.sort((a, b) => sign * ((a.value ?? 0) - (b.value ?? 0)) || a.player.name.localeCompare(b.player.name))
  let rank = 0
  for (let i = 0; i < rows.length; i++) {
    if (i === 0 || rows[i].value !== rows[i - 1].value) rank = i + 1
    rows[i].rank = rank
  }
  for (let i = 0; i < rows.length; i++) rows[i].tied = (i > 0 && rows[i - 1].value === rows[i].value) || (i + 1 < rows.length && rows[i + 1].value === rows[i].value)
  return rows
}

/** every entity's row at the window, ranked */
export function evaluate(L: Ledger, raw: Query): Board {
  const q = normalize(raw)
  const missing = missingCols(L, queryCols(q))
  if (missing.length) throw new Error(`evaluate: columns not loaded: ${missing.join(', ')}`)
  const stat = statByKey(q.stat)
  const since = Math.max(L.firstSeason, querySince(q))
  const ranked: Row[] = []
  const onTheWay: Row[] = []
  let gapped = 0, censored = 0, early = 0, partial = 0
  const push = (r: Row) => { r.age = r.games.length ? ageAt(r.player.born, L.date[r.games[r.games.length - 1]]) : null; (r.complete && r.value != null ? ranked : onTheWay).push(r) }
  const blank = { rank: 0, tied: false, age: null }

  for (const p of L.players) {
    if (!inField(p, q.pos)) continue
    if (q.seq === 'teamGames') {
      // player-seasons: the window is the team's first n games of the season, counted on his first team's schedule
      let i = p.lo
      while (i < p.hi) {
        const season = L.season[i]
        const gs: number[] = []
        while (i < p.hi && L.season[i] === season) { if (inScope(L, i, q.scope)) gs.push(i); i++ }
        if (!gs.length) continue
        if (q.since != null && season < q.since) continue
        if (season < since) { early++; continue }
        const teamIdx = L.team[gs[0]]
        const team = L.teams[teamIdx]
        const own = gs.filter((g) => L.team[g] === teamIdx && L.tgn[g] <= q.n)
        if (own.some((g) => (q.how === 'sum' || q.how === 'reach' ? stat.read(L, g) === UNKNOWN : !known(L, g, q.tests)))) { partial++; continue }
        const playedN = L.teamGames[team]?.[season]?.[q.scope === 'reg' ? 0 : 1] ?? 0
        // a season that is over is whole: a 75-game 1959-60 fills an 82-game window (the words say "all 75 games")
        const complete = playedN >= q.n || (playedN > 0 && season < L.currentSeason)
        const reachedN = Math.min(playedN, q.n)
        if (q.how === 'reach') {
          let cum = 0, at: number | null = null
          for (const g of own) { cum += stat.read(L, g); if (cum >= q.n) { at = L.tgn[g]; break } }
          push({ key: `${p.id}:${season}`, player: p, season, value: at, reached: reachedN, complete: at != null, all: false, games: own, from: season, to: season, team, ...blank })
          continue
        }
        const flagsByTgn = new Array<boolean>(reachedN).fill(false)
        for (const g of own) if (L.tgn[g] >= 1 && L.tgn[g] <= reachedN) flagsByTgn[L.tgn[g] - 1] = holds(L, g, q.tests)
        const count = flagsByTgn.filter(Boolean).length
        let value: number
        if (q.how === 'sum') { value = 0; for (const g of own) value += stat.read(L, g) }
        else value = q.how === 'streak' ? longestRun(flagsByTgn) : count
        push({ key: `${p.id}:${season}`, player: p, season, value, reached: reachedN, complete, all: (q.how === 'every' || q.how === 'count') && complete && count === q.n, games: own, from: season, to: season, team, ...blank })
      }
      continue
    }
    // a career that began before the ledger has no first N games here
    if (p.censored) { censored++; continue }
    if (q.since != null && p.debut < q.since) continue
    if (p.debut < since) { early++; continue }
    const seqItems = items(L, p, q)
    if (seqItems.length === 0) { if (q.seq === 'starts' && p.debut < L.startsSince) gapped++; continue }
    const m = measure(L, seqItems, q, stat, seqItems.length >= q.n)
    if (m.partial) { partial++; continue }
    if (startsUnknown(L, p, q, m)) { gapped++; continue }
    const gs = m.games
    push({ key: p.id, player: p, season: null, ...m, from: gs.length ? L.season[gs[0]] : p.debut, to: gs.length ? L.season[gs[gs.length - 1]] : p.debut, team: null, ...blank })
  }
  // every: the count is the value, so the entities that held in every game lead the ranking
  return { ranked: rankRows(ranked, q.dir), onTheWay: rankRows(onTheWay, q.dir), gapped, censored, early, partial, first: L.firstSeason, since, startsSince: L.startsSince }
}

/** a career's cumulative curve of a stat over the sequence: cum[i] is the total through item i+1 */
export function curve(L: Ledger, p: Player, q: Query): number[] {
  const stat = statByKey(q.stat)
  const out: number[] = []
  let cum = 0
  for (const it of items(L, p, q)) { for (const g of it) cum += Math.max(0, stat.read(L, g)); out.push(cum) }
  return out
}

export interface Crossing { n: number; kind: 'tied' | 'passed' | 'fell behind'; value: number }

/** where a's curve meets b's: the ordinals where a ties b (entering a tie) or passes b (ahead after being level or behind) */
export function crossings(a: number[], b: number[]): Crossing[] {
  const out: Crossing[] = []
  const len = Math.min(a.length, b.length)
  let prev = 0
  for (let i = 0; i < len; i++) {
    const d = Math.sign(a[i] - b[i])
    if (d === 0 && prev !== 0) out.push({ n: i + 1, kind: 'tied', value: a[i] })
    else if (d > 0 && prev <= 0 && i > 0) out.push({ n: i + 1, kind: 'passed', value: a[i] })
    else if (d < 0 && prev >= 0 && i > 0) out.push({ n: i + 1, kind: 'fell behind', value: a[i] })
    prev = d
  }
  return out
}

/** what `a` needs over its next k items to match b's total at that ordinal; null when b's curve doesn't reach it */
export function toMatch(a: number[], b: number[], k: number): { need: number; at: number } | null {
  const at = a.length + k
  if (at > b.length) return null
  return { need: b[at - 1] - (a[a.length - 1] ?? 0), at }
}

/** the player's age at the last game of a window */
export function ageAtWindow(L: Ledger, r: Row): number | null {
  const g = r.games[r.games.length - 1]
  return g != null ? ageAt(r.player.born, L.date[g]) : null
}

/** the first and last season a player appears in */
export const careerSpan = (L: Ledger, p: Player): [number, number] => [L.season[p.lo], L.season[p.hi - 1]]
/** the player played in the running season */
export const isActive = (L: Ledger, p: Player): boolean => L.season[p.hi - 1] === L.currentSeason

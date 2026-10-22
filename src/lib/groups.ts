// The team pages: the best players of one position for one franchise ("the
// best Boston Celtics centers since 1946-47"), from the ledger. A page is a
// position's metrics, every qualifying player's regular-season totals for
// the franchise, ranked by the first metric, and the cumulative curve of
// each metric for its top few, drawn as one line per player. Pure: the
// prerender computes it once and embeds the result in the page, so the
// client needs no ledger. The College Football Comparator's group pages,
// over the 30 franchises.
//
// A franchise is the league's own lineage: the ledger keeps the code of the
// day (MNL, SEA, KCK…), and FRANCHISES folds each into the team that plays
// today. Teams that folded with no successor (the Anderson Packers, the
// first Baltimore Bullets, the Washington Capitols…) have no page.
import { F_POST, seasonWords, type Ledger, type Pos } from './ledger.ts'
import { statByKey, UNKNOWN, type StatKey } from './stats.ts'
import { POS_WORDS } from './words.ts'

export type GroupPos = Exclude<Pos, 'ALL'>

export interface Franchise {
  /** the address id: today's code, lower case */
  id: string
  name: string
  /** the ledger's codes for this franchise, oldest first */
  codes: string[]
  /** a line the page says about its lineage, where the record book needs one */
  note?: string
}

export const FRANCHISES: Franchise[] = [
  { id: 'atl', name: 'Atlanta Hawks', codes: ['TCB', 'MIH', 'STL', 'ATL'] },
  { id: 'bos', name: 'Boston Celtics', codes: ['BOS'] },
  { id: 'bkn', name: 'Brooklyn Nets', codes: ['NYN', 'NJN', 'BKN'] },
  { id: 'cha', name: 'Charlotte Hornets', codes: ['CHH', 'CHA'], note: 'The Hornets of 1988-89 to 2001-02 count here, as the NBA’s record book has had them since 2014; New Orleans’s page begins in 2002-03.' },
  { id: 'chi', name: 'Chicago Bulls', codes: ['CHI'] },
  { id: 'cle', name: 'Cleveland Cavaliers', codes: ['CLE'] },
  { id: 'dal', name: 'Dallas Mavericks', codes: ['DAL'] },
  { id: 'den', name: 'Denver Nuggets', codes: ['DEN'] },
  { id: 'det', name: 'Detroit Pistons', codes: ['FTW', 'DET'] },
  { id: 'gsw', name: 'Golden State Warriors', codes: ['PHW', 'SFW', 'GSW'] },
  { id: 'hou', name: 'Houston Rockets', codes: ['SDR', 'HOU'] },
  { id: 'ind', name: 'Indiana Pacers', codes: ['IND'] },
  { id: 'lac', name: 'LA Clippers', codes: ['BUF', 'SDC', 'LAC'] },
  { id: 'lal', name: 'Los Angeles Lakers', codes: ['MNL', 'LAL'] },
  { id: 'mem', name: 'Memphis Grizzlies', codes: ['VAN', 'MEM'] },
  { id: 'mia', name: 'Miami Heat', codes: ['MIA'] },
  { id: 'mil', name: 'Milwaukee Bucks', codes: ['MIL'] },
  { id: 'min', name: 'Minnesota Timberwolves', codes: ['MIN'] },
  { id: 'nop', name: 'New Orleans Pelicans', codes: ['NOH', 'NOP'], note: 'The New Orleans Hornets of 2002-03 to 2012-13 count here, the two seasons in Oklahoma City included; the Charlotte Hornets before them are on Charlotte’s page.' },
  { id: 'nyk', name: 'New York Knicks', codes: ['NYK'] },
  { id: 'okc', name: 'Oklahoma City Thunder', codes: ['SEA', 'OKC'] },
  { id: 'orl', name: 'Orlando Magic', codes: ['ORL'] },
  { id: 'phi', name: 'Philadelphia 76ers', codes: ['SYR', 'PHI'] },
  { id: 'phx', name: 'Phoenix Suns', codes: ['PHX'] },
  { id: 'por', name: 'Portland Trail Blazers', codes: ['POR'] },
  { id: 'sac', name: 'Sacramento Kings', codes: ['ROC', 'CIN', 'KCK', 'SAC'] },
  { id: 'sas', name: 'San Antonio Spurs', codes: ['SAS'] },
  { id: 'tor', name: 'Toronto Raptors', codes: ['TOR'] },
  { id: 'uta', name: 'Utah Jazz', codes: ['NOJ', 'UTA'] },
  { id: 'was', name: 'Washington Wizards', codes: ['CHP', 'CHZ', 'BLT', 'CAP', 'WSB', 'WAS'] },
]

/** the names a franchise played under before today's, for the page's line */
export const FORMER: Record<string, string> = {
  TCB: 'Tri-Cities Blackhawks', MIH: 'Milwaukee Hawks', STL: 'St. Louis Hawks', NYN: 'New York Nets', NJN: 'New Jersey Nets',
  FTW: 'Fort Wayne Pistons', PHW: 'Philadelphia Warriors', SFW: 'San Francisco Warriors', SDR: 'San Diego Rockets',
  BUF: 'Buffalo Braves', SDC: 'San Diego Clippers', MNL: 'Minneapolis Lakers', VAN: 'Vancouver Grizzlies', NOH: 'New Orleans Hornets',
  SEA: 'Seattle SuperSonics', SYR: 'Syracuse Nationals', ROC: 'Rochester Royals', CIN: 'Cincinnati Royals', KCK: 'Kansas City Kings',
  NOJ: 'New Orleans Jazz', CHP: 'Chicago Packers', CHZ: 'Chicago Zephyrs', BLT: 'Baltimore Bullets', CAP: 'Capital Bullets', WSB: 'Washington Bullets',
}

/** WSB is the Washington Bullets from 1974-75 and, before 1951-52, the Washington Capitols, who folded */
const WSB_FROM = 1975

export const franchiseById = (id: string): Franchise | null => FRANCHISES.find((f) => f.id === id) ?? null

/** per team index of the ledger, the franchise's index in FRANCHISES, or -1 */
function franchiseIndex(L: Pick<Ledger, 'teams'>): Int8Array {
  const out = new Int8Array(L.teams.length).fill(-1)
  L.teams.forEach((code, t) => { out[t] = FRANCHISES.findIndex((f) => f.codes.includes(code)) })
  return out
}

/** the position's metrics, the first the one the page ranks by */
export const GROUP_METRICS: Record<GroupPos, StatKey[]> = {
  G: ['pts', 'ast', 'tpm'],
  F: ['pts', 'reb', 'ast'],
  C: ['pts', 'reb', 'blk'],
}
export const GROUP_POS: GroupPos[] = ['G', 'F', 'C']

/** the position's slug in a page's address */
export const POS_SLUG: Record<GroupPos, string> = { G: 'guards', F: 'forwards', C: 'centers' }
export const posFromSlug = (slug: string): GroupPos | null => (Object.entries(POS_SLUG).find(([, s]) => s === slug)?.[0] as GroupPos | undefined) ?? null

/** how many curves a chart draws */
export const CURVES = 8
/** regular-season games a player needs for the franchise to be listed: a season's worth */
export const MIN_GAMES = 82
/** a total shows where the box score has the stat in this share of his games or more; it is the sum of those games, marked */
export const KNOWN_SHARE = 0.9
/** a curve keeps at most this many points; a longer one is sampled every `step` games */
export const CURVE_POINTS = 240

export interface GroupRow {
  id: string
  name: string
  from: number
  to: number
  games: number
  /** per metric, the total over his games for the franchise; null where too many of them lack the stat */
  totals: (number | null)[]
  /** per metric, the games whose box lacks the stat (the total is the rest) */
  missing: number[]
  /** per metric, the cumulative value every `step` games and at his last, for the rows a chart draws */
  curves?: (number[] | null)[]
  /** he has a player page */
  page?: boolean
}

export interface GroupData {
  id: string
  name: string
  pos: GroupPos
  metrics: StatKey[]
  /** the franchise's first season in the ledger */
  since: number
  currentSeason: number
  /** the games between a curve's points */
  step: number
  /** the franchise's earlier names */
  former: string[]
  note: string | null
  /** every qualifying player, ranked by the first metric */
  rows: GroupRow[]
}

const fmt = (n: number) => n.toLocaleString('en-US')

/** the page's data for one franchise and position */
export function groupData(L: Ledger, f: Franchise, pos: GroupPos, { top = CURVES, minGames = MIN_GAMES } = {}): GroupData {
  const fi = FRANCHISES.indexOf(f)
  const index = franchiseIndex(L)
  const wsb = L.teams.indexOf('WSB')
  const metrics = GROUP_METRICS[pos]
  const reads = metrics.map((k) => statByKey(k).read)
  const rows: (GroupRow & { gs: number[] })[] = []
  let since = Infinity
  for (let i = 0; i < L.n; i++) if (index[L.team[i]] === fi && L.season[i] < since && !(L.team[i] === wsb && L.season[i] < WSB_FROM)) since = L.season[i]
  for (const p of L.players) {
    if (p.pos !== pos) continue
    const gs: number[] = []
    for (let i = p.lo; i < p.hi; i++) {
      const t = L.team[i]
      if (index[t] !== fi || (L.flags[i] & F_POST) !== 0 || (t === wsb && L.season[i] < WSB_FROM)) continue
      gs.push(i)
    }
    if (gs.length < minGames) continue
    const missing = metrics.map(() => 0)
    const sums = metrics.map(() => 0)
    for (const i of gs) for (let m = 0; m < metrics.length; m++) { const v = reads[m](L, i); if (v === UNKNOWN) missing[m]++; else sums[m] += v }
    const totals = sums.map((s, m) => (missing[m] <= gs.length * (1 - KNOWN_SHARE) ? s : null))
    rows.push({ id: p.id, name: p.name, from: L.season[gs[0]], to: L.season[gs[gs.length - 1]], games: gs.length, totals, missing, gs })
  }
  rows.sort((a, b) => (b.totals[0] ?? -Infinity) - (a.totals[0] ?? -Infinity) || b.games - a.games || a.name.localeCompare(b.name))
  const longest = Math.max(1, ...rows.map((r) => r.games))
  const step = Math.max(1, Math.ceil(longest / CURVE_POINTS))
  // each chart draws the top of its own metric, so the rebounds chart has the rebounders
  const drawn = metrics.map((_, m) => new Set(rows.filter((r) => r.totals[m] != null).sort((a, b) => (b.totals[m] ?? 0) - (a.totals[m] ?? 0)).slice(0, top)))
  for (const r of rows) {
    if (!drawn.some((s) => s.has(r))) continue
    r.curves = metrics.map((_, m) => {
      if (!drawn[m].has(r)) return null
      const out: number[] = []
      let cum = 0
      r.gs.forEach((i, k) => { cum += Math.max(0, reads[m](L, i)); if ((k + 1) % step === 0 || k === r.gs.length - 1) out.push(cum) })
      return out
    })
  }
  return {
    id: f.id, name: f.name, pos, metrics, since: Number.isFinite(since) ? since : L.firstSeason, currentSeason: L.currentSeason, step,
    former: f.codes.filter((c) => FORMER[c]).map((c) => FORMER[c]), note: f.note ?? null,
    rows: rows.map(({ gs, ...r }) => r),
  }
}

/** the game a curve's point k stands at */
export const gameAt = (d: Pick<GroupData, 'step'>, r: Pick<GroupRow, 'games'>, k: number) => Math.min(r.games, (k + 1) * d.step)

export const groupPath = (id: string, pos: GroupPos): string => `/team/${id}/${POS_SLUG[pos]}/`

/** "The best Boston Celtics centers since 1946-47" */
export const groupH1 = (d: Pick<GroupData, 'name' | 'pos' | 'since'>): string => `The best ${d.name} ${POS_WORDS[d.pos]} since ${seasonWords(d.since)}`
/** "Best Boston Celtics centers of all time (since 1946-47) · NBA Comparator" */
export const groupTitle = (d: Pick<GroupData, 'name' | 'pos' | 'since'>, site: string): string => `Best ${d.name} ${POS_WORDS[d.pos]} of all time (since ${seasonWords(d.since)}) · ${site}`

/** "Bill Russell leads with 14,522 points in 963 games for the Boston Celtics; Robert Parish had 18,245." */
export function groupLead(d: GroupData): string {
  const stat = statByKey(d.metrics[0])
  const [a, b] = d.rows
  if (!a || a.totals[0] == null) return ''
  return `${a.name} leads with ${fmt(a.totals[0])} ${stat.noun} in ${fmt(a.games)} games for the ${d.name}${b && b.totals[0] != null ? `; ${b.name} had ${fmt(b.totals[0])}` : ''}.`
}

/** "points, rebounds and blocks" */
export const metricsWords = (metrics: StatKey[]) => { const n = metrics.map((k) => statByKey(k).noun); return n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}` : n[0] }

export function groupDescription(d: GroupData): string {
  const stat = statByKey(d.metrics[0])
  return `${groupLead(d)} Every ${POS_WORDS[d.pos].replace(/s$/, '')} with ${MIN_GAMES} or more regular-season games for the ${d.name} since ${seasonWords(d.since)}, ranked by ${stat.noun}, with each player's ${metricsWords(d.metrics)} drawn game by game.`.replace(/\s+/g, ' ').trim()
}

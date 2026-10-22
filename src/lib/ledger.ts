// The ledger: per player, every game he appeared in, in order, from hoopR's
// ESPN box scores (1993-94 on) with NBA Stats filling what ESPN lacks.
// scripts/build-ledger.mjs writes it in columns: src/data/ledger.json holds
// the players, each with its slice [lo, lo+n) of the game arrays, and
// src/data/cols/<name>.bin.gz one gzipped typed array per column over every
// game. This decodes them. A game is an index into the columns, never an
// object: a million player-games as objects would cost a phone two hundred
// megabytes, and the page loads only the stat columns a query reads
// (`hasCols`, `missingCols`), the base columns first.

/** the field: every player, or one position group */
export type Pos = 'ALL' | 'G' | 'F' | 'C'
export const POSITIONS: Pos[] = ['ALL', 'G', 'F', 'C']

/** the stat columns, one byte a game each; the builder writes them in this order */
export const STAT_COLS = ['min', 'pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'oreb', 'dreb', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf'] as const
export type StatCol = (typeof STAT_COLS)[number]
/** the columns every query reads: the date, the flags, the team, the team's game number */
export const BASE_COLS = ['day', 'season', 'flags', 'team', 'tgn'] as const
export type ColName = StatCol | 'day' | 'season' | 'flags' | 'team' | 'opp' | 'tgn'

// the flags column's bits
export const F_POST = 1, F_HOME = 2, F_START = 4, F_STARTKNOWN = 8, F_WIN = 16

export interface Player {
  id: string
  name: string
  /** YYYY-MM-DD or null */
  born: string | null
  /** the season (by the year it ends) of his first game in the ledger */
  debut: number
  /** the career began before the ledger's first season: it has no first N games here, and sits out the career fields */
  censored: boolean
  /** the position group; null when no source has one */
  pos: Exclude<Pos, 'ALL'> | null
  /** where the position came from: ESPN, or the NBA Stats roster */
  posSrc: 'espn' | 'roster' | null
  /** his games are the indexes [lo, hi) of the columns */
  lo: number
  hi: number
}

export interface Ledger {
  builtAt: string
  firstSeason: number
  currentSeason: number
  /** the first season with a starter flag; the starts sequence begins here */
  startsSince: number
  /** games in the columns */
  n: number
  players: Player[]
  teams: string[]
  /** team -> season -> [regular-season games played, all games played] */
  teamGames: Record<string, Record<string, [number, number]>>
  /** YYYYMMDD of each game, from the day column */
  date: Int32Array
  /** the season each game belongs to, by the year it ends (the column holds it less 1900) */
  season: Uint16Array
  flags: Uint8Array
  team: Uint8Array
  tgn: Uint8Array
  /** the opponent, loaded for the panel's ledger */
  opp?: Uint8Array
  /** the stat columns loaded so far */
  col: Partial<Record<StatCol, Uint8Array>>
}

export interface LedgerFile {
  v: number
  builtAt: string
  firstSeason: number
  currentSeason: number
  startsSince: number
  n: number
  cols: Record<string, 'u8' | 'u16'>
  teams: string[]
  teamGames: Record<string, Record<string, [number, number]>>
  players: { id: string; name: string; born: string | null; debut: number; cen: 0 | 1; pos: Exclude<Pos, 'ALL'> | null; src: 'espn' | 'roster' | null; lo: number; n: number }[]
}

export type ColBytes = ArrayBuffer | Uint8Array

const bytes = (b: ColBytes): Uint8Array => (b instanceof Uint8Array ? b : new Uint8Array(b))
const u16 = (b: ColBytes): Uint16Array => { const u = bytes(b); return u.byteOffset % 2 === 0 ? new Uint16Array(u.buffer, u.byteOffset, u.byteLength / 2) : new Uint16Array(u.slice().buffer) }

/** a stat nobody recorded that game (steals before 1973-74, minutes before 1951-52): the builder writes this byte */
export const UNK = 255

const EPOCH = Date.UTC(1946, 0, 1)
/** YYYYMMDD of a day count since 1946-01-01 */
export function dateOfDay(day: number): number {
  const d = new Date(EPOCH + day * 86_400_000)
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

/** the ledger from its file and the base columns (and any stat columns already in hand) */
export function decodeLedger(file: LedgerFile, cols: Partial<Record<ColName, ColBytes>>): Ledger {
  if (file.v !== 3) throw new Error(`ledger v${file.v}, expected v3`)
  for (const k of BASE_COLS) if (!cols[k]) throw new Error(`ledger: column ${k} missing`)
  const n = file.n
  const day = u16(cols.day!)
  if (day.length !== n) throw new Error(`ledger: day has ${day.length} games, expected ${n}`)
  const date = new Int32Array(n), season = new Uint16Array(n)
  const seasonCol = bytes(cols.season!)
  // a day repeats across players, so each distinct day is converted once
  let lastDay = -1, lastDate = 0
  for (let i = 0; i < n; i++) {
    const d = day[i]
    if (d !== lastDay) { lastDay = d; lastDate = dateOfDay(d) }
    date[i] = lastDate
    season[i] = seasonCol[i] + 1900
  }
  const L: Ledger = {
    builtAt: file.builtAt, firstSeason: file.firstSeason, currentSeason: file.currentSeason, startsSince: file.startsSince, n,
    players: file.players.map((p) => ({ id: p.id, name: p.name, born: p.born, debut: p.debut, censored: p.cen === 1, pos: p.pos, posSrc: p.src, lo: p.lo, hi: p.lo + p.n })),
    teams: file.teams, teamGames: file.teamGames,
    date, season, flags: bytes(cols.flags!), team: bytes(cols.team!), tgn: bytes(cols.tgn!), col: {},
  }
  for (const k of Object.keys(cols) as ColName[]) if (!(BASE_COLS as readonly string[]).includes(k)) attachCol(L, k, cols[k]!)
  return L
}

/** a column that arrived after decoding */
export function attachCol(L: Ledger, name: ColName, data: ColBytes): void {
  const u = bytes(data)
  if (u.length !== L.n) throw new Error(`ledger: ${name} has ${u.length} games, expected ${L.n}`)
  if (name === 'opp') L.opp = u
  else if ((STAT_COLS as readonly string[]).includes(name)) L.col[name as StatCol] = u
}

export const hasCols = (L: Ledger, names: Iterable<ColName>): boolean => [...names].every((k) => (BASE_COLS as readonly string[]).includes(k) || (k === 'opp' ? !!L.opp : !!L.col[k as StatCol]))
export const missingCols = (L: Ledger, names: Iterable<ColName>): ColName[] => [...new Set(names)].filter((k) => !hasCols(L, [k]))

/** one game as an object, for a ledger listing or a test: the engine never builds these */
export interface Game {
  season: number
  post: boolean
  date: number
  home: boolean
  team: string
  opp: string
  /** ESPN's starter flag; null when nobody could say who started that team-game */
  started: boolean | null
  /** 2 won, 0 lost */
  result: number
  /** the team's game number that season, regular season then postseason */
  tgn: number
  min: number; pts: number; fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number
  oreb: number; dreb: number; reb: number; ast: number; stl: number; blk: number; tov: number; pf: number
}
export function gameAt(L: Ledger, i: number): Game {
  const f = L.flags[i]
  const g = {
    season: L.season[i], post: (f & F_POST) !== 0, date: L.date[i], home: (f & F_HOME) !== 0,
    team: L.teams[L.team[i]] ?? '?', opp: L.opp ? L.teams[L.opp[i]] ?? '?' : '?',
    started: (f & F_STARTKNOWN) === 0 ? null : (f & F_START) !== 0, result: (f & F_WIN) !== 0 ? 2 : 0, tgn: L.tgn[i],
  } as Game
  for (const k of STAT_COLS) g[k] = L.col[k]?.[i] ?? 0
  return g
}

/** whole years between a birth date and a YYYYMMDD game date; null without a birth date */
export function ageAt(born: string | null, date: number): number | null {
  if (!born) return null
  const by = Number(born.slice(0, 4)), bm = Number(born.slice(5, 7)), bd = Number(born.slice(8, 10))
  const y = Math.floor(date / 10000), m = Math.floor(date / 100) % 100, d = date % 100
  let age = y - by
  if (m < bm || (m === bm && d < bd)) age--
  return age
}

/** "Sep 7, 2017" from a YYYYMMDD */
export function fmtDate(date: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[Math.floor(date / 100) % 100 - 1]} ${date % 100}, ${Math.floor(date / 10000)}`
}

/** "1993-94" from the year a season ends in */
export const seasonWords = (season: number): string => `${season - 1}-${String(season % 100).padStart(2, '0')}`
/** "1993-94 – 2026-27", or one season */
export const spanWords = (from: number, to: number): string => (from === to ? seasonWords(from) : `${seasonWords(from)} – ${seasonWords(to)}`)

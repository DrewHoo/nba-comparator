// The stat catalog: what a game can be counted by. Each stat reads one game
// of the ledger by index, from the columns it names (`cols`), so the page can
// load a query's columns and no others. A read is UNKNOWN (-1) where nobody
// recorded the stat that game (steals before 1973-74, minutes before
// 1951-52); `since` is the first season the stat is recorded in every game,
// the era bound the words carry. `noun` is how a sum reads ("31,021
// points"), a test how a per-game threshold reads ("30+ points"). Every stat
// is every position's; the position is a filter on the field, not on the
// catalog.

import { F_WIN, UNK, type Ledger, type StatCol } from './ledger.ts'

export type StatKey =
  | 'win' | 'loss'
  | 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'tov'
  | 'tpm' | 'tpa' | 'fgm' | 'fga' | 'ftm' | 'fta' | 'ftmiss' | 'oreb' | 'dreb' | 'pf' | 'min'
  | 'dd' | 'td' | 'fx5' | 'stocks' | 'pra'

/** a stat nobody recorded that game */
export const UNKNOWN = -1

export interface Stat {
  key: StatKey
  /** plural noun for a total: "points" */
  noun: string
  /** singular for a count of 1: "point" */
  one: string
  /** the columns the read needs */
  cols: StatCol[]
  /** the first season (by its end year) the stat is in every game's box; earlier careers sit out its fields */
  since: number
  read: (L: Ledger, i: number) => number
  /** the per-game thresholds the test picker offers */
  thresholds: number[]
}

// where the box score fills in: points, field goals and free throws from the
// start; fouls from 1951-52; field-goal attempts and rebounds for nearly
// every game from 1969-70; assists from 1975-76; threes from 1979-80; minutes,
// offensive and defensive rebounds, steals, blocks and turnovers for every
// game from 1983-84 (tracked from 1973-74 and 1977-78, but with holes)
const FROM_START = 1947, PF = 1952, FGA = 1970, REB = 1970, AST = 1976, THREES = 1980, FULL_BOX = 1984

const S = (key: StatKey, noun: string, one: string, cols: StatCol[], since: number, read: (L: Ledger, i: number) => number, thresholds: number[]): Stat => ({ key, noun, one, cols, since, read, thresholds })
const val = (L: Ledger, k: StatCol, i: number) => { const v = L.col[k]![i]; return v === UNK ? UNKNOWN : v }
const C = (k: StatCol) => (L: Ledger, i: number) => val(L, k, i)
const FIVE: StatCol[] = ['pts', 'reb', 'ast', 'stl', 'blk']

/** how many of the five counting stats reached `at`: a double-double or triple-double counts the tracked stats, as the record books do (Oscar's are points, rebounds and assists), so unrecorded steals and blocks count as none, while unrecorded points, rebounds or assists make the game unknown */
function reached(L: Ledger, i: number, at: number, need: number): number {
  let n = 0, unknown = false
  for (const k of FIVE) { const v = L.col[k]![i]; if (v === UNK) { if (k !== 'stl' && k !== 'blk') unknown = true } else if (v >= at) n++ }
  if (n >= need) return 1
  return unknown ? UNKNOWN : 0
}
/** all five known and at `at` or more: a 5×5 needs the steals and blocks recorded */
function allFive(L: Ledger, i: number, at: number): number {
  for (const k of FIVE) { const v = L.col[k]![i]; if (v === UNK) return UNKNOWN; if (v < at) return 0 }
  return 1
}
const sum = (L: Ledger, i: number, ks: StatCol[]) => { let s = 0; for (const k of ks) { const v = L.col[k]![i]; if (v === UNK) return UNKNOWN; s += v }; return s }

export const STATS: Stat[] = [
  S('win', 'wins', 'win', [], FROM_START, (L, i) => ((L.flags[i] & F_WIN) !== 0 ? 1 : 0), [1]),
  S('loss', 'losses', 'loss', [], FROM_START, (L, i) => ((L.flags[i] & F_WIN) === 0 ? 1 : 0), [1]),
  S('pts', 'points', 'point', ['pts'], FROM_START, C('pts'), [10, 20, 25, 30, 40, 50]),
  S('reb', 'rebounds', 'rebound', ['reb'], REB, C('reb'), [10, 15, 20, 25]),
  S('ast', 'assists', 'assist', ['ast'], AST, C('ast'), [5, 10, 15, 20]),
  S('stl', 'steals', 'steal', ['stl'], FULL_BOX, C('stl'), [3, 4, 5, 6]),
  S('blk', 'blocks', 'block', ['blk'], FULL_BOX, C('blk'), [3, 4, 5, 7]),
  S('tpm', '3-pointers made', '3-pointer made', ['tpm'], THREES, C('tpm'), [3, 5, 7, 10]),
  S('tpa', '3-point attempts', '3-point attempt', ['tpa'], THREES, C('tpa'), [10, 15, 20]),
  S('fgm', 'field goals made', 'field goal made', ['fgm'], FROM_START, C('fgm'), [10, 15, 20]),
  S('fga', 'field goal attempts', 'field goal attempt', ['fga'], FGA, C('fga'), [20, 25, 30]),
  S('ftm', 'free throws made', 'free throw made', ['ftm'], FROM_START, C('ftm'), [10, 15, 20]),
  S('fta', 'free throw attempts', 'free throw attempt', ['fta'], FROM_START, C('fta'), [10, 15, 20]),
  S('ftmiss', 'missed free throws', 'missed free throw', ['fta', 'ftm'], FROM_START, (L, i) => { const a = val(L, 'fta', i), m = val(L, 'ftm', i); return a < 0 || m < 0 ? UNKNOWN : a - m }, [0, 5, 8, 10]),
  S('oreb', 'offensive rebounds', 'offensive rebound', ['oreb'], FULL_BOX, C('oreb'), [5, 8, 10]),
  S('dreb', 'defensive rebounds', 'defensive rebound', ['dreb'], FULL_BOX, C('dreb'), [10, 12, 15]),
  S('tov', 'turnovers', 'turnover', ['tov'], FULL_BOX, C('tov'), [0, 1, 5, 8]),
  S('pf', 'fouls', 'foul', ['pf'], PF, C('pf'), [0, 5, 6]),
  S('min', 'minutes', 'minute', ['min'], FULL_BOX, C('min'), [30, 36, 40, 45]),
  S('dd', 'double-doubles', 'double-double', FIVE, AST, (L, i) => reached(L, i, 10, 2), [1]),
  S('td', 'triple-doubles', 'triple-double', FIVE, AST, (L, i) => reached(L, i, 10, 3), [1]),
  S('fx5', '5×5 games', '5×5 game', FIVE, FULL_BOX, (L, i) => allFive(L, i, 5), [1]),
  S('stocks', 'steals + blocks', 'steal or block', ['stl', 'blk'], FULL_BOX, (L, i) => sum(L, i, ['stl', 'blk']), [5, 6, 8, 10]),
  S('pra', 'points + rebounds + assists', 'point, rebound or assist', ['pts', 'reb', 'ast'], AST, (L, i) => sum(L, i, ['pts', 'reb', 'ast']), [30, 40, 50, 60]),
]

export const statByKey = (key: StatKey): Stat => {
  const s = STATS.find((x) => x.key === key)
  if (!s) throw new Error(`no stat ${key}`)
  return s
}

/** a count stat: a game either has one or doesn't, so its only test is "a double-double" */
export const isUnit = (s: Stat) => s.thresholds.length === 1 && s.thresholds[0] === 1

/** the words of a count: "1 win", "115 wins", "31,021 points" */
export function countWords(n: number, stat: Stat): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? stat.one : stat.noun}`
}

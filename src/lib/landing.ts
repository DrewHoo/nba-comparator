// The named boards: a curated set of queries, each at its own path
// (/fastest-to-10000-points/), prerendered as the board on that query with
// an h1 and a title worded the way people search for it, a lead sentence
// with the leader, and an ItemList of the top ten. The board is the same
// board; the path is the query's canonical address, so a board that reaches
// one of these queries by any route writes the path (url.ts `hrefOf`), and
// a path with a query string on top (?t=, ?n=) reads as the landing's query
// with that on top (`parseAddress`). Pure: strings and queries only, so the
// prerender and the share worker can import it. The default query is the
// root page and must not appear here (landing.test pins it).

import { seasonWords } from './ledger.ts'
import { DEFAULT_QUERY, normalize, type Query } from './query.ts'

export interface Landing {
  slug: string
  query: Query
  /** the h1: the phrase people search with */
  h1: string
  /** the <title> before the era and the site's name; the h1 when empty */
  title?: string
}

const Q = (patch: Partial<Query>): Query => normalize({ ...DEFAULT_QUERY, ...patch })
const L = (slug: string, patch: Partial<Query>, h1: string, title?: string): Landing => ({ slug, query: Q(patch), h1, title })

export const LANDINGS: Landing[] = [
  // career windows
  L('most-points-through-500-games', { n: 500 }, 'Most points through the first 500 games of an NBA career'),
  L('most-points-through-1000-games', { n: 1000 }, 'Most points through the first 1,000 games of an NBA career'),
  L('most-rebounds-through-100-games', { stat: 'reb' }, 'Most rebounds through the first 100 games of an NBA career'),
  L('most-assists-through-100-games', { stat: 'ast' }, 'Most assists through the first 100 games of an NBA career'),
  L('most-steals-through-100-games', { stat: 'stl' }, 'Most steals through the first 100 games of an NBA career'),
  L('most-blocks-through-100-games', { stat: 'blk' }, 'Most blocks through the first 100 games of an NBA career'),
  L('most-3-pointers-through-100-games', { stat: 'tpm' }, 'Most 3-pointers through the first 100 games of an NBA career'),
  L('most-triple-doubles-through-500-games', { stat: 'td', n: 500 }, 'Most triple-doubles through the first 500 games of an NBA career'),
  L('most-wins-through-100-starts', { stat: 'win', seq: 'starts' }, 'Most wins through the first 100 starts of an NBA career'),
  L('most-points-through-5-seasons', { seq: 'seasons', n: 5 }, 'Most points through the first five NBA seasons'),
  // milestones
  L('fastest-to-10000-points', { how: 'reach', n: 10000, dir: 'fewest' }, 'Fastest to 10,000 points in NBA history', 'Fastest to 10,000 points: fewest games, every NBA career'),
  L('fastest-to-20000-points', { how: 'reach', n: 20000, dir: 'fewest' }, 'Fastest to 20,000 points in NBA history', 'Fastest to 20,000 points: fewest games, every NBA career'),
  L('fastest-to-30000-points', { how: 'reach', n: 30000, dir: 'fewest' }, 'Fastest to 30,000 points in NBA history', 'Fastest to 30,000 points: fewest games, every NBA career'),
  L('fastest-to-1000-3-pointers', { how: 'reach', stat: 'tpm', n: 1000, dir: 'fewest' }, 'Fastest to 1,000 3-pointers in NBA history', 'Fastest to 1,000 three-pointers: fewest games'),
  L('fastest-to-5000-assists', { how: 'reach', stat: 'ast', n: 5000, dir: 'fewest' }, 'Fastest to 5,000 assists in NBA history', 'Fastest to 5,000 assists: fewest games'),
  L('fastest-to-10000-rebounds', { how: 'reach', stat: 'reb', n: 10000, dir: 'fewest' }, 'Fastest to 10,000 rebounds in NBA history', 'Fastest to 10,000 rebounds: fewest games'),
  // seasons (a finished season fills the 82-game window)
  L('most-points-in-a-season', { seq: 'teamGames', n: 82 }, 'Most points in a single NBA season', 'Most points in an NBA season, every season'),
  L('most-triple-doubles-in-a-season', { stat: 'td', seq: 'teamGames', n: 82 }, 'Most triple-doubles in a single NBA season', 'Most triple-doubles in an NBA season, every season'),
  L('most-double-doubles-in-a-season', { stat: 'dd', seq: 'teamGames', n: 82 }, 'Most double-doubles in a single NBA season', 'Most double-doubles in an NBA season, every season'),
  L('most-minutes-in-a-season', { stat: 'min', seq: 'teamGames', n: 82 }, 'Most minutes played in a single NBA season'),
  L('most-turnovers-in-a-season', { stat: 'tov', seq: 'teamGames', n: 82 }, 'Most turnovers in a single NBA season'),
  L('most-missed-free-throws-in-a-season', { stat: 'ftmiss', seq: 'teamGames', n: 82 }, 'Most missed free throws in a single NBA season'),
  // rookie seasons: the first season of a career
  L('most-points-in-a-rookie-season', { seq: 'seasons', n: 1 }, 'Most points in an NBA rookie season'),
  L('most-rebounds-in-a-rookie-season', { stat: 'reb', seq: 'seasons', n: 1 }, 'Most rebounds in an NBA rookie season'),
  L('most-assists-in-a-rookie-season', { stat: 'ast', seq: 'seasons', n: 1 }, 'Most assists in an NBA rookie season'),
  L('most-blocks-in-a-rookie-season', { stat: 'blk', seq: 'seasons', n: 1 }, 'Most blocks in an NBA rookie season'),
  L('most-3-pointers-in-a-rookie-season', { stat: 'tpm', seq: 'seasons', n: 1 }, 'Most 3-pointers in an NBA rookie season'),
  L('most-triple-doubles-in-a-rookie-season', { stat: 'td', seq: 'seasons', n: 1 }, 'Most triple-doubles in an NBA rookie season'),
  // counts and streaks
  L('most-50-point-games', { how: 'count', tests: [{ stat: 'pts', min: 50 }], n: 1500 }, 'Most 50-point games in NBA history', 'Most 50-point games in a career'),
  L('most-40-point-games-through-300-games', { how: 'count', tests: [{ stat: 'pts', min: 40 }], n: 300 }, 'Most 40-point games through the first 300 games of an NBA career'),
  L('longest-streak-of-20-point-games', { how: 'streak', tests: [{ stat: 'pts', min: 20 }], n: 1500 }, 'Longest streak of 20-point games in NBA history', 'Longest streaks of consecutive 20-point games'),
  L('longest-streak-of-double-doubles', { how: 'streak', tests: [{ stat: 'dd', min: 1 }], n: 1500 }, 'Longest streak of double-doubles in NBA history', 'Longest streaks of consecutive double-doubles'),
]

export const landingBySlug = new Map(LANDINGS.map((l) => [l.slug, l]))

/** a query's identity, for matching a board to its landing */
export const queryKey = (q: Query): string => {
  const n = normalize(q)
  return [n.pos, n.stat, n.how, n.n, n.seq, n.scope, n.since ?? '', n.dir, n.how === 'sum' || n.how === 'reach' ? '' : n.tests.map((t) => `${t.stat}:${t.min}${t.max != null ? `-${t.max}` : ''}`).join(',')].join('|')
}
const byKey = new Map(LANDINGS.map((l) => [queryKey(l.query), l]))

/** the landing a query is on, when it has one */
export const landingFor = (q: Query): Landing | null => byKey.get(queryKey(q)) ?? null

/** the landing at a path like /nba-comparator/fastest-to-10000-points/ (with or without the base); null for every other address */
export function landingFromPath(pathname: string, base = ''): Landing | null {
  let rel = pathname.startsWith(base) ? pathname.slice(base.length) : pathname
  rel = rel.replace(/^\/+|\/+$/g, '')
  return landingBySlug.get(rel) ?? null
}

/** the <title>: the searcher's phrase, the era the data forces, the site */
export const landingTitle = (l: Landing, bound: number | null, site: string): string => `${l.title ?? l.h1}${bound ? ` (since ${seasonWords(bound)})` : ''} · ${site}`

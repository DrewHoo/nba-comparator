// The query in the URL, one param per slot, so every board is a link.
// Pure: parseUrl reads a search string, toUrl writes one; the defaults are
// omitted. `t` is the open player (the panel), `vs` the peer it reads against
// (the panel's default when absent; it rides only with `t`).
import { DEFAULT_QUERY, normalize, type How, type Query, type Seq, type Test } from './query.ts'
import { STATS, type StatKey } from './stats.ts'
import { POSITIONS, type Pos } from './ledger.ts'
import { landingFor, landingFromPath } from './landing.ts'

const HOWS: How[] = ['sum', 'count', 'every', 'streak', 'reach']
const SEQS: Seq[] = ['games', 'starts', 'seasons', 'teamGames']
const isStat = (s: string): s is StatKey => STATS.some((x) => x.key === s)

export interface UrlState { query: Query; open: string | null; vs?: string | null }

export function parseUrl(search: string): UrlState {
  const p = new URLSearchParams(search)
  const q: Query = { ...DEFAULT_QUERY, tests: [] }
  const pos = p.get('pos'); if (pos && (POSITIONS as string[]).includes(pos)) q.pos = pos as Pos
  const stat = p.get('stat'); if (stat && isStat(stat)) q.stat = stat
  const how = p.get('how'); if (how && (HOWS as string[]).includes(how)) q.how = how as How
  const seq = p.get('seq'); if (seq && (SEQS as string[]).includes(seq)) q.seq = seq as Seq
  const n = Number(p.get('n')); if (Number.isInteger(n) && n > 0) q.n = n
  if (p.get('scope') === 'all') q.scope = 'all'
  const since = Number(p.get('since')); if (Number.isInteger(since) && since > 1900) q.since = since
  if (p.get('dir') === 'fewest') q.dir = 'fewest'
  const tests = p.get('tests')
  if (tests) {
    q.tests = tests.split(',').map((s): Test | null => {
      const m = /^([a-z]+):(-?\d+)(?:-(\d+))?$/.exec(s)
      if (!m || !isStat(m[1])) return null
      return m[3] == null ? { stat: m[1], min: Number(m[2]) } : { stat: m[1], min: Number(m[2]), max: Number(m[3]) }
    }).filter((t): t is Test => t != null)
  }
  const open = p.get('t')
  return { query: normalize(q), open, vs: open ? p.get('vs') : null }
}

/** the address of a state, path and query string together, relative to the site's root: a landing's path when the query has one (its own params drop out), else the root with the params */
export function hrefOf(state: UrlState): string {
  const l = landingFor(state.query)
  if (!l) return `/${toUrl(state)}`
  const p = new URLSearchParams()
  if (state.open) p.set('t', state.open)
  if (state.open && state.vs) p.set('vs', state.vs)
  const s = p.toString()
  return `/${l.slug}/${s ? `?${s}` : ''}`
}

/** the state at an address: a landing path seeds its query, and the query string reads on top of it (a bare landing path is the landing's board) */
export function parseAddress(pathname: string, search: string, base = ''): UrlState {
  const l = landingFromPath(pathname, base)
  if (!l) return parseUrl(search)
  const p = new URLSearchParams(search)
  const own = toUrl({ query: l.query, open: null })
  const merged = new URLSearchParams(own)
  for (const [k, v] of p) merged.set(k, v)
  return parseUrl(`?${merged.toString()}`)
}

export function toUrl(state: UrlState): string {
  const q = normalize(state.query)
  const p = new URLSearchParams()
  if (q.pos !== DEFAULT_QUERY.pos) p.set('pos', q.pos)
  if (q.stat !== DEFAULT_QUERY.stat) p.set('stat', q.stat)
  if (q.how !== DEFAULT_QUERY.how) p.set('how', q.how)
  if (q.n !== DEFAULT_QUERY.n) p.set('n', String(q.n))
  if (q.seq !== DEFAULT_QUERY.seq) p.set('seq', q.seq)
  if (q.scope !== DEFAULT_QUERY.scope) p.set('scope', q.scope)
  if (q.since != null) p.set('since', String(q.since))
  if (q.dir !== DEFAULT_QUERY.dir) p.set('dir', q.dir)
  if (q.tests.length && q.how !== 'sum' && q.how !== 'reach') p.set('tests', q.tests.map((t) => `${t.stat}:${t.min}${t.max != null ? `-${t.max}` : ''}`).join(','))
  if (state.open) p.set('t', state.open)
  if (state.open && state.vs) p.set('vs', state.vs)
  const s = p.toString()
  return s ? `?${s}` : ''
}

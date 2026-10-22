// The records gate: golden lines written as the complaints they guard
// against, over the committed ledger. The whole catalog takes ~10 s to mine,
// so this mines a handful of shapes (points over games, both scopes;
// points and triple-doubles over a team's games; fastest to a points milestone; 30-point
// games) once at load, plus the file round trip and the nesting of a page in
// the mine.
import { describe, expect, it } from 'vitest'
import { loadLedger } from '../../scripts/lib/ledger-node.mjs'
import type { Ledger } from './ledger.ts'
import { evaluate, DEFAULT_QUERY, type Query } from './query.ts'
import { RECORDS, decodePlayer, encodePlayer, milestones, mineShape, page, shapesFor, type RecordRow, type Shape } from './records.ts'

const L: Ledger = loadLedger()
const S = (patch: Partial<Shape>): Shape => ({ pos: 'ALL', stat: 'pts', tests: [], how: 'sum', seq: 'games', scope: 'reg', since: null, dir: 'most', ...patch })
const SHAPES = {
  pts: S({}),
  ptsAll: S({ scope: 'all' }),
  td: S({ stat: 'td', seq: 'teamGames' }),
  ptsSeason: S({ seq: 'teamGames' }),
  reach: S({ how: 'reach', dir: 'fewest' }),
  thirty: S({ how: 'count', tests: [{ stat: 'pts', min: 30 }] }),
}
const mined = Object.fromEntries(Object.entries(SHAPES).map(([k, s]) => [k, mineShape(L, s)])) as Record<keyof typeof SHAPES, RecordRow[]>
const kept = Object.values(mined).flat().filter((r) => r.score >= RECORDS.keepFloor)
const player = (name: string) => L.players.find((p) => p.name === name)!
const board = (patch: Partial<Query>) => evaluate(L, { ...DEFAULT_QUERY, ...patch })
const allRows = (fams: ReturnType<typeof page>) => fams.flatMap((f) => [f.best, ...f.rest])

describe('the shapes', () => {
  it('walks every stat but losses, with no count of wins and no clean test outside tov, pf and ftmiss', () => {
    const shapes = shapesFor('ALL')
    expect(shapes.some((s) => s.stat === 'loss')).toBe(false)
    expect(shapes.some((s) => s.stat === 'win' && s.how === 'count')).toBe(false)
    expect([...new Set(shapes.flatMap((s) => s.tests.filter((t) => t.max === 0).map((t) => t.stat)))].sort()).toEqual(['ftmiss', 'pf', 'tov'])
    expect(shapes.some((s) => s.seq === 'seasons' && s.how !== 'sum')).toBe(false)
    expect(shapes.some((s) => s.dir === 'fewest' && s.how === 'sum' && s.seq !== 'starts')).toBe(false)
  })
})

describe('golden rows', () => {
  it('Wilt Chamberlain leads points through 100 games (3,748), and the mine agrees with the board', () => {
    const r = mined.pts.find((x) => x.player.name === 'Wilt Chamberlain' && x.kind === 'held' && x.lo <= 100 && x.hi >= 100)!
    expect(r).toBeTruthy()
    const b = board({ n: 100 })
    expect(b.ranked[0].player.name).toBe('Wilt Chamberlain')
    expect(b.ranked[0].value).toBe(3748)
    const at = board({ n: r.at }).ranked.find((x) => x.player.id === r.player.id)!
    expect(at.rank).toBe(1)
    expect(r.value).toBe(at.value)
  })

  it("a held row's value is the board's at its worded N, and a career's is first there", () => {
    const boards = new Map<string, ReturnType<typeof board>>()
    const rows = Object.entries(mined).filter(([k]) => k !== 'reach').flatMap(([, rs]) => rs.filter((r) => r.kind === 'held').sort((a, b) => b.score - a.score).slice(0, 8))
    for (const r of rows) {
      const key = `${JSON.stringify(r.shape)}|${r.at}`
      const b = boards.get(key) ?? boards.set(key, board({ ...r.shape, n: r.at })).get(key)!
      const x = [...b.ranked, ...b.onTheWay].find((y) => y.key === r.key)!
      expect(x.value, `${r.key} ${r.shape.stat} ${r.shape.how} ${r.shape.seq} @${r.at}`).toBe(r.value)
      if (r.season == null) expect(x.rank).toBe(1)
    }
  })

  it("Russell Westbrook's 42 triple-doubles in OKC's first 82 games of 2016-17 is a held row", () => {
    const r = mined.td.find((x) => x.player.name === 'Russell Westbrook' && x.kind === 'held' && x.season === 2017 && x.at === 82)
    expect(r?.value).toBe(42)
    expect(r?.team).toBe('OKC')
    expect(r!.score).toBeGreaterThan(RECORDS.keepFloor)
  })

  it('a reach row is worded at a milestone on the grid, and its run starts on one', () => {
    expect(mined.reach.length).toBeGreaterThan(0)
    for (const r of mined.reach) {
      expect(milestones(r.shape.stat, r.at)).toContain(r.at)
      expect(milestones(r.shape.stat, r.at)).toContain(r.from)
    }
  })

  it('no row starts under the noise floor', () => {
    for (const r of Object.values(mined).flat()) if (r.shape.how !== 'reach') expect(r.lo).toBeGreaterThanOrEqual(RECORDS.minN[r.shape.seq])
  })

  it('a set row was set in a field of at least fieldFloor', () => {
    for (const r of Object.values(mined).flat()) if (r.kind === 'set') expect(r.field).toBeGreaterThanOrEqual(RECORDS.fieldFloor)
  })

  it('a career from before a stat was in every box has no rows under it, but its points count: Oscar sits out triple-doubles and Jordan is one career', () => {
    const oscar = player('Oscar Robertson')
    expect(mined.td.filter((r) => r.player.id === oscar.id)).toHaveLength(0)
    expect(board({ n: 100 }).ranked.some((r) => r.player.id === oscar.id)).toBe(true)
    const jordan = player('Michael Jordan')
    expect(jordan.censored).toBe(false)
    expect(mined.pts.some((r) => r.player.id === jordan.id && r.season == null)).toBe(true)
    expect(mined.ptsSeason.some((r) => r.player.name === 'Wilt Chamberlain' && r.season === 1960)).toBe(true)
  })
})

describe('the file and the page', () => {
  it('a player file round-trips to the same scores', () => {
    const p = player('Wilt Chamberlain')
    const own = kept.filter((r) => r.player.id === p.id)
    expect(own.length).toBeGreaterThan(0)
    const file = encodePlayer(L, p, own)
    expect(file.games).toBe(p.hi - p.lo)
    expect(file.teams).toEqual(['PHW', 'SFW', 'PHI', 'LAL'])
    const back = decodePlayer(JSON.parse(JSON.stringify(file)))
    expect(back.map((r) => Math.round(r.score * 1000))).toEqual(own.map((r) => Math.round(r.score * 1000)))
    expect(back.map((r) => r.breaker?.name ?? '')).toEqual(own.map((r) => r.breaker?.name ?? ''))
    expect(back.map((r) => `${r.lo}-${r.hi}@${r.at}`)).toEqual(own.map((r) => `${r.lo}-${r.hi}@${r.at}`))
  })

  it("a page's rows nest in the mine: every mined row is shown or folded, nothing is added", () => {
    for (const name of ['LeBron James', 'Russell Westbrook']) {
      const p = player(name)
      const own = kept.filter((r) => r.player.id === p.id)
      const fams = page(kept, p.id)
      const seen = new Set<RecordRow>()
      const walk = (r: RecordRow) => { seen.add(r); r.folded.forEach(walk) }
      allRows(fams).forEach(walk)
      expect(seen.size).toBe(own.length)
      for (const r of seen) expect(own).toContain(r)
      for (const f of fams) for (const r of f.rest) expect(r.score).toBeLessThanOrEqual(f.best.score)
      for (const r of kept) r.folded = []
    }
  })
})

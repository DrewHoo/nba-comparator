// The team pages' gate: a franchise's leaders as its own record book has
// them, the old names folded in, the folded teams left out.
import { describe, expect, it } from 'vitest'
import { loadLedger } from '../../scripts/lib/ledger-node.mjs'
import type { Ledger } from './ledger.ts'
import { FRANCHISES, franchiseById, groupData, groupLead, MIN_GAMES, type GroupPos } from './groups.ts'

const L: Ledger = loadLedger()
const page = (id: string, pos: GroupPos) => groupData(L, franchiseById(id)!, pos)
const row = (id: string, pos: GroupPos, name: string) => page(id, pos).rows.find((r) => r.name === name)

describe('the team pages', () => {
  it('thirty franchises, every ledger code but the folded teams in one of them', () => {
    expect(FRANCHISES).toHaveLength(30)
    const folded = new Set(['AND', 'BAL', 'BOM', 'CHS', 'CLR', 'DEF', 'DN', 'HUS', 'INO', 'JET', 'PIT', 'PRO', 'SHE', 'WAT'])
    for (const code of L.teams) expect(folded.has(code) || FRANCHISES.some((f) => f.codes.includes(code)), code).toBe(true)
  })
  it("the leaders: Kobe's 33,643 for the Lakers, Jordan's 29,277 for the Bulls, Havlicek's 26,395 for the Celtics, Wilt's 17,783 for the Warriors", () => {
    expect(page('lal', 'G').rows[0]).toMatchObject({ name: 'Kobe Bryant', totals: [33643, 6306, 1827], games: 1346 })
    expect(page('chi', 'G').rows[0]).toMatchObject({ name: 'Michael Jordan', games: 930 })
    expect(page('chi', 'G').rows[0].totals[0]).toBe(29277)
    expect(page('bos', 'F').rows[0]).toMatchObject({ name: 'John Havlicek', games: 1270 })
    expect(page('bos', 'F').rows[0].totals[0]).toBe(26395)
    expect(page('gsw', 'C').rows[0].name).toBe('Wilt Chamberlain')
    expect(page('gsw', 'C').rows[0].totals[0]).toBe(17783)
    expect(groupLead(page('lal', 'G'))).toBe('Kobe Bryant leads with 33,643 points in 1,346 games for the Los Angeles Lakers; Jerry West had 25,200.')
  })
  it('the old names count: the Minneapolis Lakers, Syracuse, the first Hornets for Charlotte', () => {
    expect(page('lal', 'C').rows.find((r) => r.name === 'George Mikan')?.totals[0]).toBe(10158)
    expect(page('lal', 'C').since).toBe(1949)
    expect(row('cha', 'G', 'Dell Curry')?.totals[0]).toBe(9839)
    expect(page('nop', 'G').since).toBe(2003)
    expect(page('phi', 'F').former).toEqual(['Syracuse Nationals'])
  })
  it("the Washington Capitols of 1946-51 are not the Wizards: Washington's page begins with the Chicago Packers", () => {
    expect(page('was', 'G').since).toBe(1962)
    expect(page('bos', 'G').since).toBe(1947)
  })
  it('a total reads the games that have the stat, and goes blank where more than a tenth lack it', () => {
    const russell = row('bos', 'C', 'Bill Russell')!
    expect(russell.totals[0]).toBe(14522)
    expect(russell.missing[1]).toBeGreaterThan(0)
    expect(russell.totals[1]).not.toBeNull()
    expect(russell.totals[2]).toBeNull()
    expect(page('bos', 'G').rows.every((r) => r.games >= MIN_GAMES)).toBe(true)
  })
})

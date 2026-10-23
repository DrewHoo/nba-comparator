// The known-answer gate: published factoids the ledger has to reproduce.
// Each pin says where the data's definition differs from the publisher's.
// The ledger is the committed one (src/data), every column loaded.
import { describe, expect, it } from 'vitest'
import { loadLedger } from '../../scripts/lib/ledger-node.mjs'
import { fmtDate, gameAt, type Ledger } from './ledger.ts'
import { UNKNOWN, statByKey } from './stats.ts'
import { crossings, curve, evaluate, holds, toMatch, querySince, DEFAULT_QUERY, PLAYED_MIN, type Board, type Query } from './query.ts'

const L: Ledger = loadLedger()
const row = (b: Board, name: string, season?: number) => [...b.ranked, ...b.onTheWay].find((r) => r.player.name === name && (season == null || r.season === season))
const player = (name: string) => L.players.find((p) => p.name === name)!
const q = (patch: Partial<Query>) => evaluate(L, { ...DEFAULT_QUERY, ...patch })
const reach = (stat: Query['stat'], n: number) => q({ how: 'reach', stat, n, dir: 'fewest' })
const lastDate = (r: { games: number[] }) => fmtDate(L.date[r.games[r.games.length - 1]])
const career = (name: string, stat: Query['stat']) => row(q({ stat, n: 2000 }), name)!.value

describe('the gate, since 1946-47', () => {
  it('the ledger begins with the league: 1946-47, nobody censored, and Jordan, Bird, Magic, Kareem and Wilt are whole careers', () => {
    expect(L.firstSeason).toBe(1947)
    expect(L.players.every((p) => !p.censored)).toBe(true)
    // regular-season games and points, Basketball-Reference's; Wilt's 31,417 is NBA.com's own book (BR has 31,419)
    const gp = q({ how: 'count', tests: [{ stat: 'pts', min: 0 }], n: 2000 })
    for (const [name, games, pts] of [['Michael Jordan', 1072, 32292], ['Larry Bird', 897, 21791], ['Magic Johnson', 906, 17707], ['Kareem Abdul-Jabbar', 1560, 38387], ['Wilt Chamberlain', 1045, 31417]] as const) {
      expect(row(gp, name)!.value, `${name} games`).toBe(games)
      expect(career(name, 'pts'), `${name} points`).toBe(pts)
    }
  })

  it('Wilt has the most points through 100 games (3,748) and scored 100 on Mar 2, 1962; Zion 2,524 and Luka 2,332 since 1993-94 (CBS Sports)', () => {
    const b = q({})
    expect(b.ranked[0].player.name).toBe('Wilt Chamberlain')
    expect(b.ranked[0].value).toBe(3748)
    const w = player('Wilt Chamberlain')
    const hundred = [...Array(w.hi - w.lo).keys()].map((k) => w.lo + k).find((i) => L.col.pts![i] === 100)!
    expect(L.date[hundred]).toBe(19620302)
    const modern = q({ since: 1994 })
    expect(modern.ranked[0].player.name).toBe('Zion Williamson')
    expect(modern.ranked[0].value).toBe(2524)
    expect(row(modern, 'Luka Dončić')!.value).toBe(2332)
  })

  it("Jordan's 63 at Boston on Apr 20, 1986 is the playoff record; his 1995-96 reads 2,491, whole again from the NBA Stats logs", () => {
    const j = player('Michael Jordan')
    const sixtyThree = [...Array(j.hi - j.lo).keys()].map((k) => j.lo + k).find((i) => L.col.pts![i] === 63)!
    expect(L.date[sixtyThree]).toBe(19860420)
    expect(gameAt(L, sixtyThree).post).toBe(true)
    expect(row(q({ seq: 'teamGames', n: 82 }), 'Michael Jordan', 1996)!.value).toBe(2491)
  })

  it('fastest to 30,000: Wilt in 941 games, Jordan in 960; to 10,000: Wilt 236, Luka 358 (NBA.com), LeBron 368 (boston.com), Edwards 412 (AP)', () => {
    const thirty = reach('pts', 30000)
    expect(thirty.ranked[0].player.name).toBe('Wilt Chamberlain')
    expect(thirty.ranked[0].value).toBe(941)
    expect(row(thirty, 'Michael Jordan')!.value).toBe(960)
    const ten = reach('pts', 10000)
    expect(ten.ranked[0].player.name).toBe('Wilt Chamberlain')
    expect(ten.ranked[0].value).toBe(236)
    expect(row(ten, 'Luka Dončić')!.value).toBe(358)
    expect(row(ten, 'LeBron James')!.value).toBe(368)
    expect(row(ten, 'Anthony Edwards')!.value).toBe(412)
  })

  it('Wembanyama through 100 games: 366 blocks and 225 threes (NBA.com); NBA.com says 2,278 points and both box scores say 2,273', () => {
    expect(row(q({ stat: 'blk' }), 'Victor Wembanyama')!.value).toBe(366)
    expect(row(q({ stat: 'tpm' }), 'Victor Wembanyama')!.value).toBe(225)
    expect(row(q({ stat: 'pts' }), 'Victor Wembanyama')!.value).toBe(2273)
  })

  it('LeBron reached 20,000 in his 726th game on Jan 16, 2013 and 30,000 in his 1,107th on Jan 23, 2018: the games ESPN lacks are filled', () => {
    const twenty = row(reach('pts', 20000), 'LeBron James')!
    expect(twenty.value).toBe(726)
    expect(lastDate(twenty)).toBe('Jan 16, 2013')
    const thirty = row(reach('pts', 30000), 'LeBron James')!
    expect(thirty.value).toBe(1107)
    expect(lastDate(thirty)).toBe('Jan 23, 2018')
    expect(lastDate(row(reach('pts', 30000), 'Kobe Bryant')!)).toBe('Dec 5, 2012')
  })

  it('fastest to 1,000 threes (NBC Sports Bay Area): Hield 350, Curry 369, Thompson 372, Lillard 385; Curry to 2,000 in 597 (NBA.com)', () => {
    const b = reach('tpm', 1000)
    expect(row(b, 'Buddy Hield')!.value).toBe(350)
    expect(row(b, 'Stephen Curry')!.value).toBe(369)
    expect(row(b, 'Klay Thompson')!.value).toBe(372)
    expect(row(b, 'Damian Lillard')!.value).toBe(385)
    expect(row(reach('tpm', 2000), 'Stephen Curry')!.value).toBe(597)
  })

  it("the single-game marks: Wilt's 100, Kobe's 81 and Adebayo's 83 are the 80-point games; Drummond's 23 missed free throws (13 of 36) the most since 1983-84", () => {
    const all = (b: Board) => [...b.ranked, ...b.onTheWay].filter((r) => (r.value ?? 0) > 0).map((r) => r.player.name).sort()
    expect(all(q({ how: 'count', tests: [{ stat: 'pts', min: 80 }], n: 2000 }))).toEqual(['Bam Adebayo', 'Kobe Bryant', 'Wilt Chamberlain'])
    expect(all(q({ how: 'count', tests: [{ stat: 'ftmiss', min: 23 }], n: 2000, since: 1984 }))).toEqual(['Andre Drummond'])
  })

  it("Westbrook's 42 triple-doubles in 2016-17 and Jokić's 34 in 2024-25 lead a team's 82 games; Kidd had 107 in his career; Magic 139 where the NBA says 138", () => {
    const b = q({ stat: 'td', seq: 'teamGames', n: 82 })
    expect(b.ranked[0].player.name).toBe('Russell Westbrook')
    expect(b.ranked[0].season).toBe(2017)
    expect(b.ranked[0].value).toBe(42)
    expect(row(b, 'Nikola Jokić', 2025)!.value).toBe(34)
    expect(career('Jason Kidd', 'td')).toBe(107)
    expect(career('Magic Johnson', 'td')).toBe(139)
  })

  it("Curry's 402 threes in 2015-16 and Harden's 2,818 points in 2018-19", () => {
    expect(row(q({ stat: 'tpm', seq: 'teamGames', n: 82 }), 'Stephen Curry', 2016)!.value).toBe(402)
    expect(row(q({ stat: 'pts', seq: 'teamGames', n: 82 }), 'James Harden', 2019)!.value).toBe(2818)
  })

  it("Michael Carter-Williams's 9 steals in his debut; Griffin's 27 straight double-doubles in 2010-11; LeBron's 1,297 games in double figures; Curry's 268 with a three", () => {
    expect(row(q({ stat: 'stl', n: 1 }), 'Michael Carter-Williams')!.value).toBe(9)
    expect(row(q({ how: 'streak', tests: [{ stat: 'dd', min: 1 }], seq: 'teamGames', n: 82 }), 'Blake Griffin', 2011)!.value).toBe(27)
    expect(row(q({ how: 'streak', tests: [{ stat: 'pts', min: 10 }], n: 2000 }), 'LeBron James')!.value).toBe(1297)
    expect(row(q({ how: 'streak', tests: [{ stat: 'tpm', min: 1 }], n: 2000 }), 'Stephen Curry')!.value).toBe(268)
  })

  it('the era bounds: a stat reads from the season it is in every box, careers from before sit out, and so does a window with an unrecorded game', () => {
    expect(querySince({ ...DEFAULT_QUERY, stat: 'stl' })).toBe(1984)
    expect(querySince({ ...DEFAULT_QUERY, stat: 'tpm' })).toBe(1980)
    expect(querySince({ ...DEFAULT_QUERY, how: 'count', tests: [{ stat: 'tov', min: 0, max: 0 }] })).toBe(1984)
    const stl = q({ stat: 'stl' })
    expect(stl.since).toBe(1984)
    expect(stl.early).toBeGreaterThan(1000)
    expect(row(stl, 'Larry Bird')).toBeUndefined()
    for (const r of stl.ranked.slice(0, 50)) expect(r.player.debut).toBeGreaterThanOrEqual(1984)
    // points are complete from the start: the board's era is the ledger's and the words carry none
    const pts = q({})
    expect(pts.since).toBe(L.firstSeason)
    expect(pts.early).toBe(0)
    // an unknown read: Bob Cousy's steals
    const cousy = player('Bob Cousy')
    expect(statByKey('stl').read(L, cousy.lo)).toBe(UNKNOWN)
    expect(statByKey('pts').read(L, cousy.lo)).toBeGreaterThanOrEqual(0)
  })

  it('the starts sequence: it begins with ESPN in 1993-94, every ranked game is a start, and careers with a start-unknown game inside the window sit out', () => {
    expect(L.startsSince).toBe(1994)
    const b = q({ stat: 'win', seq: 'starts', n: 100 })
    expect(b.gapped).toBeGreaterThan(0)
    expect(row(b, 'Michael Jordan')).toBeUndefined()
    for (const r of b.ranked.slice(0, 50)) expect(r.games.every((i) => gameAt(L, i).started === true)).toBe(true)
  })
})

describe('the audit of 2026-10-21: famous numbers across the eras', () => {
  // every pin is Basketball-Reference's unless noted; the two audits (early and modern eras) found these exact
  it('career games and points: Russell, Kareem, Barry, Walton, Erving, Pettit, Cousy, Stockton, Malone, Hakeem, Shaq, Kobe, Duncan, Dirk, LeBron, Curry, Jokić, Carter, Anthony, Harden', () => {
    const gp = q({ how: 'count', tests: [{ stat: 'pts', min: 0 }], n: 2000 })
    for (const [name, games, pts] of [['Bill Russell', 963, 14522], ['Rick Barry', 794, 18395], ['Bill Walton', 468, 6215], ['Julius Erving', 836, 18364], ['Bob Pettit', 792, 20880], ['Bob Cousy', 924, 16961],
      ['John Stockton', 1504, 19711], ['Karl Malone', 1476, 36928], ['Hakeem Olajuwon', 1238, 26946], ["Shaquille O'Neal", 1207, 28596], ['Kobe Bryant', 1346, 33643], ['Tim Duncan', 1392, 26496], ['Dirk Nowitzki', 1522, 31560],
      ['Stephen Curry', 1069, 26528], ['Nikola Jokić', 810, 18009], ['Vince Carter', 1541, 25728], ['Carmelo Anthony', 1260, 28289], ['James Harden', 1221, 29339]] as const) {
      expect(row(gp, name)!.value, `${name} games`).toBe(games)
      expect(career(name, 'pts'), `${name} points`).toBe(pts) // Cousy reads 16,961 to BR's 16,960: NBA.com's line of 1951-12-17
    }
  })
  it('the surprising board names are real: Bellamy 3,122 and Mikan 2,816 points through 100 games; Harper 243 steals, Mark Jackson 1,020 assists, Stoudamire 4,061 minutes', () => {
    const pts = q({})
    expect(row(pts, 'Walt Bellamy')!.value).toBe(3122)
    expect(row(pts, 'George Mikan')!.value).toBe(2816)
    expect(row(q({ stat: 'stl' }), 'Ron Harper')!.value).toBe(243)
    expect(row(q({ stat: 'ast' }), 'Mark Jackson')!.value).toBe(1020)
    expect(row(q({ stat: 'min' }), 'Damon Stoudamire')!.value).toBe(4061) // BR 4,060:06; ESPN rounds minutes
  })
  it("seasons: Wilt's 4,029 in 1961-62 leads an 82-game window because a finished season is whole; Stockton's 1,164 assists; Eaton's 456 blocks; Mark Jackson's 868 as a rookie; Bellamy's 2,495", () => {
    const pts = q({ seq: 'teamGames', n: 82 })
    expect(pts.ranked[0].player.name).toBe('Wilt Chamberlain')
    expect(pts.ranked[0].value).toBe(4029)
    expect(pts.ranked[0].reached).toBe(80)
    expect(row(pts, 'Walt Bellamy', 1962)!.value).toBe(2495)
    expect(row(q({ stat: 'ast', seq: 'teamGames', n: 82 }), 'John Stockton', 1991)!.value).toBe(1164)
    expect(row(q({ stat: 'ast', seq: 'teamGames', n: 82 }), 'Mark Jackson', 1988)!.value).toBe(868)
    expect(row(q({ stat: 'blk', seq: 'teamGames', n: 82 }), 'Mark Eaton', 1985)!.value).toBe(456)
  })
  it('a fewest season board ranks the whole window only: a finished season shorter than it sits out', () => {
    // Anžejs Pasečņiks's one game of the 72-game 2020-21 led "fewest losses through 82 team games" among centers until the fewest boards required the window
    const b = q({ pos: 'C', stat: 'loss', seq: 'teamGames', n: 82, dir: 'fewest' })
    expect(row(b, 'Anžejs Pasečņiks', 2021)).toBeUndefined()
    expect(b.ranked.every((r) => r.reached === 82)).toBe(true)
    expect(b.ranked.some((r) => r.season === 1999)).toBe(false)
    expect(b.short).toBeGreaterThan(0)
    expect(b.ranked[0].player.name).toBe('Carl Bailey')
    expect(b.ranked[0].season).toBe(1982)
    expect(b.ranked[0].value).toBe(0)
    expect(b.ranked[0].rank).toBe(1)
  })
  it("streaks: Wilt's 126 straight 20-point games and 65 straight 30s; Kareem's 787 in double figures; Jordan's 866; Harden's 32 straight 30s; Kevin Love's 53 straight double-doubles", () => {
    expect(row(q({ how: 'streak', tests: [{ stat: 'pts', min: 20 }], n: 2000 }), 'Wilt Chamberlain')!.value).toBe(126)
    expect(row(q({ how: 'streak', tests: [{ stat: 'pts', min: 30 }], n: 2000 }), 'Wilt Chamberlain')!.value).toBe(65)
    expect(row(q({ how: 'streak', tests: [{ stat: 'pts', min: 10 }], n: 2000 }), 'Kareem Abdul-Jabbar')!.value).toBe(787)
    expect(row(q({ how: 'streak', tests: [{ stat: 'pts', min: 10 }], n: 2000 }), 'Michael Jordan')!.value).toBe(866)
    expect(row(q({ how: 'streak', tests: [{ stat: 'pts', min: 30 }], n: 2000 }), 'James Harden')!.value).toBe(32)
    expect(row(q({ how: 'streak', tests: [{ stat: 'dd', min: 1 }], n: 2000 }), 'Kevin Love')!.value).toBe(53)
  })
  it('triple-doubles and counts: Westbrook 209, Jokić 198, LeBron 125, Bird 59, Kidd 107; Duncan 841 double-doubles; Wilt 118 fifty-point games', () => {
    for (const [name, n] of [['Russell Westbrook', 209], ['Nikola Jokić', 198], ['LeBron James', 125], ['Larry Bird', 59], ['Jason Kidd', 107]] as const) expect(career(name, 'td'), name).toBe(n)
    expect(career('Tim Duncan', 'dd')).toBe(841)
    expect(row(q({ how: 'count', tests: [{ stat: 'pts', min: 50 }], n: 2000 }), 'Wilt Chamberlain')!.value).toBe(118)
  })
  it('the corrections: Mikan plays 68 games in 1950-51 (his brother Ed had 25 of them), the 1950s tiebreakers are playoffs, and the four ESPN games of February 2020 appear once', () => {
    const mikan = player('George Mikan')
    let n = 0; for (let i = mikan.lo; i < mikan.hi; i++) if (L.season[i] === 1951 && !gameAt(L, i).post) n++
    expect(n).toBe(68)
    expect(L.teamGames.POR[2020][0]).toBe(74)
    expect(L.teamGames.DEN[2020][0]).toBe(73)
  })
})

describe('the clean-game floor', () => {
  const lebron = player('LeBron James')
  const find = (f: (i: number) => boolean) => { for (let i = lebron.lo; i < lebron.hi; i++) if (f(i)) return i; return -1 }
  it('a no-turnover game counts only when he played ten minutes; a threshold test needs no floor', () => {
    const clean = [{ stat: 'tov' as const, min: 0, max: 0 }]
    const full = find((i) => L.col.min![i] >= PLAYED_MIN && L.col.tov![i] === 0)
    expect(full).toBeGreaterThan(-1)
    expect(holds(L, full, clean)).toBe(true)
    const cameo = L.players.flatMap((p) => { for (let i = p.lo; i < p.hi; i++) if (L.col.min![i] < PLAYED_MIN && L.col.tov![i] === 0) return [i]; return [] })[0]
    expect(holds(L, cameo, clean)).toBe(false)
    // a cap above zero ("0–2 turnovers") and a plain threshold read the line as it is
    const two = find((i) => L.col.tov![i] === 1)
    expect(holds(L, two, [{ stat: 'tov', min: 0, max: 2 }])).toBe(true)
    expect(holds(L, two, [{ stat: 'pts', min: 1 }])).toBe(true)
  })
  it('no streak of clean games is built from cameos', () => {
    const clean = [{ stat: 'tov' as const, min: 0, max: 0 }]
    const b = q({ how: 'streak', tests: clean, n: 50 })
    expect(b.ranked[0].value).toBeGreaterThan(0)
    const cameos = b.ranked.slice(0, 20).flatMap((r) => r.games).filter((i) => L.col.tov![i] === 0 && L.col.min![i] < PLAYED_MIN)
    expect(cameos.length).toBeGreaterThan(0)
    for (const i of cameos) expect(holds(L, i, clean)).toBe(false)
  })
})

describe('peer readings', () => {
  it('Jordan and Wilt meet on points by game', () => {
    const qq = { ...DEFAULT_QUERY }
    const a = curve(L, player('Michael Jordan'), qq)
    const b = curve(L, player('Wilt Chamberlain'), qq)
    const x = crossings(a, b)
    expect(x.length).toBeGreaterThan(0)
    expect(x.map((v) => v.n)).toEqual([...x.map((v) => v.n)].sort((p, r) => p - r))
  })

  it('toMatch says what the subject needs over its next k games', () => {
    expect(toMatch([1, 2, 3], [2, 4, 6, 8, 10], 2)).toEqual({ need: 7, at: 5 })
    expect(toMatch([1, 2, 3], [2, 4], 2)).toBeNull()
  })
})

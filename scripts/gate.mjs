// The known-answer gate: published factoids the ledger has to reproduce.
// Prints each with the numbers it found; the test in src/lib/query.test.ts
// pins the ones that pass. Run after `npm run ledger`. A number off by one
// game is information: it says which game ESPN and NBA Stats both lack.
import { loadLedger } from './lib/ledger-node.mjs'
import { evaluate, DEFAULT_QUERY } from '../src/lib/query.ts'
import { fmtDate, seasonWords } from '../src/lib/ledger.ts'

const L = loadLedger()
const row = (board, name, season) => [...board.ranked, ...board.onTheWay].find((r) => r.player.name === name && (season == null || r.season === season))
const top = (b, k = 5) => b.ranked.slice(0, k).map((r) => `${r.rank}. ${r.player.name}${r.season != null ? ` ${seasonWords(r.season)}` : ''} ${r.value}`).join(' · ')
const q = (patch) => evaluate(L, { ...DEFAULT_QUERY, ...patch })
const reach = (stat, n) => q({ how: 'reach', stat, n, dir: 'fewest' })
const at = (r) => (r ? `${r.value} (${fmtDate(L.date[r.games[r.games.length - 1]])})` : 'none')

console.log(`ledger ${L.players.length} players, ${L.n} games, ${seasonWords(L.firstSeason)} to ${seasonWords(L.currentSeason)}`)
console.log('1. the default board: most points through the first 100 games (CBS: Zion 2,524; Luka 2,332)')
{ const b = q({}); console.log(`   ${top(b, 6)} · ${b.ranked.length} careers, ${b.onTheWay.length} on the way, ${b.censored} began before the ledger`) }
console.log('2. Wembanyama through 100 games (NBA.com: 2,278 points, 366 blocks, 225 threes)')
{ const w = (stat) => row(q({ stat }), 'Victor Wembanyama')?.value; console.log(`   pts ${w('pts')}, blk ${w('blk')}, tpm ${w('tpm')}`) }
console.log('3. fastest to 10,000 points by games (LeBron 368th, Luka 358th, Edwards 412th)')
{ const b = reach('pts', 10000); console.log(`   ${top(b, 6)} · LeBron ${at(row(b, 'LeBron James'))}, Luka ${at(row(b, 'Luka Doncic') ?? row(b, 'Luka Dončić'))}, Edwards ${at(row(b, 'Anthony Edwards'))}`) }
console.log('4. LeBron to 20,000 (726th game, Jan 16, 2013) and 30,000 (1,107th, Jan 23, 2018); Kobe to 30,000 (Dec 5, 2012)')
{ console.log(`   20k ${at(row(reach('pts', 20000), 'LeBron James'))}, 30k ${at(row(reach('pts', 30000), 'LeBron James'))}, Kobe 30k ${at(row(reach('pts', 30000), 'Kobe Bryant'))}`) }
console.log('5. fastest to 1,000 threes (NBC: Hield 350, Curry 369, Thompson 372, Lillard 385) and Curry to 2,000 (NBA.com: 597)')
{ const b = reach('tpm', 1000); console.log(`   ${top(b, 6)} · Curry 2,000: ${at(row(reach('tpm', 2000), 'Stephen Curry'))}`) }
console.log('6. single-game maxima: points (Adebayo 83 on 2026-03-10, Kobe 81), missed free throws (Drummond 23 on 2016-01-20)')
{ const all = (b) => [...b.ranked, ...b.onTheWay].filter((r) => r.value > 0).map((r) => `${r.player.name} ${r.value}`).join(', ')
  console.log(`   80-point games: ${all(q({ how: 'count', tests: [{ stat: 'pts', min: 80 }], n: 2000 }))}`)
  console.log(`   20+ missed FT games: ${all(q({ how: 'count', tests: [{ stat: 'ftmiss', min: 20 }], n: 2000 }))}`) }
console.log("7. Westbrook's 42 triple-doubles in 2016-17 (82 team games); Jokić 34 in 2024-25; Kidd 107 career triple-doubles")
{ const b = q({ stat: 'td', seq: 'teamGames', n: 82 }); console.log(`   ${top(b, 5)} · Kidd career ${row(q({ stat: 'td', n: 2000 }), 'Jason Kidd')?.value}`) }
console.log("8. Curry's 402 threes in 2015-16; Harden's 2,818 points in 2018-19")
{ console.log(`   Curry ${row(q({ stat: 'tpm', seq: 'teamGames', n: 82 }), 'Stephen Curry', 2016)?.value}, Harden ${row(q({ stat: 'pts', seq: 'teamGames', n: 82 }), 'James Harden', 2019)?.value}`) }
console.log('9. rookie 30-point games (StatMuse: Iverson 20, Griffin 14, LeBron 13, Wembanyama 11): 30-point games in a rookie season, 82 team games')
{ const b = q({ how: 'count', tests: [{ stat: 'pts', min: 30 }], seq: 'teamGames', n: 82 }); const rook = [...b.ranked].filter((r) => r.season === r.player.debut && !r.player.censored); console.log(`   ${rook.slice(0, 7).map((r) => `${r.player.name} ${seasonWords(r.season)} ${r.value}`).join(' · ')}`) }
console.log('10. wins through the first 100 starts, and who sits out')
{ const b = q({ stat: 'win', seq: 'starts', n: 100 }); console.log(`   ${top(b, 5)} · ${b.ranked.length} careers, ${b.gapped} sit out (a start-unknown game), ${b.censored} began before`) }
console.log('11. Michael Carter-Williams: 9 steals in his debut; Griffin 27 straight double-doubles in 2010-11')
{ const mcw = row(q({ stat: 'stl', n: 1 }), 'Michael Carter-Williams'); const g = row(q({ how: 'streak', tests: [{ stat: 'dd', min: 1 }], seq: 'teamGames', n: 82 }), 'Blake Griffin', 2011); console.log(`   MCW ${mcw?.value}, Griffin ${g?.value}`) }
console.log("12. LeBron's 1,297 straight games in double figures (to 2025-12-04); Curry's 268 straight with a three (to 2023-12-17)")
{ const l = row(q({ how: 'streak', tests: [{ stat: 'pts', min: 10 }], n: 2000 }), 'LeBron James'); const c = row(q({ how: 'streak', tests: [{ stat: 'tpm', min: 1 }], n: 2000 }), 'Stephen Curry'); console.log(`   LeBron ${l?.value}, Curry ${c?.value}`) }
console.log('13. the careers that span 1993-94 are one career each, and the old ones are whole')
{ for (const n of ['Michael Jordan', "Shaquille O'Neal", 'Hakeem Olajuwon', 'John Stockton', 'Larry Bird', 'Magic Johnson', 'Kareem Abdul-Jabbar', 'Wilt Chamberlain']) { const p = L.players.find((p) => p.name === n); console.log(`   ${n}: ${p ? `${p.hi - p.lo} games from ${seasonWords(p.debut)}, born ${p.born}, ${p.pos} (${p.posSrc})` : 'not found'}`) } }
console.log('14. career totals (Basketball-Reference): Jordan 1,072 games 32,292 points; Bird 897/21,791; Magic 906/17,707; Kareem 1,560/38,387; Wilt 1,045/31,419; Oscar 181 triple-doubles, Magic 138')
{ const pts = q({ n: 2000 }), gp = q({ stat: 'win', how: 'count', tests: [{ stat: 'pts', min: 0 }], n: 2000 }), td = q({ stat: 'td', n: 2000 })
  for (const n of ['Michael Jordan', 'Larry Bird', 'Magic Johnson', 'Kareem Abdul-Jabbar', 'Wilt Chamberlain', 'Oscar Robertson']) console.log(`   ${n}: ${row(gp, n)?.value ?? '—'} games, ${row(pts, n)?.value ?? '—'} points, ${row(td, n)?.value ?? 'sits out'} triple-doubles`) }
console.log("15. Wilt's 100 on 1962-03-02; Jordan's 63 at Boston on 1986-04-20 (playoffs); fastest to 30,000 points: Wilt, Jordan, Kareem")
{ const w = L.players.find((p) => p.name === 'Wilt Chamberlain'); let hundred = null; for (let i = w.lo; i < w.hi; i++) if (L.col.pts[i] === 100) hundred = L.date[i]
  const j = L.players.find((p) => p.name === 'Michael Jordan'); let sixty = []; for (let i = j.lo; i < j.hi; i++) if (L.col.pts[i] >= 60) sixty.push(`${L.col.pts[i]} on ${L.date[i]}${(L.flags[i] & 1) ? ' (playoffs)' : ''}`)
  console.log(`   Wilt's 100: ${hundred}; Jordan's 60+: ${sixty.join(', ')}; ${top(reach('pts', 30000), 5)}`) }
console.log('16. the era bounds: steals through 100 games (recorded for every game from 1983-84), triple-doubles (assists from 1975-76), minutes')
{ for (const stat of ['stl', 'td', 'min', 'tpm', 'reb', 'ast']) { const b = q({ stat }); console.log(`   ${stat}: since ${seasonWords(b.since)}, ${b.ranked.length} careers, ${b.early} early, ${b.partial} partial · ${top(b, 3)}`) } }

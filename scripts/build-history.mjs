// Builds the history the ledger starts from: every player-game before the
// ESPN era, 1946-47 to 1995-96, in one committed file, data/history/
// player_games.csv.gz, plus data/history/people.csv.gz (birth dates,
// positions and names for the players of those years). The ledger builder
// takes 1946-47 to 1992-93 from it as the spine and reads 1993-94 to 1995-96
// only to join the ESPN-era players to their NBA person ids by their box
// lines. This runs once on a Mac and its output is committed, so the site's
// CI never calls NBA.com.
//
// Sources, both in data/raw/history/ (gitignored):
//   lgl_P_{RS,PO}_<YYYY-YY>.json   stats.nba.com `leaguegamelog`, PlayerOrTeam=P, one file a season and
//                                  type, fetched by scripts/fetch-history.mjs, once, on a Mac. Every
//                                  franchise, folded ones included; a stat that wasn't recorded is null,
//                                  and a minute count of 0 means unknown.
//   PlayerStatistics.csv           Eoin A. Moore, "NBA Dataset: Box Scores and Stats (1947 - Today)",
//                                  Kaggle, CC0 1.0: the same NBA.com data with every null written as 0.
//                                  It keeps a few hundred rows whose person ids NBA.com has since lost
//                                  (Loy Vaught's first id, Kurt Rambis's 1990-91), which patch the spine.
//   Players.csv, TeamStatistics.csv  the same dataset: people with birth dates and positions; team scores,
//                                  for the points-sum check printed at the end.
//
// A row here is an appearance; neither source lists a DNP before 1996-97.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { readCsv } from './lib/csv.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW = path.join(ROOT, 'data/raw/history')
const OUT = path.join(ROOT, 'data/history')
fs.mkdirSync(OUT, { recursive: true })

/** the last season (by its end year) the history carries: the ESPN era's first three, for the id join */
const LAST = 1996
/** a full box in every game from 1983-84: before it, a 0 in the Kaggle file for an untracked stat is unknown */
const FULL_BOX = 1984

const COLS = ['season', 'post', 'pid', 'name', 'game', 'date', 'team', 'opp', 'home', 'win', 'min', 'pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'oreb', 'dreb', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf']
const STATS = ['min', 'pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'oreb', 'dreb', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf']

// ---- 1. the spine: leaguegamelog, regular season and playoffs
const rows = [] // arrays in COLS order; '' is unknown
const seen = new Map() // `${pid}|${gameNum}` -> index in rows
const abbrOf = new Map() // `${season}|${teamId}` -> abbreviation of the day
const anyAbbr = new Map() // teamId -> an abbreviation from some season, for a patch row in a season the log lacks the team
const games = new Map() // gameNum -> { season, post, date, home, away }
const perSeason = {}
for (const f of fs.readdirSync(RAW).filter((f) => /^lgl_P_(RS|PO)_\d{4}-\d{2}\.json$/.test(f)).sort()) {
  const m = /^lgl_P_(RS|PO)_(\d{4})-\d{2}\.json$/.exec(f)
  const season = Number(m[2]) + 1
  if (season > LAST) continue
  const post = m[1] === 'PO' ? 1 : 0
  const rs = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8')).resultSets[0]
  const h = Object.fromEntries(rs.headers.map((k, i) => [k, i]))
  const v = (r, k) => (r[h[k]] == null ? '' : r[h[k]])
  for (const r of rs.rowSet) {
    const mm = /^(\S+) (vs\.|@) (\S+)$/.exec(r[h.MATCHUP])
    if (!mm) throw new Error(`matchup ${r[h.MATCHUP]}`)
    const team = r[h.TEAM_ABBREVIATION], opp = mm[3], home = mm[2] === 'vs.' ? 1 : 0
    const gameNum = Number(r[h.GAME_ID])
    const key = `${r[h.PLAYER_ID]}|${gameNum}`
    if (seen.has(key)) {
      // the same man twice in one game (Cousy on 1951-12-17 under Baltimore with a blank line and under Boston with 13):
      // the fuller line stands; a game finished months later after a trade (1978-11-08) keeps the bigger half
      const prev = rows[seen.get(key)]
      const fullness = (x) => x.slice(10).filter((v) => v !== '').length * 1000 + Number(x[11] || 0)
      const cand = [season, post, r[h.PLAYER_ID], r[h.PLAYER_NAME], gameNum, r[h.GAME_DATE], team, opp, home, r[h.WL] === 'W' ? 1 : 0,
        r[h.MIN] == null || r[h.MIN] === 0 ? '' : r[h.MIN], v(r, 'PTS'), v(r, 'FGM'), v(r, 'FGA'), v(r, 'FG3M'), v(r, 'FG3A'), v(r, 'FTM'), v(r, 'FTA'), v(r, 'OREB'), v(r, 'DREB'), v(r, 'REB'), v(r, 'AST'), v(r, 'STL'), v(r, 'BLK'), v(r, 'TOV'), v(r, 'PF')]
      if (fullness(cand) > fullness(prev)) rows[seen.get(key)] = cand
      continue
    }
    seen.set(key, rows.length)
    abbrOf.set(`${season}|${r[h.TEAM_ID]}`, team)
    anyAbbr.set(String(r[h.TEAM_ID]), team)
    if (!games.has(gameNum)) games.set(gameNum, { season, post, date: r[h.GAME_DATE], home: home ? team : opp, away: home ? opp : team })
    const min = r[h.MIN] == null || r[h.MIN] === 0 ? '' : r[h.MIN]
    rows.push([season, post, r[h.PLAYER_ID], r[h.PLAYER_NAME], gameNum, r[h.GAME_DATE], team, opp, home, r[h.WL] === 'W' ? 1 : 0,
      min, v(r, 'PTS'), v(r, 'FGM'), v(r, 'FGA'), v(r, 'FG3M'), v(r, 'FG3A'), v(r, 'FTM'), v(r, 'FTA'), v(r, 'OREB'), v(r, 'DREB'), v(r, 'REB'), v(r, 'AST'), v(r, 'STL'), v(r, 'BLK'), v(r, 'TOV'), v(r, 'PF')])
    ;(perSeason[season] ??= [0, 0])[post]++
  }
}
console.log(`leaguegamelog: ${rows.length} rows, ${games.size} games`)

// ---- 2. the patch: rows the Kaggle file has and leaguegamelog lacks
// a streaming CSV line split (quoted fields with commas are possible in names)
const split = (line) => {
  const out = []
  let f = '', q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) { if (c === '"') { if (line[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c === '"') q = true
    else if (c === ',') { out.push(f); f = '' }
    else f += c
  }
  out.push(f)
  return out
}
const num0 = (s) => (s === '' ? '' : Math.round(Number(s)))
let header = null, patched = 0, patchedGames = 0
const patchBySeason = {}
const rl = readline.createInterface({ input: fs.createReadStream(path.join(RAW, 'PlayerStatistics.csv')), crlfDelay: Infinity })
for await (const line of rl) {
  const c = split(line)
  if (!header) { header = Object.fromEntries(c.map((k, i) => [k, i])); continue }
  const gameNum = Number(c[header.gameId])
  const kind = String(gameNum)[0]
  if (kind !== '2' && kind !== '4') continue
  const season = Number(String(gameNum).slice(1, 3)) + (Number(String(gameNum).slice(1, 3)) >= 46 ? 1900 : 2000) + 1
  if (season > LAST) continue
  const pid = c[header.personId]
  if (seen.has(`${pid}|${gameNum}`)) continue
  if (c[header.comment]) continue
  const line16 = STATS.map((k) => c[header[{ min: 'numMinutes', pts: 'points', fgm: 'fieldGoalsMade', fga: 'fieldGoalsAttempted', tpm: 'threePointersMade', tpa: 'threePointersAttempted', ftm: 'freeThrowsMade', fta: 'freeThrowsAttempted', oreb: 'reboundsOffensive', dreb: 'reboundsDefensive', reb: 'reboundsTotal', ast: 'assists', stl: 'steals', blk: 'blocks', tov: 'turnovers', pf: 'foulsPersonal' }[k]]])
  if (line16.every((x) => x === '' || Number(x) === 0)) continue // an empty line is no appearance
  const g = games.get(gameNum)
  const team = abbrOf.get(`${season}|${c[header.playerteamId]}`) ?? anyAbbr.get(c[header.playerteamId]), opp = abbrOf.get(`${season}|${c[header.opponentteamId]}`) ?? anyAbbr.get(c[header.opponentteamId])
  if (!team || !opp) { console.warn(`patch: no code for ${c[header.playerteamCity]} ${c[header.playerteamName]} in ${season}`); continue }
  const home = c[header.home] === '1' ? 1 : 0
  const date = (c[header.gameDate] || c[header.gameDateTimeEst]).slice(0, 10)
  if (!g) { games.set(gameNum, { season, post: kind === '4' ? 1 : 0, date, home: home ? team : opp, away: home ? opp : team }); patchedGames++ }
  // the Kaggle file writes an untracked stat as 0: before the full box, a 0 in the later stats is unknown
  const known = (k, x) => (season >= FULL_BOX || ['pts', 'fgm', 'fga', 'ftm', 'fta', 'reb', 'ast', 'pf'].includes(k) || Number(x) !== 0 ? num0(x) : '')
  const vals = STATS.map((k, i) => (k === 'min' ? (Number(line16[i]) ? Math.round(Number(line16[i])) : '') : known(k, line16[i])))
  rows.push([season, kind === '4' ? 1 : 0, pid, `${c[header.firstName]} ${c[header.lastName]}`.trim(), gameNum, date, team, opp, home, c[header.win] === '1' ? 1 : 0, ...vals])
  seen.set(`${pid}|${gameNum}`, rows.length - 1)
  patched++
  patchBySeason[season] = (patchBySeason[season] ?? 0) + 1
}
console.log(`patched ${patched} rows (${patchedGames} games) from the Kaggle file: ${JSON.stringify(patchBySeason)}`)

// ---- 2a. the corrections (data/ref/history-corrections.json, each with its receipt): rows the record books
// don't have, and the 1950s playoff tiebreakers the log types as regular season; then the rows NBA.com files
// twice for one man on one day under two teams (Ed Mikan's 1950-51 games on George's id; Dwight Jones's and
// Johnny Davis's old team's rows during their new team's season; Cousy's phantom Baltimore row), where the row
// on the team of his nearest other games that season stays; then team-games where a stat reads 0 for every
// player, which is a stat nobody recorded, not a night without a rebound
const corrections = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ref/history-corrections.json'), 'utf8'))
// TRACE_PID=<person id> prints every row a pass drops for him
const trace = (pass, r) => { if (process.env.TRACE_PID && String(r[2]) === process.env.TRACE_PID) console.log(`  ${pass}: dropped ${r[5]} ${r[6]} game ${r[4]} pts ${r[11]}`) }
{
  const drops = new Set(corrections.drop.map((d) => `${d.date}|${d.team}|${d.pid}`))
  const before = rows.length
  const kept = rows.filter((r) => !drops.has(`${r[5]}|${r[6]}|${r[2]}`))
  rows.length = 0
  for (const r of kept) rows.push(r)
  const tb = new Set(corrections.tiebreakers.flatMap((t) => t.teams.map((team) => `${t.date}|${team}`)))
  let moved = 0
  for (const r of rows) if (tb.has(`${r[5]}|${r[6]}`)) { r[1] = 1; moved++ }
  for (const t of corrections.tiebreakers) for (const g of games.values()) if (g.date === t.date && t.teams.includes(g.home) && t.teams.includes(g.away)) g.post = 1
  console.log(`corrections: dropped ${before - rows.length} rows by receipt, moved ${moved} tiebreaker rows to the playoffs`)
}
{
  // rows wedged between another team's games: NBA.com files another man's lines under a player's id (passes A and B below)
  const byPidSeason = new Map()
  for (const r of rows) { const k = `${r[2]}|${r[0]}`; (byPidSeason.get(k) ?? byPidSeason.set(k, []).get(k)).push(r) }
  const drop = new Set()
  const log = []
  const dayNum = (r) => Math.round(Date.UTC(Number(r[5].slice(0, 4)), Number(r[5].slice(5, 7)) - 1, Number(r[5].slice(8, 10))) / 86_400_000)
  const pointOnly = (r) => r[10] === '' && r[20] === '' && r[21] === ''
  const sandwichedBy = (r, others) => { const d = dayNum(r); return others.some((o) => o < d && o >= d - 3) && others.some((o) => o > d && o <= d + 3) }
  for (const [, rs] of byPidSeason) {
    const byTeam = new Map()
    for (const r of rs) (byTeam.get(r[6]) ?? byTeam.set(r[6], []).get(r[6])).push(r)
    if (byTeam.size < 2) continue
    // A. a row with only points among a season of full lines, wedged between another team's games: someone else's
    //    line under his id (Dwight Jones's Houston rows during his Chicago season, Johnny Davis's Utah rows)
    const fullShare = rs.filter((r) => !pointOnly(r)).length / rs.length
    if (fullShare >= 0.5) {
      for (const [team, trs] of byTeam) {
        const others = rs.filter((r) => r[6] !== team && !pointOnly(r)).map(dayNum).sort((a, b) => a - b)
        const ghosts = trs.filter((r) => pointOnly(r) && sandwichedBy(r, others))
        if (ghosts.length >= 2) { for (const r of ghosts) { drop.add(r); trace('point-only row wedged in', r) } log.push(`${rs[0][3]} ${rs[0][0]} ${team} ×${ghosts.length}`) }
      }
    }
    // B. the smaller stint's rows wedged between the bigger stint's games (George Mikan's Rochester and Washington
    //    rows of 1950-51 are Ed's); a man leaves a team, he doesn't shuttle
    const teams = [...byTeam].sort((a, b) => b[1].length - a[1].length)
    const [bigTeam, big] = teams[0]
    const bigDays = big.filter((r) => !drop.has(r)).map(dayNum).sort((a, b) => a - b)
    for (const [team, trs] of teams.slice(1)) {
      const ghosts = trs.filter((r) => !drop.has(r) && sandwichedBy(r, bigDays))
      if (ghosts.length >= 2) { for (const r of ghosts) { drop.add(r); trace(`wedged inside ${bigTeam}`, r) } log.push(`${rs[0][3]} ${rs[0][0]} ${team} ×${ghosts.length} inside ${bigTeam}`) }
    }
  }
  const kept = rows.filter((r) => !drop.has(r))
  rows.length = 0
  for (const r of kept) rows.push(r)
  console.log(`rows sandwiched between another team's games: dropped ${drop.size} rows (${log.slice(0, 8).join(' · ')}${log.length > 8 ? ' …' : ''})`)
}
{
  // one man, one day, two teams
  const byPid = new Map()
  for (const r of rows) (byPid.get(String(r[2])) ?? byPid.set(String(r[2]), []).get(String(r[2]))).push(r)
  const drop = new Set()
  const log = []
  for (const [pid, rs] of byPid) {
    rs.sort((a, b) => (a[5] < b[5] ? -1 : a[5] > b[5] ? 1 : 0))
    const byDate = new Map()
    for (const r of rs) (byDate.get(r[5]) ?? byDate.set(r[5], []).get(r[5])).push(r)
    const dupDates = [...byDate].filter(([, v]) => v.length > 1)
    if (!dupDates.length) continue
    const clean = rs.filter((r) => byDate.get(r[5]).length === 1)
    for (const [date, v] of dupDates) {
      if (new Set(v.map((r) => r[4])).size === 1) continue // the same game twice: a game suspended and finished after a trade (1978-11-08 NJN–PHL); both rows are real
      if (new Set(v.map((r) => r[6])).size === 1) continue // two games for one team in a day: the 1950s played doubleheaders
      // the nearest single-row game by date says which team he was on
      const d = Number(date.replace(/-/g, ''))
      let best = null, bestGap = Infinity
      for (const c of clean) { const gap = Math.abs(Number(c[5].replace(/-/g, '')) - d); if (gap < bestGap) { bestGap = gap; best = c } }
      if (!best) continue
      const keep = v.find((r) => r[6] === best[6]) ?? v[0]
      for (const r of v) if (r !== keep) { drop.add(r); trace('same day', r); log.push(`${date} ${r[3]} (${pid}) on ${r[6]}, kept ${keep[6]}`) }
    }
  }
  const kept = rows.filter((r) => !drop.has(r))
  rows.length = 0
  for (const r of kept) rows.push(r)
  console.log(`one man, one day, two teams: dropped ${drop.size} rows (${log.slice(0, 6).join(' · ')}${log.length > 6 ? ' …' : ''})`)
}
{
  // a stat at 0 for every player of a team-game is unrecorded
  const byTeamGame = new Map()
  for (const r of rows) { const k = `${r[4]}|${r[6]}`; (byTeamGame.get(k) ?? byTeamGame.set(k, []).get(k)).push(r) }
  const zeroed = {}
  for (const [, trs] of byTeamGame) {
    if (trs.length < 5 || Number(trs[0][0]) >= FULL_BOX) continue
    for (const [name, i] of [['reb', 20], ['ast', 21], ['pf', 25], ['fga', 13]]) {
      if (trs.every((r) => r[i] === 0 || r[i] === '0')) { for (const r of trs) r[i] = ''; zeroed[name] = (zeroed[name] ?? 0) + 1 }
    }
  }
  console.log(`team-games with a stat at 0 for every player, now unrecorded: ${JSON.stringify(zeroed)}`)
}

// ---- 2b. ghost rows: NBA.com carries a few lines twice in a team-game, under a second person id (Bingo Smith
// beside Randy Smith on 1980-01-11; Corey Williams under two ids in 1992-93), and the team's player points then
// add to more than its score by exactly that line. Where a row duplicates another row's whole line in the same
// team-game and the team score says the points are counted twice, the copy under the id with fewer games goes.
const teamScore = new Map() // gameNum -> scores
for (const t of readCsv(path.join(RAW, 'TeamStatistics.csv'))) { const n = Number(t.gameId); (teamScore.get(n) ?? teamScore.set(n, []).get(n)).push(Number(t.teamScore)) }
const gamesOf = new Map() // pid -> rows
for (const r of rows) gamesOf.set(String(r[2]), (gamesOf.get(String(r[2])) ?? 0) + 1)
const teamGamesOf = new Map() // `${pid}|${team}|${season}` -> rows
for (const r of rows) { const k = `${r[2]}|${r[6]}|${r[0]}`; teamGamesOf.set(k, (teamGamesOf.get(k) ?? 0) + 1) }
const byTeamGame = new Map()
for (const r of rows) { const k = `${r[4]}|${r[6]}`; (byTeamGame.get(k) ?? byTeamGame.set(k, []).get(k)).push(r) }
const ghosts = []
// the same line: every compared field equal, and at least four of them recorded (a 1950s line of blanks proves little)
const sameLine = (a, b) => { const idx = [10, 11, 12, 13, 16, 17, 20, 21]; return idx.every((i) => a[i] === b[i]) && idx.filter((i) => a[i] !== '').length >= 4 } // min pts fgm fga ftm fta reb ast
for (const [k, trs] of byTeamGame) {
  const scores = teamScore.get(Number(k.split('|')[0]))
  if (!scores || trs.some((r) => r[11] === '')) continue
  const pts = trs.reduce((t, r) => t + Number(r[11]), 0)
  if (scores.includes(pts)) continue
  const score = scores.reduce((best, x) => (Math.abs(x - pts) < Math.abs(best - pts) ? x : best), scores[0])
  const excess = pts - score
  if (excess <= 0) continue
  const pair = trs.flatMap((r) => trs.filter((o) => o !== r && String(o[2]) !== String(r[2]) && Number(r[11]) === excess && sameLine(r, o)).map((o) => [r, o]))[0]
  if (!pair) continue
  // the ghost: the man with fewer games on this team this season (George Mikan has none on Rochester but these), then the row with no minutes, then the shorter career
  const key = (r) => `${r[2]}|${r[6]}|${r[0]}`
  const rank = (r) => [teamGamesOf.get(key(r)), r[10] === '' ? 0 : 1, gamesOf.get(String(r[2]))]
  const [a, b] = pair.map(rank)
  const ghost = a[0] !== b[0] ? (a[0] < b[0] ? pair[0] : pair[1]) : a[1] !== b[1] ? (a[1] < b[1] ? pair[0] : pair[1]) : a[2] <= b[2] ? pair[0] : pair[1]
  ghosts.push(ghost)
  trace('ghost', ghost)
}
const ghostSet = new Set(ghosts)
const kept = rows.filter((r) => !ghostSet.has(r))
rows.length = 0
for (const r of kept) rows.push(r)
console.log(`dropped ${ghosts.length} ghost rows: ${ghosts.slice(0, 8).map((r) => `${r[5]} ${r[6]} ${r[3]} (${r[2]}) ${r[11]} pts`).join(' · ')}${ghosts.length > 8 ? ' …' : ''}`)

// ---- 3. people: birth dates and positions, and the latest spelling of each name
const latestName = new Map()
rows.sort((a, b) => (a[5] < b[5] ? -1 : a[5] > b[5] ? 1 : 0))
for (const r of rows) latestName.set(String(r[2]), r[3])
const people = []
for (const p of readCsv(path.join(RAW, 'Players.csv'))) {
  if (!latestName.has(p.personId)) continue
  const flags = [p.guard === '1' && 'G', p.forward === '1' && 'F', p.center === '1' && 'C'].filter(Boolean)
  // one flag is a position; two read as the first letter of the combo the roster would list (G-F -> G, F-C -> F)
  const pos = flags.length === 1 ? flags[0] : flags.length === 2 ? (flags.includes('G') ? 'G' : 'F') : ''
  people.push([p.personId, latestName.get(p.personId), /^\d{4}-\d{2}-\d{2}/.test(p.birthDate) ? p.birthDate.slice(0, 10) : '', pos, p.fromYear, p.toYear])
}
const missingPeople = [...latestName.keys()].filter((id) => !people.some((p) => p[0] === id))
for (const id of missingPeople) people.push([id, latestName.get(id), '', '', '', ''])

// ---- 4. what the team scores still say: the team-games whose player points miss the score, NBA.com's own book
{
  let checked = 0, over = 0, under = 0
  const by = new Map()
  for (const r of rows) { const k = `${r[4]}|${r[6]}`; (by.get(k) ?? by.set(k, []).get(k)).push(r) }
  for (const [k, trs] of by) {
    const scores = teamScore.get(Number(k.split('|')[0]))
    if (!scores || trs.some((r) => r[11] === '')) continue
    checked++
    const pts = trs.reduce((t, r) => t + Number(r[11]), 0)
    if (scores.includes(pts)) continue
    if (pts > Math.max(...scores)) over++; else under++
  }
  console.log(`team-games checked against a team score: ${checked}; player points over the score in ${over}, under it in ${under} (NBA.com's own book; a corrections layer could name them)`)
}

// ---- 5. write
const csv = (rs) => rs.map((r) => r.map((x) => (/[",\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(',')).join('\n') + '\n'
fs.writeFileSync(path.join(OUT, 'player_games.csv.gz'), zlib.gzipSync(Buffer.from(COLS.join(',') + '\n' + csv(rows)), { level: 9 }))
fs.writeFileSync(path.join(OUT, 'people.csv.gz'), zlib.gzipSync(Buffer.from('pid,name,born,pos,from,to\n' + csv(people)), { level: 9 }))
const kb = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0)
console.log(`wrote data/history/player_games.csv.gz (${kb('player_games.csv.gz')}KB, ${rows.length} rows, ${games.size} games) and people.csv.gz (${kb('people.csv.gz')}KB, ${people.length} people, ${missingPeople.length} without a bio)`)
console.log(`rows by season [regular, playoffs]: ${JSON.stringify(perSeason)}`)
const teams = [...new Set(rows.map((r) => r[6]))].sort()
console.log(`${teams.length} team codes: ${teams.join(' ')}`)

// Builds the ledger the site reads: per player, every game he appeared in,
// in order. The spine is hoopR's ESPN box scores (1993-94 on): a row per
// player per game with the line, the result and the starter flag. The NBA
// Stats box scores (1996-97 on) fill what ESPN lacks: about seventy whole
// games (most at Utah, Washington and Cleveland in the 1990s), a few hundred
// single rows, and the starters of the team-games where ESPN flags more or
// fewer than five (Miami and Indiana in 2004-07), read off NBA Stats' row
// order, which lists the five starters first. The ESPN bios supply the birth
// date, position and draft year; the NBA Stats rosters a birth date and the
// years of experience for the rest, which is how a career that began before
// 1993-94 is known.
//
// The output is columnar (src/lib/ledger.ts decodes it): src/data/ledger.json
// holds the players, with each one's slice of the game arrays, and
// src/data/cols/<name>.bin.gz holds one gzipped typed array per column over
// every game (players in order, each player's games in order). A million
// player-games as objects would cost a phone two hundred megabytes; as
// columns they cost twenty, and the page loads the stat columns a query
// reads and no others.
//
// What the data can't say, so the site doesn't: a career that began before
// 1993-94 (Jordan, Shaq, Hakeem) has no first N games here and sits out the
// career fields (`censored`); a team-game whose starters nobody can name has
// its rows flagged start-unknown, and the starts sequence sits a career out
// when one falls inside its window. A game is an appearance: a row with
// minutes or points; a DNP row is not a game.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { readCsv } from './lib/csv.mjs'
import { FIRST_SEASON, ESPN_FIRST_SEASON, STATS_FIRST_SEASON, XW_FIRST_SEASON, CURRENT_SEASON } from './lib/window.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW = path.join(ROOT, 'data/raw')
const OUT = path.join(ROOT, 'src/data')
const COLS_DIR = path.join(OUT, 'cols')
fs.mkdirSync(COLS_DIR, { recursive: true })

// the stat columns, in the order the line arrays below carry them; src/lib/ledger.ts has the same list
export const STAT_COLS = ['min', 'pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'oreb', 'dreb', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf']
// the flags column's bits
const F_POST = 1, F_HOME = 2, F_START = 4, F_STARTKNOWN = 8, F_WIN = 16
// a stat nobody recorded (steals before 1973-74, minutes before 1951-52): src/lib/ledger.ts reads the same sentinel
const UNK = 255

const has = (f) => fs.existsSync(path.join(RAW, f))
const csv = (f) => readCsv(path.join(RAW, f))
const num = (v) => (v === '' || v === 'NA' ? 0 : Math.round(Number(v)))
const yes = (v) => String(v).toLowerCase() === 'true'
const ymd = (s) => Number(s.slice(0, 10).replace(/-/g, ''))
/** days since 1946-01-01 of a YYYY-MM-DD */
const dayOf = (s) => Math.round((Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) - Date.UTC(1946, 0, 1)) / 86_400_000)
/** the season a date belongs to: the year it ends in; a season has never begun before Oct 15 nor ended after it */
const seasonOfDate = (s) => { const y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)), d = Number(s.slice(8, 10)); return m > 10 || (m === 10 && d >= 15) ? y + 1 : y }
/** "DEC 14, 1967" -> 1967-12-14 */
const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 }
const bornOf = (s) => { const m = /^([A-Z]{3}) (\d{1,2}), (\d{4})$/.exec(s.trim().toUpperCase()); return m && MONTHS[m[1]] ? `${m[3]}-${String(MONTHS[m[1]]).padStart(2, '0')}-${m[2].padStart(2, '0')}` : null }
const majority = (counter) => [...counter].sort((a, b) => b[1] - a[1])[0]?.[0]
const vote = (map, key, value, n = 1) => { const c = map.get(key) ?? map.set(key, new Map()).get(key); c.set(value, (c.get(value) ?? 0) + n) }
// a name the sources can agree on: lowercase letters only, no accents, no suffixes
const nameKey = (name) => String(name).normalize('NFD').replace(/\(.*?\)/g, '').replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi, '').replace(/[^a-zA-Z]/g, '').toLowerCase()

// the franchise codes, by ESPN team id and season: the code of the day (CHH
// is the first Hornets, NOH their New Orleans years, CHA the Bobcats and the
// Hornets since; WSB the Bullets; NJN, SEA, VAN before the moves)
function codeOf(teamId, season, espnAbbr) {
  switch (teamId) {
    case '3': return season <= 2002 ? 'CHH' : season <= 2013 ? 'NOH' : 'NOP'
    case '30': return 'CHA'
    case '17': return season <= 2012 ? 'NJN' : 'BKN'
    case '25': return season <= 2008 ? 'SEA' : 'OKC'
    case '29': return season <= 2001 ? 'VAN' : 'MEM'
    case '27': return season <= 1997 ? 'WSB' : 'WAS'
    case '9': return 'GSW'
    case '18': return 'NYK'
    case '24': return 'SAS'
    case '26': return 'UTA'
    default: return espnAbbr
  }
}
/** NBA Stats' tricode of the day to the same codes */
const codeOfTri = (tri, season) => (tri === 'NOK' ? 'NOH' : tri === 'WAS' && season <= 1997 ? 'WSB' : tri)

// ---- 1. the spine: ESPN's schedule says which games are league games; the box scores give every appearance
const games = new Map() // game key -> { season, post, date: 'YYYY-MM-DD', home, away (codes) }
const apps = [] // { pid, name, game, team, home, win, started (0|1|-1), line: number[16] }
const appIdx = new Map() // `${game}|${pid}` -> index in apps
const appKey = { has: (k) => appIdx.has(k), add: (k) => appIdx.set(k, apps.length) }
const starters = new Map() // `${game}|${team}` -> starters flagged
const teamRows = new Map() // `${game}|${team}` -> [app indexes]
const boxPos = new Map() // pid -> Map<pos, n>
const espnByKey = new Map() // `${date}|${home}|${away}` -> game key
const skipped = { allstar: 0, cup: 0, playin: 0, notFinal: 0, otherSeason: 0, noId: 0, dnp: 0, dupRow: 0 }
const espnGames = {} // season -> games with a box
for (let s = ESPN_FIRST_SEASON; s <= CURRENT_SEASON; s++) {
  if (!has(`player_box_${s}.csv`) || !has(`nba_schedule_${s}.csv`)) continue
  const sched = new Map() // ESPN game id -> { post }
  for (const g of csv(`nba_schedule_${s}.csv`)) {
    const id = g.game_id || g.id
    if (Number(g.season) !== s) { skipped.otherSeason++; continue }
    if (g.status_type_name !== 'STATUS_FINAL') { skipped.notFinal++; continue }
    if (g.type_abbreviation === 'ALLSTAR' || Number(g.home_id) > 30 || Number(g.away_id) > 30) { skipped.allstar++; continue }
    if (g.type_abbreviation === 'CC') { skipped.cup++; continue } // the NBA Cup final: not a regular-season game in the league's own books
    if (g.season_type === '5') { skipped.playin++; continue } // the play-in: neither regular season nor playoffs in the league's books
    if (g.season_type !== '2' && g.season_type !== '3') continue
    if (!(Number(g.home_score) > 0 || Number(g.away_score) > 0)) continue // a ghost row
    sched.set(id, { post: g.season_type === '3' ? 1 : 0 })
  }
  let n = 0
  for (const r of csv(`player_box_${s}.csv`)) {
    const sg = sched.get(r.game_id)
    if (!sg || Number(r.season) !== s) continue
    if (!r.athlete_id) { skipped.noId++; continue }
    if (r.minutes === '' && r.points === '') { skipped.dnp++; continue } // a DNP row, flagged or not
    const key = `espn:${r.game_id}`
    const ak = `${key}|${r.athlete_id}`
    if (appKey.has(ak)) { skipped.dupRow++; continue }
    appKey.add(ak)
    const date = r.game_date.slice(0, 10)
    const team = codeOf(r.team_id, s, r.team_abbreviation), opp = codeOf(r.opponent_team_id, s, r.opponent_team_abbreviation)
    const home = r.home_away === 'home'
    if (!games.has(key)) {
      games.set(key, { season: s, post: sg.post, date, home: home ? team : opp, away: home ? opp : team })
      espnByKey.set(`${date}|${home ? team : opp}|${home ? opp : team}`, key)
      n++
    }
    const started = yes(r.starter) ? 1 : 0
    const tk = `${key}|${team}`
    if (started) starters.set(tk, (starters.get(tk) ?? 0) + 1)
    ;(teamRows.get(tk) ?? teamRows.set(tk, []).get(tk)).push(apps.length)
    const pos = r.athlete_position_abbreviation
    if (pos && pos !== 'NA') vote(boxPos, r.athlete_id, pos)
    apps.push({
      pid: r.athlete_id, name: r.athlete_display_name, game: key, team, home, win: Number(r.team_score) > Number(r.opponent_team_score) ? 1 : 0, started,
      line: [num(r.minutes), num(r.points), num(r.field_goals_made), num(r.field_goals_attempted), num(r.three_point_field_goals_made), num(r.three_point_field_goals_attempted),
        num(r.free_throws_made), num(r.free_throws_attempted), num(r.offensive_rebounds), num(r.defensive_rebounds), num(r.rebounds), num(r.assists), num(r.steals), num(r.blocks), num(r.turnovers), num(r.fouls)],
    })
  }
  espnGames[s] = n
}

// ---- 2. the crosswalk: NBA Stats person id <-> ESPN athlete id, the id most seasons agree on
const espnVotes = new Map(), nbaVotes = new Map()
for (let s = XW_FIRST_SEASON; s <= CURRENT_SEASON; s++) {
  if (!has(`nba_player_crosswalk_${s}.csv`)) continue
  for (const r of csv(`nba_player_crosswalk_${s}.csv`)) {
    if (!r.nba_player_id || !r.espn_athlete_id) continue
    vote(espnVotes, r.nba_player_id, r.espn_athlete_id)
    vote(nbaVotes, r.espn_athlete_id, r.nba_player_id)
  }
}
const espnOf = new Map([...espnVotes].map(([k, c]) => [k, majority(c)]))
const nbaOf = new Map([...nbaVotes].map(([k, c]) => [k, majority(c)]))
// a player the crosswalk lacks, by name (unique spellings only)
const pidByName = new Map()
for (const a of apps) { const k = nameKey(a.name); const v = pidByName.get(k); if (v == null) pidByName.set(k, a.pid); else if (v !== a.pid) pidByName.set(k, -1) }

// ---- 3. NBA Stats: the games and rows ESPN lacks, and the starters where ESPN's flag is short
const filled = {} // season -> { games, rows, starters }
const fillLog = new Map() // `${pid}|${name}` -> rows filled
// the players on a team in a season, by every token of their name, for a row the crosswalk and the full name can't
// place (Nene vs Nene Hilario, Yao Ming vs Ming Yao, Didier Ilunga-Mbenga vs DJ Mbenga, two Larry Johnsons)
const tokens = (name) => String(name).normalize('NFD').replace(/\(.*?\)/g, '').toLowerCase().split(/[\s-]+/).map((t) => t.replace(/[^a-z]/g, '')).filter((t) => t && !/^(jr|sr|ii|iii|iv)$/.test(t))
const teamSeasonTokens = new Map() // `${team}|${season}` -> Map<token, Set<pid>>
for (const a of apps) { const k = `${a.team}|${games.get(a.game).season}`; const m = teamSeasonTokens.get(k) ?? teamSeasonTokens.set(k, new Map()).get(k); for (const t of tokens(a.name)) (m.get(t) ?? m.set(t, new Set()).get(t)).add(a.pid) }
const unmatchedTri = new Set()
const personVotes = new Map() // NBA person id -> Map<espn pid, weight>: the crosswalk's say, NBA Stats' rows, the box lines of 1993-94 to 1995-96
for (const [person, c] of espnVotes) for (const [pid, n] of c) vote(personVotes, person, pid, 1000 * n)
let statsGames = {}
for (let s = STATS_FIRST_SEASON; s <= CURRENT_SEASON; s++) {
  if (!has(`nbastats_player_boxscores_${s}.csv`) || !has(`nbastats_schedule_${s}.csv.gz`)) continue
  const f = (filled[s] = { games: 0, rows: 0, starters: 0, fixed: 0 })
  const sched = new Map() // nba game id -> { date, home, away, homePts, awayPts, post }
  for (const g of csv(`nbastats_schedule_${s}.csv.gz`)) {
    const kind = g.game_id.slice(0, 3)
    if (kind !== '002' && kind !== '004') continue // regular season and playoffs only: no preseason, All-Star, play-in or Cup final
    if (g.home_pts === '' || g.away_pts === '') continue
    sched.set(g.game_id, { date: g.game_date.slice(0, 10), home: codeOfTri(g.home_team_abbreviation, s), away: codeOfTri(g.away_team_abbreviation, s), homePts: Number(g.home_pts), awayPts: Number(g.away_pts), post: kind === '004' ? 1 : 0 })
  }
  statsGames[s] = sched.size
  const byGame = new Map() // nba game id -> [rows in file order]
  for (const r of csv(`nbastats_player_boxscores_${s}.csv`)) { if (sched.has(r.game_id)) (byGame.get(r.game_id) ?? byGame.set(r.game_id, []).get(r.game_id)).push(r) }
  for (const [gid, rows] of byGame) {
    const g = sched.get(gid)
    const date = g.date
    let key = espnByKey.get(`${date}|${g.home}|${g.away}`)
    if (key == null) {
      // ESPN dated four late West Coast games of February 2020 to the next day (UTC): the same teams a day off is the same game, and NBA Stats' date stands
      const shift = (d, n) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)) + n)).toISOString().slice(0, 10)
      for (const n of [1, -1]) {
        const k = espnByKey.get(`${shift(date, n)}|${g.home}|${g.away}`)
        if (k) { key = k; const eg = games.get(k); espnByKey.delete(`${eg.date}|${g.home}|${g.away}`); eg.date = date; espnByKey.set(`${date}|${g.home}|${g.away}`, k); f.redated = (f.redated ?? 0) + 1; break }
      }
    }
    const newGame = key == null
    if (newGame) {
      // a day earlier or later, in case the two sources disagree on a date (none seen, but cheap to check)
      key = `nba:${gid}`
      games.set(key, { season: s, post: g.post, date, home: g.home, away: g.away })
      espnByKey.set(`${date}|${g.home}|${g.away}`, key)
      f.games++
    }
    // the rows by team, in file order: the first five played are the starters
    const byTeam = new Map()
    for (const r of rows) (byTeam.get(r.team_tricode) ?? byTeam.set(r.team_tricode, []).get(r.team_tricode)).push(r)
    for (const [tri, trs] of byTeam) {
      const team = codeOfTri(tri, s)
      if (team !== g.home && team !== g.away) { unmatchedTri.add(`${s}:${tri}`); continue }
      const home = team === g.home, opp = home ? g.away : g.home
      const win = (home ? g.homePts > g.awayPts : g.awayPts > g.homePts) ? 1 : 0
      const tk = `${key}|${team}`
      const espnStarters = starters.get(tk) ?? 0
      const fixStarters = !newGame && espnStarters !== 5 && (teamRows.get(tk)?.length ?? 0) > 0
      const played = trs.filter((r) => r.minutes !== '' && (r.first_name || r.family_name))
      const idOf = (r) => {
        const xw = espnOf.get(r.person_id)
        if (xw) return xw
        const full = `${r.first_name} ${r.family_name}`
        const byFull = pidByName.get(nameKey(full))
        if (byFull && byFull !== -1) return byFull
        // the one player on this team this season whose name shares the most tokens (when he is already in this game, the row is his and adds nothing)
        const m = teamSeasonTokens.get(`${team}|${s}`)
        if (m) {
          const score = new Map()
          for (const t of tokens(full)) for (const pid of m.get(t) ?? []) score.set(pid, (score.get(pid) ?? 0) + 1)
          const best = [...score].sort((a, b) => b[1] - a[1])
          if (best.length && (best.length === 1 || best[0][1] > best[1][1])) return best[0][0]
        }
        return `n${r.person_id}`
      }
      const first5 = new Set(played.slice(0, 5).map(idOf))
      // an ESPN row of zeros for a man NBA Stats lists with no minutes, or doesn't list at all (Harden's 2023-10-31 under
      // the Clippers, six days before his Clippers debut), is a DNP ESPN wrote as a line of zeros
      if (!newGame) {
        const inBox = new Set(played.map(idOf))
        for (const i of teamRows.get(tk) ?? []) { const a = apps[i]; if (!a.nba && !inBox.has(a.pid) && a.line.every((v) => v === 0)) { a.drop = true; f.dnp = (f.dnp ?? 0) + 1 } }
      }
      if (fixStarters) {
        // ESPN flagged the wrong number of starters: NBA Stats' first five stand in, and the rest of the team's rows are not starters
        for (const i of teamRows.get(tk)) { apps[i].started = first5.has(apps[i].pid) ? 1 : 0 }
        starters.set(tk, teamRows.get(tk).filter((i) => apps[i].started === 1).length)
        f.starters++
      }
      for (const r of played) {
        const pid = idOf(r)
        if (!/^n\d/.test(String(pid))) vote(personVotes, r.person_id, pid)
        const ak = `${key}|${pid}`
        const mm = r.minutes.split(':')
        const min = Math.round(Number(mm[0]) + (Number(mm[1] ?? 0) >= 30 ? 1 : 0))
        const line = [min, num(r.points), num(r.field_goals_made), num(r.field_goals_attempted), num(r.three_pointers_made), num(r.three_pointers_attempted),
          num(r.free_throws_made), num(r.free_throws_attempted), num(r.rebounds_offensive), num(r.rebounds_defensive), num(r.rebounds_total), num(r.assists), num(r.steals), num(r.blocks), num(r.turnovers), num(r.fouls_personal)]
        if (appKey.has(ak)) {
          // both sources have the row: where their lines differ, the league's own book stands
          const a = apps[appIdx.get(ak)]
          let differs = false
          for (let k = 1; k < line.length; k++) if (a.line[k] !== line[k]) differs = true
          if (differs) { f.fixed++; a.line = [Math.abs(a.line[0] - min) > 1 ? min : a.line[0], ...line.slice(1)] }
          continue
        }
        appKey.add(ak)
        if (!newGame) { f.rows++; const lk = `${pid}|${r.first_name} ${r.family_name}`; fillLog.set(lk, (fillLog.get(lk) ?? 0) + 1) }
        const started = first5.has(pid) ? 1 : 0
        if (!espnOf.has(r.person_id)) espnOf.set(r.person_id, pid)
        ;(teamRows.get(tk) ?? teamRows.set(tk, []).get(tk)).push(apps.length)
        apps.push({
          pid, name: `${r.first_name} ${r.family_name}`.trim(), nba: true, game: key, team, home, win, started,
          line,
        })
      }
      if (newGame) starters.set(tk, 5)
    }
  }
}
// a team-game whose starters ESPN flagged wrong and NBA Stats didn't fix (or never had): its rows are start-unknown
let startUnknownRows = 0
const unknownByTeamGame = {}
for (const [tk, idx] of teamRows) {
  if ((starters.get(tk) ?? 0) === 5) continue
  const season = games.get(tk.split('|')[0]).season
  unknownByTeamGame[season] = (unknownByTeamGame[season] ?? 0) + 1
  for (const i of idx) { apps[i].started = -1; startUnknownRows++ }
}

// ---- 3b. the history: every player-game from 1946-47 to 1992-93 (data/history, built once by
// scripts/build-history.mjs from NBA.com's game logs and the Kaggle republication), the games of 1993-94 to
// 1995-96 that ESPN lacks, and the join of the ESPN era's players to their NBA person ids by their box lines,
// so a career that spans 1993-94 (Jordan's, Shaq's, Stockton's) is one career
const HIST = path.join(ROOT, 'data/history')
const histCode = (code, season) => ({ GOS: 'GSW', UTH: 'UTA', SAN: 'SAS', PHL: 'PHI' })[code] ?? (code === 'WAS' && season <= 1997 ? 'WSB' : code)
const people = new Map() // person id -> { name, born, pos }
const espnOfPerson = new Map(), personOfEspn = new Map()
const hist = { rows: 0, games: 0, stitched: 0, lineMatched: 0, filledGames: 0, filledRows: 0, persons: 0 }
if (fs.existsSync(path.join(HIST, 'player_games.csv.gz'))) {
  for (const r of readCsv(path.join(HIST, 'people.csv.gz'))) people.set(r.pid, { name: r.name, born: r.born || null, pos: r.pos || null })
  const histRows = readCsv(path.join(HIST, 'player_games.csv.gz'))
  // the box lines of the ESPN era's first three seasons, by date: the same line on the same day is the same man
  const lineIdx = new Map()
  for (const a of apps) {
    const g = games.get(a.game)
    if (a.nba || g.season < ESPN_FIRST_SEASON || g.season > ESPN_FIRST_SEASON + 2) continue
    const k = `${g.date}|${a.line[1]}|${a.line[10]}|${a.line[11]}|${a.line[3]}`
    ;(lineIdx.get(k) ?? lineIdx.set(k, []).get(k)).push(a.pid)
  }
  for (const r of histRows) {
    if (Number(r.season) < ESPN_FIRST_SEASON || r.pts === '' || r.reb === '' || r.ast === '' || r.fga === '') continue
    const m = lineIdx.get(`${r.date}|${r.pts}|${r.reb}|${r.ast}|${r.fga}`)
    if (m && m.length === 1) { vote(personVotes, r.pid, m[0]); hist.lineMatched++ }
  }
  // one ESPN id per person and one person per ESPN id: the heaviest pairs first
  const pairs = [...personVotes].flatMap(([person, c]) => [...c].map(([pid, n]) => [person, pid, n])).sort((a, b) => b[2] - a[2])
  for (const [person, pid] of pairs) { if (espnOfPerson.has(person) || personOfEspn.has(pid)) continue; espnOfPerson.set(person, pid); personOfEspn.set(pid, person) }
  hist.persons = espnOfPerson.size
  const u = (v) => (v === '' ? UNK : Math.round(Number(v)))
  const lineOf = (r) => [u(r.min), u(r.pts), u(r.fgm), u(r.fga), u(r.tpm), u(r.tpa), u(r.ftm), u(r.fta), u(r.oreb), u(r.dreb), u(r.reb), u(r.ast), u(r.stl), u(r.blk), u(r.tov), u(r.pf)]
  for (const r of histRows) {
    const season = Number(r.season)
    const team = histCode(r.team, season), opp = histCode(r.opp, season), home = r.home === '1'
    const gk = `${r.date}|${home ? team : opp}|${home ? opp : team}`
    let key = espnByKey.get(gk)
    const spine = season < ESPN_FIRST_SEASON
    if (!spine && key != null && !espnOfPerson.has(r.pid)) continue // an ESPN game, and a man the lines didn't place: his row is there under his ESPN id
    const pid = espnOfPerson.get(r.pid) ?? `n${r.pid}`
    if (key == null) {
      key = `h:${r.game}`
      if (!games.has(key)) { games.set(key, { season, post: r.post === '1' ? 1 : 0, date: r.date, home: home ? team : opp, away: home ? opp : team }); espnByKey.set(gk, key); if (spine) hist.games++; else hist.filledGames++ }
    }
    const ak = `${key}|${pid}`
    if (appKey.has(ak)) {
      // ESPN has the row as a line of zeros (Darrick Martin's whole 1994-95): the log's line stands
      const a = apps[appIdx.get(ak)]
      if (!spine && a.line.every((v) => v === 0)) { const line = lineOf(r); if (line.some((v) => v > 0 && v !== UNK)) { a.line = line; hist.fixedRows = (hist.fixedRows ?? 0) + 1 } }
      continue
    }
    appKey.add(ak)
    if (spine) { hist.rows++; if (espnOfPerson.has(r.pid)) hist.stitched++ } else hist.filledRows++
    apps.push({ pid, name: r.name, nba: true, game: key, team, home, win: r.win === '1' ? 1 : 0, started: -1, line: lineOf(r) })
  }
}

// ---- 4. the team's game number that season, and the season's length
const teamSeason = new Map() // `${team}|${season}` -> [{ key, post, date }]
for (const [key, g] of games) for (const team of [g.home, g.away]) (teamSeason.get(`${team}|${g.season}`) ?? teamSeason.set(`${team}|${g.season}`, []).get(`${team}|${g.season}`)).push({ key, post: g.post, date: g.date })
const tgnOf = new Map() // `${key}|${team}` -> n
const teamGames = {} // team -> season -> [reg, all]
for (const [k, list] of teamSeason) {
  const [team, season] = k.split('|')
  list.sort((a, b) => a.post - b.post || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  list.forEach((x, i) => tgnOf.set(`${x.key}|${team}`, i + 1))
  ;(teamGames[team] ??= {})[season] = [list.filter((x) => !x.post).length, list.length]
}

// ---- 5. bios: ESPN's birth date, position and draft year; NBA Stats rosters' birth date, position and years of experience
const bio = new Map() // espn id -> { born, pos, draft }
for (let s = ESPN_FIRST_SEASON; s <= CURRENT_SEASON; s++) {
  if (!has(`player_core_${s}.csv`)) continue
  for (const r of csv(`player_core_${s}.csv`)) {
    const b = bio.get(r.athlete_id) ?? bio.set(r.athlete_id, { born: null, pos: null, draft: null }).get(r.athlete_id)
    if (!b.born && r.date_of_birth) b.born = r.date_of_birth.slice(0, 10)
    if (!b.pos && r.position_abbreviation && r.position_abbreviation !== 'NA') b.pos = r.position_abbreviation
    if (!b.draft && r.draft_year) b.draft = Number(r.draft_year)
  }
}
const roster = new Map() // nba person id -> { born, pos: Map, debut }
const rosterByName = new Map() // nameKey -> person id (unique)
for (let s = STATS_FIRST_SEASON; s <= CURRENT_SEASON; s++) {
  if (!has(`nbastats_rosters_${s}.csv`)) continue
  for (const r of csv(`nbastats_rosters_${s}.csv`)) {
    if (!r.player_id) continue
    const b = roster.get(r.player_id) ?? roster.set(r.player_id, { born: null, pos: new Map(), debut: null, name: null }).get(r.player_id)
    if (!b.born && r.birth_date) b.born = bornOf(r.birth_date)
    b.name = r.player // the latest season's spelling
    if (r.position) b.pos.set(r.position, (b.pos.get(r.position) ?? 0) + 1)
    // years of experience before this season: a rookie's is R; the earliest roster says when the career began
    if (b.debut == null && r.exp !== '') b.debut = r.exp === 'R' ? s : Number.isInteger(Number(r.exp)) ? s - Number(r.exp) : null
    const k = nameKey(r.player); const v = rosterByName.get(k); if (v == null) rosterByName.set(k, r.player_id); else if (v !== r.player_id) rosterByName.set(k, -1)
  }
}

// ---- 6. the players, and the columns
const teams = [...new Set([...games.values()].flatMap((g) => [g.home, g.away]))].sort()
const ti = new Map(teams.map((t, i) => [t, i]))
const GROUP = { G: 'G', F: 'F', C: 'C', PG: 'G', SG: 'G', SF: 'F', PF: 'F', GF: 'G', 'G-F': 'G', 'F-G': 'G', FC: 'F', 'F-C': 'F', 'C-F': 'C', 'G/F': 'G', 'F/C': 'F', 'C/F': 'C' }
const group = (label) => (label ? GROUP[label] ?? GROUP[String(label).replace(/[^A-Z]/g, '').slice(0, 1)] ?? null : null)
const byPlayer = new Map()
// the name is ESPN's latest spelling (NBA Stats puts the family name last: "Ming Yao"), unless ESPN never had him
for (const a of apps) { if (a.drop) continue; const p = byPlayer.get(a.pid) ?? byPlayer.set(a.pid, { id: a.pid, name: a.name.trim(), apps: [] }).get(a.pid); if (!a.nba || p.apps.every((x) => x.nba)) p.name = a.name.trim(); p.apps.push(a) }
const dayOfGame = new Map([...games].map(([k, g]) => [k, dayOf(g.date)]))
const out = [] // the players, in order
const tally = { pos: {}, noBorn: 0, censored: 0, censoredGuess: 0, nbaOnly: 0 }
for (const p of byPlayer.values()) {
  p.apps.sort((a, b) => dayOfGame.get(a.game) - dayOfGame.get(b.game))
  const nba = nbaOf.get(p.id) ?? personOfEspn.get(p.id) ?? (/^n\d/.test(p.id) ? p.id.slice(1) : null) ?? (() => { const v = rosterByName.get(nameKey(p.name)); return v && v !== -1 ? v : null })()
  const ro = nba ? roster.get(nba) : null
  const hp = nba ? people.get(nba) : null
  // the NBA's spelling where it carries the accents ESPN drops (Dončić, Jokić) and is the same name
  if (ro?.name && /[^\x00-\x7f]/.test(ro.name) && nameKey(ro.name) === nameKey(p.name)) p.name = ro.name
  const b = bio.get(p.id)
  const first = games.get(p.apps[0].game).season
  // the position: the NBA Stats roster's (the league's label, one vote a season), else ESPN's (the box rows'
  // modal label, then the bio's; ESPN's is the player's profile position today, so Kobe reads SF there)
  const espnPos = group(boxPos.has(p.id) ? majority(boxPos.get(p.id)) : b?.pos)
  const rosterPos = group(ro && ro.pos.size ? majority(ro.pos) : null)
  // then NBA.com's own position flags (the history's people file), then ESPN's profile position (Magic reads F there)
  const histPos = group(hp?.pos)
  const pos = rosterPos ?? histPos ?? espnPos
  const posSrc = pos == null ? null : rosterPos ? 'roster' : histPos ? 'nba' : 'espn'
  tally.pos[posSrc ?? 'none'] = (tally.pos[posSrc ?? 'none'] ?? 0) + 1
  const born = b?.born ?? ro?.born ?? hp?.born ?? null
  if (!born) tally.noBorn++
  if (/^n\d/.test(p.id)) tally.nbaOnly++
  // when the career began: a draft year of 1993 or later says it began inside the ledger; else the rosters' years of
  // experience say so for anyone who lasted to 1996-97; otherwise a career whose first game is in the first season is
  // taken to have begun before it
  // a draft year inside the ledger wins over the roster's count, which can include seasons abroad (David Andersen, drafted 2002, debuted 2009-10 with "7 years")
  const known = b?.draft != null && b.draft >= FIRST_SEASON - 1 ? Math.max(first, b.draft + 1) : ro?.debut ?? null
  // the ledger begins with the league, so nothing began before it; the flag stays for a ledger that doesn't
  const censored = known != null && known < FIRST_SEASON
  if (censored) tally.censored++
  if (censored && known == null) tally.censoredGuess++
  out.push({ id: p.id, name: p.name, born, debut: first, cen: censored ? 1 : 0, pos, src: posSrc, apps: p.apps })
}
out.sort((a, b) => dayOfGame.get(a.apps[0].game) - dayOfGame.get(b.apps[0].game) || (a.id < b.id ? -1 : 1))

const N = apps.filter((a) => !a.drop).length
const col = { day: new Uint16Array(N), season: new Uint8Array(N), flags: new Uint8Array(N), team: new Uint8Array(N), opp: new Uint8Array(N), tgn: new Uint8Array(N) }
for (const s of STAT_COLS) col[s] = new Uint8Array(N)
let i = 0, clipped = 0
const players = []
for (const p of out) {
  const lo = i
  for (const a of p.apps) {
    const g = games.get(a.game)
    col.day[i] = dayOfGame.get(a.game)
    col.season[i] = g.season - 1900 // 1947 to 2155 fit a byte
    col.flags[i] = (g.post ? F_POST : 0) | (a.home ? F_HOME : 0) | (a.started === 1 ? F_START : 0) | (a.started >= 0 ? F_STARTKNOWN : 0) | (a.win ? F_WIN : 0)
    col.team[i] = ti.get(a.team)
    col.opp[i] = ti.get(a.home ? g.away : g.home)
    col.tgn[i] = tgnOf.get(`${a.game}|${a.team}`) ?? 0
    for (let k = 0; k < STAT_COLS.length; k++) { const v = a.line[k]; if (v > 254 && v !== UNK || v < 0) clipped++; col[STAT_COLS[k]][i] = Math.max(0, Math.min(255, v)) }
    i++
  }
  players.push({ id: p.id, name: p.name, born: p.born, debut: p.debut, cen: p.cen, pos: p.pos, src: p.src, lo, n: p.apps.length })
}
if (clipped) throw new Error(`${clipped} values outside a byte`)

// the starter flag is ESPN's from the first season on; a team-game nobody can name the starters of is start-unknown
const startsSince = ESPN_FIRST_SEASON
const builtAt = new Date().toISOString()
const cols = Object.fromEntries(Object.keys(col).map((k) => [k, col[k] instanceof Uint16Array ? 'u16' : 'u8']))
for (const [k, arr] of Object.entries(col)) fs.writeFileSync(path.join(COLS_DIR, `${k}.bin.gz`), zlib.gzipSync(Buffer.from(arr.buffer), { level: 9 }))
const file = { v: 3, builtAt, firstSeason: FIRST_SEASON, currentSeason: CURRENT_SEASON, startsSince, n: N, cols, teams, teamGames, players }
const text = JSON.stringify(file)
fs.writeFileSync(path.join(OUT, 'ledger.json'), text)

const kb = (f) => (fs.statSync(path.join(COLS_DIR, f)).size / 1024).toFixed(0)
const perSeason = {}
for (const g of games.values()) perSeason[g.season] = (perSeason[g.season] ?? 0) + 1
console.log(`${players.length} players, ${N} appearances, ${games.size} games; ledger.json ${(text.length / 1024).toFixed(0)}KB, columns ${fs.readdirSync(COLS_DIR).map((f) => `${f.replace('.bin.gz', '')} ${kb(f)}KB`).join(', ')}`)
console.log(`games by season ${JSON.stringify(perSeason)}`)
console.log(`ESPN games by season ${JSON.stringify(espnGames)}; NBA Stats games by season ${JSON.stringify(statsGames)}`)
console.log(`filled from NBA Stats ${JSON.stringify(filled)}; unmatched NBA Stats tricodes ${[...unmatchedTri].join(' ') || 'none'}`)
console.log(`skipped ${JSON.stringify(skipped)}`)
console.log(`history ${JSON.stringify(hist)}`)
console.log(`most rows filled: ${[...fillLog].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, n]) => `${k} ${n}`).join(' · ')}`)

console.log(`start-unknown rows ${startUnknownRows}, team-games by season ${JSON.stringify(unknownByTeamGame)}`)
console.log(`positions by source ${JSON.stringify(tally.pos)}, no birth date ${tally.noBorn}, censored careers ${tally.censored} (${tally.censoredGuess} by first season alone), NBA Stats-only ids ${tally.nbaOnly}`)
console.log(`teams ${teams.join(' ')}`)
console.log(`built ${builtAt}`)

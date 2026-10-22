// Downloads the hoopR (sportsdataverse) NBA release files the ledger is built
// from into data/raw/ (gitignored). Skips a file that is already there; the
// running season's files refetch after a day. Releases:
// https://github.com/sportsdataverse/sportsdataverse-data/releases
//   espn_nba_player_boxscores/player_box_<season>.csv        ESPN box scores, 1993-94 on: the spine (a row per player per game, the starter flag, the result)
//   espn_nba_schedules/nba_schedule_<season>.csv             ESPN schedule: the game type (All-Star, the NBA Cup final), the status, the teams' ids
//   espn_nba_player_core/player_core_<season>.csv            ESPN bios: birth date, position, draft year
//   nba_stats_player_boxscores/player_boxscores_<season>.csv NBA Stats box scores, 1996-97 on: the games and rows ESPN lacks, a starter where ESPN's flag is short
//   nba_stats_schedules/nba_schedule_<season>.csv.gz         NBA Stats schedule: the date and teams of each NBA Stats game id
//   nba_stats_rosters/rosters_<season>.csv                   NBA Stats rosters, 1996-97 on: birth dates and years of experience (who played before 1993-94)
//   nba_crosswalk/nba_player_crosswalk_<season>.csv          ESPN athlete id <-> NBA Stats person id, 2001-02 on
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESPN_FIRST_SEASON, STATS_FIRST_SEASON, XW_FIRST_SEASON, CURRENT_SEASON } from './lib/window.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW = path.join(ROOT, 'data/raw')
const BASE = 'https://github.com/sportsdataverse/sportsdataverse-data/releases/download'
fs.mkdirSync(RAW, { recursive: true })

const wants = [] // [asset, local name, optional]
for (let s = ESPN_FIRST_SEASON; s <= CURRENT_SEASON; s++) {
  wants.push([`espn_nba_player_boxscores/player_box_${s}.csv`, `player_box_${s}.csv`])
  wants.push([`espn_nba_schedules/nba_schedule_${s}.csv`, `nba_schedule_${s}.csv`])
  wants.push([`espn_nba_player_core/player_core_${s}.csv`, `player_core_${s}.csv`])
}
for (let s = STATS_FIRST_SEASON; s <= CURRENT_SEASON; s++) {
  // the NBA Stats pipeline lags ESPN's by weeks at the start of a season: its running-season files may not exist yet
  const optional = s === CURRENT_SEASON
  wants.push([`nba_stats_player_boxscores/player_boxscores_${s}.csv`, `nbastats_player_boxscores_${s}.csv`, optional])
  wants.push([`nba_stats_schedules/nba_schedule_${s}.csv.gz`, `nbastats_schedule_${s}.csv.gz`, optional])
  wants.push([`nba_stats_rosters/rosters_${s}.csv`, `nbastats_rosters_${s}.csv`, optional])
}
for (let s = XW_FIRST_SEASON; s <= CURRENT_SEASON; s++) wants.push([`nba_crosswalk/nba_player_crosswalk_${s}.csv`, `nba_player_crosswalk_${s}.csv`, s === CURRENT_SEASON])

// the running season's files change nightly; refetch those when older than a day
const fresh = (file) => {
  if (!fs.existsSync(file)) return false
  const running = file.includes(`_${CURRENT_SEASON}.`)
  return !running || Date.now() - fs.statSync(file).mtimeMs < 86_400_000
}

let n = 0
const pool = []
const one = async ([asset, name, optional]) => {
  const file = path.join(RAW, name)
  if (fresh(file)) return
  const res = await fetch(`${BASE}/${asset}`)
  if (!res.ok) {
    await res.body?.cancel()
    if (optional) { console.warn(`fetch ${asset}: HTTP ${res.status} (not there yet)`); return }
    console.error(`fetch ${asset}: HTTP ${res.status}`); process.exitCode = 1; return
  }
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  n++
  console.log(`${name} ${(fs.statSync(file).size / 1024).toFixed(0)}KB`)
}
// six at a time
for (let i = 0; i < wants.length; i += 6) await Promise.all(wants.slice(i, i + 6).map(one))
console.log(`fetched ${n} file(s) into data/raw`)

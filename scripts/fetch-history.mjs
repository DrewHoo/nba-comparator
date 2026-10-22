// Fetches the history the ledger starts from, once: NBA.com's game logs
// (stats.nba.com `leaguegamelog`, PlayerOrTeam=P, regular season and playoffs,
// 1946-47 to 1995-96) into data/raw/history/lgl_P_{RS,PO}_<YYYY-YY>.json, and
// the Kaggle republication's files (Eoin A. Moore, CC0) that patch and check
// them. Skips a file that is already there. Runs on a Mac at reader pace
// (2.5 s between requests: stats.nba.com stalls datacenter IPs and rate
// limits); CI never runs it, because scripts/build-history.mjs turns the
// result into the committed data/history files. Drew's call, 2026-10-21: the
// league's own logs over the CC0 copy, for the nulls and the folded
// franchises the copy lacks.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIRST_SEASON, ESPN_FIRST_SEASON } from './lib/window.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW = path.join(ROOT, 'data/raw/history')
fs.mkdirSync(RAW, { recursive: true })

/** the last season (by its end year) the history carries: the ESPN era's first three, for the id join in the ledger builder */
const LAST = ESPN_FIRST_SEASON + 2
const PAUSE = 2500
// the headers the nba_api client sends; stats.nba.com answers nothing without a browser's
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  Connection: 'keep-alive',
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`

let n = 0
for (let season = FIRST_SEASON; season <= LAST; season++) {
  for (const [kind, type] of [['RS', 'Regular Season'], ['PO', 'Playoffs']]) {
    const file = path.join(RAW, `lgl_P_${kind}_${label(season)}.json`)
    if (fs.existsSync(file)) continue
    const url = `https://stats.nba.com/stats/leaguegamelog?Counter=0&DateFrom=&DateTo=&Direction=ASC&LeagueID=00&PlayerOrTeam=P&Season=${label(season)}&SeasonType=${encodeURIComponent(type)}&Sorter=DATE`
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) })
    if (!res.ok) { console.error(`${label(season)} ${kind}: HTTP ${res.status}`); process.exitCode = 1; await sleep(PAUSE); continue }
    const body = await res.json()
    const rows = body?.resultSets?.[0]?.rowSet?.length ?? 0
    fs.writeFileSync(file, JSON.stringify(body))
    console.log(`${label(season)} ${kind}: ${rows} rows`)
    n++
    await sleep(PAUSE)
  }
}

// the Kaggle files download one at a time without an account (a signed redirect); the whole-dataset zip needs a login
const KAGGLE = 'https://www.kaggle.com/api/v1/datasets/download/eoinamoore/historical-nba-data-and-player-box-scores'
for (const name of ['PlayerStatistics.csv', 'Players.csv', 'TeamStatistics.csv']) {
  const file = path.join(RAW, name)
  if (fs.existsSync(file)) continue
  const res = await fetch(`${KAGGLE}/${name}`, { redirect: 'follow' })
  if (!res.ok) { console.error(`kaggle ${name}: HTTP ${res.status}`); process.exitCode = 1; continue }
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  console.log(`${name} ${(fs.statSync(file).size / 1024 / 1024).toFixed(0)}MB`)
  n++
}
console.log(`fetched ${n} file(s) into data/raw/history; now: npm run history`)

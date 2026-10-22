// Prints a player's page as the records mine would build it: every family,
// its best row with the score's terms, the rest folded. Reads the built
// files (public/players, `npm run records`) when they are there, else mines
// the catalog first (~12 s). Usage:
//   node scripts/records.mjs "LeBron James" "Victor Wembanyama"
//   FAMS=30 ROWS=5 FAMILY=pts node scripts/records.mjs "Zion Williamson"
//   MINE=1 node scripts/records.mjs ...   (mine afresh, ignoring the files)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadLedger } from './lib/ledger-node.mjs'
import { spanWords } from '../src/lib/ledger.ts'
import { decodePlayer, mine, page, shapesFor, RECORDS } from '../src/lib/records.ts'
import { queryWords, recordWords, placeWords, runWords, breakerWords } from '../src/lib/words.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'public/players')
const names = process.argv.slice(2)
const L = loadLedger()
const plain = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const fromFiles = !process.env.MINE && fs.existsSync(path.join(DIR, 'index.json'))
let rows = null
if (!fromFiles) {
  const t0 = Date.now()
  const shapes = shapesFor('ALL')
  rows = mine(L, shapes)
  console.log(`${shapes.length} shapes, ${rows.length} rows, ${((Date.now() - t0) / 1000).toFixed(1)}s`)
} else console.log(`from ${path.relative(ROOT, DIR)} (MINE=1 to mine afresh)`)

const words = (r) => `${recordWords(r)} — ${placeWords(r)}${runWords(r, RECORDS.minN[r.shape.seq]) ? ' · ' + runWords(r, RECORDS.minN[r.shape.seq]) : ''}${r.breaker ? ' · ' + breakerWords(r) : ''}`
const terms = (r) => Object.entries(r.terms).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v.toFixed(1)}`).join(' ')

for (const name of names) {
  const p = L.players.find((x) => x.name === name) ?? L.players.find((x) => plain(x.name) === plain(name))
  if (!p) { console.log(`\n${name}: not in the ledger`); continue }
  let own
  if (fromFiles) {
    const f = path.join(DIR, `${p.id}.json`)
    own = fs.existsSync(f) ? decodePlayer(JSON.parse(fs.readFileSync(f, 'utf8'))) : []
  } else own = rows.filter((r) => r.player.id === p.id)
  const fams = page(own, p.id)
  const n = fams.reduce((s, f) => s + 1 + f.rest.length, 0)
  console.log(`\n=== ${p.name} (${spanWords(L.season[p.lo], L.season[p.hi - 1])}, ${p.hi - p.lo} games${p.censored ? ', began before the ledger' : ''}): ${fams.length} families, ${n} rows of ${own.length} mined ===`)
  const FAMS = Number(process.env.FAMS ?? 18), ROWS = Number(process.env.ROWS ?? 3)
  const only = process.env.FAMILY
  for (const f of fams.filter((f) => !only || f.key.startsWith(only)).slice(0, FAMS)) {
    const r = f.best
    console.log(`\n[${r.score.toFixed(1)}] ${r.live ? 'LIVE' : r.kind.toUpperCase()} · ${queryWords({ ...r.shape, n: r.at })}`)
    console.log(`   ${words(r)}`)
    console.log(`   ${terms(r)}${r.folded.length ? ` · folds ${r.folded.length}` : ''}`)
    for (const s of f.rest.slice(0, ROWS)) console.log(`   + [${s.score.toFixed(1)}] ${s.live ? 'live' : s.kind} · ${words(s)}`)
    if (f.rest.length > ROWS) console.log(`   + ${f.rest.length - ROWS} more`)
  }
}

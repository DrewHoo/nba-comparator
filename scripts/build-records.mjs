// Mines what every player leads (src/lib/records.ts) over the one ledger,
// the whole field (`pos: 'ALL'`), and writes one file per player with a row
// to public/players/<id>.json, plus public/players/index.json: every player
// in the ledger (the finder lists everyone), with `n` his rows and `top` his
// best score (0 and null without a page), the best first. Runs before
// `vite build` so the files ship with the site, and on its own
// (`npm run records`) for the dev server. Nothing here is committed; the
// ledger in src/data is the source. One thread mines the catalog in ~12 s on
// an M-series Mac, so there are no workers.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { loadLedger } from './lib/ledger-node.mjs'
import { encodePlayer, mine, shapesFor } from '../src/lib/records.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/players')
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const t0 = Date.now()
const L = loadLedger()
const t1 = Date.now()
const shapes = shapesFor('ALL')
const rows = mine(L, shapes)
const t2 = Date.now()
const by = new Map()
for (const r of rows) (by.get(r.player.id) ?? by.set(r.player.id, []).get(r.player.id)).push(r)

const index = []
let bytes = 0, gz = 0, biggest = { id: null, name: '', bytes: 0, gz: 0 }
for (const p of L.players) {
  const own = by.get(p.id) ?? []
  const file = encodePlayer(L, p, own)
  if (own.length) {
    const json = JSON.stringify(file)
    fs.writeFileSync(path.join(OUT, `${p.id}.json`), json)
    const z = zlib.gzipSync(json).length
    bytes += json.length; gz += z
    if (json.length > biggest.bytes) biggest = { id: p.id, name: p.name, bytes: json.length, gz: z }
  }
  index.push({ id: p.id, name: p.name, pos: p.pos, from: file.from, to: file.to, games: file.games, n: own.length, top: own.length ? Math.round(Math.max(...own.map((r) => r.score)) * 10) / 10 : null })
}
// the best pages first, then the biggest careers (what the finder lists before anything is typed)
index.sort((a, b) => (b.top ?? -Infinity) - (a.top ?? -Infinity) || b.games - a.games || a.name.localeCompare(b.name))
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index))
const kb = (n) => `${(n / 1024).toFixed(0)} KB`
console.log(`ledger ${L.players.length} players, ${L.n} games, loaded in ${((t1 - t0) / 1000).toFixed(1)}s`)
console.log(`${shapes.length} shapes, ${rows.length} rows, mined in ${((t2 - t1) / 1000).toFixed(1)}s`)
console.log(`${by.size} of ${L.players.length} players with a page: ${kb(bytes)} raw, ${kb(gz)} gzipped; the biggest ${biggest.name} (${biggest.id}) ${kb(biggest.bytes)}, ${kb(biggest.gz)} gzipped`)
console.log(`${index.length} players in public/players/index.json, ${((Date.now() - t0) / 1000).toFixed(1)}s in all`)

// The ledger for a script: src/data/ledger.json plus every column, gunzipped
// and decoded. The page loads columns one at a time (src/lib/load.ts); a
// script wants them all.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { decodeLedger } from '../../src/lib/ledger.ts'

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/data')

export function readLedgerFile() {
  return JSON.parse(fs.readFileSync(path.join(DATA, 'ledger.json'), 'utf8'))
}

/** every column, by name, as bytes */
export function readCols(names = null) {
  const out = {}
  for (const f of fs.readdirSync(path.join(DATA, 'cols'))) {
    if (!f.endsWith('.bin.gz')) continue
    const name = f.replace('.bin.gz', '')
    if (names && !names.includes(name)) continue
    out[name] = new Uint8Array(zlib.gunzipSync(fs.readFileSync(path.join(DATA, 'cols', f))))
  }
  return out
}

export function loadLedger() {
  return decodeLedger(readLedgerFile(), readCols())
}

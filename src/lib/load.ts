// Loading the ledger's columns: each is a gzipped typed array
// (src/data/cols/<name>.bin.gz), fetched and inflated here with the
// platform's DecompressionStream (browsers, Node 22, workerd). The page
// loads the base columns and the default board's before it hydrates, then a
// query's columns as the query needs them (`ensureCols`); the share worker
// loads from the site's own dist/data. Pure of React; the app and the worker
// both import it.
import { attachCol, BASE_COLS, decodeLedger, missingCols, type ColBytes, type ColName, type Ledger, type LedgerFile } from './ledger.ts'

/** the inflated bytes of a gzipped column; a server that already inflated it (Vite's dev server sends `.gz` with content-encoding: gzip) hands over plain bytes, which the magic number tells apart */
export async function inflate(res: Response): Promise<Uint8Array> {
  if (!res.ok) throw new Error(`column ${res.url}: HTTP ${res.status}`)
  const raw = new Uint8Array(await res.arrayBuffer())
  if (!(raw[0] === 0x1f && raw[1] === 0x8b)) return raw
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export type ColUrl = (name: ColName) => string

/** fetch several columns at once */
export async function fetchCols(url: ColUrl, names: ColName[], init?: RequestInit): Promise<Partial<Record<ColName, ColBytes>>> {
  const out: Partial<Record<ColName, ColBytes>> = {}
  await Promise.all(names.map(async (k) => { out[k] = await inflate(await fetch(url(k), init)) }))
  return out
}

/** the ledger with the base columns and `extra`, from a file and a column URL */
export async function loadLedger(file: LedgerFile, url: ColUrl, extra: ColName[] = [], init?: RequestInit): Promise<Ledger> {
  return decodeLedger(file, await fetchCols(url, [...new Set([...BASE_COLS, ...extra])], init))
}

// a column fetched once per ledger, however many queries ask for it while it is in flight
const inFlight = new WeakMap<Ledger, Map<ColName, Promise<void>>>()

/** the columns a query reads, loaded onto the ledger; resolves when they are all there */
export async function ensureCols(L: Ledger, url: ColUrl, names: Iterable<ColName>, init?: RequestInit): Promise<void> {
  const missing = missingCols(L, names)
  if (!missing.length) return
  const flights = inFlight.get(L) ?? inFlight.set(L, new Map()).get(L)!
  await Promise.all(missing.map((k) => {
    let p = flights.get(k)
    if (!p) {
      p = fetch(url(k), init).then(inflate).then((bytes) => { attachCol(L, k, bytes) }).finally(() => flights.delete(k))
      flights.set(k, p)
    }
    return p
  }))
}

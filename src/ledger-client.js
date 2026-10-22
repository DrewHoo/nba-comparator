// Where the page finds its ledger: the players file is bundled (its own
// chunk, so a code change doesn't refetch it), the columns are hashed assets
// fetched one at a time as a query needs them (src/lib/load.ts).
import file from './data/ledger.json'

export const ledgerFile = file

const urls = import.meta.glob('./data/cols/*.bin.gz', { query: '?url', import: 'default', eager: true })

/** the asset URL of a column */
export const colUrl = (name) => {
  const u = urls[`./data/cols/${name}.bin.gz`]
  if (!u) throw new Error(`no column ${name}`)
  return u
}

// JSON-LD pieces the prerender puts in a page's @graph: a ranked list for a
// board (its top rows, each linking to the player's page when he has one)
// and for a player page (his family faces). Pure; the words are words.ts's,
// so the list says what the page says. Streak King's itemList, by name.
import { recordWords, rowName, rowWords } from '../../src/lib/words.ts'

/**
 * An ItemList: `items` in order, each `{ name, url? }`.
 * @param {{ name: string, url?: string, items: { name: string, url?: string }[] }} list
 */
export const itemListOf = ({ name, url, items }) => ({
  '@type': 'ItemList',
  name,
  ...(url ? { url } : {}),
  itemListOrder: 'https://schema.org/ItemListOrderAscending',
  numberOfItems: items.length,
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...(it.url ? { url: it.url } : {}) })),
})

/**
 * A board's top n ranked rows as items: "Wilt Chamberlain: 3,748 points through his first 100 games",
 * with the player's page where `pages` has his id.
 * @param {import('../../src/lib/query.ts').Board} board
 * @param {import('../../src/lib/query.ts').Query} q
 * @param {import('../../src/lib/ledger.ts').Ledger} _L unused today; the words read the row and the query
 * @param {{ playerUrl: (id: string) => string, pages?: Set<string>, n?: number, site?: string }} opts
 */
export function boardItems(board, q, _L, { playerUrl, pages = new Set(), n = 10 }) {
  return board.ranked.slice(0, n).map((r) => ({
    name: `${rowName(r)}: ${rowWords(r, q)}`,
    ...(pages.has(r.player.id) ? { url: playerUrl(r.player.id) } : {}),
  }))
}

/**
 * A player page's family faces as items: "10,000 points in 358 games".
 * @param {import('../../src/lib/records.ts').Family[]} fams
 */
export const playerItems = (fams) => fams.map((f) => ({ name: recordWords(f.best) }))

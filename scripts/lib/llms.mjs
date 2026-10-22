// llms.txt (llmstxt.org): the site in plain markdown for a language model
// that reads it, the way a person reads the board: what it is, then one line
// per named board with its leader, then the player pages and the data. Said
// the way the pages say it, nothing more. Streak King's, in shape.
//
//   fs.writeFileSync(path.join(ROOT, 'dist', 'llms.txt'), llmsText({ ... }))
import { seasonWords } from '../../src/lib/ledger.ts'
import { ESPN_FIRST_SEASON } from './window.mjs'

const REPO = 'https://github.com/DrewHoo/nba-comparator'

/** a line: "- [h1](url) — lead" (the lead optional) */
const line = ({ text, url, lead }) => `- [${text}](${url})${lead ? ` — ${lead}` : ''}`

/**
 * The llms.txt markdown.
 * @param {{
 *   site: string,              // the site's URL, with the trailing slash
 *   title: string,             // site.config.js title
 *   description: string,       // site.config.js description
 *   firstSeason: number,       // the ledger's first season by its end year (1947)
 *   currentSeason: number,     // the running season (2027)
 *   landings: { h1: string, url: string, lead?: string }[],
 *   players: { name: string, url: string, lead?: string }[],  // five examples
 *   playerCount: number,       // how many player pages there are
 *   espnFirst?: number,        // the first ESPN season (1994)
 * }} o
 */
export function llmsText({ site, title, description, firstSeason, currentSeason, landings = [], players = [], playerCount, espnFirst = ESPN_FIRST_SEASON }) {
  const first = seasonWords(firstSeason), espn = seasonWords(espnFirst)
  const count = (playerCount ?? players.length).toLocaleString('en-US')
  return `# ${title}

> ${description}

Every row is a player's games in order, with the box-score line and the result, from the league's first season (${first}, the BAA) to ${seasonWords(currentSeason)}. From ${espn} on the games are the ESPN box scores hoopR (sportsdataverse) publishes, CC BY 4.0, with hoopR's NBA Stats box scores filling what ESPN lacks; before ${espn} they are NBA.com's own game logs, patched from a CC0 republication of the same data. The board at ${site} ranks every career, or every player-season, by its value at the same point: the most points through the first 100 games, the fewest games to 10,000 points, triple-doubles in a team's first 82 games. Any stat, threshold, window and position; the regular season by default, the playoffs optional. Open a row to read it against a peer. It updates daily in season.

## Boards

The comparisons people search for, each at its own address.

${landings.map((l) => line({ text: l.h1, url: l.url, lead: l.lead })).join('\n')}

## Players

A page per player at ${site}player/<id>/ (${count} of them), listing every comparison he leads, or once led, at some point in his career. For example:

${players.map((p) => line({ text: p.name, url: p.url, lead: p.lead })).join('\n')}

## Data

- [Method](${site}#method): the sources, the rulings (what counts as a game, a start, a triple-double) and the era each stat is recorded from.
- [The repository](${REPO}): the ledger, the engine and the known-answer gate.
`
}

// The one file to edit when you start a project from this template.
// The URL slug is NOT here: it is the "name" in package.json, and it has to
// equal the GitHub repo name, because the site serves at https://<domain>/<repo>/.
import { FIRST_SEASON } from './scripts/lib/window.mjs'

// the ledger's first season (scripts/lib/window.mjs), named by the year it ends, never typed here: 1994 reads "1993-94"
const since = `${FIRST_SEASON - 1}-${String(FIRST_SEASON % 100).padStart(2, '0')}`

export default {
  domain: 'drewhoover.com',
  title: 'NBA Comparator',
  description:
    `Compare NBA players at the same point in their careers: points through the first 100 games, triple-doubles through a rookie season, fastest to 10,000 points, 30-point games in a team's first 20. Build the comparison, see who stacks up, every career since ${since}.`,
  ogSubtitle: 'Same point in the career. Who stacks up.',
  ogImageAlt: 'A ranked list of NBA players compared at the same point in their careers, on a dark background.',
  accent: '#c36c36',
}

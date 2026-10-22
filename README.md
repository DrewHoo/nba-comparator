# NBA Comparator

[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-support%20the%20site-ff5e5b?logo=ko-fi&logoColor=white)](https://ko-fi.com/drewhooverdotcom)

Compare NBA players at the same point in their careers. Set the sentence (who · did what · how much · over which games · against whom) and the board ranks every career, or every player-season, by its value at that window: points through the first 100 games, triple-doubles through a rookie season, the fewest games to 10,000 points, 30-point games in a team's first 20. Open a row to read it against a peer: where their curves met, and what the player needs over the next five games to match. Every player also gets a page listing what he leads, or once led, at some point in his career. Live at [drewhoover.com/nba-comparator](https://drewhoover.com/nba-comparator/).

The data is [hoopR](https://github.com/sportsdataverse/sportsdataverse-data/releases) (sportsdataverse) ESPN box scores 1993-94 on, with NBA Stats box scores filling what ESPN lacks, CC BY 4.0. A career that began before 1993-94 has no first 100 games here, so it sits out the career boards. The data follows the [receipts-research](https://github.com/DrewHoo/receipts-research) method: code does the counting, and the known-answer gate fails the tests on a published number the ledger can't reproduce.

```bash
npm install
npm run fetch:history  # once, on a Mac: NBA.com's game logs 1946-47 to 1995-96 and the CC0 Kaggle patch, into data/raw/history/
npm run history        # turns them into the committed data/history/ files the ledger starts from (CI never runs these two)
npm run fetch          # hoopR release files into data/raw/
npm run ledger         # src/data/ledger.json and the columns under src/data/cols/
npm run records        # every player's records, public/players/
npm test               # the known-answer gate and the engine's tests
npm run dev
npm run build          # the site, with a prerendered page and social card per player
npm run gen:og         # public/og.png and public/card.png from the default board (needs a Mac's Georgia Bold)
npm run gen:favicon    # copies drewhoover.com's favicon set from the index repo
npm run worker:dev     # the share worker (every URL unfurls with its own card), against vite preview
npm run worker:deploy
```

After a deploy, `node scripts/indexnow.mjs` pings IndexNow (Bing and the rest) with the board and the named boards, `--all` with the whole live sitemap, `--dry` prints the URLs without sending; the key is the file `public/d7da20c426bd993247fc65d44102c66c.txt`, whose name and content are the key. The deploy workflow runs it after every deploy.

A sibling of [WNBA Comparator](https://drewhoover.com/wnba-comparator/), [NFL Comparator](https://drewhoover.com/nfl-comparator/) and [College Football Streak King](https://drewhoover.com/cfb-streak-king/); this is the same engine over a different ledger.

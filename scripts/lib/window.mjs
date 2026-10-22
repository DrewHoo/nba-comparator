// The seasons the ledger spans. A season is named by the year it ends
// (1947 is 1946-47), the convention ESPN and NBA Stats both use in their
// files; src/lib/words.ts turns it back into "1946-47" for the page.
/** the league's first season, 1946-47 (the BAA): the history files (data/history) begin here */
export const FIRST_SEASON = 1947
/** the first season with ESPN box scores (1993-94): the spine from here on, and the first with a starter flag */
export const ESPN_FIRST_SEASON = 1994
/** the first season of NBA Stats box scores, which fill the games ESPN lacks */
export const STATS_FIRST_SEASON = 1997
/** the first season of the ESPN <-> NBA Stats player crosswalk */
export const XW_FIRST_SEASON = 2002
/** the running season: 2026-27 */
export const CURRENT_SEASON = 2027

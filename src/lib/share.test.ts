import { describe, expect, it } from 'vitest'
import { loadLedger } from '../../scripts/lib/ledger-node.mjs'
import { cardHeading, cardRows, claimWords, isShared, playerText, shareDescription, shareText, shareTitle } from './share.ts'
import { peerOf } from './compare.ts'
import type { Ledger } from './ledger.ts'
import { evaluate, DEFAULT_QUERY } from './query.ts'
import { parseUrl } from './url.ts'

const L: Ledger = loadLedger()

describe('share words', () => {
  it('the root is not a share; a slot off its default or an open player is', () => {
    expect(isShared(DEFAULT_QUERY, null)).toBe(false)
    expect(isShared({ ...DEFAULT_QUERY, n: 50 }, null)).toBe(true)
    expect(isShared(DEFAULT_QUERY, '1966')).toBe(true)
  })
  it('titles and headings read the sentence', () => {
    expect(shareTitle(DEFAULT_QUERY)).toBe('Players with the most points through their first 100 games · NBA Comparator')
    expect(shareTitle({ ...DEFAULT_QUERY, since: 2010 })).toBe('Players with the most points through their first 100 games since 2009-10 · NBA Comparator')
    expect(playerText('LeBron James', 'F', null, L.firstSeason).title).toBe('LeBron James: every comparison he leads at the same point in a career · NBA Comparator')
    expect(cardHeading(DEFAULT_QUERY)).toBe('most points through the first 100 games')
    expect(cardHeading({ ...DEFAULT_QUERY, how: 'reach', n: 10000, dir: 'fewest' })).toBe('fastest to 10,000 points')
    expect(cardHeading({ ...DEFAULT_QUERY, how: 'count', tests: [{ stat: 'pts', min: 30 }], seq: 'teamGames', n: 20 })).toBe("most games of 30+ points in a team's first 20 games")
  })
  it('the description names the leader, or the open player with his rank', () => {
    const b = evaluate(L, DEFAULT_QUERY)
    expect(shareDescription(DEFAULT_QUERY, L, b, null, L.firstSeason)).toMatch(/^Wilt Chamberlain leads with 3,748 points through his first 100 games\. Every NBA career since 1946-47/)
    const luka = [...b.ranked, ...b.onTheWay].find((r) => r.player.name === 'Luka Dončić')!
    expect(shareDescription(DEFAULT_QUERY, L, b, luka, L.firstSeason)).toMatch(/^Luka Dončić has 2,332 points through his first 100 games, \d+(st|nd|rd|th) of [\d,]+ careers\./)
    // a stat the box score records from later on carries its era in the words
    const stl = { ...DEFAULT_QUERY, stat: 'stl' as const }
    expect(shareDescription(stl, L, evaluate(L, stl), null, L.firstSeason)).toMatch(/through their first 100 games since 1983-84\./)
    expect(shareTitle(stl, null, null, 1984)).toBe('Players with the most steals through their first 100 games since 1983-84 · NBA Comparator')
  })
  it("with a peer, the description reads the open player against him: the peer's claim, where they met, what he needs", () => {
    const b = evaluate(L, DEFAULT_QUERY)
    const luka = b.ranked.find((r) => r.player.name === 'Luka Dončić')!
    const peer = peerOf(b, luka, null)!
    expect(peer.player.name).toBe('Wilt Chamberlain')
    const d = shareDescription(DEFAULT_QUERY, L, b, luka, L.firstSeason, peer)
    expect(d).toMatch(/^Luka Dončić has 2,332 points through his first 100 games, \d+(st|nd|rd|th) of [\d,]+ careers\. Wilt Chamberlain: 3,748 points through his first 100 games\. (Luka Dončić (tied|passed|fell behind) Wilt Chamberlain at game \d+, [\d,]+ points|Their curves never met)\./)
    expect(shareTitle(DEFAULT_QUERY, luka, peer)).toBe('Luka Dončić vs Wilt Chamberlain: most points through the first 100 games · NBA Comparator')
    // the share button's text: the open row's claim, else the sentence
    expect(claimWords(DEFAULT_QUERY, b, b.ranked[0])).toMatch(/^Wilt Chamberlain has 3,748 points through his first 100 games, 1st of [\d,]+ careers\.$/)
    expect(shareText(DEFAULT_QUERY, b, null)).toBe('Players with the most points through their first 100 games.')
    // a named peer wins; an unknown one falls back to the leader
    expect(peerOf(b, luka, b.ranked[2].key)!.key).toBe(b.ranked[2].key)
    expect(peerOf(b, luka, 'nobody')!.key).toBe(b.ranked[0].key)
  })
  it('the card shows the top rows, and the open player in place of the last when he is further down', () => {
    const wemby = L.players.find((p) => p.name === 'Victor Wembanyama')!
    const { query, open } = parseUrl(`?n=400&t=${wemby.id}`)
    const rows = cardRows(evaluate(L, query), query, open)
    expect(rows).toHaveLength(6)
    expect(rows[5]).toMatchObject({ name: 'Victor Wembanyama', rank: '—', live: true, hi: true })
    expect(rows[5].span).toMatch(/^thru \d+$/)
  })
})

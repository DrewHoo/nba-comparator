import { describe, expect, it } from 'vitest'
import { LANDINGS, landingBySlug, landingFor, landingFromPath, landingTitle, queryKey } from './landing.ts'
import { hrefOf, parseAddress, toUrl } from './url.ts'
import { DEFAULT_QUERY, normalize } from './query.ts'
import { h1Words } from './words.ts'

describe('the named boards', () => {
  it('every slug is unique, lower-case and hyphenated, and none is the root query', () => {
    expect(new Set(LANDINGS.map((l) => l.slug)).size).toBe(LANDINGS.length)
    for (const l of LANDINGS) expect(l.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    expect(landingFor(DEFAULT_QUERY)).toBeNull()
    expect(new Set(LANDINGS.map((l) => queryKey(l.query))).size).toBe(LANDINGS.length)
  })
  it('a landing is its own address, and the query string reads on top of it', () => {
    for (const l of LANDINGS) {
      expect(hrefOf({ query: l.query, open: null })).toBe(`/${l.slug}/`)
      expect(parseAddress(`/${l.slug}/`, '')).toEqual({ query: normalize(l.query), open: null, vs: null })
      expect(parseAddress(`/nba-comparator/${l.slug}/`, '', '/nba-comparator/').query).toEqual(normalize(l.query))
    }
    const ten = landingBySlug.get('fastest-to-10000-points')!
    expect(hrefOf({ query: ten.query, open: '1035', vs: 'n76375' })).toBe('/fastest-to-10000-points/?t=1035&vs=n76375')
    expect(parseAddress('/fastest-to-10000-points/', '?t=1035&vs=n76375').open).toBe('1035')
    expect(parseAddress('/fastest-to-10000-points/', '?n=20000').query.n).toBe(20000)
    // a query off a landing writes the root with its params
    expect(hrefOf({ query: { ...ten.query, n: 15000 }, open: null })).toBe(`/${toUrl({ query: { ...ten.query, n: 15000 }, open: null })}`)
    expect(landingFromPath('/nowhere/')).toBeNull()
    expect(landingFromPath('/player/1035/')).toBeNull()
  })
  it('an unnamed board\'s h1 is the query worded the way it is searched', () => {
    expect(h1Words(DEFAULT_QUERY)).toBe('Most points through the first 100 games of an NBA career')
    expect(h1Words({ ...DEFAULT_QUERY, stat: 'stl', pos: 'G' }, 1984)).toBe("Most steals through the first 100 games of an NBA guard's career since 1983-84")
    expect(h1Words({ ...DEFAULT_QUERY, how: 'reach', n: 10000, dir: 'fewest', seq: 'starts', scope: 'all' })).toBe('Fastest to 10,000 points in NBA history, by starts, playoffs included')
    expect(h1Words({ ...DEFAULT_QUERY, seq: 'teamGames', n: 20, how: 'count', tests: [{ stat: 'pts', min: 30 }] })).toBe("Most games with 30+ points in a team's first 20 games of an NBA season")
    expect(h1Words({ ...DEFAULT_QUERY, stat: 'ast', seq: 'seasons', n: 1, pos: 'C' })).toBe("Most assists in an NBA center's rookie season")
    expect(h1Words({ ...DEFAULT_QUERY, how: 'streak', tests: [{ stat: 'dd', min: 1 }], n: 500 })).toBe('Longest streak of games with a double-double in the first 500 games of an NBA career')
  })
  it('titles carry the era the data forces and the site', () => {
    expect(landingTitle(landingBySlug.get('most-steals-through-100-games')!, 1984, 'NBA Comparator')).toBe('Most steals through the first 100 games of an NBA career (since 1983-84) · NBA Comparator')
    expect(landingTitle(landingBySlug.get('fastest-to-10000-points')!, null, 'NBA Comparator')).toBe('Fastest to 10,000 points: fewest games, every NBA career · NBA Comparator')
  })
})

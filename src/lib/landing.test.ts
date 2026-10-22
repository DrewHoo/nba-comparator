import { describe, expect, it } from 'vitest'
import { LANDINGS, landingBySlug, landingFor, landingFromPath, landingTitle, queryKey } from './landing.ts'
import { hrefOf, parseAddress, toUrl } from './url.ts'
import { DEFAULT_QUERY, normalize } from './query.ts'

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
  it('titles carry the era the data forces and the site', () => {
    expect(landingTitle(landingBySlug.get('most-steals-through-100-games')!, 1984, 'NBA Comparator')).toBe('Most steals through the first 100 games of an NBA career (since 1983-84) · NBA Comparator')
    expect(landingTitle(landingBySlug.get('fastest-to-10000-points')!, null, 'NBA Comparator')).toBe('Fastest to 10,000 points: fewest games, every NBA career · NBA Comparator')
  })
})

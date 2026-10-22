// Runs after `vite build`. Bakes the rendered board into dist/index.html and
// writes the <head> from site.config.js, then a page per player with a
// records file (dist/player/<id>/index.html, the file embedded so the
// hydrate matches, and dist/player/<id>/og.png, his own social card), the
// sitemap, and the ledger for the share worker (dist/data/).
//
// Without this the deployed page is `<div id="root"></div>` and every word on
// it exists only after React runs. Google usually renders JS in a deferred
// second pass; Bing, DuckDuckGo, social unfurlers, and the LLM crawlers
// largely don't. Prerendering makes the content plain HTML.
import { createServer } from 'vite'
import { renderToString } from 'react-dom/server'
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../site.config.js'
import pkg from '../package.json' with { type: 'json' }
import { loadLedger } from './lib/ledger-node.mjs'
import { spanWords } from '../src/lib/ledger.ts'
import { decodePlayer, page } from '../src/lib/records.ts'
import { placeWords, recordWords } from '../src/lib/words.ts'
import { playerText, SITE as SITE_NAME } from '../src/lib/share.ts'
import { LANDINGS, landingTitle } from '../src/lib/landing.ts'
import { evaluate, eraBound, DEFAULT_QUERY } from '../src/lib/query.ts'
import { toUrl } from '../src/lib/url.ts'
import { queryWords, rowName, rowWords, eraWords } from '../src/lib/words.ts'
import { itemListOf, boardItems, playerItems } from './lib/jsonld.mjs'
import { llmsText } from './lib/llms.mjs'
import { toPng } from './lib/og.mjs'
import { playerCard } from './lib/og-player.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SLUG = pkg.name
const ORIGIN = `https://${config.domain}`
const SITE = `${ORIGIN}/${SLUG}/`
const OUT = path.join(ROOT, 'dist/index.html')
const DATA = path.join(ROOT, 'src/data')

// the ledger as files, for the share worker (workers/share), which runs the
// engine at the edge on the same columns the page fetches
fs.mkdirSync(path.join(ROOT, 'dist/data/cols'), { recursive: true })
fs.copyFileSync(path.join(DATA, 'ledger.json'), path.join(ROOT, 'dist/data/ledger.json'))
for (const f of fs.readdirSync(path.join(DATA, 'cols'))) if (f.endsWith('.bin.gz')) fs.copyFileSync(path.join(DATA, 'cols', f), path.join(ROOT, 'dist/data/cols', f))

const L = loadLedger()
const SEASONS = spanWords(L.firstSeason, L.currentSeason)

if (config.domain === 'example.com') {
  console.warn('prerender: site.config.js still says example.com; the canonical and OG URLs will be wrong until you set your domain')
}

const vite = await createServer({
  root: ROOT,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'warn',
})
const { default: App } = await vite.ssrLoadModule('/src/App.jsx')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** the head for one page: its title, description, canonical and OG (the board's card unless the page has its own), the embeds, its JSON-LD */
function headFor({ url, title, description, jsonLd, image = { url: `${SITE}og.png`, alt: config.ogImageAlt } }) {
  return `
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(config.domain)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image.url}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(image.alt)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${image.url}" />

    <!-- Cross-site chrome served by the index site: back bar, comments, analytics. -->
    <script src="${ORIGIN}/embed/back-bar.js" data-section="sports" async></script>
    <script src="${ORIGIN}/embed/giscus.js" async></script>
    <script src="${ORIGIN}/embed/analytics.js" async></script>

    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>`
}

const template = fs.readFileSync(OUT, 'utf8')
// Throw rather than no-op: a Vite change that renames the marker would
// otherwise quietly ship an empty page again.
if (!template.includes('<div id="root"></div>')) throw new Error('prerender: could not find an empty #root in dist/index.html')
if (!/<title>[^<]*<\/title>/.test(template)) throw new Error('prerender: could not find <title> in dist/index.html')

/** the template with a page's title, head, markup and (for a player) its embedded file */
function pageHtml({ title, head, appHtml, embed }) {
  let html = template
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
  html = html.replace('</head>', head)
  html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
  if (embed) html = html.replace('<script type="module"', `<script id="player-data" type="application/json">${JSON.stringify(embed).replace(/</g, '\\u003c')}</script>\n    <script type="module"`)
  return html
}

// who has a page, for the ItemLists' links
const playersDir = path.join(ROOT, 'dist/players')
const index = fs.existsSync(path.join(playersDir, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(playersDir, 'index.json'), 'utf8')) : []
const hasPage = new Set(index.filter((e) => e.n).map((e) => e.id))
const playerUrl = (id) => `${SITE}player/${encodeURIComponent(id)}/`
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const lead = (board, q) => (board.ranked[0] && board.ranked[0].value != null ? `${rowName(board.ranked[0])} leads with ${rowWords(board.ranked[0], q)}.` : '')

// the board: its title carries the default query the way Streak King's root carries its head term
const appHtml = renderToString(React.createElement(App, { ledger: L }))
const rootBoard = evaluate(L, DEFAULT_QUERY)
const rootTitle = `${cap(queryWords(DEFAULT_QUERY))}, and every NBA career at the same point since ${SEASONS.split(' ')[0]} · ${config.title}`
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebPage', '@id': SITE, url: SITE, name: rootTitle, description: config.description, isPartOf: { '@type': 'WebSite', url: `${ORIGIN}/`, name: config.domain } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: config.domain, item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: config.title, item: SITE },
    ] },
    itemListOf({ name: cap(queryWords(DEFAULT_QUERY)), url: SITE, items: boardItems(rootBoard, DEFAULT_QUERY, L, { playerUrl, pages: hasPage }) }),
  ],
}
fs.writeFileSync(OUT, pageHtml({ title: rootTitle, head: headFor({ url: SITE, title: rootTitle, description: `${lead(rootBoard, DEFAULT_QUERY)} ${config.description}`.trim(), jsonLd }), appHtml }))
const words = appHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
console.log(`prerendered ${(appHtml.length / 1024).toFixed(0)}KB into #root (~${words} words); head written for ${SITE}`)

// the named boards (src/lib/landing.ts): the board on each query at its own path, titled the way people search,
// with the leader in the lead line and an ItemList of the top ten; its card is the worker's for the query
const llmsBoards = []
{
  let n = 0
  for (const l of LANDINGS) {
    const board = evaluate(L, l.query)
    const url = `${SITE}${l.slug}/`
    const bound = eraBound(l.query, board)
    const title = landingTitle(l, bound, config.title)
    const lead1 = lead(board, l.query)
    const description = `${lead1} Every NBA ${l.query.seq === 'teamGames' ? 'season' : 'career'}${eraWords(bound)} ranked at the same point: ${queryWords(l.query, bound)}. Open a row to read it against a peer.`.replace(/\s+/g, ' ').trim()
    const html = renderToString(React.createElement(App, { path: `/${SLUG}/${l.slug}/`, ledger: L }))
    if (!html.includes(`<span class="h1-words">${esc(l.h1).replace(/'/g, '&#x27;')}</span>`)) throw new Error(`prerender: ${l.slug} rendered without its h1`)
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', '@id': url, url, name: title, description, isPartOf: { '@type': 'WebSite', url: `${ORIGIN}/`, name: config.domain } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: config.domain, item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: config.title, item: SITE },
          { '@type': 'ListItem', position: 3, name: l.h1, item: url },
        ] },
        itemListOf({ name: l.h1, url, items: boardItems(board, l.query, L, { playerUrl, pages: hasPage }) }),
      ],
    }
    const image = { url: `${SITE}share/og.png${toUrl({ query: l.query, open: null })}`, alt: `${l.h1}, on a dark leaderboard.` }
    const dir = path.join(ROOT, 'dist', l.slug)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml({ title, head: headFor({ url, title, description, jsonLd: ld, image }), appHtml: html }))
    llmsBoards.push({ h1: l.h1, url, lead: lead1 })
    n++
  }
  console.log(`prerendered ${n} named boards`)
}

// a page per player with a records file (scripts/build-records.mjs), and his
// card; the PNGs draw a few at a time, sharp's threads do the work
const urls = [SITE, ...llmsBoards.map((b) => b.url)]
const llmsPlayers = []
const pending = new Set()
const draw = async (svg, file) => {
  const p = toPng(svg, file).finally(() => pending.delete(p))
  pending.add(p)
  if (pending.size >= 8) await Promise.race(pending)
}
const t0 = Date.now()
let n = 0
for (const entry of index) {
  if (!entry.n) continue
  const file = JSON.parse(fs.readFileSync(path.join(playersDir, `${entry.id}.json`), 'utf8'))
  const url = `${SITE}player/${encodeURIComponent(entry.id)}/`
  const html = renderToString(React.createElement(App, { path: `/${SLUG}/player/${encodeURIComponent(entry.id)}/`, preload: file }))
  const fams = page(decodePlayer(file), file.id)
  const face = fams[0]?.best
  const { title, description } = playerText(file.name, 'ALL', face, L.firstSeason, config.title)
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': url, url, name: title, description, isPartOf: { '@type': 'WebSite', url: `${ORIGIN}/`, name: config.domain }, about: { '@type': 'Person', name: file.name } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: config.domain, item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: config.title, item: SITE },
        { '@type': 'ListItem', position: 3, name: file.name, item: url },
      ] },
      itemListOf({ name: `What ${file.name} leads`, url, items: playerItems(fams) }),
    ],
  }
  if (llmsPlayers.length < 5 && face) llmsPlayers.push({ name: file.name, url, lead: description.split('. ')[0] + '.' })
  const dir = path.join(ROOT, 'dist/player', entry.id)
  fs.mkdirSync(dir, { recursive: true })
  const image = { url: `${url}og.png`, alt: face ? `${file.name}: ${recordWords(face)}, ${placeWords(face)}. His page on ${config.title}, on a dark background.` : `${file.name}'s page on ${config.title}, on a dark background.` }
  fs.writeFileSync(path.join(dir, 'index.html'), pageHtml({ title, head: headFor({ url, title, description, jsonLd: ld, image }), appHtml: html, embed: file }))
  await draw(playerCard(file, fams, { seasons: SEASONS }), path.join(dir, 'og.png'))
  urls.push(url)
  n++
}
await Promise.all(pending)
await vite.close()
console.log(`prerendered ${n} player pages, each with its card, in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

// llms.txt (llmstxt.org): the site in plain markdown for a language model
fs.writeFileSync(path.join(ROOT, 'dist/llms.txt'), llmsText({ site: SITE, title: config.title, description: config.description, firstSeason: L.firstSeason, currentSeason: L.currentSeason, landings: llmsBoards, players: llmsPlayers, playerCount: n }))

// the sitemap: what Search Console wants submitted, and it carries lastmod
const lastmod = new Date().toISOString().slice(0, 10)
fs.writeFileSync(
  path.join(ROOT, 'dist/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`).join('\n')}
</urlset>
`,
)

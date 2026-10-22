// Generate the board's social preview images. Run: npm run gen:og
//   public/og.png    1200x630, what X/Bluesky/LinkedIn/Reddit/iMessage show
//   public/card.png  1200x750, the 8:5 cover for the index site's project card
//
// The composition is the real thing: the page's default board (players by
// points through their first 100 games, regular season) from the ledger
// through src/lib/query.ts, drawn in the page's own look. It drifts as
// results come in; re-run after a redesign or when a fresher board is worth
// committing. Outputs are committed; CI does not regenerate them. The player
// pages' cards are drawn at build by scripts/prerender.mjs instead
// (scripts/lib/og-player.mjs).
//
// The drawing kit (fonts as outlines, palette, safe column, frame) is
// scripts/lib/og.mjs. Everything sits inside the centered 720px column.
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../site.config.js'
import { spanWords } from '../src/lib/ledger.ts'
import { evaluate, DEFAULT_QUERY } from '../src/lib/query.ts'
import { statByKey } from '../src/lib/stats.ts'
import { queryWords } from '../src/lib/words.ts'
import { loadLedger } from './lib/ledger-node.mjs'
import { CREAM, FAINT, INK, LINE, SAFE, dashed, fit, footer, frame, hasTitleFont, safeL, safeR, sizeToFit, text, toPng, width } from './lib/og.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// the committed images carry the real heading face; a fallback would ship a different card
if (!hasTitleFont()) throw new Error('gen-og: Georgia Bold missing; run on a Mac or set GEORGIA_BOLD to a Georgia Bold TTF')
const outDir = resolve(ROOT, 'public')
mkdirSync(outDir, { recursive: true })

const ledger = loadLedger()
const query = DEFAULT_QUERY
const board = evaluate(ledger, query)
if (!board.ranked.length) throw new Error('gen-og: the default board is empty')
const seasons = spanWords(ledger.firstSeason, ledger.currentSeason)
const sentence = queryWords(query).replace(/^./, (c) => c.toUpperCase())
const noun = statByKey(query.stat).noun.toUpperCase()

function render(W, H) {
  const L = safeL(W), R = safeR(W)
  const rowH = 42
  const top = 258
  const footerY = H - 30
  const rows = board.ranked.slice(0, Math.floor((footerY - 28 - top) / rowH))
  const parts = []
  parts.push(text(seasons, { x: W / 2, y: 58, font: 'Mono', size: 15, fill: FAINT, anchor: 'middle', spacing: 2.4 }))
  parts.push(text(config.title, { x: W / 2, y: 132, font: 'Title', size: sizeToFit(config.title, 'Title', 72, SAFE, 1), fill: CREAM, anchor: 'middle', spacing: 1 }))
  parts.push(text(sentence, { x: W / 2, y: 182, font: 'Serif', size: sizeToFit(sentence, 'Serif', 25, SAFE), fill: INK, anchor: 'middle' }))
  parts.push(text(fit(config.ogSubtitle, 'Serif', 18, SAFE), { x: W / 2, y: 214, font: 'Serif', size: 18, fill: FAINT, anchor: 'middle' }))
  // the board's header and rows
  parts.push(`<line x1="${L}" y1="${top - 22}" x2="${R}" y2="${top - 22}" stroke="${LINE}" stroke-dasharray="1 3"/>`)
  parts.push(text(`${board.ranked.length.toLocaleString('en-US')} CAREERS WITH THE WHOLE WINDOW`, { x: L, y: top - 4, font: 'Mono', size: 10.5, fill: FAINT, spacing: 1.4 }))
  parts.push(text(noun, { x: R, y: top - 4, font: 'Mono', size: 10.5, fill: FAINT, anchor: 'end', spacing: 1.4 }))
  let last = 0
  rows.forEach((r, i) => {
    const y = top + rowH * (i + 1) - 12
    const rank = `${r.tied ? 'T' : ''}${r.rank}`
    const value = r.value.toLocaleString('en-US')
    const valueW = width(value, 'Graduate', 26)
    const span = spanWords(r.from, r.to)
    const spanW = width(span, 'Mono', 10.5, 0.8)
    const nameX = L + 44
    // the name gives way before the span or the value would touch
    const name = fit(r.player.name, 'Serif', 22, R - valueW - 24 - spanW - 14 - nameX)
    parts.push(text(rank, { x: L + 4, y, font: 'Mono', size: 12, fill: r.rank === 1 ? CREAM : FAINT }))
    parts.push(text(name, { x: nameX, y, font: 'Serif', size: 22, fill: INK }))
    parts.push(text(span, { x: nameX + width(name, 'Serif', 22) + 14, y, font: 'Mono', size: 10.5, fill: FAINT, spacing: 0.8 }))
    parts.push(text(value, { x: R, y: y + 1, font: 'Graduate', size: 26, fill: CREAM, anchor: 'end' }))
    parts.push(dashed(L, y + 14, R))
    last = y
  })
  if (last + 18 > footerY - 14) throw new Error(`gen-og: the rows run into the footer at ${W}x${H}`)
  parts.push(...footer(W, H, `${config.domain}/nba-comparator`))
  return frame(W, H, parts)
}

for (const { name, w, h } of [
  { name: 'og.png', w: 1200, h: 630 },
  { name: 'card.png', w: 1200, h: 750 },
]) {
  await toPng(render(w, h), resolve(outDir, name))
  console.log(`wrote ${name} (${w}x${h}), ${board.ranked.length} careers, top: ${board.ranked[0].player.name} ${board.ranked[0].value}`)
}

// A player page's social card: his name, the career line, and the faces of
// his best families with their values, in the page's own look, inside the
// safe column. Drawn by scripts/prerender.mjs for every player page, to
// dist/player/<id>/og.png.
import config from '../../site.config.js'
import { spanWords } from '../../src/lib/ledger.ts'
import { placeWords, recordWords, POS_WORDS } from '../../src/lib/words.ts'
import { CREAM, FAINT, INK, RUST, dashed, fit, footer, frame, masthead, safeL, safeR, sizeToFit, text } from './og.mjs'

const KIND = { held: 'LEADS', set: 'SET IT' }

/**
 * the card's SVG for a player file (records.ts `PlayerFile`) and his page's
 * families (records.ts `page`, each with a `best` RecordRow). `seasons` is the
 * ledger's span for the footer: spanWords(L.firstSeason, L.currentSeason).
 */
export function playerCard(file, fams, { W = 1200, H = 630, seasons } = {}) {
  const L = safeL(W), R = safeR(W)
  const top = 206, rowH = 66
  const faces = fams.slice(0, Math.floor((H - 60 - top) / rowH)).map((f) => f.best).filter(Boolean)
  // a player with no position is one of the "players"; the card names him in the singular
  const pos = POS_WORDS[file.pos ?? 'ALL'].replace(/s$/, '')
  const sub = `${pos} · ${spanWords(file.from, file.to)} · ${file.teams.join(', ')} · ${file.games.toLocaleString('en-US')} games${file.active ? ' · active' : ''}`
  const parts = masthead(W, { brand: config.title.toUpperCase(), heading: file.name, sub })
  if (!faces.length) parts.push(text('Nothing he leads at any point.', { x: W / 2, y: top + 30, font: 'Serif', size: 22, fill: FAINT, anchor: 'middle' }))
  let y = top
  for (const r of faces) {
    const kind = r.live ? 'LIVE' : KIND[r.kind]
    const value = r.value.toLocaleString('en-US')
    // the value column is 100 wide; a long value steps down a size rather than leave the safe column
    parts.push(text(value, { x: L + 100, y: y + 30, font: 'Graduate', size: sizeToFit(value, 'Graduate', 28, 100, 0, 18), fill: r.live ? RUST : CREAM, anchor: 'end' }))
    const tx = L + 120
    parts.push(text(fit(recordWords(r), 'Serif', 22, R - tx), { x: tx, y: y + 21, font: 'Serif', size: 22, fill: INK }))
    const line = `${kind} · ${placeWords(r)}`
    parts.push(text(fit(line.toUpperCase(), 'Mono', 12, R - tx, 1), { x: tx, y: y + 44, font: 'Mono', size: 12, spacing: 1, fill: FAINT }))
    y += rowH
    if (r !== faces[faces.length - 1]) parts.push(dashed(L, y - 14, R))
  }
  parts.push(...footer(W, H, `${seasons} · ${config.domain}/nba-comparator`))
  return frame(W, H, parts)
}

// The social-card drawing kit shared by scripts/gen-og.mjs (the board's
// committed og.png and card.png) and scripts/prerender.mjs (a card per
// player page, drawn at build). One palette, the page's fonts as glyph
// outlines, and the frame every card sits in. The worker's on-demand cards
// (workers/share/card.ts) follow the same layout in satori HTML.
//
// Every meaningful glyph stays inside the centered 720px column (x 240–960
// on a 1200 canvas): Reddit's compact feed center-crops the 1.91:1 card to
// a near-square thumbnail, and a safe-zone layout survives any such crop.
// Streak King learned that one the hard way.
//
// Text is drawn as glyph outlines through opentype.js (pinned to 1.3.4; 2.x
// emits NaN path data), because sharp's librsvg never finds Graduate or Plex
// Mono. The TTFs are committed under scripts/fonts/ (OFL).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const font = (f) => opentype.parse(readFileSync(resolve(ROOT, 'scripts/fonts', f)).buffer.slice(0))
// The heading is Georgia Bold, the face the page's h1 and Hostile Territory's
// poster use, read from the Mac's own copy (not redistributable, so never
// committed here; GEORGIA_BOLD points at another copy). CI has no Georgia,
// so the player cards it draws fall back to Graduate, which the worker's
// cards use too.
const GEORGIA_BOLD = process.env.GEORGIA_BOLD ?? '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
export const FONT = {
  Graduate: font('Graduate-Regular.ttf'),
  Mono: font('IBMPlexMono-Regular.ttf'),
  MonoBold: font('IBMPlexMono-SemiBold.ttf'),
  Serif: font('SourceSerif4-Regular.ttf'),
  Title: null,
}
if (existsSync(GEORGIA_BOLD)) FONT.Title = opentype.parse(readFileSync(GEORGIA_BOLD).buffer.slice(0))
else { console.warn(`og: no Georgia Bold at ${GEORGIA_BOLD}; headings fall back to Graduate`); FONT.Title = FONT.Graduate }
/** true when the heading face is the real one; gen-og refuses to commit a card without it */
export const hasTitleFont = () => FONT.Title !== FONT.Graduate

export const BG = '#282127', INK = '#efe6d9', MUTED = '#bfb2a6', FAINT = '#857a75', LINE = '#453a42', CREAM = '#f3e2bc', RUST = '#c36c36'

/** the safe column: 720 wide, centered */
export const SAFE = 720
export const safeL = (W) => Math.round(W / 2 - SAFE / 2)
export const safeR = (W) => safeL(W) + SAFE

export const width = (str, name, size, spacing = 0) => FONT[name].getAdvanceWidth(str, size, { kerning: true, letterSpacing: spacing / size })

/** a run of text as a filled path; anchor start|middle|end */
export function text(str, { x, y, font: name, size, fill, anchor = 'start', spacing = 0, opacity }) {
  const f = FONT[name]
  const opts = { kerning: true, letterSpacing: spacing / size }
  const w = f.getAdvanceWidth(str, size, opts)
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x
  return `<path d="${f.getPath(str, x0, y, size, opts).toPathData(2)}" fill="${fill}"${opacity != null ? ` opacity="${opacity}"` : ''}/>`
}

/** the string cut at a word to fit maxW, with an ellipsis */
export function fit(str, name, size, maxW, spacing = 0) {
  if (width(str, name, size, spacing) <= maxW) return str
  const words = str.split(' ')
  while (words.length > 1) {
    words.pop()
    const s = words.join(' ').replace(/[\s,;:·–-]+$/, '') + '…'
    if (width(s, name, size, spacing) <= maxW) return s
  }
  let s = str
  while (s.length > 1 && width(s + '…', name, size, spacing) > maxW) s = s.slice(0, -1)
  return s + '…'
}

/** the biggest size at or under `size` that fits maxW */
export function sizeToFit(str, name, size, maxW, spacing = 0, min = 22) {
  let s = size
  while (s > min && width(str, name, s, spacing) > maxW) s -= 2
  return s
}

export const dashed = (x1, y, x2) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${LINE}" stroke-dasharray="1 4"/>`

/** the top every card shares: the site's name in rust (brand, config.title upper-cased), the heading, a small line */
export function masthead(W, { brand, heading, sub, headingSize = 38 }) {
  const parts = [
    text(brand, { x: W / 2, y: 70, font: 'MonoBold', size: 16, spacing: 4, fill: RUST, anchor: 'middle' }),
    text(heading, { x: W / 2, y: 134, font: 'Title', size: sizeToFit(heading, 'Title', headingSize, SAFE, 0.5), fill: CREAM, anchor: 'middle', spacing: 0.5 }),
  ]
  if (sub) parts.push(text(fit(sub.toUpperCase(), 'Mono', 14, SAFE, 2), { x: W / 2, y: 168, font: 'Mono', size: 14, spacing: 2, fill: FAINT, anchor: 'middle' }))
  return parts
}

/** the footer every card shares, centered: the seasons and the site's path, as the caller words them */
export function footer(W, H, words) {
  return [text(words.toUpperCase(), { x: W / 2, y: H - 30, font: 'Mono', size: 14, spacing: 2, fill: FAINT, anchor: 'middle' })]
}

/** the frame: the dark field with the glow, then the parts */
export function frame(W, H, parts) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="-0.2" r="0.9">
      <stop offset="0%" stop-color="${CREAM}" stop-opacity="0.12"/>
      <stop offset="65%" stop-color="${CREAM}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${parts.join('\n  ')}
</svg>`
}

export const toPng = (svg, file) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file)

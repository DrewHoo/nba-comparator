// A team page's social card: the franchise and the position, the leader's
// line, and the top players' cumulative lines for the ranking metric, in the
// page's own look, inside the safe column. Drawn by scripts/prerender.mjs
// for every team page, to dist/team/<id>/<position>/og.png. The College
// Football Comparator's group card.
import config from '../../site.config.js'
import { spanWords } from '../../src/lib/ledger.ts'
import { statByKey } from '../../src/lib/stats.ts'
import { POS_WORDS } from '../../src/lib/words.ts'
import { groupH1, groupLead, gameAt } from '../../src/lib/groups.ts'
import { CREAM, FAINT, INK, LINE, MUTED, fit, footer, frame, masthead, safeL, safeR, text } from './og.mjs'

export function groupCard(d, { W = 1200, H = 630 } = {}) {
  const L = safeL(W), R = safeR(W)
  const stat = statByKey(d.metrics[0])
  const parts = masthead(W, { brand: config.title.toUpperCase(), heading: groupH1(d), headingSize: 34, sub: `${POS_WORDS[d.pos]} · ${stat.noun} by game · ${d.rows.length} players` })
  const lead = groupLead(d)
  if (lead) parts.push(text(fit(lead, 'Serif', 20, R - L), { x: W / 2, y: 204, font: 'Serif', size: 20, fill: MUTED, anchor: 'middle' }))
  const lines = d.rows.filter((r) => r.curves?.[0]).sort((a, b) => b.totals[0] - a.totals[0]).slice(0, 8)
  const top = 236, bottom = H - 62, left = L + 40, right = R - 150
  if (lines.length) {
    const len = Math.max(...lines.map((r) => r.games))
    const max = Math.max(1, ...lines.map((r) => r.curves[0][r.curves[0].length - 1]))
    const x = (g) => left + ((g - 1) / Math.max(1, len - 1)) * (right - left)
    const y = (v) => top + (1 - v / max) * (bottom - top)
    parts.push(`<line x1="${left}" y1="${y(0)}" x2="${right}" y2="${y(0)}" stroke="${LINE}"/>`)
    parts.push(text(max.toLocaleString('en-US'), { x: left - 8, y: top + 5, font: 'Mono', size: 11, fill: FAINT, anchor: 'end' }))
    parts.push(text(`${len.toLocaleString('en-US')} GAMES`, { x: right, y: bottom + 18, font: 'Mono', size: 11, fill: FAINT, anchor: 'end', spacing: 1 }))
    // the names in a column at the right edge, in the order the lines end, nudged apart
    const ends = lines.map((r, k) => ({ k, y: y(r.curves[0][r.curves[0].length - 1]) })).sort((a, b) => a.y - b.y)
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15
    // then up from the floor, so a crowd at the bottom stacks rather than overlaps
    if (ends.length && ends[ends.length - 1].y > bottom) ends[ends.length - 1].y = bottom
    for (let i = ends.length - 2; i >= 0; i--) if (ends[i + 1].y - ends[i].y < 15) ends[i].y = ends[i + 1].y - 15
    const labelY = new Map(ends.map((e) => [e.k, e.y]))
    for (let k = lines.length - 1; k >= 0; k--) {
      const r = lines[k]
      const d2 = r.curves[0].map((v, j) => `${j ? 'L' : 'M'}${x(gameAt(d, r, j)).toFixed(1)},${y(v).toFixed(1)}`).join('')
      parts.push(`<path d="${d2}" fill="none" stroke="${k === 0 ? CREAM : FAINT}" stroke-width="${k === 0 ? 2.5 : 1.4}" opacity="${k === 0 ? 1 : 0.85}"/>`)
      const name = fit(r.name, 'Mono', 12, 140, 0.5)
      const ex = x(r.games), ey = y(r.curves[0][r.curves[0].length - 1])
      parts.push(`<line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${right + 6}" y2="${labelY.get(k).toFixed(1)}" stroke="${LINE}" stroke-dasharray="1 3"/>`)
      parts.push(text(name, { x: right + 10, y: labelY.get(k) + 4, font: 'Mono', size: 12, fill: k === 0 ? CREAM : INK, spacing: 0.5 }))
    }
  }
  parts.push(...footer(W, H, `${spanWords(d.since, d.currentSeason)} · ${config.domain}/nba-comparator`))
  return frame(W, H, parts)
}

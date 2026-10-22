// The share card: a board drawn as a 1200x630 PNG through workers-og
// (satori + resvg wired for workerd, wasm included). The design follows
// gen-og.mjs: the dark room, Graduate counts, serif names, mono small
// print. Fonts ride in the bundle (OFL; the same four the site uses).

import { ImageResponse } from 'workers-og';
// wrangler's Data rule hands these over as ArrayBuffers
import graduate from './fonts/Graduate-Regular.ttf';
import mono from './fonts/IBMPlexMono-Regular.ttf';
import monoBold from './fonts/IBMPlexMono-SemiBold.ttf';
import serif from './fonts/SourceSerif4-Regular.ttf';
import type { CardRow } from '../../src/lib/share.ts';

const BG = '#282127';
const INK = '#efe6d9';
const MUTED = '#bfb2a6';
const FAINT = '#857a75';
const LINE = '#453a42';
const CREAM = '#f3e2bc';
const RUST = '#c36c36';

export interface Card {
  /** "MOST POINTS THROUGH THE FIRST 100 GAMES" */
  heading: string;
  /** the whole sentence */
  words: string;
  rows: CardRow[];
  /** "1993-94 – 2026-27 · 1,461 careers with the whole window · drewhoover.com" */
  footer: string;
}

// satori reads the text as-is, entities included, so only the characters
// that would open a tag or close an attribute are escaped
const esc = (s: string) => s.replace(/</g, '&lt;').replace(/"/g, '&quot;');

// the heading is one line inside the 720px column: Graduate runs about 0.62em
// a character, so a long sentence ("MOST POINTS THROUGH THE FIRST 50 GAMES")
// drops its size rather than leaving a word alone on a second line
const HEADING_MAX = 34;
const HEADING_MIN = 20;
export const headingSize = (heading: string): number => Math.max(HEADING_MIN, Math.min(HEADING_MAX, Math.floor(720 / (0.62 * Math.max(1, heading.length)))));

// the sentence likewise stays on one line where it can: Source Serif runs
// about 0.46em a character, so a long one ("... through their team's first
// 82 games of a season") drops toward 16px before it wraps
const WORDS_MAX = 21;
const WORDS_MIN = 16;
export const wordsSize = (words: string): number => Math.max(WORDS_MIN, Math.min(WORDS_MAX, Math.floor(720 / (0.46 * Math.max(1, words.length)))));

// and the footer: Plex Mono at 1px tracking runs 0.6em plus the
// tracking a character, and a long span ("13,654 player-seasons") steps down
const footerSize = (footer: string): number => Math.max(11, Math.min(14, Math.floor((720 / Math.max(1, footer.length) - 1) / 0.6)));

export function renderCard(card: Card): Response {
  const rows = card.rows.map((r) => `
    <div style="display:flex; flex-direction:row; align-items:center; gap:16px; padding:7px 10px; margin:0 -10px; border-bottom:1px dashed ${LINE}; ${r.hi ? `background-color: rgba(243,226,188,0.08); border-radius:6px;` : ''}">
      <div style="display:flex; justify-content:flex-end; width:44px; font-family:'IBM Plex Mono'; font-size:15px; letter-spacing:1px; color:${r.rank === '1' ? CREAM : FAINT};">${esc(r.rank)}</div>
      <div style="display:flex; flex-direction:column; flex-grow:1; width:470px;">
        <div style="display:flex; font-family:'Source Serif 4'; font-size:25px; color:${INK}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(r.name)}</div>
        <div style="display:flex; font-family:'IBM Plex Mono'; font-size:12px; letter-spacing:1px; color:${r.live ? RUST : FAINT}; margin-top:1px;">${esc(r.span.toUpperCase())}</div>
      </div>
      <div style="display:flex; justify-content:flex-end; width:150px; font-family:'Graduate'; font-size:32px; color:${r.live ? RUST : CREAM};">${esc(r.value)}</div>
    </div>`).join('');

  // every meaningful glyph stays inside the centered 720px column: Reddit's
  // compact feed center-crops the 1.91:1 card to a near-square thumbnail,
  // and a safe-zone layout survives any such crop
  const html = `
  <div style="display:flex; flex-direction:column; align-items:center; width:1200px; height:630px; background-color:${BG}; padding:40px 0 32px;
              background-image: radial-gradient(circle at 600px -126px, rgba(243,226,188,0.13) 0%, rgba(243,226,188,0) 65%);">
    <div style="display:flex; font-family:'IBM Plex Mono'; font-weight:600; font-size:16px; letter-spacing:4px; color:${RUST};">NBA COMPARATOR</div>
    <div style="display:flex; font-family:'Graduate'; font-size:${headingSize(card.heading)}px; color:${CREAM}; margin-top:10px; max-width:720px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(card.heading.toUpperCase())}</div>
    <div style="display:flex; font-family:'Source Serif 4'; font-size:${wordsSize(card.words)}px; color:${MUTED}; margin-top:2px; max-width:720px; text-align:center;">${esc(card.words)}</div>
    <div style="display:flex; flex-direction:column; margin-top:12px; flex-grow:1; width:720px;">${rows}</div>
    <div style="display:flex; font-family:'IBM Plex Mono'; font-size:${footerSize(card.footer)}px; letter-spacing:1px; color:${FAINT}; margin-top:10px; white-space:nowrap;">${esc(card.footer.toUpperCase())}</div>
  </div>`;

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Graduate', data: graduate as ArrayBuffer, weight: 400, style: 'normal' },
      { name: 'IBM Plex Mono', data: mono as ArrayBuffer, weight: 400, style: 'normal' },
      { name: 'IBM Plex Mono', data: monoBold as ArrayBuffer, weight: 600, style: 'normal' },
      { name: 'Source Serif 4', data: serif as ArrayBuffer, weight: 400, style: 'normal' },
    ],
  });
}

// Tells Bing (and the other IndexNow engines: Yandex, Seznam, Naver) which
// pages to recrawl, after a deploy. Bing's index is what ChatGPT search,
// Copilot and DuckDuckGo answer from, and it crawls a new site slowly on its
// own. Streak King's script (cfb-streak-king/scripts/indexnow.mjs), ported.
//
//   node scripts/indexnow.mjs          the board and every sitemap URL that isn't a player page (the named boards)
//   node scripts/indexnow.mjs --all    every URL in the live sitemap
//   node scripts/indexnow.mjs --dry    print the URLs it would send, send nothing (with or without --all)
//
// The default mode reads dist/sitemap.xml when there is one (a local run
// after `npm run build`), else the live sitemap (the deploy job's checkout
// has no dist/, and the job runs after the deploy, so the live one is this
// build's).
//
// The key is public by design: a file under public/ whose name and content
// are the key, served from this project's path, which scopes it to
// /nba-comparator/ URLs. Run after the deploy, so the key file and the pages
// are live. It reports and exits 0 on any failure: a missed ping never fails
// a deploy.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../site.config.js'
import pkg from '../package.json' with { type: 'json' }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = `https://${config.domain}/${pkg.name}/`
const ENDPOINT = 'https://api.indexnow.org/indexnow'
const BATCH = 10000 // the protocol's cap per request
const ALL = process.argv.includes('--all')
const DRY = process.argv.includes('--dry')

const keyFile = fs.readdirSync(path.join(ROOT, 'public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))
if (!keyFile) { console.log('indexnow: no key file under public/, skipped'); process.exit(0) }
const key = keyFile.slice(0, -4)
const keyLocation = `${SITE}${keyFile}`

// Pages can take a minute to serve a fresh deploy, so the key file gets a few tries.
async function keyIsLive() {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(keyLocation, { cache: 'no-store' }).catch(() => null)
    if (res?.ok && (await res.text()).trim() === key) return true
    await new Promise((r) => setTimeout(r, 20000))
  }
  return false
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())

/** the sitemap's URLs: the built one for the default mode when there is one, else the live one; null when neither reads */
async function sitemap(live) {
  const local = path.join(ROOT, 'dist', 'sitemap.xml')
  if (!live && fs.existsSync(local)) return locs(fs.readFileSync(local, 'utf8'))
  const res = await fetch(`${SITE}sitemap.xml`, { cache: 'no-store' }).catch((e) => ({ ok: false, status: e instanceof Error ? e.message : e }))
  if (!res.ok) { console.log(`indexnow: sitemap ${res.status}, skipped`); return null }
  return locs(await res.text())
}

async function main() {
  const all = await sitemap(ALL)
  if (!all) return
  // the default mode: the board and the named boards (/<slug>/), not the player pages
  const urls = [...new Set(ALL ? all : [SITE, ...all.filter((u) => !u.startsWith(`${SITE}player/`))])].filter((u) => u.startsWith(SITE))
  if (DRY) { console.log(`indexnow (dry): ${urls.length} URLs, key ${keyLocation}\n${urls.join('\n')}`); return }
  if (!(await keyIsLive())) { console.log(`indexnow: the key file isn't live at ${keyLocation}, skipped`); return }
  for (let i = 0; i < urls.length; i += BATCH) {
    const urlList = urls.slice(i, i + BATCH)
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: config.domain, key, keyLocation, urlList }),
    })
    // 200 accepted, 202 accepted while the key is checked; 403 key not
    // valid, 422 a URL outside the key's scope, 429 too often
    console.log(`indexnow: ${urlList.length} URLs → ${res.status} ${res.statusText} ${(await res.text()).slice(0, 200)}`)
  }
}

main().catch((e) => console.log(`indexnow: ${e instanceof Error ? e.message : e}`))

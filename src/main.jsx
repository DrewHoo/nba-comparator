import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.jsx'
import { ledgerFile, colUrl } from './ledger-client.js'
import { loadLedger } from './lib/load.ts'
import { queryCols, DEFAULT_QUERY } from './lib/query.ts'
import { parseAddress } from './lib/url.ts'
import './styles.css'

// The markup is already in the HTML: scripts/prerender.mjs bakes it in at
// build time so crawlers get the whole page without running anything.
// Hydrate onto it rather than throwing it away. The dev server has no baked
// markup, so fall back to a plain render there.
//
// The board needs the ledger to render the same rows the prerender did, so
// the base columns and the address's own columns (about 1.5MB gzipped for the
// default board) load before the hydrate; the page is readable meanwhile. A
// player page carries its records file in the HTML and needs no ledger, and so
// does a team page.
const root = document.getElementById('root')
const path = window.location.pathname
const data = document.getElementById('player-data')
let preload = null
try { preload = data ? JSON.parse(data.textContent) : null } catch {}

const mount = (ledger) => {
  const app = (
    <React.StrictMode>
      <App path={path} preload={preload} ledger={ledger} />
    </React.StrictMode>
  )
  if (root.firstChild) hydrateRoot(root, app)
  else createRoot(root).render(app)
}

if (/\/player\/[^/]+\/?$/.test(path) || /\/team\//.test(path)) mount(null)
else {
  let cols = queryCols(DEFAULT_QUERY)
  try { cols = [...new Set([...cols, ...queryCols(parseAddress(path, window.location.search, import.meta.env.BASE_URL).query)])] } catch {}
  loadLedger(ledgerFile, colUrl, cols).then(mount).catch((e) => {
    console.error(e)
    const p = document.createElement('p')
    p.className = 'loading'
    p.textContent = 'The ledger did not load; reload the page.'
    root.append(p)
  })
}

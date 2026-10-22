// One write per change. A query change is a replaceState so the back stack
// doesn't grow; the analytics embed counts each write as a pageview. The
// address is path and query string together (url.ts `hrefOf`), relative to
// the site's base, so a board on a named query lands on its own path.
export function writeUrl(href, mode = 'replace', base = import.meta.env.BASE_URL) {
  try {
    const url = new URL(window.location.href)
    const [path, search = ''] = href.split('?')
    url.pathname = base.replace(/\/$/, '') + path
    url.search = search ? `?${search}` : ''
    if (mode === 'push') window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
  } catch {}
}

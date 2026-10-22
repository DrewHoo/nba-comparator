// The analytics embed (the index site's /embed/analytics.js) is third-party
// and blockable, hence optional-chained. Event names are lowercase, with a
// `from` where the same thing can happen in more than one place.

declare global {
  interface Window { dhAnalytics?: { track: (name: string, props?: Record<string, unknown>) => void } }
}

export const track = (name: string, props?: Record<string, unknown>) => {
  try { window.dhAnalytics?.track(name, props) } catch {}
}

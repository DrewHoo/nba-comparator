// The named boards (landing.ts), listed under the board as real links, so a
// crawler reaches every one from the root and a reader finds the boards
// worth a look. The current one is marked.
import { LANDINGS } from '../lib/landing.ts'

const BASE = import.meta.env.BASE_URL

export function Landings({ current = null }) {
  return (
    <section className="landings" aria-label="Named boards">
      <h2 className="notes-h">More boards</h2>
      <ul className="landing-list">
        {LANDINGS.map((l) => (
          <li key={l.slug}>{l.slug === current ? <b>{l.h1}</b> : <a href={`${BASE}${l.slug}/`}>{l.h1}</a>}</li>
        ))}
      </ul>
      <p className="landing-more">The best guards, forwards and centers of <a href={`${BASE}team/`}>every franchise</a>.</p>
    </section>
  )
}

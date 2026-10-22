// Find a player: a filter box over every player in the ledger, in a dropdown
// (Streak King's team picker, without the phone sheet). The list is
// public/players/index.json (scripts/build-records.mjs), fetched the first
// time the menu opens; a pick goes to his page when he has one (`n` rows
// above the floor), else opens his row on the board.
import { useEffect, useMemo, useState } from 'react'
import * as DM from '@radix-ui/react-dropdown-menu'
import { SearchIcon } from './Icons.jsx'
import { spanWords } from '../lib/ledger.ts'

const BASE = import.meta.env.BASE_URL
const plain = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
let cached = null
/** every player in the ledger, fetched once per load */
export const loadIndex = () => (cached ? Promise.resolve(cached) : fetch(`${BASE}players/index.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((list) => (cached = list)))

export const playerUrl = (id) => `${BASE}player/${encodeURIComponent(id)}/`

export function PlayerFinder({ current = null, onPick = null }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [all, setAll] = useState(cached)
  useEffect(() => {
    if (!open || all) return
    let live = true
    loadIndex().then((list) => { if (live) setAll(list) })
    return () => { live = false }
  }, [open, all])
  const want = plain(q)
  // names that start with what's typed, then names that contain it; untyped, the biggest pages first
  const list = useMemo(() => {
    const src = all ?? []
    if (!want) return src.slice(0, 40)
    const starts = src.filter((p) => plain(p.name).startsWith(want) || plain(p.name.split(' ').slice(-1)[0]).startsWith(want))
    const within = src.filter((p) => !starts.includes(p) && plain(p.name).includes(want))
    return [...starts, ...within].slice(0, 40)
  }, [all, want])
  const change = (o) => { setOpen(o); if (!o) setQ('') }
  const pick = (p) => {
    change(false)
    if (p.n > 0) window.location.href = playerUrl(p.id)
    else if (onPick) onPick(p)
    else window.location.href = `${BASE}?t=${encodeURIComponent(p.id)}`
  }
  return (
    <DM.Root open={open} onOpenChange={change} modal={false}>
      <DM.Trigger asChild>
        <button className="ico finder" aria-label="Find a player"><SearchIcon /><span>find a player</span></button>
      </DM.Trigger>
      <DM.Portal>
        {/* focus stays where the pick put the page, not back on the trigger at the top */}
        <DM.Content className="menu tp-menu" sideOffset={6} collisionPadding={12} align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
          <div className="tp-top">
            <input
              className="tp-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a player" aria-label="Find a player" autoFocus
              // typing is the filter's, not the menu's own type-to-jump
              onKeyDown={(e) => { if (e.key === 'Enter' && list.length) pick(list[0]); else if (e.key !== 'Escape' && e.key !== 'ArrowDown' && e.key !== 'Tab') e.stopPropagation() }}
            />
          </div>
          <div className="tp-list">
            {!all && <p className="tp-none">loading…</p>}
            {all && list.length === 0 && <p className="tp-none">No player matches.</p>}
            {list.map((p) => (
              <DM.Item key={p.id} className={'mi tp-row' + (p.id === current ? ' on' : '')} onSelect={() => pick(p)}>
                <span className="tp-name">{p.name}</span>
                <span className="tp-rec">{p.pos ?? '?'} · {spanWords(p.from, p.to)}</span>
              </DM.Item>
            ))}
          </div>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}

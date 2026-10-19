import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Card } from './Card.tsx'
import { Detail } from './Detail.tsx'
import { setShelf, setStatus, sorts, tierClass, tierOrder, type Library, type Movie, type Shelf, type Tier } from './lib.ts'
import { TastePanel } from './TastePanel.tsx'

const tabs = [
  { id: 'watched', label: 'Watched', empty: 'Nothing here yet. Tell Claude Code about a movie you watched.' },
  { id: 'watchlist', label: 'Watchlist', empty: 'Your watchlist is empty. Ask Claude Code to add something.' },
  { id: 'suggested', label: 'Suggested', empty: 'No suggestions yet. Run /suggestions in Claude Code.' },
]

const shelves: { id: Shelf; title: string; hint: string }[] = [
  { id: 'weekend', title: 'Weekend', hint: 'Candidates for the next session' },
  { id: 'someday', title: 'Someday', hint: 'Keeping these for later' },
]

const kinds: { id: Movie['kind']; label: string }[] = [
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'Series' },
  { id: 'collection', label: 'Franchises' },
]

// Sort, filters, open tab and collapsed shelves survive a reload. The search box doesn't:
// it's for finding one title now, not a setting. Sort and filters are kept per tab.
type View = {
  tab: string
  sort: Record<string, string>
  genres: Record<string, string[]>
  kinds: Record<string, Movie['kind'][]>
  tiers: Record<string, Tier[]>
  collapsed: Record<string, boolean>
}
const defaults: View = { tab: 'watched', sort: {}, genres: {}, kinds: {}, tiers: {}, collapsed: {} }

const toggleIn = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

function FilterChip({ active, activeClass, onClick, children }: { active: boolean; activeClass?: string; onClick: () => void; children: ReactNode }) {
  const on = activeClass ?? 'bg-sky-500 font-semibold text-black'
  return (
    <button onClick={onClick} className={`rounded-full px-2.5 py-1 text-xs transition ${active ? on : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
      {children}
    </button>
  )
}

function useView() {
  const [view, setView] = useState<View>(() => {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem('movies.view') ?? '{}') }
    } catch {
      return defaults
    }
  })
  const update = (changes: Partial<View>) =>
    setView((current) => {
      const next = { ...current, ...changes }
      localStorage.setItem('movies.view', JSON.stringify(next))
      return next
    })
  return [view, update] as const
}

export default function App() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [view, update] = useView()
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(() => Number(new URLSearchParams(location.search).get('movie')) || null)

  // Reload whenever the window regains focus, to pick up movies Claude Code just added.
  const load = useCallback(() => fetch('/api/library').then((r) => r.json()).then(setLibrary), [])
  useEffect(() => {
    load()
    addEventListener('focus', load)
    return () => removeEventListener('focus', load)
  }, [load])

  // The open movie stays in the URL so a card can be linked to directly.
  useEffect(() => {
    history.replaceState(null, '', openId ? `?movie=${openId}` : location.pathname)
  }, [openId])

  if (!library) return null

  const tab = tabs.some((t) => t.id === view.tab) ? view.tab : 'watched'
  // "Recently watched" only means something on the Watched tab.
  const available = Object.entries(sorts).filter(([, s]) => !s.watchedOnly || tab === 'watched')
  const sort = available.some(([id]) => id === view.sort[tab]) ? view.sort[tab] : 'rating'
  const selectedGenres = view.genres[tab] ?? []
  const selectedKinds = view.kinds[tab] ?? []
  const selectedTiers = view.tiers[tab] ?? []
  const allGenres = [...new Set(library.movies.flatMap((m) => m.genres))].sort()

  // Chips are only offered for what this tab actually holds: no "Franchises" where there are none,
  // and no empty tiers. Tiers are a Watched-only idea, so the other tabs ignore the tier filter.
  const inTab = library.movies.filter((m) => m.status === tab)
  const availableKinds = kinds.filter((k) => inTab.some((m) => m.kind === k.id))
  const availableTiers = tab === 'watched' ? tierOrder.filter((t) => inTab.some((m) => m.tier === t)) : []

  const matches = library.movies.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) &&
      (!selectedGenres.length || m.genres.some((g) => selectedGenres.includes(g))) &&
      (!selectedKinds.length || selectedKinds.includes(m.kind)) &&
      (!selectedTiers.length || m.status !== 'watched' || (m.tier !== null && selectedTiers.includes(m.tier))),
  )
  const shown = matches.filter((m) => m.status === tab).sort((a, b) => sorts[sort].compare(a, b) || a.title.localeCompare(b.title))
  const open = library.movies.find((m) => m.id === openId)
  const filters = selectedGenres.length + selectedKinds.length + selectedTiers.length
  const filtering = Boolean(search || filters)

  const changeStatus = (m: Movie) => async (status: 'watchlist' | 'dismissed') => {
    await setStatus(m.id, status)
    if (openId === m.id) setOpenId(null)
    load()
  }
  const move = (m: Movie) => async (shelf: Shelf) => {
    await setShelf(m.id, shelf)
    load()
  }

  const grid = (movies: Movie[]) => (
    <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {movies.map((m) => (
        <Card
          key={m.id}
          movie={m}
          onOpen={() => setOpenId(m.id)}
          onStatus={changeStatus(m)}
          onMove={tab === 'watchlist' ? move(m) : undefined}
        />
      ))}
    </div>
  )

  const section = (shelf: (typeof shelves)[number], children: ReactNode, count: number) => {
    const collapsed = view.collapsed[shelf.id]
    return (
      <section>
        <button
          onClick={() => update({ collapsed: { ...view.collapsed, [shelf.id]: !collapsed } })}
          className="group/head mb-4 flex w-full items-center gap-3 text-left"
        >
          <span className={`text-zinc-500 transition group-hover/head:text-zinc-300 ${collapsed ? '' : 'rotate-90'}`}>▶</span>
          <h2 className="text-sm font-bold tracking-widest text-zinc-200 uppercase">{shelf.title}</h2>
          <span className="rounded-full bg-white/10 px-2 text-xs text-zinc-300">{count}</span>
          <span className="text-xs text-zinc-500 group-hover/head:text-zinc-400">{collapsed ? 'Show' : shelf.hint}</span>
        </button>
        {!collapsed && children}
      </section>
    )
  }

  return (
    <div className="flex min-h-screen flex-col text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#171a21]/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex h-14 items-center gap-8">
            <h1 className="text-lg font-black tracking-widest text-white">MOVIES</h1>
            <nav className="flex h-full">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => update({ tab: t.id })}
                  className={`border-b-2 px-4 text-sm font-semibold tracking-wide uppercase transition ${
                    tab === t.id ? 'border-sky-400 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t.label} <span className="ml-1 text-xs text-zinc-500">{matches.filter((m) => m.status === t.id).length}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-3 pb-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search titles"
              className="w-56 rounded bg-zinc-800 px-3 py-1.5 text-sm placeholder-zinc-500 ring-1 ring-white/10 outline-none focus:ring-sky-400"
            />
            <select
              value={sort}
              onChange={(e) => update({ sort: { ...view.sort, [tab]: e.target.value } })}
              className="rounded bg-zinc-800 px-2 py-1.5 text-sm ring-1 ring-white/10 outline-none focus:ring-sky-400"
            >
              {available.map(([id, s]) => (
                <option key={id} value={id}>{s.label}</option>
              ))}
            </select>
            {availableKinds.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {availableKinds.map((k) => (
                  <FilterChip
                    key={k.id}
                    active={selectedKinds.includes(k.id)}
                    onClick={() => update({ kinds: { ...view.kinds, [tab]: toggleIn(selectedKinds, k.id) } })}
                  >
                    {k.label}
                  </FilterChip>
                ))}
              </div>
            )}
            {availableTiers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-l border-white/10 pl-3">
                {availableTiers.map((t) => (
                  <FilterChip
                    key={t}
                    active={selectedTiers.includes(t)}
                    activeClass={`font-bold ${tierClass(t)}`}
                    onClick={() => update({ tiers: { ...view.tiers, [tab]: toggleIn(selectedTiers, t) } })}
                  >
                    <span className="inline-block min-w-3 text-center">{t}</span>
                  </FilterChip>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pb-3">
            {allGenres.map((g) => (
              <FilterChip
                key={g}
                active={selectedGenres.includes(g)}
                onClick={() => update({ genres: { ...view.genres, [tab]: toggleIn(selectedGenres, g) } })}
              >
                {g}
              </FilterChip>
            ))}
            {filters > 0 && (
              <button
                onClick={() => update({ genres: { ...view.genres, [tab]: [] }, kinds: { ...view.kinds, [tab]: [] }, tiers: { ...view.tiers, [tab]: [] } })}
                className="px-2 text-xs text-zinc-400 hover:text-white"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        {tab === 'suggested' && <TastePanel library={library} />}
        {tab === 'watchlist' ? (
          <div className="divide-y divide-white/10 [&>*:not(:first-child)]:pt-8 [&>*:not(:last-child)]:pb-8">
            {shelves.map((shelf) => {
              const movies = shown.filter((m) => (m.shelf ?? 'someday') === shelf.id)
              return (
                <div key={shelf.id}>
                  {section(
                    shelf,
                    movies.length ? (
                      grid(movies)
                    ) : (
                      <p className="py-6 text-sm text-zinc-500">
                        {filtering ? 'Nothing here matches your search or filters.' : 'Nothing on this shelf.'}
                      </p>
                    ),
                    movies.length,
                  )}
                </div>
              )
            })}
          </div>
        ) : shown.length ? (
          grid(shown)
        ) : (
          <p className="py-20 text-center text-zinc-500">
            {filtering ? 'No movies match your search or filters.' : tabs.find((t) => t.id === tab)?.empty}
          </p>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-zinc-600">This product uses the TMDB API but is not endorsed or certified by TMDB.</footer>

      {open && (
        <Detail
          movie={open}
          basedOn={library.movies.filter((m) => open.based_on.includes(m.id))}
          onClose={() => setOpenId(null)}
          onStatus={changeStatus(open)}
        />
      )}
    </div>
  )
}

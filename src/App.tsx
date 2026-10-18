import { useCallback, useEffect, useState } from 'react'
import { Card } from './Card.tsx'
import { Detail } from './Detail.tsx'
import { setStatus, sorts, type Library, type Movie } from './lib.ts'
import { TastePanel } from './TastePanel.tsx'

const tabs = [
  { id: 'watched', label: 'Watched', empty: 'Nothing here yet. Tell Claude Code about a movie you watched.' },
  { id: 'watchlist', label: 'Watchlist', empty: 'Your watchlist is empty. Ask Claude Code to add something.' },
  { id: 'suggested', label: 'Suggested', empty: 'No suggestions yet. Run /suggestions in Claude Code.' },
]

// The current view lives in the query string, so a refresh keeps it.
function useQuery() {
  const [query, setQuery] = useState(() => new URLSearchParams(location.search))
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(query)
    for (const [key, value] of Object.entries(changes)) value ? next.set(key, value) : next.delete(key)
    history.replaceState(null, '', next.size ? `?${next}` : location.pathname)
    setQuery(next)
  }
  return [query, update] as const
}

export default function App() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [query, update] = useQuery()

  // Reload whenever the window regains focus, to pick up movies Claude Code just added.
  const load = useCallback(() => fetch('/api/library').then((r) => r.json()).then(setLibrary), [])
  useEffect(() => {
    load()
    addEventListener('focus', load)
    return () => removeEventListener('focus', load)
  }, [load])

  if (!library) return null

  const tab = query.get('tab') ?? 'watched'
  const sort = sorts[query.get('sort') ?? ''] ? query.get('sort')! : 'rating'
  const search = query.get('q') ?? ''
  const selected = query.get('genres')?.split(',') ?? []
  const allGenres = [...new Set(library.movies.flatMap((m) => m.genres))].sort()

  const matches = library.movies.filter(
    (m) => m.title.toLowerCase().includes(search.toLowerCase()) && (!selected.length || m.genres.some((g) => selected.includes(g))),
  )
  const shown = matches.filter((m) => m.status === tab).sort((a, b) => sorts[sort].compare(a, b) || a.title.localeCompare(b.title))
  const open = library.movies.find((m) => m.id === Number(query.get('movie')))

  const toggleGenre = (g: string) => {
    const next = selected.includes(g) ? selected.filter((s) => s !== g) : [...selected, g]
    update({ genres: next.join(',') || null })
  }
  const changeStatus = (m: Movie) => async (status: 'watchlist' | 'dismissed') => {
    await setStatus(m.id, status)
    if (open?.id === m.id) update({ movie: null })
    load()
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
                  onClick={() => update({ tab: t.id === 'watched' ? null : t.id })}
                  className={`border-b-2 px-4 text-sm font-semibold tracking-wide uppercase transition ${
                    tab === t.id ? 'border-sky-400 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t.label} <span className="ml-1 text-xs text-zinc-500">{matches.filter((m) => m.status === t.id).length}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-3 pb-3">
            <input
              type="search"
              value={search}
              onChange={(e) => update({ q: e.target.value || null })}
              placeholder="Search titles"
              className="w-56 rounded bg-zinc-800 px-3 py-1.5 text-sm placeholder-zinc-500 ring-1 ring-white/10 outline-none focus:ring-sky-400"
            />
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value === 'rating' ? null : e.target.value })}
              className="rounded bg-zinc-800 px-2 py-1.5 text-sm ring-1 ring-white/10 outline-none focus:ring-sky-400"
            >
              {Object.entries(sorts).map(([id, s]) => (
                <option key={id} value={id}>{s.label}</option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1.5">
              {allGenres.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`rounded-full px-2.5 py-1 text-xs transition ${
                    selected.includes(g) ? 'bg-sky-500 font-semibold text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {g}
                </button>
              ))}
              {selected.length > 0 && (
                <button onClick={() => update({ genres: null })} className="px-2 text-xs text-zinc-400 hover:text-white">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        {tab === 'suggested' && <TastePanel library={library} />}
        {shown.length ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {shown.map((m) => (
              <Card key={m.id} movie={m} onOpen={() => update({ movie: String(m.id) })} onStatus={changeStatus(m)} />
            ))}
          </div>
        ) : (
          <p className="py-20 text-center text-zinc-500">
            {search || selected.length ? 'No movies match your search or filters.' : tabs.find((t) => t.id === tab)?.empty}
          </p>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-zinc-600">This product uses the TMDB API but is not endorsed or certified by TMDB.</footer>

      {open && (
        <Detail
          movie={open}
          basedOn={library.movies.filter((m) => open.based_on.includes(m.id))}
          onClose={() => update({ movie: null })}
          onStatus={changeStatus(open)}
        />
      )}
    </div>
  )
}

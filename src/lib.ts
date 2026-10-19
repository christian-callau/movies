// Types only: `server/db.ts` opens the database when it loads, so importing a value from it
// would pull SQLite into the browser bundle.
import type { Movie, Tier } from '../server/db.ts'

export type { Movie, Tier }
export type Library = { movies: Movie[]; taste: { prompt: string | null; summary: string | null } }

export const year = (m: Movie) => m.release_date?.slice(0, 4) ?? ''
export const posterUrl = (m: Movie) => `/posters${m.poster_path}`

// Best to worst. S gets the only gradient, so the top of the library reads at a glance.
// `Record<Tier, string>` makes a missing tier a type error, and the key order is the sort order.
const tierClasses: Record<Tier, string> = {
  S: 'bg-linear-to-br from-fuchsia-500 to-violet-600 text-white',
  A: 'bg-amber-400 text-black',
  B: 'bg-emerald-500 text-black',
  C: 'bg-sky-400 text-black',
  D: 'bg-yellow-300 text-black',
  E: 'bg-orange-400 text-black',
  F: 'bg-rose-500 text-white',
}

export const tierClass = (tier: Tier) => tierClasses[tier]

export const tierOrder = Object.keys(tierClasses) as Tier[]

// Watched entries are scored by tier, everything else by its TMDB rating, so the two never
// share a sort. Counting back from the end puts S highest and leaves unscored entries last.
const rank = (m: Movie) =>
  m.status === 'watched' ? (m.tier ? tierOrder.length - tierOrder.indexOf(m.tier) : null) : m.tmdb_rating

export const runtime = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`

// "Oct 12" for this year, "Oct 12, 2025" otherwise.
export function watchedLabel(date: string) {
  return formatDate(date, date.slice(0, 4) !== new Date().getFullYear().toString())
}

export function formatDate(date: string, withYear = true) {
  return new Date(`${date}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: withYear ? 'numeric' : undefined })
}

// The years a collection spans, e.g. "2001–2011". A single-film collection shows one year.
export function years(m: Movie) {
  const last = m.parts.at(-1)?.year
  const first = year(m)
  return last && last !== first ? `${first}–${last}` : first
}

// "In theaters Dec 18" for movies that aren't out yet, "Premieres Dec 18" for series.
export function releaseBadge(m: Movie) {
  const today = new Date().toLocaleDateString('en-CA')
  if (m.kind === 'collection' || m.status === 'watched' || !m.release_date || m.release_date <= today) return null
  return `${m.kind === 'tv' ? 'Premieres' : 'In theaters'} ${formatDate(m.release_date, m.release_date.slice(0, 4) !== today.slice(0, 4))}`
}

export const sorts: Record<string, { label: string; compare: (a: Movie, b: Movie) => number; watchedOnly?: boolean }> = {
  rating: { label: 'Score: high to low', compare: (a, b) => (rank(b) ?? -1) - (rank(a) ?? -1) },
  // Entries with no date land at the bottom, since '' sorts after any date here.
  watched: {
    label: 'Recently watched',
    compare: (a, b) => (b.watched_on ?? '').localeCompare(a.watched_on ?? ''),
    watchedOnly: true,
  },
  'rating-asc': { label: 'Score: low to high', compare: (a, b) => (rank(a) ?? 99) - (rank(b) ?? 99) },
  newest: { label: 'Release: newest', compare: (a, b) => (b.release_date ?? '9999').localeCompare(a.release_date ?? '9999') },
  oldest: { label: 'Release: oldest', compare: (a, b) => (a.release_date ?? '9999').localeCompare(b.release_date ?? '9999') },
  genre: { label: 'Genre: A–Z', compare: (a, b) => (a.genres[0] ?? '~').localeCompare(b.genres[0] ?? '~') },
}

export type Shelf = 'weekend' | 'someday'

async function post(path: string, body: object) {
  await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

export const setStatus = (id: number, status: 'watchlist' | 'dismissed') => post(`/api/movies/${id}/status`, { status })
export const setShelf = (id: number, shelf: Shelf) => post(`/api/movies/${id}/shelf`, { shelf })

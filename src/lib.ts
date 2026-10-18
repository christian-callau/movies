import type { Movie } from '../server/db.ts'

export type { Movie }
export type Library = { movies: Movie[]; taste: { prompt: string | null; summary: string | null } }

export const year = (m: Movie) => m.release_date?.slice(0, 4) ?? ''
export const posterUrl = (m: Movie) => `/posters${m.poster_path}`

// The user's own rating for watched movies, the TMDB rating for everything else.
export const score = (m: Movie) => (m.status === 'watched' ? m.rating : m.tmdb_rating)

export function ratingClass(n: number) {
  if (n >= 9) return 'bg-amber-400 text-black'
  if (n >= 7) return 'bg-emerald-500 text-black'
  if (n >= 5) return 'bg-zinc-300 text-black'
  return 'bg-rose-500 text-white'
}

export const runtime = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`

export function formatDate(date: string, withYear = true) {
  return new Date(`${date}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: withYear ? 'numeric' : undefined })
}

// "In theaters Dec 18" for movies that aren't out yet, "Premieres Dec 18" for series.
export function releaseBadge(m: Movie) {
  const today = new Date().toLocaleDateString('en-CA')
  if (m.status === 'watched' || !m.release_date || m.release_date <= today) return null
  return `${m.kind === 'tv' ? 'Premieres' : 'In theaters'} ${formatDate(m.release_date, m.release_date.slice(0, 4) !== today.slice(0, 4))}`
}

export const sorts: Record<string, { label: string; compare: (a: Movie, b: Movie) => number }> = {
  rating: { label: 'Rating: high to low', compare: (a, b) => (score(b) ?? -1) - (score(a) ?? -1) },
  'rating-asc': { label: 'Rating: low to high', compare: (a, b) => (score(a) ?? 99) - (score(b) ?? 99) },
  newest: { label: 'Release: newest', compare: (a, b) => (b.release_date ?? '9999').localeCompare(a.release_date ?? '9999') },
  oldest: { label: 'Release: oldest', compare: (a, b) => (a.release_date ?? '9999').localeCompare(b.release_date ?? '9999') },
  genre: { label: 'Genre: A–Z', compare: (a, b) => (a.genres[0] ?? '~').localeCompare(b.genres[0] ?? '~') },
}

export async function setStatus(id: number, status: 'watchlist' | 'dismissed') {
  await fetch(`/api/movies/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

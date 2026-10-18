import { existsSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { postersDir, root, type Kind } from './db.ts'

process.loadEnvFile(join(root, '.env'))

async function get(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` } })
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}: ${await res.text()}`)
  return res.json()
}

// TMDB uses `title`/`release_date` for movies and `name`/`first_air_date` for series.
export async function search(kind: Kind, query: string, year?: string) {
  const yearParam = kind === 'tv' ? 'first_air_date_year' : 'year'
  const data = await get(`/search/${kind}`, year ? { query, [yearParam]: year } : { query })
  return data.results.slice(0, 8).map((r: any) => ({
    tmdb_id: r.id,
    title: r.title ?? r.name,
    release_date: (r.release_date ?? r.first_air_date) || null,
    votes: r.vote_count,
    overview: r.overview.slice(0, 200),
  }))
}

// Some TV genres combine two movie genres. Splitting them keeps one genre list for the filter.
const tvGenres: Record<string, string[]> = {
  'Sci-Fi & Fantasy': ['Science Fiction', 'Fantasy'],
  'Action & Adventure': ['Action', 'Adventure'],
  'War & Politics': ['War'],
}

// Metadata columns for the movies table, with the poster saved to disk.
export async function details(kind: Kind, tmdbId: number) {
  const m = await get(`/${kind}/${tmdbId}`, { append_to_response: 'credits' })
  if (m.poster_path) await savePoster(m.poster_path)
  const director = m.credits.crew.find((c: any) => c.job === 'Director')?.name
  return {
    kind,
    tmdb_id: m.id,
    title: m.title ?? m.name,
    release_date: (m.release_date ?? m.first_air_date) || null,
    poster_path: m.poster_path,
    overview: m.overview || null,
    runtime_min: m.runtime || null,
    seasons: m.number_of_seasons ?? null,
    director: (kind === 'tv' ? m.created_by.map((c: any) => c.name).join(', ') : director) || null,
    tmdb_rating: m.vote_count ? Math.round(m.vote_average * 10) / 10 : null,
    genres: JSON.stringify(m.genres.flatMap((g: any) => tvGenres[g.name] ?? [g.name])),
  }
}

async function savePoster(path: string) {
  const file = join(postersDir, basename(path))
  if (existsSync(file)) return
  const res = await fetch(`https://image.tmdb.org/t/p/w500${path}`)
  if (!res.ok) throw new Error(`Poster download failed (${res.status}): ${path}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
}

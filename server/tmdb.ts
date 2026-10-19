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

// TMDB uses `title`/`release_date` for movies, `name`/`first_air_date` for series, and `name` alone for collections.
export async function search(kind: Kind, query: string, year?: string) {
  const yearParam = kind === 'tv' ? 'first_air_date_year' : 'year'
  const params = year && kind !== 'collection' ? { query, [yearParam]: year } : { query }
  const data = await get(`/search/${kind}`, params)
  return data.results.slice(0, 8).map((r: any) => ({
    tmdb_id: r.id,
    title: r.title ?? r.name,
    release_date: (r.release_date ?? r.first_air_date) || null,
    votes: r.vote_count ?? null,
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
  if (kind === 'collection') return collectionDetails(tmdbId)
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
    parts: '[]',
    director: (kind === 'tv' ? m.created_by.map((c: any) => c.name).join(', ') : director) || null,
    tmdb_rating: m.vote_count ? Math.round(m.vote_average * 10) / 10 : null,
    genres: JSON.stringify(m.genres.flatMap((g: any) => tvGenres[g.name] ?? [g.name])),
  }
}

// Collection parts carry genre ids instead of names, so the id-to-name map is fetched once.
let genreNames: Map<number, string> | undefined
async function genreName(id: number) {
  genreNames ??= new Map((await get('/genre/movie/list')).genres.map((g: any) => [g.id, g.name]))
  return genreNames.get(id)
}

// A franchise as one entry: the collection poster, every film in `parts`, and figures averaged over the films.
async function collectionDetails(tmdbId: number) {
  const c = await get(`/collection/${tmdbId}`)
  if (c.poster_path) await savePoster(c.poster_path)
  // Unreleased films are left out, so a watched franchise isn't padded with sequels that don't exist yet.
  // `refresh-metadata` picks them up once they are out.
  const today = new Date().toLocaleDateString('en-CA')
  const films = c.parts
    .filter((p: any) => p.release_date && p.release_date <= today)
    .sort((a: any, b: any) => a.release_date.localeCompare(b.release_date))
  if (!films.length) throw new Error(`Collection ${tmdbId} has no released films`)

  // Genres shared by at least a third of the films, most common first.
  const counts = new Map<number, number>()
  for (const id of films.flatMap((p: any) => p.genre_ids)) counts.set(id, (counts.get(id) ?? 0) + 1)
  const genres = await Promise.all(
    [...counts]
      .filter(([, n]) => n >= films.length / 3)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => genreName(id)),
  )

  const rated = films.filter((p: any) => p.vote_count)
  const mean = rated.reduce((sum: number, p: any) => sum + p.vote_average, 0) / (rated.length || 1)
  return {
    kind: 'collection' as const,
    tmdb_id: c.id,
    title: c.name,
    release_date: films[0].release_date,
    poster_path: c.poster_path,
    overview: c.overview || null,
    runtime_min: null,
    seasons: null,
    parts: JSON.stringify(films.map((p: any) => ({ title: p.title, year: p.release_date.slice(0, 4) }))),
    director: null,
    tmdb_rating: rated.length ? Math.round(mean * 10) / 10 : null,
    genres: JSON.stringify(genres.filter(Boolean)),
  }
}

async function savePoster(path: string) {
  const file = join(postersDir, basename(path))
  if (existsSync(file)) return
  const res = await fetch(`https://image.tmdb.org/t/p/w500${path}`)
  if (!res.ok) throw new Error(`Poster download failed (${res.status}): ${path}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
}

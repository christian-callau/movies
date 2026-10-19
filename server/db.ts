import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const root = join(import.meta.dirname, '..')
export const postersDir = join(root, 'data', 'posters')
mkdirSync(postersDir, { recursive: true })

export const db = new Database(join(root, 'data', 'movies.db'))
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'movie' CHECK (kind IN ('movie', 'tv', 'collection')),
    tmdb_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    release_date TEXT,
    poster_path TEXT,
    overview TEXT,
    runtime_min INTEGER,
    seasons INTEGER,
    parts TEXT NOT NULL DEFAULT '[]',
    director TEXT,
    tmdb_rating REAL,
    genres TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL CHECK (status IN ('watched', 'watchlist', 'suggested', 'dismissed')),
    watched_on TEXT,
    tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'D', 'E', 'F')),
    rating REAL CHECK (rating BETWEEN 1 AND 10),
    raw_feedback TEXT,
    review TEXT,
    liked TEXT NOT NULL DEFAULT '[]',
    disliked TEXT NOT NULL DEFAULT '[]',
    shelf TEXT CHECK (shelf IN ('weekend', 'someday')),
    suggestion_reason TEXT,
    based_on TEXT NOT NULL DEFAULT '[]',
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (kind, tmdb_id)
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`)

// Ratings were 1–10 until the library outgrew the top of that scale: too many 10s, and no way to
// say "above all of them". Tiers replaced them, with `S` as the ceiling the numbers never had.
// The old numbers stay in `rating` as a record of where each tier came from; nothing writes them now.
const columns = new Set((db.prepare('SELECT name FROM pragma_table_info(?)').all('movies') as { name: string }[]).map((c) => c.name))
if (!columns.has('tier')) {
  db.exec(`
    ALTER TABLE movies ADD COLUMN tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'D', 'E', 'F'));
    UPDATE movies SET tier = CASE
      WHEN rating IS NULL THEN NULL
      WHEN rating >= 9.5 THEN 'A'
      WHEN rating >= 8.5 THEN 'B'
      WHEN rating >= 7.5 THEN 'C'
      WHEN rating >= 6 THEN 'D'
      WHEN rating >= 4 THEN 'E'
      ELSE 'F'
    END;
  `)
}

export type Status = 'watched' | 'watchlist' | 'suggested' | 'dismissed'
export type Kind = 'movie' | 'tv' | 'collection'

// Best to worst. `S` is meant to stay small — the handful that sit above everything else.
// It saturates like a 10 would if it fills up, so it is a shelf, not a grade.
export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
export const tiers: Tier[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F']

// A movie, a TV series or a franchise collection.
// Series: release_date is the first air date, director holds the creators.
// Collection: release_date is the first film's, parts lists every film, and there is no director.
// Watchlist entries sit on a shelf: `weekend` (watching soon) or `someday`.
// Watched entries can carry the date they were seen (`watched_on`), which is often unknown for older ones,
// and a `tier` from S to F. `rating` is the 1–10 score they were given before tiers, kept for reference only.
export type Movie = {
  id: number
  kind: Kind
  tmdb_id: number
  title: string
  release_date: string | null
  poster_path: string | null
  overview: string | null
  runtime_min: number | null
  seasons: number | null
  parts: { title: string; year: string }[]
  director: string | null
  tmdb_rating: number | null
  genres: string[]
  status: Status
  watched_on: string | null
  tier: Tier | null
  rating: number | null
  raw_feedback: string | null
  review: string | null
  liked: string[]
  disliked: string[]
  shelf: 'weekend' | 'someday' | null
  suggestion_reason: string | null
  based_on: number[]
  added_at: string
}

export const listFields = ['genres', 'liked', 'disliked', 'based_on', 'parts']

function parse(row: Record<string, unknown>): Movie {
  for (const f of listFields) row[f] = JSON.parse(row[f] as string)
  return row as Movie
}

export function listMovies(status?: string): Movie[] {
  const rows = status
    ? db.prepare('SELECT * FROM movies WHERE status = ? ORDER BY id').all(status)
    : db.prepare('SELECT * FROM movies ORDER BY id').all()
  return (rows as Record<string, unknown>[]).map(parse)
}

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, value)
}

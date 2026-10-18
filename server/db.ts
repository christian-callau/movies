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
    kind TEXT NOT NULL DEFAULT 'movie' CHECK (kind IN ('movie', 'tv')),
    tmdb_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    release_date TEXT,
    poster_path TEXT,
    overview TEXT,
    runtime_min INTEGER,
    seasons INTEGER,
    director TEXT,
    tmdb_rating REAL,
    genres TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL CHECK (status IN ('watched', 'watchlist', 'suggested', 'dismissed')),
    rating REAL CHECK (rating BETWEEN 1 AND 10),
    raw_feedback TEXT,
    review TEXT,
    liked TEXT NOT NULL DEFAULT '[]',
    disliked TEXT NOT NULL DEFAULT '[]',
    priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
    suggestion_reason TEXT,
    based_on TEXT NOT NULL DEFAULT '[]',
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (kind, tmdb_id)
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`)

export type Status = 'watched' | 'watchlist' | 'suggested' | 'dismissed'
export type Kind = 'movie' | 'tv'

// A movie or a TV series. For series, release_date is the first air date and director holds the creators.
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
  director: string | null
  tmdb_rating: number | null
  genres: string[]
  status: Status
  rating: number | null
  raw_feedback: string | null
  review: string | null
  liked: string[]
  disliked: string[]
  priority: 'high' | 'medium' | 'low' | null
  suggestion_reason: string | null
  based_on: number[]
  added_at: string
}

export const listFields = ['genres', 'liked', 'disliked', 'based_on']

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

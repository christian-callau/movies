import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { db, getSetting, listFields, listMovies, setSetting, type Kind } from './db.ts'
import { details, search } from './tmdb.ts'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { year: { type: 'string' }, status: { type: 'string' }, tv: { type: 'boolean' } },
})
const [cmd, ...args] = positionals

// JSON comes from an argument, or from stdin when the argument is left out.
const readJson = (arg?: string) => JSON.parse(arg ?? readFileSync(0, 'utf8'))

const editable = ['status', 'rating', 'raw_feedback', 'review', 'liked', 'disliked', 'priority', 'suggestion_reason', 'based_on']

// Keeps editable fields and turns lists into JSON text. Unknown keys are rejected to catch typos.
function columns(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!editable.includes(key)) throw new Error(`Unknown field "${key}". Allowed: ${editable.join(', ')}`)
    if (listFields.includes(key) && !Array.isArray(value)) throw new Error(`"${key}" must be a list`)
    out[key] = listFields.includes(key) ? JSON.stringify(value) : value
  }
  return out
}

function insert(row: Record<string, unknown>) {
  const keys = Object.keys(row)
  const sql = `INSERT INTO movies (${keys.join(', ')}) VALUES (${keys.map((k) => '@' + k).join(', ')})`
  return Number(db.prepare(sql).run(row).lastInsertRowid)
}

function brief(id: number) {
  return db.prepare('SELECT id, kind, title, substr(release_date, 1, 4) AS year, status, rating, priority FROM movies WHERE id = ?').get(id)
}

const commands: Record<string, () => unknown> = {
  search: () => search(values.tv ? 'tv' : 'movie', args.join(' '), values.year),

  async add() {
    const { tmdb_id, kind = 'movie', ...fields } = readJson(args[0])
    if (kind !== 'movie' && kind !== 'tv') throw new Error('"kind" must be "movie" or "tv"')
    const existing = db.prepare('SELECT id, status FROM movies WHERE kind = ? AND tmdb_id = ?').get(kind, tmdb_id) as { id: number; status: string } | undefined
    if (existing) throw new Error(`Already in the library as id ${existing.id} (${existing.status}). Use update instead.`)
    const cols = columns(fields)
    return brief(insert({ ...(await details(kind, tmdb_id)), ...cols }))
  },

  update() {
    const id = Number(args[0])
    const changes = columns(readJson(args[1]))
    const keys = Object.keys(changes)
    if (!keys.length) throw new Error('Nothing to update')
    const result = db.prepare(`UPDATE movies SET ${keys.map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...changes, id })
    if (!result.changes) throw new Error(`No movie with id ${id}`)
    return brief(id)
  },

  remove() {
    const id = Number(args[0])
    const movie = brief(id)
    if (!movie) throw new Error(`No movie with id ${id}`)
    db.prepare('DELETE FROM movies WHERE id = ?').run(id)
    return { removed: movie }
  },

  list: () => listMovies(values.status).map(({ overview, poster_path, added_at, ...m }) => m),

  taste: () => ({
    prompt: getSetting('taste_prompt'),
    summary: getSetting('taste_summary'),
    watched: listMovies('watched').map(({ id, title, rating, liked, disliked }) => ({ id, title, rating, liked, disliked })),
  }),

  'set-taste'() {
    const { prompt, summary, ...rest } = readJson(args[0])
    if (Object.keys(rest).length) throw new Error('Only "prompt" and "summary" can be set')
    if (prompt !== undefined) setSetting('taste_prompt', prompt)
    if (summary !== undefined) setSetting('taste_summary', summary)
    return commands.taste()
  },

  // Suggestions are movies only.
  async 'replace-suggestions'() {
    const picks: { tmdb_id: number; reason: string; based_on?: number[] }[] = readJson(args[0])
    const rows = db.prepare("SELECT tmdb_id, title FROM movies WHERE status != 'suggested' AND kind = 'movie'").all() as { tmdb_id: number; title: string }[]
    const taken = new Map(rows.map((r) => [r.tmdb_id, r.title]))
    const unique = [...new Map(picks.map((p) => [p.tmdb_id, p])).values()]
    const fresh = unique.filter((p) => !taken.has(p.tmdb_id))
    const metas = await Promise.all(fresh.map((p) => details('movie', p.tmdb_id)))
    db.transaction(() => {
      db.prepare("DELETE FROM movies WHERE status = 'suggested'").run()
      fresh.forEach((p, i) => insert({ ...metas[i], ...columns({ status: 'suggested', suggestion_reason: p.reason, based_on: p.based_on ?? [] }) }))
    })()
    return {
      saved: metas.map((m) => m.title),
      skipped_already_in_library: unique.filter((p) => taken.has(p.tmdb_id)).map((p) => taken.get(p.tmdb_id)),
    }
  },

  async 'refresh-metadata'() {
    const rows = (args[0]
      ? db.prepare('SELECT id, kind, tmdb_id FROM movies WHERE id = ?').all(Number(args[0]))
      : db.prepare('SELECT id, kind, tmdb_id FROM movies').all()) as { id: number; kind: Kind; tmdb_id: number }[]
    const update = db.prepare(`UPDATE movies SET title = @title, release_date = @release_date, poster_path = @poster_path, overview = @overview,
      runtime_min = @runtime_min, seasons = @seasons, director = @director, tmdb_rating = @tmdb_rating, genres = @genres WHERE id = @id`)
    for (const r of rows) {
      const { kind, tmdb_id, ...meta } = await details(r.kind, r.tmdb_id)
      update.run({ ...meta, id: r.id })
    }
    return { refreshed: rows.length }
  },
}

const run = commands[cmd]
if (!run) {
  console.error(`Usage: node server/cli.ts <${Object.keys(commands).join(' | ')}> [args]`)
  process.exit(1)
}
try {
  console.log(JSON.stringify(await run(), null, 2))
} catch (e) {
  console.error(`Error: ${(e as Error).message}`)
  process.exit(1)
}

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono, type Context } from 'hono'
import { join } from 'node:path'
import { db, getSetting, listMovies, root } from './db.ts'

const app = new Hono()

// Only answer requests addressed to this machine. This blocks DNS rebinding from other websites.
app.use(async (c, next) => {
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(c.req.header('host') ?? '')) return c.text('Forbidden', 403)
  await next()
})

app.get('/api/library', (c) =>
  c.json({
    movies: listMovies().filter((m) => m.status !== 'dismissed'),
    taste: { prompt: getSetting('taste_prompt'), summary: getSetting('taste_summary') },
  }),
)

// The two write paths the app itself has. Requiring JSON forces a CORS preflight on cross-site
// requests, which is never granted, so another site can't drive these.
const jsonOnly = (c: Context) => c.req.header('content-type')?.startsWith('application/json')

// The suggestion buttons.
app.post('/api/movies/:id/status', async (c) => {
  if (!jsonOnly(c)) return c.json({ error: 'Expected JSON' }, 415)
  const { status } = await c.req.json()
  if (status !== 'watchlist' && status !== 'dismissed') return c.json({ error: 'status must be watchlist or dismissed' }, 400)
  const result = db
    .prepare(`UPDATE movies SET status = ?, shelf = IIF(? = 'watchlist', 'weekend', NULL) WHERE id = ? AND status = 'suggested'`)
    .run(status, status, Number(c.req.param('id')))
  return result.changes ? c.json({ ok: true }) : c.json({ error: 'Not a current suggestion' }, 404)
})

// Moving a watchlist entry across the divider.
app.post('/api/movies/:id/shelf', async (c) => {
  if (!jsonOnly(c)) return c.json({ error: 'Expected JSON' }, 415)
  const { shelf } = await c.req.json()
  if (shelf !== 'weekend' && shelf !== 'someday') return c.json({ error: 'shelf must be weekend or someday' }, 400)
  const result = db.prepare(`UPDATE movies SET shelf = ? WHERE id = ? AND status = 'watchlist'`).run(shelf, Number(c.req.param('id')))
  return result.changes ? c.json({ ok: true }) : c.json({ error: 'Not a watchlist entry' }, 404)
})

// Posters and Vite's hashed build files never change, so browsers can cache them for good.
const cacheForever = (_path: string, c: Context) => c.header('Cache-Control', 'public, max-age=31536000, immutable')
app.use('/posters/*', serveStatic({ root: join(root, 'data'), onFound: cacheForever }))
app.use('/assets/*', serveStatic({ root: join(root, 'dist'), onFound: cacheForever }))
app.use('/*', serveStatic({ root: join(root, 'dist') }))

serve({ fetch: app.fetch, port: 3000, hostname: '127.0.0.1' }, () => console.log('Movies running at http://127.0.0.1:3000'))

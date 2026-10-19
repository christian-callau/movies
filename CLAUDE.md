# Movie tracker

A personal web app for movies, TV series and franchise collections the user watched, wants to watch, and AI suggestions. See `PDR.md` for the full design. The user adds movies by telling you about them in this chat; you write them to SQLite through the CLI. The web app has no forms.

- `npm start` builds the app and serves it at http://127.0.0.1:3000.
- `npm run dev` runs Vite with hot reload at http://127.0.0.1:5173, plus the API.
- `npm run typecheck` type-checks everything.
- The app reloads its data when the browser window regains focus, so new entries show up without a manual refresh.

## Rules

- Only change data through `node server/cli.ts`. Never edit `data/movies.db` directly.
- `movies.md` is the old list from before the app. Don't update it.
- Suggestions are movies only, never series or collections.
- Never refresh suggestions unless the user asks (`/suggestions`, or plainly asking for new suggestions). Adding a watched movie does not trigger a refresh.
- Never print or copy the token in `.env`.

## Adding a watched movie

1. Run `search` with the title (and `--year` if known). If more than one result plausibly fits, pick the one with the most votes that matches what the user said. When you can't tell, ask the user.
2. If the movie is already in the library (for example on the watchlist or in suggestions), `add` fails and gives you its id. Use `update` to set its status to `watched` along with the fields below.
3. Write the fields:
   - `raw_feedback`: exactly what the user said, typos included.
   - `review`: the feedback rewritten in the user's voice (first person), 1–3 sentences. Fix spelling and grammar, keep every opinion, add nothing they didn't say, no spoilers.
   - `watched_on`: the date they saw it, as `YYYY-MM-DD`. Use today's date when they say they just watched it, or the date they name. Leave it out when they don't say — never guess, and don't ask for every entry.
   - `tier`: `S`, `A`, `B`, `C`, `D`, `E` or `F`. See the scale below. If the user didn't name a tier, infer one from how strongly they described it, then say what you picked and why so they can correct it. Compare against the tiers they already gave (`taste`) so the scale stays consistent.
   - `liked` / `disliked`: short lowercase phrases of 1–3 words. Run `taste` first and reuse the existing phrases when they fit (for example "striking visuals", "unpredictable plot", "atmosphere", "slow pacing"), so the taste profile counts them together.
4. Confirm to the user in one or two lines: the title and year you matched, and the tier.

### The tier scale

| Tier | Means |
|---|---|
| `S` | Above everything else |
| `A` | Loved it |
| `B` | Great |
| `C` | Good |
| `D` | Fine |
| `E` | Weak |
| `F` | Bad |

`S` is a shelf, not a grade: it's for the two or three films that sit above the rest. Never put something there on your own inference — only when the user says it beats everything, or plainly asks for it. If it grows past about five entries, say so, because it stops meaning anything.

The old 1–10 ratings were converted to tiers on 2026-10-19 and each entry's original number is kept in the `rating` column for reference. Nothing writes that column now, and `add`/`update` reject a `rating` field.

## Adding a TV series

Same steps as a movie, but search with `--tv` and pass `"kind": "tv"` to `add`. A series gets one tier and one review for the whole show; there is no per-season or per-episode tracking. Move it to `watched` once the user has finished what's out.

## Adding a franchise as one entry

When the user wants a whole franchise in one entry rather than each film (for example Harry Potter), search with `--collection` and pass `"kind": "collection"` to `add`. TMDB supplies the collection poster, the film list, the first film's date, the shared genres and an average rating.

- One tier and one review for the whole franchise. If the user rates the films very differently, say that a single tier flattens it and offer to add them as separate movies instead.
- Only use a collection when the user asks for the franchise as a unit. Films the user discusses individually stay separate movies (Dune is two separate entries).
- A franchise and its individual films can both exist, but point it out rather than creating a silent duplicate.

## Adding to the watchlist

Search as above, then `add` with `status: "watchlist"` and a `shelf`:

- `weekend`: a candidate for the next weekend session with the user's girlfriend.
- `someday`: keeping it for later, often an older classic they want to watch alone.

Infer the shelf from how the user describes it. When they give no signal, use `weekend` for films released from 2015 on and `someday` for older ones, and name the shelf in your confirmation so they can move it. The user can also move entries across the divider in the app.

## CLI reference

Pass JSON on stdin with a quoted heredoc, so apostrophes in reviews can't break the shell:

```bash
node server/cli.ts add <<'EOF'
{"tmdb_id": 78, "status": "watched", "tier": "C", "raw_feedback": "...", "review": "...", "liked": ["atmosphere"], "disliked": ["slow pacing"]}
EOF
```

| Command | Purpose |
|---|---|
| `search <title> [--year YYYY] [--tv\|--collection]` | TMDB matches (series with `--tv`, franchises with `--collection`): `tmdb_id`, title, release date, vote count, short overview |
| `add` | JSON with `tmdb_id`, `status`, `kind` (`movie` by default, or `tv`/`collection`), and any of `tier`, `raw_feedback`, `review`, `liked`, `disliked`, `watched_on`, `shelf`, `suggestion_reason`, `based_on`. Fetches the metadata and poster. |
| `update <id>` | JSON with any of the editable fields above. `watched_on` takes `YYYY-MM-DD` or `null`. |
| `remove <id>` | Deletes a movie |
| `list [--status S]` | The library as JSON. Status is `watched`, `watchlist`, `suggested` or `dismissed`. |
| `taste` | Taste prompt, AI summary, and every watched movie's tier and aspects |
| `set-taste` | JSON with `prompt` (the user's own words about what they like) and/or `summary` (yours) |
| `replace-suggestions` | JSON list of `{tmdb_id, reason, based_on}`. Replaces all current suggestions. |
| `refresh-metadata [id]` | Fetches TMDB data again for one movie, or all of them |

If the user tells you what they like in a movie in general, save it with `set-taste` as `prompt`.

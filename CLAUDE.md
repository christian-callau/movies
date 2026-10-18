# Movie tracker

A personal web app for movies (and TV series) the user watched, wants to watch, and AI suggestions. See `PDR.md` for the full design. The user adds movies by telling you about them in this chat; you write them to SQLite through the CLI. The web app has no forms.

- `npm start` builds the app and serves it at http://127.0.0.1:3000.
- `npm run dev` runs Vite with hot reload at http://127.0.0.1:5173, plus the API.
- `npm run typecheck` type-checks everything.
- The app reloads its data when the browser window regains focus, so new entries show up without a manual refresh.

## Rules

- Only change data through `node server/cli.ts`. Never edit `data/movies.db` directly.
- `movies.md` is the old list from before the app. Don't update it.
- Suggestions are movies only, never series.
- Never refresh suggestions unless the user asks (`/suggestions`, or plainly asking for new suggestions). Adding a watched movie does not trigger a refresh.
- Never print or copy the token in `.env`.

## Adding a watched movie

1. Run `search` with the title (and `--year` if known). If more than one result plausibly fits, pick the one with the most votes that matches what the user said. When you can't tell, ask the user.
2. If the movie is already in the library (for example on the watchlist or in suggestions), `add` fails and gives you its id. Use `update` to set its status to `watched` along with the fields below.
3. Write the fields:
   - `raw_feedback`: exactly what the user said, typos included.
   - `review`: the feedback rewritten in the user's voice (first person), 1–3 sentences. Fix spelling and grammar, keep every opinion, add nothing they didn't say, no spoilers.
   - `rating`: 1–10. Half points (like 9.5) are fine when the user gives them. If the user didn't give a number, infer one from how strongly they described it, then say what you picked and why so they can correct it. Compare against their existing ratings (`list --status watched`) so the scale stays consistent.
   - `liked` / `disliked`: short lowercase phrases of 1–3 words. Run `taste` first and reuse the existing phrases when they fit (for example "striking visuals", "unpredictable plot", "atmosphere", "slow pacing"), so the taste profile counts them together.
4. Confirm to the user in one or two lines: the title and year you matched, and the rating.

## Adding a TV series

Same steps as a movie, but search with `--tv` and pass `"kind": "tv"` to `add`. A series gets one rating and one review for the whole show; there is no per-season or per-episode tracking. Move it to `watched` once the user has finished what's out.

## Adding to the watchlist

Search as above, then `add` with `status: "watchlist"`. Priority is `medium` unless the user signals otherwise (excitement or "next up" means `high`).

## CLI reference

Pass JSON on stdin with a quoted heredoc, so apostrophes in reviews can't break the shell:

```bash
node server/cli.ts add <<'EOF'
{"tmdb_id": 78, "status": "watched", "rating": 8, "raw_feedback": "...", "review": "...", "liked": ["atmosphere"], "disliked": ["slow pacing"]}
EOF
```

| Command | Purpose |
|---|---|
| `search <title> [--year YYYY] [--tv]` | TMDB matches (series with `--tv`): `tmdb_id`, title, release date, vote count, short overview |
| `add` | JSON with `tmdb_id`, `status`, `kind` (`movie` by default, or `tv`), and any of `rating`, `raw_feedback`, `review`, `liked`, `disliked`, `priority`, `suggestion_reason`, `based_on`. Fetches the metadata and poster. |
| `update <id>` | JSON with any of the editable fields above |
| `remove <id>` | Deletes a movie |
| `list [--status S]` | The library as JSON. Status is `watched`, `watchlist`, `suggested` or `dismissed`. |
| `taste` | Taste prompt, AI summary, and every watched movie's rating and aspects |
| `set-taste` | JSON with `prompt` (the user's own words about what they like) and/or `summary` (yours) |
| `replace-suggestions` | JSON list of `{tmdb_id, reason, based_on}`. Replaces all current suggestions. |
| `refresh-metadata [id]` | Fetches TMDB data again for one movie, or all of them |

If the user tells you what they like in a movie in general, save it with `set-taste` as `prompt`.

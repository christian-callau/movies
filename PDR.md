# PDR: Movie Tracker Web App

Status: Draft · Last updated: 2026-10-18

## 1. Summary

A personal web app, run locally, for tracking movies the user has watched, movies they want to watch, and movies an AI suggests based on what they liked. The interface is a grid of poster cards, styled like the Steam library.

The web app has no add-movie forms. The user tells Claude Code what they watched and what they thought of it. Claude Code rewrites the review, fetches the poster, release date and genres, and writes the entry to a SQLite database using a command-line tool that comes with the project. The web app displays that data and lets the user search, sort and filter it.

## 2. Principles

- **One user, local only.** No accounts, no login, no public hosting.
- **Claude Code enters the data.** The web app has no add or edit forms. Its only write actions are the two suggestion buttons (section 3.6).
- **Metadata is fetched, never typed.** Poster, release date, genres and runtime come from TMDB (The Movie Database).
- **Visual first.** The poster is the main element on every card.

## 3. Features (v1)

### 3.1 Three sections

The app has three tabs, each showing a count of its movies:

1. **Watched**: movies the user has seen, with their rating and review.
2. **Watchlist**: movies the user plans to watch.
3. **Suggested**: movies the AI recommends, each with a reason.

### 3.2 Cards

| Card element | Watched | Watchlist | Suggested |
|---|---|---|---|
| Poster | Yes | Yes | Yes |
| Title and year | Yes | Yes | Yes |
| Rating badge | The user's rating (1–10) | TMDB rating | TMDB rating |
| Extra line | Review snippet on hover | Priority (High/Medium/Low) | Reason for the suggestion |
| Release badge | n/a | If not yet released | If not yet released |
| Genres | On hover | On hover | On hover |
| Buttons | None | None | "+ Watchlist", and ✕ for "Not interested" |
| Series badge | For TV series | For TV series | n/a |

Visual style:

- Dark theme.
- Portrait posters at a 2:3 ratio, in a responsive grid of about 6 columns on desktop.
- On hover, a card lifts slightly and glows.
- Cards with no poster show placeholder art with the title.
- The rating badge is colored by score, for example gold for 9–10.

### 3.3 Detail view

Clicking a card opens a read-only panel over the grid, which closes with Esc or a click outside it. The panel shows:

- A large poster, the title, release date, runtime, director and genres. For a series: the first air date, number of seasons and creators.
- The user's rating and the TMDB rating.
- **Watched:** the full rewritten review, plus the liked and disliked aspects.
- **Suggested:** the full reason and the watched movies it is based on.
- The TMDB synopsis and a link to the movie's TMDB page.

The URL changes when the panel opens (for example `?movie=12`), so a movie can be linked to directly.

### 3.4 Search, sort and filter

- **Search:** a box that matches titles across all three sections.
- **Sort by:** release date (newest or oldest first), rating (highest or lowest first), or genre (A–Z by primary genre).
- **How rating sort works:** Watched sorts by the user's rating. Watchlist and Suggested sort by TMDB rating.
- **How genre sort works:** TMDB gives most movies several genres. The first genre listed counts as the primary genre.
- **Filter by genre:** selectable genre chips, more than one at a time. A movie appears if it has any selected genre.
- **Scope:** the URL query string holds the current section, search, sort and filter, so refreshing the page keeps the view. They carry over when switching sections.
- **Where it runs:** all search, sorting and filtering happens in the browser, on data loaded once from the server.

### 3.5 Adding movies through Claude Code

The user describes a movie in plain language, for example: "I watched Blade Runner, boring at times but the ending made it worth it." Claude Code then:

1. Searches TMDB for the title. If several films match (there are several called *Obsession*), it picks the most likely one and asks the user when it can't tell.
2. Rewrites the feedback into a clean review and keeps the original text too.
3. Sets the rating. If the user gave a number, it uses that. Otherwise it proposes a rating based on the feedback and tells the user so they can change it.
4. Pulls out what the user liked and disliked. For example, liked: "unpredictable plot", "striking visuals"; disliked: "slow pacing".
5. Writes the entry with the command-line tool (section 5.3).

Claude Code can also add a movie to the watchlist, move a movie from Watchlist to Watched, change a rating, review or priority, and remove a movie.

### 3.6 AI suggestions and taste profile

- **Taste profile.** All the liked and disliked aspects, combined with a short "what I like in a movie" prompt the user writes. A panel at the top of the Suggested section shows it.
- **How suggestions are made.** Claude Code picks 12 movies, working from the taste profile and the user's highest-rated movies. It skips anything already in Watched or Watchlist, and anything the user dismissed.
- **Reasons.** Every suggestion names specific movies and aspects. For example: "Because you liked the unpredictable plots in *Obsession* and *The Drama*, and the scares in *Midsommar*."
- **Real movies only.** Each suggestion is checked against TMDB, so it is a real movie with a poster.
- **Refreshing.** Suggestions only change when the user runs the `/suggestions` command in Claude Code (section 5.4). Adding a watched movie does not refresh them.
- **Buttons on suggested cards:**
  - **"Add to watchlist"** moves the movie to Watchlist with Medium priority.
  - **"Not interested"** dismisses it. Dismissed movies never come back, and the next refresh takes them into account.

### 3.7 Release countdown

Watchlist and suggested movies with a release date in the future show a badge, for example "In theaters Dec 18" for *Dune: Part Three*, or "Premieres Dec 18" for a series. The badge goes away once the date has passed. TMDB release dates sometimes change, so the `refresh-metadata` command (section 5.3) fetches them again.

### 3.8 TV series

TV series live in the same three sections as movies, with a "Series" badge on their cards. To keep it simple:

- A series gets one rating and one review for the whole show, with no per-season or per-episode tracking.
- The user moves it to Watched once they've finished what's out.
- Suggestions stay movies only.
- Combined TV genres such as "Sci-Fi & Fantasy" are split into the matching movie genres, so the genre filter has one list.

## 4. Data model (SQLite)

### `movies`

TV series and suggestions are stored in this table too, so posters, genres, search, sorting and filtering work the same in every section. List fields are stored as JSON text in their row, so there are no join tables.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `kind` | TEXT | `movie` or `tv` |
| `tmdb_id` | INTEGER | TMDB numbers movies and series separately, so `(kind, tmdb_id)` is the unique key |
| `title` | TEXT | |
| `release_date` | TEXT | `YYYY-MM-DD`; the year is derived from it. For a series, the first air date. |
| `poster_path` | TEXT | TMDB image path. The image is saved as `data/posters/<file name>`. |
| `genres` | TEXT | JSON list of TMDB genre names; the first is the primary genre |
| `overview` | TEXT | TMDB synopsis |
| `runtime_min` | INTEGER | Movies only |
| `seasons` | INTEGER | Series only |
| `director` | TEXT | For a series, its creators |
| `tmdb_rating` | REAL | |
| `status` | TEXT | `watched`, `watchlist`, `suggested` or `dismissed` |
| `rating` | REAL | 1–10 (half points allowed), Watched only |
| `raw_feedback` | TEXT | What the user said, word for word |
| `review` | TEXT | The AI-rewritten review |
| `liked` | TEXT | JSON list of liked aspects |
| `disliked` | TEXT | JSON list of disliked aspects |
| `priority` | TEXT | `high`, `medium` or `low`, Watchlist only |
| `suggestion_reason` | TEXT | Suggested only |
| `based_on` | TEXT | JSON list of the movie IDs behind a suggestion |
| `added_at` | TEXT | For internal use; not shown in the app |

### `settings`

A `(key, value)` table that holds `taste_prompt` (written by the user) and `taste_summary` (written by the AI).

The server creates both tables when it starts if they don't exist yet, so there is no migration tool.

## 5. Architecture

### 5.1 Stack

The goal is as little code and as few dependencies as possible. Everything is written in TypeScript. Current Node.js runs TypeScript files directly, so the server needs no build step.

| Part | Choice |
|---|---|
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS v4, through its Vite plugin |
| Server | Hono on Node.js (`@hono/node-server`) |
| Database | SQLite through `better-sqlite3`, with plain SQL |
| Data entry | A Node command-line tool that Claude Code runs |

Left out on purpose: a router, a data-fetching library, an RPC layer, an ORM and a validation library. Instead:

- The browser keeps the current view in the URL query string.
- Data loads with a plain `fetch`.
- The command-line tool does a few basic checks itself, such as making sure a rating is between 1 and 10.

The command-line tool and the server share the same database and TMDB code.

### 5.2 Project layout

```
movies/
  package.json       One package for the app, server and CLI
  index.html
  vite.config.ts
  src/               React app
  server/
    db.ts            SQLite connection; creates the tables if missing
    tmdb.ts          TMDB client
    api.ts           Hono server
    cli.ts           Commands that Claude Code runs
  data/
    movies.db
    posters/         Saved poster images
  .claude/
    skills/
      suggestions/
        SKILL.md     The /suggestions command
  CLAUDE.md          How Claude Code adds movies (commands, conventions)
  .env               TMDB API key (never committed)
```

### 5.3 Command-line tool (Claude Code's write path)

Claude Code runs these commands with `node server/cli.ts <command>`. JSON can be passed as an argument, or on stdin with a quoted heredoc when it's left out; the heredoc keeps apostrophes in reviews from breaking the shell. The commands work right away in any session, including the current one, with no extra setup. `CLAUDE.md` documents them along with the conventions for reviews, ratings and aspects, so future sessions follow the same rules.

| Command | What it does |
|---|---|
| `search <query> [--year YYYY] [--tv]` | Lists matching TMDB titles, so Claude Code can pick the right one. `--tv` searches series. |
| `add [json]` | Fetches the metadata from TMDB, saves the poster and adds the movie. The JSON fields are `tmdb_id`, `kind` (`movie` by default, or `tv`), `status`, `rating`, `raw_feedback`, `review`, `liked[]`, `disliked[]`, `priority`, `suggestion_reason` and `based_on[]`. |
| `update <id> [json]` | Changes status, rating, review, aspects or priority |
| `remove <id>` | Deletes a movie |
| `list [--status S]` | Prints the library as JSON, so Claude Code has context and can make suggestions |
| `taste` / `set-taste [json]` | Shows the taste profile / sets `prompt` (the user's words) and/or `summary` (the AI's) |
| `replace-suggestions [json]` | Replaces the current suggestions and skips any movie already in the library. The JSON is a list of `{tmdb_id, reason, based_on}`. |
| `refresh-metadata [id]` | Fetches TMDB data again for one movie, or for every movie if no ID is given |

### 5.4 The `/suggestions` command

A Claude Code skill in this project (`.claude/skills/suggestions/SKILL.md`). Running `/suggestions` makes Claude Code:

1. Read the library and taste profile with `list` and `taste`.
2. Pick 12 movies the user hasn't seen, hasn't put on the watchlist and hasn't dismissed. Each one gets a reason that names specific movies and aspects.
3. Check each pick with `search`, and replace any that don't match a real TMDB title.
4. Save them with `replace-suggestions`.
5. List the 12 picks and their reasons in the chat.

The command can take an optional hint, for example `/suggestions something light` or `/suggestions more westerns`. A hint steers that one run only and doesn't change the taste profile.

### 5.5 Server API

Two endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/library` | Returns every movie except dismissed ones, plus the taste profile, in one response. The browser builds the grid, genre chips and detail view from it. |
| `POST /api/movies/:id/status` | Suggestion buttons only. Accepts `watchlist` or `dismissed` and only changes a movie whose status is `suggested`. |
| `GET /posters/*` | Saved poster images, cached by the browser for a year |
| `GET /*` | The built app from `dist/` (`npm start`) |

### 5.6 Network

- The Hono server listens only on `127.0.0.1` (its `hostname` option), so other machines can't reach it.
- The Vite dev server also listens only on `127.0.0.1`, and forwards `/api` and `/posters` requests to Hono.
- The server answers only requests addressed to `localhost` or `127.0.0.1`, which blocks DNS rebinding attacks from other websites.
- The status endpoint accepts only JSON, so other websites can't send it requests from the user's browser.

## 6. External data: TMDB

- **Access.** A free API key, stored in `.env`.
- **What v1 uses.** Search, posters, release dates, genres, runtime, director and rating.
- **What v2 would also use.** Streaming availability, movie collections and trailers.
- **Attribution.** TMDB's terms require this line in the footer: "This product uses the TMDB API but is not endorsed or certified by TMDB."
- **Posters.** Downloaded once (at 500 px wide) when a movie is added, and saved to `data/posters/`. The server tells the browser to cache them for a year, so the grid loads instantly and works offline.
- **Release dates.** The date is TMDB's primary release date, which is the earliest worldwide release. It can be a few days before the user's local release.

## 7. Out of scope for v1

- Add or edit forms in the web app.
- Date watched.
- More than one user, login, or public hosting.
- A native mobile app.
- An AI chat bar inside the app.
- Per-season or per-episode tracking for TV series.

## 8. Future features (v2, not yet approved)

| # | Feature | What it does |
|---|---|---|
| 1 | Franchise grouping | Uses TMDB collections to stack a series (*Dune* 1–3) and suggest the next film in a series the user rated highly. |
| 2 | Where to watch | Shows which streaming services have each watchlist movie in the user's country (TMDB / JustWatch data). |
| 3 | "Pick for tonight" | Ask Claude Code to choose from the watchlist by mood and time, e.g. "2 hours, want something scary." |
| 4 | Stats page | Rating distribution, top genres, average rating per genre, and movies per decade. |
| 5 | Trailers | Plays the YouTube trailer from the detail view. |
| 6 | Markdown export | Rebuilds `movies.md` from the database as a readable backup. |

## 9. Migration from `movies.md`

Once the command-line tool works, Claude Code imports the current file (7 watched movies and 4 watchlist movies) using `search` and `add`. This also serves as the tool's first real test.

- Each title is matched on TMDB.
- The hand-entered genres are replaced with TMDB genres.
- Existing notes become `raw_feedback`, and Claude Code fills in `review` and the aspects.
- Current ratings and priorities carry over.

## 10. Decisions

| Date | Decision |
|---|---|
| 2026-10-18 | v1 includes the detail view, title search, the suggestion buttons and the release countdown. |
| 2026-10-18 | The user adds movies by prompting Claude Code, which writes through the project's command-line tool. There is no chat bar in the app. |
| 2026-10-18 | Stack: Vite + React, a Hono server on Node.js, and SQLite (section 5.1). |
| 2026-10-18 | Keep it light: as little code and as few dependencies as possible. No RPC, router, data-fetching library, ORM or validation library. Filtering runs in the browser. |
| 2026-10-18 | Posters are saved locally so they load as fast as possible. |
| 2026-10-18 | Ratings allow half points (for example 9.5). |
| 2026-10-18 | TV series are supported, kept simple (section 3.8). Suggestions stay movies only. |
| 2026-10-18 | Date watched is not tracked. |
| 2026-10-18 | Suggestions only refresh when the user runs `/suggestions`, a Claude Code skill in this project. |
| 2026-10-18 | 12 suggestions at a time. |
| 2026-10-18 | Styling uses Tailwind CSS. |

## 11. Open questions

None right now.

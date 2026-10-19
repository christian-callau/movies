import { posterUrl, releaseBadge, tierClass, watchedLabel, year, years, type Movie, type Shelf } from './lib.ts'

const kindBadge = 'ml-1.5 rounded px-1 py-px text-[10px] font-semibold tracking-wide uppercase'

export function Poster({ movie, className = '' }: { movie: Movie; className?: string }) {
  if (!movie.poster_path) {
    return <div className={`grid place-items-center bg-zinc-800 p-4 text-center font-semibold text-zinc-400 ${className}`}>{movie.title}</div>
  }
  return <img src={posterUrl(movie)} alt={movie.title} decoding="async" className={`object-cover ${className}`} />
}

// The user's tier on watched entries, the TMDB rating everywhere else. A tier is one letter,
// so it gets a fixed width to keep the badge square whatever the letter is.
export function ScoreBadge({ movie, className = '' }: { movie: Movie; className?: string }) {
  if (movie.status === 'watched') {
    if (!movie.tier) return null
    return (
      <span className={`inline-block min-w-6 rounded px-1.5 py-0.5 text-center font-bold shadow ${tierClass(movie.tier)} ${className}`}>
        {movie.tier}
      </span>
    )
  }
  if (movie.tmdb_rating == null) return null
  return <span className={`rounded bg-black/75 px-1.5 py-0.5 font-bold text-zinc-100 shadow ${className}`}>★ {movie.tmdb_rating.toFixed(1)}</span>
}

// On cards the dismiss button is just ✕ to fit the width; the detail view spells it out.
export function SuggestionButtons({ onStatus, compact = false }: { onStatus: (status: 'watchlist' | 'dismissed') => void; compact?: boolean }) {
  return (
    <div className="flex gap-2">
      <button onClick={() => onStatus('watchlist')} className="flex-1 rounded bg-sky-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-sky-400">
        + Watchlist
      </button>
      <button
        onClick={() => onStatus('dismissed')}
        title="Not interested"
        aria-label="Not interested"
        className={`rounded bg-zinc-800 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 ${compact ? 'px-3' : 'flex-1 px-3'}`}
      >
        {compact ? '✕' : 'Not interested'}
      </button>
    </div>
  )
}

type CardProps = {
  movie: Movie
  onOpen: () => void
  onStatus: (status: 'watchlist' | 'dismissed') => void
  onMove?: (shelf: Shelf) => void
}

export function Card({ movie, onOpen, onStatus, onMove }: CardProps) {
  const badge = releaseBadge(movie)
  const snippet = movie.status === 'watched' ? movie.review : movie.overview
  return (
    <div className="group flex flex-col">
      <button
        onClick={onOpen}
        className="relative aspect-2/3 w-full cursor-pointer overflow-hidden rounded-md bg-zinc-800 shadow-lg shadow-black/60 ring-1 ring-white/5 transition duration-200 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-sky-500/20 group-hover:ring-2 group-hover:ring-sky-400/70"
      >
        <Poster movie={movie} className="size-full" />
        <ScoreBadge movie={movie} className="absolute top-2 right-2 text-sm" />
        {badge && <span className="absolute top-2 left-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-semibold text-amber-300">{badge}</span>}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-linear-to-t from-black via-black/90 to-transparent p-3 pt-10 text-left transition duration-200 group-hover:translate-y-0">
          <div className="flex flex-wrap gap-1">
            {movie.genres.map((g) => (
              <span key={g} className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-zinc-200">{g}</span>
            ))}
          </div>
          {snippet && <p className="mt-2 line-clamp-4 text-xs text-zinc-300">{snippet}</p>}
        </div>
      </button>
      <div className="mt-2 px-0.5">
        <h3 className="truncate text-sm font-semibold text-zinc-100" title={movie.title}>{movie.title}</h3>
        <p className="text-xs text-zinc-400">
          {movie.kind === 'collection' ? years(movie) : year(movie)}
          {movie.kind === 'tv' && <span className={kindBadge + ' bg-violet-500/20 text-violet-300'}>Series</span>}
          {movie.kind === 'collection' && <span className={kindBadge + ' bg-amber-500/20 text-amber-300'}>{movie.parts.length} films</span>}
          {movie.status === 'watched' && movie.genres[0] && ` · ${movie.genres[0]}`}
          {movie.watched_on && <span className="text-zinc-500"> · {watchedLabel(movie.watched_on)}</span>}
          {movie.kind === 'collection' && movie.status !== 'watched' && movie.genres[0] && ` · ${movie.genres[0]}`}
        </p>
        {movie.status === 'suggested' && <p className="mt-1 line-clamp-3 text-xs text-sky-200/80">{movie.suggestion_reason}</p>}
      </div>
      {onMove && movie.shelf && (
        <button
          onClick={() => onMove(movie.shelf === 'weekend' ? 'someday' : 'weekend')}
          title={movie.shelf === 'weekend' ? 'Move below the line, to Someday' : 'Move above the line, to Weekend'}
          className="mt-2 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100"
        >
          {movie.shelf === 'weekend' ? '↓ Someday' : '↑ Weekend'}
        </button>
      )}
      {movie.status === 'suggested' && (
        <div className="mt-2">
          <SuggestionButtons onStatus={onStatus} compact />
        </div>
      )}
    </div>
  )
}

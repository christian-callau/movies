import { posterUrl, ratingClass, releaseBadge, score, year, type Movie } from './lib.ts'

const priorityStyle = { high: 'text-rose-400', medium: 'text-amber-300', low: 'text-zinc-400' }

export function Poster({ movie, className = '' }: { movie: Movie; className?: string }) {
  if (!movie.poster_path) {
    return <div className={`grid place-items-center bg-zinc-800 p-4 text-center font-semibold text-zinc-400 ${className}`}>{movie.title}</div>
  }
  return <img src={posterUrl(movie)} alt={movie.title} decoding="async" className={`object-cover ${className}`} />
}

export function ScoreBadge({ movie, className = '' }: { movie: Movie; className?: string }) {
  const value = score(movie)
  if (value == null) return null
  const mine = movie.status === 'watched'
  return (
    <span className={`rounded px-1.5 py-0.5 font-bold shadow ${mine ? ratingClass(value) : 'bg-black/75 text-zinc-100'} ${className}`}>
      {mine ? value : `★ ${value.toFixed(1)}`}
    </span>
  )
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

export function Card({ movie, onOpen, onStatus }: { movie: Movie; onOpen: () => void; onStatus: (status: 'watchlist' | 'dismissed') => void }) {
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
          {year(movie)}
          {movie.kind === 'tv' && (
            <span className="ml-1.5 rounded bg-violet-500/20 px-1 py-px text-[10px] font-semibold tracking-wide text-violet-300 uppercase">Series</span>
          )}
          {movie.status === 'watched' && movie.genres[0] && ` · ${movie.genres[0]}`}
          {movie.status === 'watchlist' && movie.priority && (
            <span className={priorityStyle[movie.priority]}> · {movie.priority[0].toUpperCase() + movie.priority.slice(1)} priority</span>
          )}
        </p>
        {movie.status === 'suggested' && <p className="mt-1 line-clamp-3 text-xs text-sky-200/80">{movie.suggestion_reason}</p>}
      </div>
      {movie.status === 'suggested' && (
        <div className="mt-2">
          <SuggestionButtons onStatus={onStatus} compact />
        </div>
      )}
    </div>
  )
}

import { useEffect, type ReactNode } from 'react'
import { Poster, ScoreBadge, SuggestionButtons } from './Card.tsx'
import { formatDate, releaseBadge, runtime, watchedLabel, year, years, type Movie } from './lib.ts'

function Chips({ items, className }: { items: string[]; className: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className={`rounded-full px-2.5 py-0.5 text-xs ${className}`}>{item}</span>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold tracking-wider text-zinc-500 uppercase">{title}</h3>
      {children}
    </section>
  )
}

type Props = {
  movie: Movie
  basedOn: Movie[]
  onClose: () => void
  onStatus: (status: 'watchlist' | 'dismissed') => void
}

export function Detail({ movie, basedOn, onClose, onStatus }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])

  const tv = movie.kind === 'tv'
  const collection = movie.kind === 'collection'
  const facts = collection
    ? [`${movie.parts.length} films`, years(movie)]
    : [
        tv && 'Series',
        movie.release_date && formatDate(movie.release_date),
        tv ? movie.seasons && `${movie.seasons} season${movie.seasons > 1 ? 's' : ''}` : movie.runtime_min && runtime(movie.runtime_min),
        movie.director && `${tv ? 'Created' : 'Directed'} by ${movie.director}`,
      ].filter(Boolean)
  const badge = releaseBadge(movie)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-zinc-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <Poster movie={movie} className="hidden w-80 shrink-0 sm:block" />
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="pr-8">
            <h2 className="text-2xl font-bold text-white">
              {movie.title} {!collection && <span className="font-normal text-zinc-500">{year(movie)}</span>}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">{facts.join(' · ')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            {movie.status === 'watched' && (
              <span className="flex items-center gap-2 text-zinc-400">
                My tier <ScoreBadge movie={movie} />
              </span>
            )}
            {movie.tmdb_rating != null && <span className="text-zinc-400">TMDB ★ {movie.tmdb_rating.toFixed(1)}</span>}
            {badge && <span className="rounded bg-amber-400/15 px-2 py-0.5 font-semibold text-amber-300">{badge}</span>}
            {movie.watched_on && <span className="text-zinc-400">Watched {watchedLabel(movie.watched_on)}</span>}
            {movie.status === 'watchlist' && movie.shelf && (
              <span className="rounded bg-white/10 px-2 py-0.5 text-zinc-300 capitalize">{movie.shelf}</span>
            )}
          </div>

          <Chips items={movie.genres} className="bg-white/10 text-zinc-200" />

          {movie.review && (
            <Section title="My review">
              <p className="leading-relaxed text-zinc-200">{movie.review}</p>
            </Section>
          )}

          {(movie.liked.length > 0 || movie.disliked.length > 0) && (
            <Section title="What stood out">
              <div className="space-y-2">
                <Chips items={movie.liked} className="bg-emerald-500/15 text-emerald-300" />
                <Chips items={movie.disliked} className="bg-rose-500/15 text-rose-300" />
              </div>
            </Section>
          )}

          {movie.status === 'suggested' && (
            <Section title="Why it was suggested">
              <p className="leading-relaxed text-sky-200">{movie.suggestion_reason}</p>
              {basedOn.length > 0 && <p className="mt-2 text-sm text-zinc-400">Based on {basedOn.map((m) => m.title).join(', ')}</p>}
            </Section>
          )}

          {collection && (
            <Section title="Films">
              <ol className="space-y-1 text-sm text-zinc-300">
                {movie.parts.map((p, i) => (
                  <li key={p.title}>
                    <span className="mr-2 text-zinc-500">{i + 1}.</span>
                    {p.title} <span className="text-zinc-500">{p.year}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {movie.overview && (
            <Section title="Synopsis">
              <p className="text-sm leading-relaxed text-zinc-400">{movie.overview}</p>
            </Section>
          )}

          {movie.status === 'suggested' && <SuggestionButtons onStatus={onStatus} />}

          <a href={`https://www.themoviedb.org/${movie.kind}/${movie.tmdb_id}`} target="_blank" rel="noreferrer" className="inline-block text-sm text-sky-400 hover:underline">
            View on TMDB ↗
          </a>
        </div>
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white">
          ✕
        </button>
      </div>
    </div>
  )
}

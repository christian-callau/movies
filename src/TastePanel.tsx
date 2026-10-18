import type { Library } from './lib.ts'

// Counts each aspect across watched movies, most common first.
function tally(lists: string[][]) {
  const counts = new Map<string, number>()
  for (const item of lists.flat()) counts.set(item.toLowerCase(), (counts.get(item.toLowerCase()) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])
}

export function TastePanel({ library }: { library: Library }) {
  const watched = library.movies.filter((m) => m.status === 'watched')
  const liked = tally(watched.map((m) => m.liked)).slice(0, 14)
  const disliked = tally(watched.map((m) => m.disliked)).slice(0, 6)
  const { summary, prompt } = library.taste

  return (
    <section className="mb-8 rounded-xl bg-linear-to-br from-sky-950/60 to-zinc-900 p-5 ring-1 ring-sky-400/15">
      <h2 className="text-xs font-semibold tracking-wider text-sky-300 uppercase">Your taste</h2>
      {summary && <p className="mt-2 max-w-3xl leading-relaxed text-zinc-200">{summary}</p>}
      <p className="mt-2 text-sm text-zinc-400">
        {prompt ? (
          <>
            <span className="text-zinc-300">What you look for:</span> {prompt}
          </>
        ) : (
          'Tell Claude Code what you like in a movie to add your own taste prompt.'
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {liked.map(([text, n]) => (
          <span key={text} className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300">
            {text}
            {n > 1 && <span className="ml-1 text-emerald-300/60">×{n}</span>}
          </span>
        ))}
        {disliked.map(([text]) => (
          <span key={text} className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs text-rose-300">
            − {text}
          </span>
        ))}
      </div>
    </section>
  )
}

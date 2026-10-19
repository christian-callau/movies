---
name: suggestions
description: Refresh the 12 AI movie suggestions shown in the web app's Suggested tab, based on the user's taste profile. Use only when the user runs /suggestions or explicitly asks for new suggestions.
argument-hint: "[optional hint, e.g. something light]"
---

# Refresh movie suggestions

Optional hint from the user: $ARGUMENTS

A hint steers this run only. Don't save it to the taste profile.

1. Run `node server/cli.ts taste` and `node server/cli.ts list` to get the taste prompt, the tier and aspects of every watched movie, and every movie already in the library. Skip anything with status `watched`, `watchlist` or `dismissed`. Dismissed movies were rejected by the user, so also avoid close lookalikes of them.
2. Write a 2–3 sentence `summary` of the user's taste in second person ("You love…"). Base it on the `S` and `A` tier entries, the most repeated liked aspects, the disliked aspects and the prompt. Save it with `set-taste`.
3. Pick 12 movies (never TV series or collections). Aim for a mix: a few close matches, a few from different decades, and one or two that stretch the taste a little. Honor the hint if there is one. Avoid what the disliked aspects warn against.
4. Write one `reason` per pick: one or two sentences that name specific watched movies and the aspects that connect them. For example: "Because you loved the unpredictable plot of *Obsession* and the atmosphere of *Blade Runner*." Set `based_on` to the ids of the movies you named.
5. Run `search` for every pick to get its `tmdb_id`. Replace any pick that doesn't come back as a clear match.
6. Save all 12 at once with `replace-suggestions`, passing the JSON on stdin with a quoted heredoc. If it reports any as `skipped_already_in_library`, swap those picks and run it again.
7. Reply with a short list of the 12 titles and years, each with a few words of reason, and remind the user that they're in the Suggested tab.

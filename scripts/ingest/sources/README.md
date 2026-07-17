# beginnerRank sources

Committed snapshots that drive `beginnerRank` in `src/data/generated/vocab.json`
(see `scripts/ingest/beginnerrank.py`). They are committed rather than fetched
at build time so the ordering is reproducible from a clean checkout. Refresh
only if you want newer data — all three upstreams are static.

| File | Upstream | Author | Licence |
|------|----------|--------|---------|
| `jlpt-tanos.json` | [tanos.co.uk JLPT vocabulary](http://www.tanos.co.uk/jlpt/) | Jonathan Waller | CC BY |
| `jlpt-anki-n[1-5].csv` | [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) | jamsinclair & contributors | MIT |
| `opensubtitles-ja-2018.txt` | [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) — `content/2018/ja/ja_full.txt` | Hermit Dave | CC BY-SA 4.0 |

Formats:

- `jlpt-tanos.json` — `{ "headword": [ { "reading": "…", "level": N } ] }`, where
  `level` is the JLPT N-number (5 = N5, easiest). Multiple entries per headword
  when readings/levels differ.
- `jlpt-anki-n{L}.csv` — columns `expression,reading,meaning,tags,guid`; the file
  name (`nL`) is the authoritative level.
- `opensubtitles-ja-2018.txt` — `token count`, one per line, most-frequent first;
  line number is the frequency rank.

All three are ShareAlike-compatible with this directory's CC BY-SA 4.0 data
licence (CC BY and MIT may be folded into a BY-SA work; OpenSubtitles is itself
BY-SA). Attribution lives in `src/data/generated/LICENSE`.

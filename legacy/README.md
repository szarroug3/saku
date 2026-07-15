# Kana quiz

Local quiz app for drilling hiragana + katakana mixed together. No internet,
no dependencies — Python stdlib only.

## Run it

```bash
cd ~/git/personal/obsidian/Daily/Tools/kana-quiz
python3 kana_quiz.py
```

Opens `http://127.0.0.1:8766` in the browser. Ctrl+C to stop.

## Files

| File | What it is | Edit it to… |
|------|-----------|-------------|
| `kana_quiz.py` | The server | change the port |
| `characters.py` | All character data | add kanji sets, vocab, new sections |
| `theme.py` | Colors, fonts, behavior tuning | restyle everything, add fonts, change slow-answer threshold |
| `app.html` | The app UI + logic | change screens/features |
| `history.json` | Session results + per-character stats | (auto-written; delete to reset history) |

## Features (v1)

- Drill mode (type romaji or multiple choice) and match-pairs mode
- Directions: JP→EN, EN→JP (multiple choice now; "type kana" ready for an IME), both at once
- Endless, question count, or full coverage; misses re-queue within the round
- Per-section and per-character selection with add all / remove all
- Retries (none/limited/unlimited), timer (timeout costs a retry), show-answer toggle
- Script label toggle, live romaji→kana preview, random Japanese font per card
- Mid-drill settings drawer — changes apply instantly
- Results: forgiving vs strict scoring (flip after the fact), miss counts per
  character, slow-but-correct list, mix-up pattern detection, redrill button
- Settings persist in the browser; sessions append to `history.json`

## Roadmap

- **v2:** write a word / write text (word sets in `characters.py` — Minna
  lesson vocab), listen mode (browser Japanese TTS)
- **v3:** stroke order + draw (KanjiVG stroke data; Japanese only)

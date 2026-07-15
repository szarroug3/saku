"""Theme for the kana quiz — every visual knob lives here.

Change a value, refresh the browser, done. No CSS hunting.
- "light" / "dark" follow your system appearance automatically.
- jp_fonts is the pool for the random-font feature (each card draws a random
  font so you don't overfit to one typeface). Add or remove freely — names
  must be fonts installed on the machine.
- behavior holds non-color tuning: slow-answer threshold, requeue distance,
  card size, multiple-choice option count.
"""

THEME = {
    "light": {
        "bg": "#faf9f5",
        "card": "#ffffff",
        "panel": "#f1efe8",
        "text": "#1a1a18",
        "text-muted": "#8a887f",
        "border": "#e3e1d9",
        "accent": "#2f6fad",
        "accent-bg": "#e6f1fb",
        "danger": "#b3382e",
        "danger-bg": "#fcebeb",
        "success": "#2f7d54",
        "success-bg": "#e9f4ec",
        "warning": "#8a5a0b",
        "warning-bg": "#faeeda",
        "gcard": "#2e7cc4",
        "gcard-right": "#3f9d4e",
        "gcard-wrong": "#9fb8cd",
        "gcard-shake": "#d64545",
    },
    "dark": {
        "bg": "#1e1e1c",
        "card": "#2a2a27",
        "panel": "#33332f",
        "text": "#eceae4",
        "text-muted": "#95938a",
        "border": "#44443f",
        "accent": "#7fb2e3",
        "accent-bg": "#173754",
        "danger": "#e88a82",
        "danger-bg": "#4a1f1b",
        "success": "#8cc9a6",
        "success-bg": "#1d3d2b",
        "warning": "#e3b567",
        "warning-bg": "#453212",
        "gcard": "#2e6ea8",
        "gcard-right": "#3f8f4c",
        "gcard-wrong": "#46586b",
        "gcard-shake": "#b23c34",
    },
    "font_ui": "-apple-system, 'Helvetica Neue', system-ui, sans-serif",
    "jp_fonts": [
        "'Hiragino Sans'",
        "'Hiragino Mincho ProN'",
        "'Hiragino Maru Gothic ProN'",
        "'Yu Gothic'",
        "'Yu Mincho'",
        "'Klee'",
        "'Tsukushi A Round Gothic'",
        "'Toppan Bunkyu Gothic'",
    ],
    "behavior": {
        "card_size_px": 96,          # size of the big character on the drill card
        "slow_answer_ms": 5000,      # correct-but-slower-than-this gets flagged
        "requeue_min": 3,            # a missed card comes back 3–7 questions later
        "requeue_max": 7,
        "mc_options": 6,             # options per multiple-choice question
        "pairs_per_board": 8,        # pairs per match-the-pairs board
        "random_font": True,         # random Japanese font per card
    },
}

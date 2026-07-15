"""Character data for the kana quiz.

HOW TO EXTEND
=============
- Add a section to an existing script: append a row to HIRAGANA_ROWS /
  KATAKANA_ROWS below — (section_id, label, kana_string_or_list, romaji_list,
  optional mnemonics_list).
- Add a whole new set (kanji, vocab words, etc.): append a dict to SETS at the
  bottom. Example for later:

    SETS.append({
        "id": "minna-l1",
        "label": "Minna Lesson 1",
        "label_ja": "みんなの日本語 L1",
        "sections": [
            {"id": "l1-vocab", "label": "Vocabulary", "chars": [
                {"c": "先生", "r": ["sensei"], "meaning": "teacher", "m": "the one who was born (生) before (先) you"},
            ]},
        ],
    })

  Every entry needs: c (the Japanese) and r (list of accepted answers).
  Optional keys: m (mnemonic, shown in the Kana chart), meaning,
  strokes / audio (reserved for the stroke-order, draw, and listen modes).
"""


def _sec(sec_id, label, kana, romaji, mnemonics=None):
    chars = []
    kana_list = list(kana) if isinstance(kana, str) else kana
    for i, (c, r) in enumerate(zip(kana_list, romaji)):
        d = {"c": c, "r": r if isinstance(r, list) else [r]}
        if mnemonics and i < len(mnemonics) and mnemonics[i]:
            d["m"] = mnemonics[i]
        chars.append(d)
    return {"id": sec_id, "label": label, "chars": chars}


# Romaji rows shared by both scripts (list item = one character's accepted answers)
_R = {
    "vowels": ["a", "i", "u", "e", "o"],
    "k": ["ka", "ki", "ku", "ke", "ko"],
    "s": ["sa", ["shi", "si"], "su", "se", "so"],
    "t": ["ta", ["chi", "ti"], ["tsu", "tu"], "te", "to"],
    "n": ["na", "ni", "nu", "ne", "no"],
    "h": ["ha", "hi", ["fu", "hu"], "he", "ho"],
    "m": ["ma", "mi", "mu", "me", "mo"],
    "y": ["ya", "yu", "yo"],
    "r": ["ra", "ri", "ru", "re", "ro"],
    "w": ["wa", ["wo", "o"], ["n", "nn"]],
    "g": ["ga", "gi", "gu", "ge", "go"],
    "z": ["za", ["ji", "zi"], "zu", "ze", "zo"],
    "d": ["da", ["ji", "di"], ["zu", "du"], "de", "do"],
    "b": ["ba", "bi", "bu", "be", "bo"],
    "p": ["pa", "pi", "pu", "pe", "po"],
    "ky": ["kya", "kyu", "kyo"],
    "sh": [["sha", "sya"], ["shu", "syu"], ["sho", "syo"]],
    "ch": [["cha", "tya"], ["chu", "tyu"], ["cho", "tyo"]],
    "ny": ["nya", "nyu", "nyo"],
    "hy": ["hya", "hyu", "hyo"],
    "my": ["mya", "myu", "myo"],
    "ry": ["rya", "ryu", "ryo"],
    "gy": ["gya", "gyu", "gyo"],
    "j": [["ja", "jya", "zya"], ["ju", "jyu", "zyu"], ["jo", "jyo", "zyo"]],
    "dj": [["ja", "dya"], ["ju", "dyu"], ["jo", "dyo"]],
    "by": ["bya", "byu", "byo"],
    "py": ["pya", "pyu", "pyo"],
}

# Mnemonics — short shape hooks shown in the Kana chart tab. Edit freely.
_MH = {
    "vowels": ["an antenna poking out of a TV", "two eels swimming side by side (ii!)", "a sideways U wearing a hat", "an exotic bird strutting", "an ostrich craning its neck"],
    "k": ["a kite with a little tail", "a key with two teeth", "a bird's open beak — ku-ku!", "a keg beside its tap", "two cozy lines cuddling"],
    "s": ["a fishing hook catching sardines", "a shiny fishing hook", "a spring suspended and coiled", "a set of crooked teeth", "a zigzag bolt soaring down"],
    "t": ["'t' and 'a' squished together — ta!", "the number 5 cheering — chi!", "a tsunami wave rolling in", "a telephone pole crossbar", "a toe with a splinter in it"],
    "n": ["a nail resting by a cross", "a knee pressed against a wall", "noodles twirled on chopsticks", "a neko (cat) with a curled tail", "a no-entry sign"],
    "h": ["an 'H' holding a balloon — ha!", "a big grin — hee!", "Mount Fuji puffing steam", "hey, a little hill", "a house with chimney and antenna"],
    "m": ["a mailbox with a looped flag", "looks like 21 — 'mi? I'm 21!'", "a cow's face going moo", "a big eye — me means eye", "a hook with more bait on it"],
    "y": ["a yak's head with horns", "a unique fish swimming past", "a yo-yo hanging off a finger"],
    "r": ["a rabbit's ear flopping over", "a river between two banks", "a loop-de-loop route with a curl", "a runner kneeling, ready", "the same road, no curl (vs る)"],
    "w": ["a water slide off a pole", "someone tripping — woah!", "a cursive lowercase 'n'"],
}
_MK = {
    "vowels": ["an axe blade swinging", "an easel standing on one leg", "う's hat on a box — u again", "an elevator between floors", "an opera singer mid-kick"],
    "k": ["か's kite, tail snipped off", "the top half of き's key", "a cook's hat", "a K that lost a leg", "a corner bracket"],
    "s": ["two saplings under a branch", "a smiling face — she smiles (strokes lie flat)", "a suit on a hanger", "せ's teeth, katakana style", "one needle sewing straight down (stroke stands up)"],
    "t": ["a cook's hat with a tag inside", "a 7 cheating with an extra bar", "a standing tsunami — vs シ, these drops fall", "a telephone pole with two wires", "a totem pole with a peg"],
    "n": ["a plus sign missing an arm — nah", "two lines — ni means two!", "chopsticks crossing over noodles", "a necktie on a pole", "a nose sliding down — one stroke, no more"],
    "h": ["two strokes laughing apart — ha ha", "a heel kicking sideways", "one clean cliff edge — full drop", "the exact same hill as へ — they match", "a pole with branches — home for birds"],
    "m": ["a map pin tilted over", "three lines — mi = three!", "a pyramid with a mummy inside", "a message crossed out with an X", "も's hook, straightened out"],
    "y": ["や's yak horns again", "a U-boat hatch", "a backwards E — yo!"],
    "r": ["a radar dish on a roof", "り's river, straighter banks", "a running shoe kicking up", "a reclining letter L", "a room seen from above"],
    "w": ["a water glass flipped upside down", "a wobbly two-shelf bracket — woah", "one stroke lying down — vs ソ it points up"],
}

HIRAGANA_ROWS = [
    ("h-vowels", "Vowels あ", "あいうえお", _R["vowels"], _MH["vowels"]),
    ("h-k", "K か", "かきくけこ", _R["k"], _MH["k"]),
    ("h-s", "S さ", "さしすせそ", _R["s"], _MH["s"]),
    ("h-t", "T た", "たちつてと", _R["t"], _MH["t"]),
    ("h-n", "N な", "なにぬねの", _R["n"], _MH["n"]),
    ("h-h", "H は", "はひふへほ", _R["h"], _MH["h"]),
    ("h-m", "M ま", "まみむめも", _R["m"], _MH["m"]),
    ("h-y", "Y や", "やゆよ", _R["y"], _MH["y"]),
    ("h-r", "R ら", "らりるれろ", _R["r"], _MH["r"]),
    ("h-w", "W わ + ん", "わをん", _R["w"], _MH["w"]),
    ("h-g", "Dakuten G が", "がぎぐげご", _R["g"]),
    ("h-z", "Dakuten Z ざ", "ざじずぜぞ", _R["z"]),
    ("h-d", "Dakuten D だ", "だぢづでど", _R["d"]),
    ("h-b", "Dakuten B ば", "ばびぶべぼ", _R["b"]),
    ("h-p", "Handakuten P ぱ", "ぱぴぷぺぽ", _R["p"]),
    ("h-kya", "Combo きゃ", ["きゃ", "きゅ", "きょ"], _R["ky"]),
    ("h-sha", "Combo しゃ", ["しゃ", "しゅ", "しょ"], _R["sh"]),
    ("h-cha", "Combo ちゃ", ["ちゃ", "ちゅ", "ちょ"], _R["ch"]),
    ("h-nya", "Combo にゃ", ["にゃ", "にゅ", "にょ"], _R["ny"]),
    ("h-hya", "Combo ひゃ", ["ひゃ", "ひゅ", "ひょ"], _R["hy"]),
    ("h-mya", "Combo みゃ", ["みゃ", "みゅ", "みょ"], _R["my"]),
    ("h-rya", "Combo りゃ", ["りゃ", "りゅ", "りょ"], _R["ry"]),
    ("h-gya", "Combo ぎゃ", ["ぎゃ", "ぎゅ", "ぎょ"], _R["gy"]),
    ("h-ja", "Combo じゃ", ["じゃ", "じゅ", "じょ"], _R["j"]),
    ("h-dja", "Combo ぢゃ", ["ぢゃ", "ぢゅ", "ぢょ"], _R["dj"]),
    ("h-bya", "Combo びゃ", ["びゃ", "びゅ", "びょ"], _R["by"]),
    ("h-pya", "Combo ぴゃ", ["ぴゃ", "ぴゅ", "ぴょ"], _R["py"]),
]

KATAKANA_ROWS = [
    ("k-vowels", "Vowels ア", "アイウエオ", _R["vowels"], _MK["vowels"]),
    ("k-k", "K カ", "カキクケコ", _R["k"], _MK["k"]),
    ("k-s", "S サ", "サシスセソ", _R["s"], _MK["s"]),
    ("k-t", "T タ", "タチツテト", _R["t"], _MK["t"]),
    ("k-n", "N ナ", "ナニヌネノ", _R["n"], _MK["n"]),
    ("k-h", "H ハ", "ハヒフヘホ", _R["h"], _MK["h"]),
    ("k-m", "M マ", "マミムメモ", _R["m"], _MK["m"]),
    ("k-y", "Y ヤ", "ヤユヨ", _R["y"], _MK["y"]),
    ("k-r", "R ラ", "ラリルレロ", _R["r"], _MK["r"]),
    ("k-w", "W ワ + ン", "ワヲン", _R["w"], _MK["w"]),
    ("k-g", "Dakuten G ガ", "ガギグゲゴ", _R["g"]),
    ("k-z", "Dakuten Z ザ", "ザジズゼゾ", _R["z"]),
    ("k-d", "Dakuten D ダ", "ダヂヅデド", _R["d"]),
    ("k-b", "Dakuten B バ", "バビブベボ", _R["b"]),
    ("k-p", "Handakuten P パ", "パピプペポ", _R["p"]),
    ("k-kya", "Combo キャ", ["キャ", "キュ", "キョ"], _R["ky"]),
    ("k-sha", "Combo シャ", ["シャ", "シュ", "ショ"], _R["sh"]),
    ("k-cha", "Combo チャ", ["チャ", "チュ", "チョ"], _R["ch"]),
    ("k-nya", "Combo ニャ", ["ニャ", "ニュ", "ニョ"], _R["ny"]),
    ("k-hya", "Combo ヒャ", ["ヒャ", "ヒュ", "ヒョ"], _R["hy"]),
    ("k-mya", "Combo ミャ", ["ミャ", "ミュ", "ミョ"], _R["my"]),
    ("k-rya", "Combo リャ", ["リャ", "リュ", "リョ"], _R["ry"]),
    ("k-gya", "Combo ギャ", ["ギャ", "ギュ", "ギョ"], _R["gy"]),
    ("k-ja", "Combo ジャ", ["ジャ", "ジュ", "ジョ"], _R["j"]),
    ("k-dja", "Combo ヂャ", ["ヂャ", "ヂュ", "ヂョ"], _R["dj"]),
    ("k-bya", "Combo ビャ", ["ビャ", "ビュ", "ビョ"], _R["by"]),
    ("k-pya", "Combo ピャ", ["ピャ", "ピュ", "ピョ"], _R["py"]),
]

SETS = [
    {
        "id": "hiragana",
        "label": "Hiragana",
        "label_ja": "ひらがな",
        "sections": [_sec(*row) for row in HIRAGANA_ROWS],
    },
    {
        "id": "katakana",
        "label": "Katakana",
        "label_ja": "カタカナ",
        "sections": [_sec(*row) for row in KATAKANA_ROWS],
    },
]

# Characters that are commonly confused — used for multiple-choice distractors
# and for grouping misses in the results screen. Groups can mix scripts.
LOOKALIKES = [
    ["シ", "ツ"],
    ["ソ", "ン"],
    ["ク", "ワ", "フ", "ウ"],
    ["コ", "ユ"],
    ["ス", "ヌ"],
    ["チ", "テ"],
    ["ナ", "メ"],
    ["ね", "れ", "わ"],
    ["ぬ", "め"],
    ["る", "ろ"],
    ["は", "ほ"],
    ["き", "さ"],
    ["た", "な"],
    ["あ", "お"],
    ["か", "カ"],
    ["や", "ヤ"],
    ["も", "モ"],
    ["り", "リ"],
    ["せ", "セ"],
    ["き", "キ"],
    ["に", "ニ"],
    ["へ", "ヘ"],
]

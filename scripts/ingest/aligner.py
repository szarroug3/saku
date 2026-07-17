# -*- coding: utf-8 -*-
"""Align a word's kana reading to its kanji, per-kanji. The core of
'one card pays two debts': 学生/がくせい -> 学=がく, 生=せい."""
import functools

def kata2hira(s):
    return ''.join(chr(ord(c)-0x60) if 0x30A1<=ord(c)<=0x30F6 else c for c in s)

# modern rendaku spelling: ちゅう -> じゅう (not ぢゅう), つ -> ず. Without these
# 一日中/一年中 fail to align.
ALT_VOICE = {'ち':'じ','つ':'ず'}
VOICE = {'か':'が','き':'ぎ','く':'ぐ','け':'げ','こ':'ご','さ':'ざ','し':'じ','す':'ず','せ':'ぜ','そ':'ぞ',
         'た':'だ','ち':'ぢ','つ':'づ','て':'で','と':'ど','は':'ば','ひ':'び','ふ':'ぶ','へ':'べ','ほ':'ぼ'}
HANDAKU = {'は':'ぱ','ひ':'ぴ','ふ':'ぷ','へ':'ぺ','ほ':'ぽ'}

def is_kanji(c):
    o=ord(c)
    return 0x4E00<=o<=0x9FFF or 0x3400<=o<=0x4DBF or o==0x3005

def clean_kun(r):
    """'い.きる' -> core 'い'; '-び' -> 'び'; 'なま-' -> 'なま'"""
    r=r.strip('-')
    return r.split('.')[0]

def candidates(c, KRD, allow_nanori=False):
    """(reading, cost) candidates for kanji c, base forms only."""
    d=KRD.get(c)
    if not d: return []
    out={}
    for r in d['on']:
        h=kata2hira(r).strip('-')
        if h: out.setdefault(h, 0)
    for r in d['kun']:
        h=clean_kun(kata2hira(r))
        if h: out.setdefault(h, 0)
    if allow_nanori:
        for r in d['nanori']:
            h=kata2hira(r).strip('-')
            if h: out.setdefault(h, 3)
    return sorted(out.items(), key=lambda kv: -len(kv[0]))

def variants(r, cost, first, last):
    """rendaku / sokuon / handakuten forms -> (surface, cost). `first`=word-initial."""
    v=[(r,cost)]
    if not first and r[0] in VOICE:
        v.append((VOICE[r[0]]+r[1:], cost+1))
    if not first and r[0] in ALT_VOICE:
        v.append((ALT_VOICE[r[0]]+r[1:], cost+1))
    if not first and r[0] in HANDAKU:
        v.append((HANDAKU[r[0]]+r[1:], cost+1))
    if not last and len(r)>1 and r[-1] in ('つ','ち','く','き'):
        v.append((r[:-1]+'っ', cost+1))
    if not last and len(r)>1 and r[-1]=='ん':
        pass
    # 撥音: some on-readings ending in ん stay ん (no change needed)
    return v

def align(keb, reb, KRD, allow_nanori=False):
    """Return list of (kanji, reading) for kanji positions, or None if no clean
    alignment (jukujikun like 今日/きょう -> None, and that is CORRECT: there is
    no per-kanji reading to teach)."""
    n=len(keb)
    best=None
    @functools.lru_cache(maxsize=None)
    def rec(i, j):
        if i==n:
            return ([], 0) if j==len(reb) else None
        c=keb[i]
        if c=='々' and i>0 and is_kanji(keb[i-1]):
            c=keb[i-1]          # iteration mark: 人々 = 人+人
        if not is_kanji(c):
            # literal kana (okurigana / particles) must match exactly
            if j<len(reb) and reb[j]==c:
                sub=rec(i+1, j+1)
                if sub: return (sub[0], sub[1])
            # tolerate 々 handled below; else fail
            return None
        bestlocal=None
        for r,cost in candidates(c, KRD, allow_nanori):
            for rv, cv in variants(r, cost, i==0, i==n-1):
                if reb.startswith(rv, j):
                    sub=rec(i+1, j+len(rv))
                    if sub is not None:
                        tot=sub[1]+cv
                        # (kanji, surface-in-this-word, BASE kanjidic reading)
                        cand=([(c,rv,r)]+sub[0], tot)
                        if bestlocal is None or tot<bestlocal[1]: bestlocal=cand
        return bestlocal
    r=rec(0,0)
    rec.cache_clear()
    return r[0] if r else None

if __name__=='__main__':
    import pickle
    KRD=pickle.load(open('kread.pkl','rb'))
    tests=[('学生','がくせい'),('先生','せんせい'),('生きる','いきる'),('人生','じんせい'),
           ('日本','にほん'),('今日','きょう'),('大人','おとな'),('一日','ついたち'),
           ('学校','がっこう'),('小学生','しょうがくせい'),('物語','ものがたり'),
           ('見物','けんぶつ'),('目的地','もくてきち'),('気分','きぶん'),('出口','でぐち')]
    for keb,reb in tests:
        print(f"{keb:<5} {reb:<10} -> {align(keb,reb,KRD)}")

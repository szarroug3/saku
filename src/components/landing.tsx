import Link from "next/link";
import { preload } from "react-dom";
import type { ReactNode } from "react";

// The landing — what a signed-out visitor sees at /. It introduces Saku and
// gives a way in, so no one is asked to sign in to a blank wall. Rendered by
// app/page.tsx only when there is no session; the sign-in button is passed in
// (a client island) so this stays a plain server component.

const TRACKS: Array<{ en: string; jp: string }> = [
  { en: "Hiragana", jp: "ひらがな" },
  { en: "Katakana", jp: "カタカナ" },
  { en: "Radicals", jp: "部首" },
  { en: "Kanji", jp: "漢字" },
  { en: "Vocabulary", jp: "単語" },
  { en: "Grammar", jp: "文法" },
  { en: "Keigo", jp: "敬語" },
  { en: "Counters", jp: "数え方" },
  { en: "Pitch", jp: "アクセント" },
];

const FEATURES: Array<{ title: string; body: string }> = [
  {
    title: "Mnemonics that stick",
    body: "Every character comes with a little illustrated story, so its shape and its sound actually stay with you instead of blurring together.",
  },
  {
    title: "A reference you'll use",
    body: "Look up any kana, kanji, word, or grammar point in the Library whenever you want. It's there to answer a question, not to quiz you.",
  },
  {
    title: "Practice that keeps up",
    body: "Saku remembers what you know and what's slipping, and picks what to show you next, so your time is used where it helps most.",
  },
];

export function Landing({ signIn }: { signIn: ReactNode }) {
  // Preload the mark here, not globally: it appears only in the hero below, so
  // preloading it in the root layout wasted the fetch on every other route (and
  // tripped the "preloaded but not used" console warning). Scoped to the landing,
  // it's decoded before first paint so the hero <img> doesn't flash blank.
  preload("/brand/saku-mark.png", { as: "image" });
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24">
      {/* Hero */}
      <section className="flex flex-col items-center pt-10 text-center">
        {/* alt="" on purpose — the <h1> below names the app; a non-empty alt
            would flash "Saku" as text while the PNG decodes. */}
        <img
          src="/brand/saku-mark.png"
          alt=""
          width={132}
          height={132}
          className="h-33 w-33 object-contain"
        />
        <h1 className="mt-6 text-[34px] font-medium leading-tight text-text sm:text-[40px]">
          Learn Japanese from the very first character.
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-text-muted">
          Saku takes you the whole way, in order: kana, then kanji, words, and
          grammar. It keeps track of what you know so every session picks up right
          where you are.
        </p>
        <div className="mt-8 w-full max-w-xs">{signIn}</div>
        {/* The way in without an account: the whole curriculum lives at /learn and
            works signed out — you just don't keep your progress. */}
        <Link
          href="/learn"
          className="mt-4 text-[14px] font-medium text-accent hover:underline"
        >
          Or start learning without an account →
        </Link>
        <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-text-muted">
          Free to use, no ads. Signing in is only to remember your progress across
          devices. We never email you anything.
        </p>
      </section>

      {/* The path */}
      <section className="mt-20">
        <h2 className="text-center text-[13px] font-medium uppercase tracking-wide text-text-muted">
          Everything, in the right order
        </h2>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          {TRACKS.map((t) => (
            <span
              key={t.en}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-[14px] text-text"
            >
              <span className="font-kana text-accent">{t.jp}</span>
              {t.en}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mt-20 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-[16px] font-medium text-text">{f.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-text-muted">{f.body}</p>
          </div>
        ))}
      </section>

    </main>
  );
}

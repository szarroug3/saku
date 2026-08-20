"use client";

// The drawn picture, or the glyph — with the fallback decided at LOAD TIME.
//
// `getMnemonic` hands every kana a candidate image path (/mnemonics/<romaji>.webp)
// whether or not that file has been drawn yet. This component loads it and, if it
// 404s (no drawing for that kana), swaps to the plain character glyph — the exact
// placeholder look kana without a picture have always shown. So the owner adds a
// drawing by dropping the webp into public/mnemonics; nothing here or in the data
// table changes, and a missing file degrades to the character instead of a broken
// image.
//
// The failure is tracked BY SRC, not as a bare boolean: when the same component
// instance is reused for a different kana (a new src), a prior failure doesn't
// carry over — `failedSrc !== src` is true again, so the new picture gets a fresh
// try with no effect/reset plumbing.

import { useState } from "react";
import Image from "next/image";

export function MnemonicImage({
  src,
  glyph,
  imgClassName,
  glyphClassName,
  onMissing,
  priority,
}: {
  /** Candidate picture path, e.g. "/mnemonics/a.webp". */
  src: string;
  /** The character to fall back to when the picture is absent. */
  glyph: string;
  /** Classes for the <img> when the picture loads. */
  imgClassName: string;
  /** Classes for the glyph <span> when the picture is missing. */
  glyphClassName: string;
  /** Told once, when the picture turns out not to exist. Lets a caller that
   * prints the character elsewhere (the mnemonic view's header glyph) drop it,
   * so a kana with no drawing doesn't print its glyph twice. Fired from the
   * <img>'s error event, never during render. */
  onMissing?: () => void;
  /** Set when this is the single large hero drawing for the page (MnemonicView),
   * so Next can skip lazy-loading it — it is the page's LCP element there. Leave
   * unset everywhere else (hint popovers, drill screens) where many of these can
   * mount at once and eager-loading all of them would cost more than it saves. */
  priority?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return (
      <span className={glyphClassName} aria-hidden>
        {glyph}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={192}
      height={192}
      className={imgClassName}
      aria-hidden
      priority={priority}
      onError={() => {
        setFailedSrc(src);
        onMissing?.();
      }}
    />
  );
}

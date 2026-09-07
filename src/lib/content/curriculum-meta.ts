// The two things about the curriculum that every page needs, without the
// index they come from. `learn-index.json` is 4.4 MB and was loaded into every
// server bundle for a version string and the glyph list (SAK-399); the build
// script writes these two into a file of their own alongside it.

import metaJson from "@/data/generated/curriculum-meta.json" with { type: "json" };

const META = metaJson as { readonly curriculumVersion: string; readonly curriculumGlyphs: readonly string[] };

/** The content hash of the index (the frontier cache key, the catalogue versions). */
export const CURRICULUM_VERSION: string = META.curriculumVersion;

/** Every curriculum glyph in prereq-respecting spine order. */
export const CURRICULUM_GLYPHS: readonly string[] = META.curriculumGlyphs;

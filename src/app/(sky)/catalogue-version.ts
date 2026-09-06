// What a catalogue is called (SAK-381).
//
// A catalogue is served with `immutable`, which tells a browser it may keep
// it forever and never ask again. That is only safe if the name changes
// whenever the contents do, so the name is a hash of the contents, not a
// version somebody remembers to bump. CURRICULUM_VERSION rides in front of it
// so a human can read which build a cached file came from; the hash is the
// part that makes the promise true, since a catalogue is a function of the
// tables AND of the code that shapes them.

import { createHash } from "node:crypto";

import { CURRICULUM_VERSION } from "@/lib/content/learn-index";

export function versionOf(body: string): string {
  return `${CURRICULUM_VERSION}.${createHash("sha1").update(body).digest("hex").slice(0, 12)}`;
}

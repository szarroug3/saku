// The EDRDG acknowledgement link. NOT DECORATION — a licence obligation.
//
// src/data/attribution.ts has carried the text since the dictionaries landed and
// has never had a UI, which means the app has been shipping a licence violation.
// The licence's own terms (see that file's header) are unusually specific about
// where the acknowledgement may live: a README, an About box or a startup screen
// are ruled out BY NAME, and what is required is that the acknowledgement appear
// on each screen that displays the data OR be reachable from it — a menu item is
// the example the licence itself gives.
//
// So this is the cheap half of that: a persistent link in the chrome of every
// screen that renders dictionary data, pointing at /about/data, which renders
// the notice in full.
//
// IT GOES ON EVERY SCREEN THAT SHOWS THE DATA, and today that means the Library
// and the entry page. When kanji reach the quiz screens and Home's shelves, they
// will need it too — this component exists so that is an import and not a
// rewrite. It deliberately does NOT live in the root layout: a link on Settings,
// which shows no dictionary data, is not wrong but it is noise, and putting it
// there would make it nobody's job to notice when a new screen needs it.

import { SHORT, ATTRIBUTION_HREF } from "@/data/attribution";

export function AttributionLink() {
  return (
    <p className="mt-6 text-center text-xs text-text-muted">
      <a href={ATTRIBUTION_HREF} className="text-text-muted underline">
        {SHORT}
      </a>
    </p>
  );
}

import "server-only";

// The one switch that says whether this server answers for the dev surfaces
// (SAK-445): the pretend learner behind `?sample` and the lesson's `?showcase`.
// Both were built to develop against and both reached production, where
// `/?sample` served a made-up history to anybody who typed the word.
//
// It is read here and nowhere else, and it is read at request time rather than
// baked into the bundle, so the same production build is a dev server with the
// variable set and a plain production server without it. That matters: the e2e
// suite runs a PRODUCTION build and still wants the pretend learner, so
// `NODE_ENV` alone could not tell the two apart.
//
// Deliberately NOT `NEXT_PUBLIC_`. The browser never decides this; the server
// does, on every request, and hands the page down a flag that is already false.
//
// Where it is on:
//   - `next dev`, with nothing set (NODE_ENV is "development" there)
//   - the e2e suite, which sets it in playwright.config.ts's webServer env
//     beside SAKU_DISABLE_AUTH
//   - a production build anyone deliberately starts with SAKU_DEV_SURFACES=1
//
// Where it is off: Vercel, which must never carry the variable.

export function devSurfacesOn(): boolean {
  if (process.env.SAKU_DEV_SURFACES === "1") return true;
  return process.env.NODE_ENV !== "production";
}

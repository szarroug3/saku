# Where the functions run, and why it is Portland

`vercel.json` pins the serverless functions to `pdx1`.

That is not a preference. Supabase holds this project's database in AWS
`us-west-2`, which is Oregon, and `pdx1` is Vercel's region in the same
place. Every query the app makes is a round trip from a function to that
database, so the distance between them is paid on every page a signed-in
learner opens, several times over.

Before this, the functions ran in `iad1`, Washington DC. That is a
coast-to-coast round trip: about 60 to 70 ms each way before the database
has done any work at all. A query is not one round trip either — opening a
connection is a handshake of several — so a first query on a cold function
measured 1240 ms for a single row looked up by its primary key, which is
nothing a faster query could fix.

Measured on the deployed app, 2026-09-06, SAK-382:

| phase | ms |
| --- | --- |
| `db:query`, one row by primary key, cold | 1240 |
| `db:normalise`, including a second query to the facts table | 309 |
| `atlas`, building the page | 651 |
| `session`, the auth refresh in the proxy | 99 |

## How to check it is still right

Two regions appear on a response and they are not the same thing. The
`Server-Timing` header carries `edge`, which is where the request landed:
near whoever asked, and nothing to do with the database. The page's own
timings carry `region`, which is where the page was built and is the one
that decides how far the database is. `x-vercel-id` says both at once, as
`<edge>::<function>::<id>`, so `iad1::pdx1` is a request that landed in
Washington and was served from Portland.

Read the page's `region` against the region on Supabase's project settings
page. They should say the same place.

If the database ever moves, move this with it. The two Vercel regions that
matter here: `pdx1` is Oregon (`us-west-2`), `iad1` is Washington DC
(`us-east-1`).

## What this does not fix

Cold starts. Fluid Compute is on, which keeps functions alive longer, but a
function that has been idle long enough still boots from nothing: a 3246 ms
time to first byte with only 99 ms of session in it, measured the same day.
A page reports `boot` in its own timings when it is the first request a
process has served, so a slow run can be told apart from slow code.

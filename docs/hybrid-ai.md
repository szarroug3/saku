# The writing drill's grader: Firebase AI Logic hybrid inference

Built for #BuildHybridAI 2026 (deadline Mon Nov 30, 2:00 PM PT). The drill is at `/practice/write` and listed in Practice's Drills panel.

## What it does

The learner sees an English sentence from the grammar corpus and writes it in Japanese, in kana or kanji, in their own words. Saku never marks a right answer wrong, and a string compare can't keep that promise for a sentence written from scratch: kana for kanji, a dropped subject, polite or plain, another word order are all right. That is why the assembly drill keeps only 605 of 9,654 sentences. A grader that reads meaning brings the rest back.

## How an answer is graded

1. **Exact match.** The stored answer, give or take punctuation, is right with no model asked.
2. **On the device.** Otherwise Gemini Nano grades it in Chrome through Firebase AI Logic (`InferenceMode.PREFER_ON_DEVICE`). The answer never leaves the machine, it's free, and it works offline. Where Nano isn't there (Safari, Firefox, a phone, a download in progress), the same call goes to Gemini in the cloud.
3. **A second look in the cloud.** A device "right" stands. A device "close" or "wrong" is checked by the cloud model before the learner sees it, when there's a connection. The small model is quick and good at spotting a right answer, and the bigger one gets the last word before the learner is told they're wrong. Offline, the device's verdict stands.

Verdicts are `right`, `close` (one slip, so another try with the note as a hint) and `wrong` (the answer is shown). Both models get the same prompt and the same JSON schema: a response constraint on the device and a response schema in the cloud. The screen says where each answer was checked.

Each model gets 15 seconds. Nano usually answers in a few seconds, but its first session after Chrome starts can take much longer, and before the limit a stuck session left the screen on "Checking…". When the device runs out of time the cloud grades the answer; when the cloud does too, the offline path takes over. A grader that fails or times out is logged to the console.

The note glosses every Japanese word or particle it names, with the kana reading first for a word in kanji: を (marks the direct object) instead of に (marks the target) after ギター (guitar). The example in the prompt uses words no drill answer has (私, 猫). An earlier example matched a real mistake word for word, and the model copied it.

Code:

- `src/sky/lib/write-drill.ts`: the model (run, score, exact match, prompt, schema, parsing, and `gradeWith`, the grading steps with their time limits). Tests in `write-drill.test.ts` beside it, with fake graders for every path.
- `src/app/(sky)/hybrid-grader.ts`: Firebase, App Check and the two models, handed to `gradeWith`. Firebase is imported on first use, so it ships with this page only.
- `src/app/(sky)/write-drill.ts`: the pool, 200 short corpus sentences spread across patterns, each with its words line.
- `src/sky/components/sky-write-drill.tsx`: the screen. `src/app/(sky)/write-client.tsx` hands it the grader. The end screen, `src/sky/components/drill-end.tsx`, is shared with the readings drill.

## Setup

1. Create a Firebase project. Add a Web app and copy its config into `.env.local` (see `.env.example`): API key, auth domain, project ID, app ID.
2. In the console, open **AI Logic** and enable the **Gemini Developer API** (no billing needed for `gemini-3.5-flash-lite`).
3. App Check, which AI Logic requires:
   - **Local dev:** set `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` to a UUID, then register the same value under App Check, Apps, Manage debug tokens.
   - **Production:** create a score-based reCAPTCHA Enterprise web key (no checkbox challenge, don't add localhost), register it for the web app under App Check, and set `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY`. Add the same vars in Vercel.
   - Enforce it by hand: App Check, APIs, Firebase AI Logic, Set up, Enforced. The automatic date for this project was Jan 21, 2027, after judging. Replay protection stays off; it needs limited-use tokens, which the app does not send.
4. Gemini Nano in Chrome: Chrome 139 or later on desktop. The first download can take minutes; the drill shows a "Download it" link while it's downloadable, and grades in the cloud meanwhile.

The line above the card says which case a browser is in:

- **Nano available:** checked on the device, with the cloud checking a mistake.
- **"Turned off or can't run on this device":** the browser has the Prompt API but Nano says no. On 2026-11-14 a Chromium-based browser that isn't Chrome showed this on the same Mac where Chrome had Nano. A managed Chrome profile with the `GenAILocalFoundationalModelSettings` policy set to 1 would show it too.
- **"No on-device model":** no Prompt API at all (Safari, Firefox, a phone).

The last two grade in the cloud, so the drill works everywhere.

## What Nano did on real answers (2026-11-14)

Chrome 157 on Sam's Mac: `LanguageModel.availability()` is "available" for English in and out, English and Japanese in, and Japanese in and out. So Japanese input works on the device.

Twelve answers through the real prompt and schema, three sentences, each with right, one-slip and wrong answers. Each took 3 to 7.5 seconds.

| Answers | Nano said |
|---|---|
| 3 wrong | 3 wrong |
| 3 with one slip | 3 close |
| 6 right | 1 right, 5 close |

Nano never called a mistake right, but it is far too strict on right answers. It marked kana for kanji (わらってはいけない), a polite form (もどりたいです), an added を and another word for "go back" (かえりたい) as close, and its notes on them were made up. One read 食べる as "たんべい". That shapes the design:

- A device "right" is trusted, so most right answers are confirmed on the device, privately and for free.
- A device "close" or "wrong" always goes to the cloud for the verdict and the note.
- Offline, a device "close" or "wrong" is not shown. The learner is told the device wasn't sure, and compares with the answer.

## What the cloud model did on the same answers (2026-11-14)

`gemini-3.5-flash-lite` through Firebase AI Logic, same prompt and schema, about 1 second per answer. With the first prompt it matched 10 of 12: it told a learner to drop the を from なにかをしてみましょう (fine Japanese) and called もどるたい wrong instead of close. After adding the line that an optional particle added or left out is right, it matched 12 of 12, with accurate notes. Like Nano, it never called a mistake right.

So the split works as intended: Nano's "right" (trusted) is cheap, private and on the device, and the cloud gives the verdict and the note whenever an answer might be a mistake.

## The project as set up (2026-11-14)

- Firebase project **Saku Hybrid AI** (`project-8806328f-21aa-4b00-b3d`), web app **Saku Web**. Billing is unlinked, so it is on the free Spark plan and Gemini's free tier. Linked to the Cloud free trial, the Gemini API refused every call ("prepayment credits are depleted"), and the trial ends Nov 18, before the deadline.
- App Check: a debug token for localhost (in `.env.local`, never on Vercel), and a score-based reCAPTCHA Enterprise key for `saku-san.vercel.app`, registered with App Check. App Check is enforced for AI Logic (set 2026-11-14). The key is public by design; it goes in Vercel as `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY`. A preview deployment's hostname isn't on the key, so grading only works on the production alias and localhost.
- The free tier allows only a handful of cloud calls a minute: 17 calls in about a minute hit a 429. Grading on the device first keeps most answers off the cloud. A cloud failure falls back to the offline path (the learner compares with the answer).

## Submission checklist

- [ ] Repo public, MIT license showing in the GitHub About box
- [ ] Hosted URL works without signing in (the drill reads no learner)
- [ ] Video under 3 minutes, on YouTube: Chrome with Nano (DevTools offline to show it on the device), then Safari falling back to the cloud, then a near miss getting a hint
- [ ] Devpost: "Existing" project, start date 07-15-26, summary of what was built after Nov 11, platform Web (Chrome)

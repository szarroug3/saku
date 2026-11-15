# Hybrid AI in Saku: the writing drill's grader and the mix-up coach

Built for #BuildHybridAI 2026 (deadline Mon Nov 30, 2:00 PM PT). The drill is at `/practice/write` and listed in Practice's Drills panel.

## What it does

The learner sees an English sentence from the grammar corpus and writes it in Japanese, in kana or kanji, in their own words. Saku never marks a right answer wrong. A string compare can't keep that promise for a sentence written from scratch. Kana for kanji, a dropped subject, polite or plain, and another word order are all right. That is why the assembly drill keeps only 605 of 9,654 sentences. A grader that reads for meaning can use the rest.

## How an answer is graded

1. **Exact match.** The stored answer, give or take punctuation, is right with no model asked.
2. **On the device.** Otherwise Gemini Nano grades it in Chrome through Firebase AI Logic (`InferenceMode.PREFER_ON_DEVICE`). The answer stays on the machine and works offline. Where Nano isn't there (Safari, Firefox, a phone, a download in progress), the same call goes to Gemini in the cloud.
3. **A second look in the cloud.** A device "right" stands. A device "close" or "wrong" is checked by the cloud model before the learner sees it, when there's a connection. The small model is quick and good at spotting a right answer, and the bigger one decides before the learner is told they're wrong. Offline, the device's verdict stands.

Verdicts are `right`, `close` (one slip, so another try with the note as a hint) and `wrong` (the answer is shown). Both models get the same prompt and the same JSON schema: a response constraint on the device and a response schema in the cloud. The screen says where each answer was checked.

Each model gets 15 seconds. Nano usually answers in a few seconds, but its first session after Chrome starts can take much longer, and before the limit a stuck session left the screen on "Checking…". When the device runs out of time the cloud grades the answer; when the cloud does too, the device's verdict is handled as it is offline. A grader that fails or times out is logged to the console.

The note glosses every Japanese word or particle it names, with the kana reading first for a word in kanji: を (marks the direct object) instead of に (marks the target) after ギター (guitar). The example in the prompt uses words no drill answer has (私, 猫). An earlier example matched a real mistake word for word, and the model copied it.

Code:

- `src/sky/lib/write-drill.ts`: the model (run, score, exact match, prompt, schema, parsing, and `gradeWith`, the grading steps with their time limits). Tests in `write-drill.test.ts` beside it, with fake graders for every path.
- `src/app/(sky)/firebase-ai.ts`: Firebase, App Check, and a pair of models (on the device first, and the cloud only) for each answer shape. Shared by the grader and the mix-up coach. Firebase is imported on first use, so only the pages that use it load it.
- `src/app/(sky)/hybrid-grader.ts`: the grader's two models, handed to `gradeWith`.
- `src/app/(sky)/write-drill.ts`: the pool, 200 short corpus sentences spread across patterns, each with its words line.
- `src/sky/components/sky-write-drill.tsx`: the screen. `src/app/(sky)/write-client.tsx` hands it the grader. The end screen, `src/sky/components/drill-end.tsx`, is shared with the readings drill.

## The mix-up coach

When a learner mixes two things up (シ and ツ, 待 and 持), Gemini says how to tell them apart in two or three sentences. The coach shows up in two places. After a missed quiz card, the reveal says "You picked ツ" with a "What's the difference?" link. On the home page, each row of the Mix-ups panel has a "Why?".

### How mix-ups are recorded

The home Mix-ups panel, the Practice "Mix-ups" filter and the weakness ranking all read `confused` counts on session records (`src/lib/confusions.ts`). The quiz writes them:

- `QuizAnswer.picked` carries the ids of the wrong choices picked on a card (`sky-quiz.tsx`), and a saved run keeps them.
- `quizRecords` turns each into a mix-up through `mixedWith` (`src/app/(sky)/quiz-mixups.ts`). A wrong pick names its entry for certain. A wrong typed answer counts only when exactly one card in the quiz has it as an answer (the engine's `confusedWith`). Each entry counts once per card, and another reading of the same character is never a mix-up.

One mix-up is enough for a pair to show on the home panel.

### How an explanation is made

1. **Facts, on the server.** `mixupCoachRequest` (`actions.ts`, built by `mixup-facts.ts`) collects Saku's own facts about the two entries. For kana that's the sound and the shape story, and for kanji the meanings, readings and parts (with what each part means). The pair's hand-written tip is added when there is one: the radical tips, or `src/data/shape-tips.ts` for the look-alike kana and the sample learner's kanji pairs. Nothing about the learner goes in.
2. **Nano first.** The browser asks Gemini Nano (`PREFER_ON_DEVICE`, so the cloud where there's no Nano).
3. **The grounding check.** Every Japanese character in the answer must appear in those facts (`ungrounded` in `src/sky/lib/mixup-coach.ts`). An answer that uses a reading, a part or a word the facts don't have is thrown out, and the cloud model is asked. A cloud answer that fails the check isn't shown either. The screen says where the explanation came from, including when Nano's was replaced.

The prompt also says to describe strokes only when a fact or the tip does, because English can't be checked the same way.

### What the cloud model wrote (2026-11-14)

`gemini-3.5-flash-lite`, 12 pairs, 1 to 10 s each. Every answer passed the grounding check. Before the shape tips, the kana pairs got only their two stories retold, and 人/入 got an invented story about which "leg" leans. With the tips, シ/ツ, ソ/ン, ぬ/め, 日/目 and 人/入 each named the real difference. The shape tips were written for this and still need Sam's check.

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

So the split works as intended. Nano's "right" is trusted and costs nothing. The cloud gives the verdict and the note whenever an answer might be a mistake.

## The project as set up (2026-11-14)

- Firebase project **Saku Hybrid AI** (`project-8806328f-21aa-4b00-b3d`), web app **Saku Web**. Billing is unlinked, so it is on the free Spark plan and Gemini's free tier. Linked to the Cloud free trial, the Gemini API refused every call ("prepayment credits are depleted"), and the trial ends Nov 18, before the deadline.
- App Check: a debug token for localhost (in `.env.local`, never on Vercel), and a score-based reCAPTCHA Enterprise key for `saku-san.vercel.app`, registered with App Check. App Check is enforced for AI Logic (set 2026-11-14). The key is public by design; it goes in Vercel as `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY`. A preview deployment's hostname isn't on the key, so grading only works on the production alias and localhost.
- The free tier allows only a handful of cloud calls a minute: 17 calls in about a minute hit a 429. Grading on the device first keeps most answers off the cloud. A cloud failure falls back to the offline path (the learner compares with the answer).

## Submission checklist

- [ ] Repo public, MIT license showing in the GitHub About box
- [ ] Hosted URL works without signing in (the drill reads no learner)
- [ ] Video under 3 minutes, on YouTube: Chrome with Nano (DevTools offline to show it on the device), then another browser falling back to the cloud, then a near miss getting a hint, then a missed quiz card's "What's the difference?" and the home panel's Why?
- [ ] Devpost: "Existing" project, start date 07-15-26, summary of what was built after Nov 11, platform Web (Chrome)

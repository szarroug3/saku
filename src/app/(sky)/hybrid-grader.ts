// The writing drill's grader: Firebase AI Logic hybrid inference
// (#BuildHybridAI). Browser only.
//
// HOW AN ANSWER IS GRADED
// =======================
// The steps (exact match, Nano on the device, the cloud's second look, the
// offline path) and their time limits are `gradeWith` in
// src/sky/lib/write-drill.ts, with tests. This file only hands it the two
// Firebase models: PREFER_ON_DEVICE, which runs Gemini Nano in Chrome and
// falls back to the cloud where there is none, and ONLY_IN_CLOUD.
//
// Firebase is imported on the first grade, not at load, so it ships with
// this drill's page and no other.
//
// SETUP
// =====
// The NEXT_PUBLIC_FIREBASE_* values below come from the Firebase console
// (Project settings, Your apps, Web app). App Check is required by Firebase
// AI Logic: production uses a reCAPTCHA Enterprise key, and localhost uses a
// debug token registered in the console. See docs/hybrid-ai.md.

import type { DeviceModelState, Graded, WriteItem } from "@/sky/lib/write-drill";
import { gradeWith, parseVerdict, VERDICT_SCHEMA } from "@/sky/lib/write-drill";

const CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const RECAPTCHA_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY;
const APPCHECK_DEBUG_TOKEN = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
/** The cloud model. The default is on the free tier. */
const CLOUD_MODEL = process.env.NEXT_PUBLIC_GEMINI_CLOUD_MODEL || "gemini-3.5-flash-lite";

/** Whether the Firebase values are set, so the drill can grade at all. */
export function graderConfigured(): boolean {
  return Boolean(CONFIG.apiKey && CONFIG.projectId && CONFIG.appId);
}

/** What the on-device model expects, for the availability check and the
 * session: English and Japanese in, English out. */
const EXPECTED = {
  expectedInputs: [{ type: "text" as const, languages: ["en", "ja"] }],
  expectedOutputs: [{ type: "text" as const, languages: ["en"] }],
};

interface PromptApi {
  availability(options?: object): Promise<string>;
}

export async function deviceModelState(): Promise<DeviceModelState> {
  const api = (globalThis as { LanguageModel?: PromptApi }).LanguageModel;
  if (!api) return "unsupported";
  try {
    const state = await api.availability(EXPECTED);
    return (["available", "downloadable", "downloading"] as const).find((s) => s === state) ?? "unavailable";
  } catch {
    return "unavailable";
  }
}

type Models = {
  /** On the device when it can be, the cloud when not. */
  hybrid: import("firebase/ai").GenerativeModel;
  /** The cloud only, for the second look. */
  cloud: import("firebase/ai").GenerativeModel;
};

let models: Promise<Models> | undefined;

/** Firebase, App Check and the two models, set up once. */
function loadModels(): Promise<Models> {
  models ??= (async () => {
    const [{ initializeApp, getApps }, { initializeAppCheck, ReCaptchaEnterpriseProvider }, ai] = await Promise.all([
      import("firebase/app"),
      import("firebase/app-check"),
      import("firebase/ai"),
    ]);
    const app = getApps()[0] ?? initializeApp(CONFIG);
    if (APPCHECK_DEBUG_TOKEN) {
      // a token registered in the console, for localhost (App Check's own
      // switch: it must be set before initializeAppCheck)
      (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = APPCHECK_DEBUG_TOKEN;
    }
    if (RECAPTCHA_KEY || APPCHECK_DEBUG_TOKEN) {
      // with a debug token App Check never asks reCAPTCHA, so on localhost
      // the site key can be a placeholder
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_KEY ?? "debug"), isTokenAutoRefreshEnabled: true });
    }
    const backend = ai.getAI(app, { backend: new ai.GoogleAIBackend() });
    // the schema is plain JSON Schema, the shape Firebase's Schema builder
    // produces; the lib keeps it Firebase-free so the device can share it
    const generationConfig = { responseMimeType: "application/json", responseSchema: VERDICT_SCHEMA as unknown as import("firebase/ai").ObjectSchemaRequest, temperature: 0 };
    return {
      hybrid: ai.getGenerativeModel(backend, {
        mode: ai.InferenceMode.PREFER_ON_DEVICE,
        // no temperature or topK on the device: Chrome takes those only from
        // an extension, and a web page that sends them can fail to start a
        // session, which would quietly send every answer to the cloud
        onDeviceParams: { createOptions: EXPECTED, promptOptions: { responseConstraint: VERDICT_SCHEMA } },
        inCloudParams: { model: CLOUD_MODEL, generationConfig },
      }),
      cloud: ai.getGenerativeModel(backend, {
        mode: ai.InferenceMode.ONLY_IN_CLOUD,
        inCloudParams: { model: CLOUD_MODEL, generationConfig },
      }),
    };
  })();
  models.catch(() => { models = undefined; });
  return models;
}

/** Starts Gemini Nano's download. Chrome only lets this begin from a click,
 * so the drill's "Download it" link calls it. Progress is 0 to 1. Grading never
 * waits for it: until the download is done, answers go to the cloud. */
export async function prepareDeviceModel(onProgress?: (fraction: number) => void): Promise<void> {
  if (!graderConfigured()) return;
  const { hybrid } = await loadModels();
  await hybrid.initializeDeviceModel(onProgress);
}

/** One model's verdict on one answer. */
async function ask(model: Models["hybrid"], prompt: string): Promise<Graded | null> {
  const result = await model.generateContent(prompt);
  const parsed = parseVerdict(result.response.text());
  if (!parsed) return null;
  return { ...parsed, source: result.response.inferenceSource === "on_device" ? "on_device" : "in_cloud" };
}

const online = () => typeof navigator === "undefined" || navigator.onLine !== false;

/** Grades what the learner wrote, through `gradeWith` (the steps, timeouts
 * and fallbacks, tested in the lib). Throws only when no grader could answer
 * (no connection and no on-device model, or Firebase is not set up). The
 * models load on the first answer that is not an exact match. */
export function gradeAnswer(item: WriteItem, given: string): Promise<Graded> {
  return gradeWith(item, given, {
    first: async (prompt) => ask((await loadModels()).hybrid, prompt),
    cloud: async (prompt) => ask((await loadModels()).cloud, prompt),
    online,
  });
}

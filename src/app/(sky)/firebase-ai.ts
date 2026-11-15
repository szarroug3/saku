// Firebase AI Logic hybrid inference, set up once for every feature that asks
// Gemini (#BuildHybridAI): the writing drill's grader (hybrid-grader.ts) and
// the mix-up coach (mixup-coach-client.ts). Browser only.
//
// Each feature gets a pair of models for its own answer shape:
//
//   hybrid  InferenceMode.PREFER_ON_DEVICE: Gemini Nano in Chrome, and the
//           same call goes to Gemini in the cloud where there is no Nano
//           (another browser, a phone, a download in progress).
//   cloud   InferenceMode.ONLY_IN_CLOUD, for when the device's answer can't
//           be used.
//
// Firebase is imported on first use, not at load, so only the pages that use it
// load it.
//
// SETUP
// =====
// The NEXT_PUBLIC_FIREBASE_* values come from the Firebase console (Project
// settings, Your apps, Web app). App Check is required by Firebase AI Logic:
// production uses a reCAPTCHA Enterprise key, and localhost uses a debug token
// registered in the console. See docs/hybrid-ai.md.

import type { DeviceModelState } from "@/sky/lib/write-drill";

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

/** Whether the Firebase values are set, so anything can ask Gemini at all. */
export function aiConfigured(): boolean {
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

/** Where Gemini Nano stands in this browser. */
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

type FirebaseAI = typeof import("firebase/ai");
type Model = import("firebase/ai").GenerativeModel;

let loaded: Promise<{ ai: FirebaseAI; backend: import("firebase/ai").AI }> | undefined;

/** Firebase, App Check and the AI backend, set up once. */
function load() {
  loaded ??= (async () => {
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
    return { ai, backend: ai.getAI(app, { backend: new ai.GoogleAIBackend() }) };
  })();
  loaded.catch(() => { loaded = undefined; });
  return loaded;
}

export interface ModelPair {
  hybrid: Model;
  cloud: Model;
}

const pairs = new Map<object, Promise<ModelPair>>();

/** The two models for one answer shape, made once per schema. `schema` is
 * plain JSON Schema, the shape Firebase's Schema builder produces; the sky
 * libs keep theirs Firebase-free, which is what the cast stands for. */
export function modelPair(schema: object): Promise<ModelPair> {
  let pair = pairs.get(schema);
  if (!pair) {
    pair = load().then(({ ai, backend }) => {
      const generationConfig = { responseMimeType: "application/json", responseSchema: schema as import("firebase/ai").ObjectSchemaRequest, temperature: 0 };
      return {
        hybrid: ai.getGenerativeModel(backend, {
          mode: ai.InferenceMode.PREFER_ON_DEVICE,
          // no temperature or topK on the device: Chrome takes those only from
          // an extension, and a web page that sends them can fail to start a
          // session, which would quietly send everything to the cloud
          onDeviceParams: { createOptions: EXPECTED, promptOptions: { responseConstraint: schema } },
          inCloudParams: { model: CLOUD_MODEL, generationConfig },
        }),
        cloud: ai.getGenerativeModel(backend, {
          mode: ai.InferenceMode.ONLY_IN_CLOUD,
          inCloudParams: { model: CLOUD_MODEL, generationConfig },
        }),
      };
    });
    pair.catch(() => pairs.delete(schema));
    pairs.set(schema, pair);
  }
  return pair;
}

/** One model asked one prompt: its reply, and where it ran. */
export async function askModel(model: Model, prompt: string): Promise<{ text: string; source: "on_device" | "in_cloud" }> {
  const result = await model.generateContent(prompt);
  return { text: result.response.text(), source: result.response.inferenceSource === "on_device" ? "on_device" : "in_cloud" };
}

/** Starts Gemini Nano's download. Chrome only lets this begin from a click,
 * so a "Download it" link calls it. Progress is 0 to 1. Nothing waits for
 * it: until the download is done, questions go to the cloud. */
export async function prepareDeviceModel(onProgress?: (fraction: number) => void): Promise<void> {
  if (!aiConfigured()) return;
  const { hybrid } = await modelPair(DOWNLOAD_SCHEMA);
  await hybrid.initializeDeviceModel(onProgress);
}

/** Any schema does for a download; the model is the same. */
const DOWNLOAD_SCHEMA = { type: "object", properties: {} };

export const online = () => typeof navigator === "undefined" || navigator.onLine !== false;

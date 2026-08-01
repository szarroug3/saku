// The conjugation-class axis shared by grammar fact generation and vehicle
// selection. Every regular verb class is a separately tracked production skill,
// even when two classes happen to produce the same surface ending.

import type { WordClass } from "../conjugate/index.ts";

/** ONE representative verb per regular drillable class, in teaching order. */
export const CLASS_ANCHOR: readonly {
  readonly cls: WordClass;
  /** The ending shown in the Godan table. Empty for ichidan. */
  readonly ending: string;
  readonly surface: string;
  readonly kana: string;
}[] = [
  { cls: "v5u", ending: "う", surface: "買う", kana: "かう" },
  { cls: "v5t", ending: "つ", surface: "待つ", kana: "まつ" },
  { cls: "v5r", ending: "る", surface: "帰る", kana: "かえる" },
  { cls: "v5m", ending: "む", surface: "飲む", kana: "のむ" },
  { cls: "v5b", ending: "ぶ", surface: "遊ぶ", kana: "あそぶ" },
  { cls: "v5n", ending: "ぬ", surface: "死ぬ", kana: "しぬ" },
  { cls: "v5k", ending: "く", surface: "書く", kana: "かく" },
  { cls: "v5g", ending: "ぐ", surface: "泳ぐ", kana: "およぐ" },
  { cls: "v5s", ending: "す", surface: "話す", kana: "はなす" },
  { cls: "v1", ending: "", surface: "食べる", kana: "たべる" },
];

/** Which vehicles a production fact may roll: one class or one exceptional word. */
export type VehicleBucket =
  | { readonly kind: "class"; readonly cls: WordClass }
  | { readonly kind: "verb"; readonly surface: string };

export function vehicleInBucket(
  v: { readonly cls: WordClass | null; readonly surface: string },
  bucket: VehicleBucket,
): boolean {
  return bucket.kind === "class"
    ? v.cls === bucket.cls
    : v.surface === bucket.surface;
}

// 作成：Phase-108-1｜更新：Phase-108-3
import type { SharedChangeRequestRead } from "@/features/share/api/types";

// 共有リンクの画面のテストで使う応答(devex-api の SharedChangeRequestRead の形。必要な項目だけ上書きする)。

export const FINGERPRINT = "a".repeat(64);

export function makeShared(overrides: Partial<SharedChangeRequestRead> = {}): SharedChangeRequestRead {
  return {
    state: "open",
    state_label: "開いている",
    label: "CR-3",
    title: "検索に絞り込みを足す",
    expires_at: "2026-11-08T00:00:00Z",
    markdown: "# 変更の説明書\n\n## 1. 変更の内容と背景\n\n検索結果を期間で絞り込めるようにします。\n",
    fingerprint: FINGERPRINT,
    options: [],
    recommended_reason: "",
    changes: [],
    changed_since: null,
    decision: null,
    comments: [],
    ...overrides,
  };
}

// 直している・閉じた CR の閲覧の形(説明書・指紋・案・コメントは返らない)
export function makeHiddenShared(
  state: "paused" | "closed",
  overrides: Partial<SharedChangeRequestRead> = {},
): SharedChangeRequestRead {
  return makeShared({
    state,
    state_label: state === "paused" ? "直しています" : "閉じた",
    markdown: null,
    fingerprint: null,
    ...overrides,
  });
}

// Phase-108-3:追記
// 案のある CR(案A・案B。案B がおすすめ)
export function makeSharedWithOptions(overrides: Partial<SharedChangeRequestRead> = {}): SharedChangeRequestRead {
  return makeShared({
    options: [
      { number: 1, label: "案A", name: "全部の項目で絞り込む", outcome: "手間は大きいが、何でも絞れる", recommended: false },
      { number: 2, label: "案B", name: "期間だけで絞り込む", outcome: "手間は小さい。ほかの項目は後で", recommended: true },
    ],
    recommended_reason: "まず期間だけで使われ方を見たい",
    ...overrides,
  });
}

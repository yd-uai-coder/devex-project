# Phase-53-3: 画面の API・意味モデル・ストア

## この章の目的

devex-ui にレビューの機能(`src/features/design-review/`)を作る。API の型と呼び出し、画面に出すラベルと純粋関数(重要度の順・区切りの文言・手順書の知らせ・対象から文書の推定)、区切りの状態とログイン中のユーザーを持つストアまで。パネル(部品)は [53-4](./Phase-53-4.md)。デモ(`demo/`)は触らず、本物の API の型で作り直した。

自動実装モード: on([introduction](./Phase-53-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-ui/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/features/design-review/api/reviewApi.ts`](../samples/frontend/src/features/design-review/api/reviewApi.ts) | 新規 | API の型(snake_case のまま)と、`getCurrentUser`・`updateReviewSettings`・`listReviewGates`・`requestReview`・`decideFinding` |
| [`src/features/design-review/model.ts`](../samples/frontend/src/features/design-review/model.ts) | 新規 | ラベル・`sortFindings`・`decisionCounts`・`actionLabel`・`gateDocuments`・`unreviewedNotice`・`documentOfTarget` |
| [`src/features/design-review/review-store.ts`](../samples/frontend/src/features/design-review/review-store.ts) | 新規 | 区切り(プロジェクトごと)とユーザー(プロジェクトによらない)の Zustand ストア |
| ── ここからテスト ── | | |
| [`src/features/design-review/test-utils/reviewFixtures.ts`](../samples/frontend/src/features/design-review/test-utils/reviewFixtures.ts) | 新規 | 指摘・回・区切り・ユーザーの仮データ |
| [`src/features/design-review/api/__tests__/reviewApi.test.ts`](../samples/frontend/src/features/design-review/api/__tests__/reviewApi.test.ts) | 新規 | URL・メソッド・本文 |
| [`src/features/design-review/__tests__/model.test.ts`](../samples/frontend/src/features/design-review/__tests__/model.test.ts) | 新規 | 純粋関数 |
| [`src/features/design-review/__tests__/review-store.test.ts`](../samples/frontend/src/features/design-review/__tests__/review-store.test.ts) | 新規 | ストアの操作 |

## 要点の抜粋

### 1. ユーザーはこの機能で読む

devex-ui は今まで `/users/me` を読んでいなかった(認証のストアはトークンだけ)。レビューの出し分けにしか使わないので、`auth-store` を広げずに、この機能の API・ストアで読む。出し分けはサーバーの実効値 `review_effective` で行う(保存値 `review_enabled` はスイッチの表示だけ)。

```ts
// src/features/design-review/api/reviewApi.ts
export type CurrentUserRead = {
  id: string;
  email: string;
  is_superuser: boolean;
  review_enabled: boolean;
  review_effective: boolean;
};
```

### 2. 純粋関数

```ts
// src/features/design-review/model.ts
export function actionLabel(status: GateStatus): string | null {
  if (status === "not_ready" || status === "running") return null;
  return status === "unreviewed" ? "レビューする" : "もう一度レビュー";
}

export function unreviewedNotice(gates: ReviewGateSummaryRead[]): string | null {
  const pending = gates.filter((g) => g.status === "unreviewed" || g.status === "failed").map((g) => GATE_LABEL[g.gate]);
  if (pending.length === 0) return null;
  return `未レビューの区切りがあります(${pending.join("・")})。このまま手順書を生成できます。`;
}
```

- `sortFindings` は重要度 → サーバーの並び(`position`)の順。
- `documentOfTarget` は対象の書き方から文書を推定する(`FR-`/`NFR-`/`CON-` → 要件定義書、`SCR-`・メソッド + パス → 外部設計書、`DF-`・「テーブル」→ 内部設計書、`M-` → 実装計画書)。推定できなければ null(プレビューで飛べない)。

### 3. ストア

```ts
// src/features/design-review/review-store.ts
runReview: async (projectId, gate) => {
  set({ requesting: gate, actionError: null });
  try {
    await requestReview(projectId, gate);
    set({ requesting: null });
    await get().fetchGates(projectId, { force: true });
    return true;
  } catch (err) {
    set({ requesting: null, actionError: messageOf(err, "レビューを始められませんでした") });
    return false;
  }
},
```

- 区切りは `documents-store` と同じく `projectId`・`fetchedAt`(TTL)を持ち、別のプロジェクトに移ったら捨てる。
- 失敗の文はサーバーの `detail`(日本語)をそのまま出す(403・409・429・502 の文はサービスが書いている)。
- 採否は返った指摘で、区切りの中の同じ指摘を置き換える(取り直さない)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `reviewApi` の各関数 | vitest(`reviewApi.test.ts`) | `stubFetch`(fetch を差し替え、送ったリクエストを記録)── HTTP を呼ぶので通信を偽物にする | `/users/me`・`PUT review-settings` の本文・`/reviews`・`POST /reviews/stage6`・`PUT /reviews/findings/f1` の本文 |
| `model.ts` の純粋関数 | vitest(`model.test.ts`) | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため | 重要度と `position` の順・採否の件数・押せる操作・モードの文書・知らせ(実行中・そろっていないは数えない)・対象 → 文書 |
| `useReviewStore` | vitest(`review-store.test.ts`。`getState()` で直接呼ぶ) | `stubFetch`(応答を積む) | TTL の内は取り直さない・プロジェクトを替えると捨てる・受け付けたら取り直す・429 の文・採否の置き換え・ユーザーと設定 |

```sh
cd devex-ui && npx vitest run src/features/design-review/api src/features/design-review/__tests__
```

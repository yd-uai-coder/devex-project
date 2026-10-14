# Phase-53-4: レビューのパネルと、対象へ飛ぶ仕組み

## この章の目的

プレビュー(SCR-005)と作業領域(SCR-008)に、共通の「AI 設計レビュー」のパネルを置く。superuser にだけ出し、見出しで本人がオン・オフを切り替える。オンなら区切りの表(状態・レビューする / もう一度レビュー)と、区切りごとの指摘の表(重要度の順・採用 / 却下 / 保留)を出す。指摘の対象からは、作業領域では段階の表の行へ、プレビューでは文書のタブへ移れる。

自動実装モード: on([introduction](./Phase-53-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-ui/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/features/design-review/model.ts`](../samples/frontend/src/features/design-review/model.ts) | 更新 | `TargetAction`・`TargetActionOf`(対象から飛ぶ操作の型) |
| [`src/features/detailed-design/impactOps.ts`](../samples/frontend/src/features/detailed-design/impactOps.ts) | 更新 | `locateTargetStage`(対象 → 段階) |
| [`src/features/design-review/components/FindingTable.tsx`](../samples/frontend/src/features/design-review/components/FindingTable.tsx) | 新規 | 区切り1つ分の指摘の表(対象のボタン・採否) |
| [`src/features/design-review/components/ReviewPanel.tsx`](../samples/frontend/src/features/design-review/components/ReviewPanel.tsx) | 新規 | パネル(スイッチ・区切りの表・指摘の表・取り直し) |
| [`src/features/documents/components/DocumentTabs.tsx`](../samples/frontend/src/features/documents/components/DocumentTabs.tsx) | 更新 | 選んでいる文書を親が持てるようにする |
| [`src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | パネル(文書の区切りだけ)を置き、対象からタブを切り替える |
| [`src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | パネルを置き、対象から `jumpTo` で段階へ移る |
| ── ここからテスト ── | | |
| [`src/features/design-review/components/__tests__/ReviewPanel.test.tsx`](../samples/frontend/src/features/design-review/components/__tests__/ReviewPanel.test.tsx) | 新規 | パネル(`FindingTable` を含む) |
| [`src/features/detailed-design/__tests__/impactOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/impactOps.test.ts) | 更新 | `locateTargetStage` |
| [`src/features/documents/components/__tests__/DocumentTabs.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentTabs.test.tsx) | 更新 | 親が持つタブ |
| [`src/features/documents/components/__tests__/DocumentsPageContent.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx) | 更新 | パネルに渡すもの・タブの切り替え |
| [`src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | パネルと `jumpTo`(レビューのストアを偽物にする) |

## 要点の抜粋

### 1. パネルは画面の事情を知らない

```tsx
// src/features/design-review/components/ReviewPanel.tsx
export function ReviewPanel({ projectId, gates: only, targetAction, refreshKey }: {
  projectId: string;
  gates?: ReviewGate[];            // 出す区切り(プレビューは ["documents"])
  targetAction?: TargetActionOf;   // 対象 → 押したときの操作(飛べなければ null)
  refreshKey?: string;             // 文書・段階の版。変わったら取り直す
}) {
```

パネルは「対象からどこへ飛ぶか」を画面から受け取るので、段階の表もタブも知らない。作業領域は段階、プレビューは文書のタブ。`FindingTable` は押せる対象をボタン、押せない対象を文字で出す。

### 2. 作業領域: 対象 → 段階(`locateTargetStage`)

```ts
// src/features/detailed-design/impactOps.ts
export function locateTargetStage(text: string, stages: DesignStageRead[]): number | null {
  const has = (stage: number) => stages.some((s) => s.stage === stage && s.model !== null);
  if (/F-\d+#\d+/.test(text) && has(5)) return 5;
  return [7, 4, 3, 6, 1].find((stage) => has(stage) && resolveFixTarget(stage, text, stages) !== null) ?? null;
}
```

既存の `resolveFixTarget`(「段階Nで直す」の文字から行のキーを推定。Phase 44)を、段階を決めるのに使い回す。手順 ID は段階5、それ以外は単位・横断事項 → モジュール → テーブル → 関数 → 処理の順(処理 ID は段階1・2・5 に当たるので、最後の段階1 で受ける)。決めた段階と文字を `jumpTo(stage, target)` に渡すと、ストアが段階を開き、行を強調する。

### 3. プレビュー: 対象 → タブ

```tsx
// src/features/documents/components/DocumentsPageContent.tsx
const targetAction: TargetActionOf = (target) => {
  const type = documentOfTarget(target);
  if (type === null || !documents.some((doc) => doc.doc_type === type)) return null;
  return { label: "この文書を開く", onPress: () => setActiveType(type) };
};
```

`DocumentTabs` は `onActiveTypeChange` を渡されたときだけ、選んでいる文書を親に任せる(渡さなければ今までどおり自分で持つ)。

### 4. 取り直し

- 実行中の区切りがあれば 5 秒ごとに取り直す(生成のポーリングと同じ `useInterval`)。
- `refreshKey`(プレビューは文書の種類と版、作業領域は段階の状態と承認した版)が変わったら、3回取り直す。生成を「完了」にしてから自動のレビューを受け付けるので、完了の直後は回がまだ無く、実行中が見えないことがあるため。

### 5. 出し分け

| ユーザー | パネル |
|---|---|
| superuser でない | 出さない(今の自己診断のまま) |
| superuser・オフ | 見出しとスイッチと「オフ(生成の後は、今の自己診断をチャットに出します)」 |
| superuser・オン | 区切りの表・区切りごとの指摘の表(採否の件数、古い版のレビューなら注記) |

採否のボタンは押し直すと未判断に戻す。区切りのボタンは、どこかが実行中・受け付けを待っている間は押せない(サーバーも実行中は409)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ReviewPanel`(`FindingTable` を含む) | render と操作(`ReviewPanel.test.tsx`) | レビューのストアの `fetchMe`・`fetchGates`・`setReviewEnabled`・`runReview`・`decide`(API を呼ばず、呼ばれ方を確かめる) | 一般ユーザーは出ない・オフは切り替えだけで区切りを取らない・状態の文と押せる操作・重要度の順と採否(押し直すと未判断)・飛べる対象だけボタン・観点のキー・古い版の注記・区切りの絞り込み・失敗の文 |
| `locateTargetStage` | vitest(`impactOps.test.ts`) | スタブ不要 ── 対象が純粋で外部依存を呼ばないため | 単位・モジュール・テーブル・関数・処理・手順 ID・画面(null)・内容の無い段階には飛ばない |
| `DocumentTabs`(親が持つとき) | render と操作 | スタブ不要 ── 親のコールバックは `vi.fn` で受けるだけ | 親の文書を出し、切り替えを親へ伝える |
| `DocumentsPageContent` | render(`DocumentsPageContent.test.tsx`) | `DocumentTabs`・`ReviewPanel` を props を記録する偽物にする | パネルに文書の区切りと版のキーを渡す・推定できない / 無い文書は押せない・対象からタブが切り替わる |
| `DetailedDesignPageContent` | render と操作 | 段階のストアの `jumpTo`、レビューのストアの `fetchMe`・`fetchGates`(既存のテストもユーザー無しにして API を呼ばない) | 区切りを取る・対象 F-01 で `jumpTo(1, "F-01")`・画面の ID は押せない |

```sh
cd devex-ui && npx vitest run src/features/design-review/components src/features/detailed-design/__tests__/impactOps.test.ts src/features/documents/components src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx
```

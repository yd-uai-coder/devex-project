# Phase-109-2: 起点の処理と束の入れた CR

## この章の目的

Phase 106-5 の API の変更を画面に通す。新しい要件を足す CR の予測の起点に、段階1 の処理(画面にも API にも出ないバッチ・内部の処理)を選べるようにする。束(合意済みの版)の「入れた CR」は、CR の一覧の `included_baseline_number` から引いていた(Phase 88)のを、束の応答の `included_change_requests` から出すようにし、束の中身のページは CR の一覧を読まない(着手時の相談 (3))。

自動実装モード: on([introduction](./Phase-109-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/baselines/api/types.ts`](../samples/frontend/src/features/baselines/api/types.ts) | 更新 | `OriginKind` に `function`・`BaselineChangeRequestRead`・`included_change_requests` |
| [`src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | `ORIGIN_KIND_LABEL.function`・`changeRequestLabel` |
| [`src/features/change-requests/components/ChangeRequestForm.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestForm.tsx) | 更新 | 起点の案内文に「処理」 |
| [`src/features/baselines/baselineOps.ts`](../samples/frontend/src/features/baselines/baselineOps.ts) | 更新 | `includedChangeRequests` を削除 |
| [`src/features/baselines/components/BaselineList.tsx`](../samples/frontend/src/features/baselines/components/BaselineList.tsx) | 更新 | 入れた CR を束の応答から。`changeRequests` の prop を外す |
| [`src/features/baselines/components/BaselinesPageContent.tsx`](../samples/frontend/src/features/baselines/components/BaselinesPageContent.tsx) | 更新 | 一覧に CR を渡さない。空の CR の一覧を定数に |
| [`src/features/baselines/components/BaselineDetailContent.tsx`](../samples/frontend/src/features/baselines/components/BaselineDetailContent.tsx) | 更新 | 入れた CR を束の応答から。CR の一覧の読み込みと状態の印を外す |
| [`src/features/baselines/test-utils/baselineFixtures.ts`](../samples/frontend/src/features/baselines/test-utils/baselineFixtures.ts) | 更新 | `included_change_requests: []` |
| [`src/features/baselines/__tests__/baselineOps.test.ts`](../samples/frontend/src/features/baselines/__tests__/baselineOps.test.ts) | 更新 | 消した関数の確かめを外す |
| [`src/features/change-requests/__tests__/changeRequestOps.test.ts`](../samples/frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts) | 更新 | 「処理」の表示名・`changeRequestLabel` |
| [`src/features/change-requests/components/__tests__/ChangeRequestForm.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestForm.test.tsx) | 更新 | 処理を起点に選べる |
| [`src/features/baselines/components/__tests__/BaselinesPageContent.test.tsx`](../samples/frontend/src/features/baselines/components/__tests__/BaselinesPageContent.test.tsx) | 更新 | 入れた CR を束の応答から |
| [`src/features/baselines/components/__tests__/BaselineDetailContent.test.tsx`](../samples/frontend/src/features/baselines/components/__tests__/BaselineDetailContent.test.tsx) | 更新 | CR の一覧を読まない・入れた CR の題 |

## 1. 起点の処理

```ts
// src/features/baselines/api/types.ts(抜粋)
export type OriginKind = "requirement" | "screen" | "api" | "function";

// src/features/change-requests/changeRequestOps.ts(抜粋)
export const ORIGIN_KIND_LABEL: Record<OriginKind, string> = { requirement: "要件", screen: "画面", api: "API", function: "処理" };
```

- 候補は今までどおり `GET .../baselines/{n}/origins` が決める(キーは `fn:F-07`、表示名は `F-07 毎朝の集計`)。処理が候補に出るのは束に段階1 が入っているときだけ(API の規則)。画面は選択の文を `処理: F-07 毎朝の集計` と出すだけで、新しい入口は増えない。
- 起点の案内文を「既存の要件・画面・API・処理」にした。

## 2. 束の入れた CR

```ts
// src/features/baselines/api/types.ts(抜粋)
export type BaselineChangeRequestRead = { number: number; title: string };
type BaselineRecordRead = { …; included_change_requests: BaselineChangeRequestRead[] };

// src/features/change-requests/changeRequestOps.ts(抜粋)
export function changeRequestLabel(number: number): string   // "CR-<番号>"(devex-api の label と同じ形)
```

- 束の一覧・中身とも `included_change_requests` を描く。応答は番号と題だけなので、表示名は `changeRequestLabel` で作る。
- 中身のページは CR の一覧を読まなくなった。状態の印も外した(束に入れられるのは検証済みの CR だけで、印は全部同じになるため)。
- 一覧のページは、作成のフォームの「入れられる CR」(検証済みで、まだ束に入れていない)のために、CR の一覧を読み続ける。`includedChangeRequests` は消した(使う所が無くなった)。
- **画面確認で直したもの**(#38): 一覧のページの `useChangeRequestsStore((s) => (s.projectId === projectId ? s.list : []))` は、別のプロジェクトの一覧を持っている間、選ぶたびに新しい配列を返し、React が「getSnapshot の結果がキャッシュされていない」と警告していた(この Phase より前からあった)。空の一覧をモジュールの定数 `NO_CHANGE_REQUESTS` にして直した。中身のページの同じ形の行は、この章で消えた。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `changeRequestOps.test.ts` | `ORIGIN_KIND_LABEL`・`changeRequestLabel` | vitest のテスト関数 | スタブ不要 ── 純粋なため |
| `ChangeRequestForm.test.tsx` | `ChangeRequestForm` | Testing Library | `onSubmit`(`vi.fn`)|
| `BaselinesPageContent.test.tsx`(`BaselineList` を通る) | ページ | Testing Library | 束と CR のストアの取得の関数 |
| `BaselineDetailContent.test.tsx` | 中身のページ | Testing Library | 束のストアの取得の関数・router |
| `baselineOps.test.ts` | 純粋関数 | vitest のテスト関数 | スタブ不要 |

- 統合スモーク: 束の一覧・中身の既存のテスト。
- 処理を起点に選ぶと `処理: …` と出る。
- 一覧の「入れた CR」は束の応答の番号から CR の詳細へリンクする。
- 中身のページは CR の一覧を読まず、入れた CR の番号(リンク)と題を出す。

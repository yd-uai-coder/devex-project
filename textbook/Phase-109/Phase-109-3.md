# Phase-109-3: 確認事項の「CR-n で変わった」

## この章の目的

Phase 106-2 で、CR の反映で文が変わった要件の確認事項を、確認済みから未確認に戻し、どの CR で戻したかを `changed_by_change_request_number` に残すようにした。この章で、確認事項の表にそれを出し、その CR へ移れるようにする(着手時の相談 (4))。確認済みにしていた要件が、知らないうちに未確認に戻っているように見えないようにするため。

自動実装モード: on([introduction](./Phase-109-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/confirmations/api/types.ts`](../samples/frontend/src/features/confirmations/api/types.ts) | 更新 | `changed_by_change_request_number` |
| [`src/features/confirmations/confirmationOps.ts`](../samples/frontend/src/features/confirmations/confirmationOps.ts) | 更新 | `changedByLabel` |
| [`src/features/confirmations/components/ConfirmationTable.tsx`](../samples/frontend/src/features/confirmations/components/ConfirmationTable.tsx) | 更新 | 状態の文の下の段に CR へのリンク |
| [`src/features/confirmations/test-utils/confirmationFixtures.ts`](../samples/frontend/src/features/confirmations/test-utils/confirmationFixtures.ts) | 更新 | `changed_by_change_request_number: null` |
| [`src/features/confirmations/__tests__/confirmationOps.test.ts`](../samples/frontend/src/features/confirmations/__tests__/confirmationOps.test.ts) | 更新 | `changedByLabel` |
| [`src/features/confirmations/components/__tests__/ConfirmationsPageContent.test.tsx`](../samples/frontend/src/features/confirmations/components/__tests__/ConfirmationsPageContent.test.tsx) | 更新 | 表のリンク |

## 1. 見た目

```
| 状態                             |
| 未確認                           |
| CR-3 の反映で文が変わりました →     |   ← CR-3 の詳細へ
| [確認済みにする] [却下]            |
```

- 今の「変えるときは変更要求(CR)で →」と同じ2段の形(状態の文の下に小さく、ブロックで)。
- 出すのは API が値を返す間だけ(利用者が状態を決め直すと、API が消す)。画面は値をそのまま読み、消す操作は持たない。

## 2. 純粋関数

```ts
// src/features/confirmations/confirmationOps.ts(抜粋)
export function changedByLabel(item: ConfirmationItemRead): string | null   // "CR-3 の反映で文が変わりました"
```

- CR の表示名は 109-2 の `changeRequestLabel`、リンク先は既存の `changeRequestHref` を使う(同じ事実。#17)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `confirmationOps.test.ts` | `changedByLabel` | vitest のテスト関数 | スタブ不要 ── 純粋なため |
| `ConfirmationsPageContent.test.tsx` の `ConfirmationTable` | 表 | Testing Library | `onUpdate`(`vi.fn`)── 表の描き方だけを見るため |

- 統合スモーク: 確認事項のページの既存のテスト。
- 値が無ければ文を作らない。あれば `CR-n の反映で文が変わりました`。
- 表では値のある行だけにリンクが出て、CR の詳細へ移る。状態の文の下の段(ブロック)に出る。

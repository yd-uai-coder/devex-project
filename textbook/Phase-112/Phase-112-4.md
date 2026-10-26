# Phase-112-4: 重なる CR の競合のガード(画面)

## この章の目的

[112-3](./Phase-112-3.md) の競合を、CR の詳細の見出しの下に知らせ、「今の文と見比べて確かめた」で印を付けられるようにする。未確認のうちは文書への反映のボタンを押せなくし、説明済み・合意の確かめのダイアログには知らせの1行を出す(止めない)。共有リンクの画面(クライアント)には出さない(着手時の決定4)。

自動実装モード: on([introduction](./Phase-112-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/change-requests/api/types.ts`](../samples/frontend/src/features/change-requests/api/types.ts) | 更新 | `ChangeRequestConflictRead`・CR の詳細の `conflicts` |
| [`src/features/change-requests/api/changeRequestsApi.ts`](../samples/frontend/src/features/change-requests/api/changeRequestsApi.ts) | 更新 | `checkChangeRequestConflicts` |
| [`src/features/change-requests/change-requests-store.ts`](../samples/frontend/src/features/change-requests/change-requests-store.ts) | 更新 | `checkConflicts`(状態の操作と同じ流れで詳細を置き換える) |
| [`src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | `uncheckedConflicts`・`conflictNoticeLine` |
| [`src/features/change-requests/components/ConflictNotice.tsx`](../samples/frontend/src/features/change-requests/components/ConflictNotice.tsx) | 新規 | 競合の知らせと確かめのボタン |
| [`src/features/change-requests/components/DecisionDialog.tsx`](../samples/frontend/src/features/change-requests/components/DecisionDialog.tsx) | 更新 | `notice`(説明の下の知らせ) |
| [`src/features/change-requests/components/ChangeRequestActions.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestActions.tsx) | 更新 | 説明済み・合意の確かめに知らせの1行 |
| [`src/features/change-requests/components/ImpactTab.tsx`](../samples/frontend/src/features/change-requests/components/ImpactTab.tsx) | 更新 | 未確認なら反映のボタンを押せず、理由を出す |
| [`src/features/change-requests/components/ContentTab.tsx`](../samples/frontend/src/features/change-requests/components/ContentTab.tsx) | 更新 | 重なりの下に知らせへの案内 |
| [`src/features/change-requests/components/ChangeRequestDetailContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx) | 更新 | 操作の下に `ConflictNotice` |
| [`src/features/change-requests/test-utils/changeRequestFixtures.ts`](../samples/frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts) | 更新 | `makeChangeRequest` の `conflicts`・`makeConflict` |
| [`src/features/change-requests/test-utils/renderWithStore.tsx`](../samples/frontend/src/features/change-requests/test-utils/renderWithStore.tsx) | 更新 | ストアの `checkConflicts` の `vi.fn` |
| [`src/features/change-requests/__tests__/changeRequestOps.test.ts`](../samples/frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts) | 更新 | 未確認の数え方と知らせの1行 |
| [`src/features/change-requests/__tests__/change-requests-store.test.ts`](../samples/frontend/src/features/change-requests/__tests__/change-requests-store.test.ts) | 更新 | `checkConflicts` の POST と詳細 |
| [`src/features/change-requests/components/__tests__/ConflictNotice.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ConflictNotice.test.tsx) | 新規 | 出し分け・表・リンク・ボタン |
| [`src/features/change-requests/components/__tests__/ChangeRequestActions.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestActions.test.tsx) | 更新 | ダイアログの知らせ |
| [`src/features/change-requests/components/__tests__/ImpactTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ImpactTab.test.tsx) | 更新 | 反映のボタンの止め |
| [`src/features/change-requests/components/__tests__/ChangeRequestDetailContent.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestDetailContent.test.tsx) | 更新 | 知らせの置き場 |
| [`src/features/change-requests/components/__tests__/ContentTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ContentTab.test.tsx) | 更新 | 重なりの下の案内 |

## 1. 見た目

```
CR-3 予約の期間を1週間までにする  [下書き]
[説明済みにする] [取り下げる] 説明書をダウンロード(.md)
┌ 先にほかの CR が変えた対象の要件 ────────────────────────────── (未確認のうちは橙の枠)
│ この CR の案は、基準の束(B-1)の文をもとにしています。束の後に、次の要件がほかの CR の反映で
│ 変わりました。案が先の変更を消さないか、今の文と見比べてください。文書への反映は、見比べて確かめるまでできません。
│ | 要件 | 先に変えた CR | 束(B-1)の文 | 今の文 | 確かめ |
│ | FR-001 | CR-2 | [E2E Fake] 備品を予約できる | 備品を予約でき、管理者が承認する | 未確認 |
│ [今の文と見比べて確かめた]
└──────────────────────────────────────────────
内容 | 影響 | …
```

- 先に変えた CR のリンクは、その CR の影響のタブの「反映で変わった所」のその要件の行へ([112-2](./Phase-112-2.md) の URL)。何がどう変わったかを、そのまま見比べられる。
- 確かめ済みになると、枠を通常の色にし、ボタンと「反映できません」の文を消す(表は残す)。後でさらに変わると、API が未確認に戻すので、また出る。
- 置き場はタブの外(見出しの下)。どのタブを開いていても見え、反映のボタン(影響のタブ)・説明済み / 合意(見出し)のどちらからも近い。

## 2. 止め方と知らせ方

```ts
// src/features/change-requests/changeRequestOps.ts(抜粋)
export function uncheckedConflicts(cr: Pick<ChangeRequestRead, "conflicts">): ChangeRequestConflictRead[]
export function conflictNoticeLine(cr): string | null
// 「対象の要件が、基準の束の後にほかの CR の反映で変わっています: FR-005(CR-2 が先に変えた)。…」
```

- **反映**: 影響のタブの「文書へ反映する」は、未確認の競合があれば押せず、「見出しの下の知らせで、今の文と見比べて確かめてから反映してください」を出す。API も 409 なので、古い画面から押しても反映はされない(ストアの今までの失敗の文で出る)。
- **説明済み・合意**: 止めない(着手時の相談・111-3 の決定2。作成を止めない Phase 82 の決定と同じ考え)。説明済みにする確かめのダイアログと、合意の記録のダイアログ(`DecisionDialog` の `notice`)に知らせの1行を出す。
- 内容のタブの「同じ要件を対象にする、進行中の変更要求」の下に、先に反映された CR があると見出しの下に知らせが出ることを1行で案内する(重なりは反映の前の CR も含むので、競合とは別に残す)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `changeRequestOps.test.ts` の「重なる CR の競合」 | `uncheckedConflicts`・`conflictNoticeLine` | vitest のテスト関数 | スタブ不要 ── 純粋関数 |
| `change-requests-store.test.ts` に1本 | `checkConflicts` | テスト関数(ストアを直接呼ぶ) | fetch(`stubFetch`)── 送る URL・メソッドと、応答で詳細を置き換えることを見るため |
| `ConflictNotice.test.tsx`(新規) | `ConflictNotice` | Testing Library(描画・クリック) | ストアの関数(`vi.fn`)── 確かめのボタンが呼ぶ操作だけを見るため |
| `ChangeRequestActions.test.tsx` に1本 | `ChangeRequestActions`・`DecisionDialog` | Testing Library | ストアの操作の関数(`vi.fn`) |
| `ImpactTab.test.tsx` に1本 | `ImpactTab` | Testing Library | ストアの関数(`vi.fn`) |
| `ChangeRequestDetailContent.test.tsx` を直した | `ChangeRequestDetailContent` | Testing Library | `ConflictNotice` ほか(`vi.mock`)── 置き場だけを見るため |
| `ContentTab.test.tsx` の1本に足した | `ContentTab` | Testing Library | ストアの関数(`vi.fn`) |

- 統合スモーク: 既存の詳細・操作・影響のタブのテスト(`conflicts` が空なら今までどおり)。
- 競合が無ければ何も出さない・要件ごとの表と先に変えた CR のリンク・消えた要件は「(消えています)」・確かめると `checkConflicts`・確かめ済みならボタンと止めの文が消える・未確認なら反映のボタンは `aria-disabled`・説明済み / 合意のダイアログに知らせが出て、記録はできる。

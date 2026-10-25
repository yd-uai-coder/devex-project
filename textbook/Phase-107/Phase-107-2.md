# Phase-107-2: 選択肢の表示・編集と、案を選ぶ合意

## この章の目的

Phase 102 の選択肢(案)を、内容タブの「選択肢」の節に出し、開発者が書けるようにする。案ごとに名前・この案で変える要件(CR の対象から選び、種類と変更後の案)・結果を書き、おすすめの案と理由を選ぶ。編集は案だけの欄で、保存は案だけを送る(着手時の相談 (3))。あわせて、案のある CR の合意で案を選べるようにする(今の合意のダイアログは `option` を送らず、案のある CR は画面から合意できなかった)。合意の記録には、選んだ案と出どころ(Phase 104)も出す。

自動実装モード: on([introduction](./Phase-107-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/change-requests/api/types.ts`](../samples/frontend/src/features/change-requests/api/types.ts) | 更新 | `ChangeRequestOptionIn`・`ChangeRequestOptionsIn`・`ChangeRequestOptionRead`・`ChangeRequestOptionsRead`。CR に `options`、合意の記録に `option`・`source`・`source_label`・`fingerprint`、合意の本文に `option` |
| [`src/features/change-requests/api/changeRequestsApi.ts`](../samples/frontend/src/features/change-requests/api/changeRequestsApi.ts) | 更新 | `updateChangeRequestOptions`(`PATCH` で `{options}` だけ) |
| [`src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | 案のフォームの変換・足す・消す・対象の入り切り・確かめ・送る本文、`decidedOptionLabel` |
| [`src/features/change-requests/change-requests-store.ts`](../samples/frontend/src/features/change-requests/change-requests-store.ts) | 更新 | `updateOptions` |
| [`src/features/change-requests/components/OptionCards.tsx`](../samples/frontend/src/features/change-requests/components/OptionCards.tsx) | 新規 | 案のカード(107-3 の下書きでも使う) |
| [`src/features/change-requests/components/OptionsEditor.tsx`](../samples/frontend/src/features/change-requests/components/OptionsEditor.tsx) | 新規 | 案の編集欄 |
| [`src/features/change-requests/components/OptionsSection.tsx`](../samples/frontend/src/features/change-requests/components/OptionsSection.tsx) | 新規 | 選択肢の節(表示と編集の切り替え) |
| [`src/features/change-requests/components/ContentTab.tsx`](../samples/frontend/src/features/change-requests/components/ContentTab.tsx) | 更新 | 選択肢の節、合意の記録に選んだ案と出どころ |
| [`src/features/change-requests/components/DecisionDialog.tsx`](../samples/frontend/src/features/change-requests/components/DecisionDialog.tsx) | 更新 | 案のある CR の合意で案のラジオ(選ばないと記録しない) |
| [`src/features/change-requests/components/ChangeRequestActions.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestActions.tsx) | 更新 | ダイアログに CR の案を渡す |
| [`src/features/change-requests/test-utils/changeRequestFixtures.ts`](../samples/frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts) | 更新 | `makeOptions`。CR の既定に `options: null` |
| [`src/features/change-requests/test-utils/renderWithStore.tsx`](../samples/frontend/src/features/change-requests/test-utils/renderWithStore.tsx) | 更新 | `updateOptions` の `vi.fn` |
| [`src/features/change-requests/__tests__/changeRequestOps.test.ts`](../samples/frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts) | 更新 | 案の純粋関数 |
| [`src/features/change-requests/__tests__/change-requests-store.test.ts`](../samples/frontend/src/features/change-requests/__tests__/change-requests-store.test.ts) | 更新 | 案の保存 |
| [`src/features/change-requests/components/__tests__/OptionsEditor.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/OptionsEditor.test.tsx) | 新規 | 削除の案・おすすめ・3つまで |
| [`src/features/change-requests/components/__tests__/OptionsSection.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/OptionsSection.test.tsx) | 新規 | 表示・書く・全部消す |
| [`src/features/change-requests/components/__tests__/ChangeRequestActions.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestActions.test.tsx) | 更新 | 案を選ぶ合意・却下 |
| [`src/features/change-requests/components/__tests__/ContentTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ContentTab.test.tsx) | 更新 | 合意の記録の選んだ案・出どころ |
| [`src/features/baselines/__tests__/baselineOps.test.ts`](../samples/frontend/src/features/baselines/__tests__/baselineOps.test.ts) | 更新 | 合意の記録の固定値に新しい項目 |
| [`src/features/baselines/components/__tests__/BaselineCreateForm.test.tsx`](../samples/frontend/src/features/baselines/components/__tests__/BaselineCreateForm.test.tsx) | 更新 | 同上 |

## 1. 見た目

```
選択肢(案)  [案を直す]
おすすめは案1です。理由: 手間が小さい
┌ 案1 5件まで  おすすめ ──────────────┐   ← 合意の後は選んだ案に「合意した案」
│ FR-005 | 内容の変更 | 5件まで添付できる │
│ 結果: 上限の値だけを変える             │
└──────────────────────────────┘
┌ 案2 上限なし ─────────────────────┐
```

編集欄(「案を直す」「案を書く」で開く):

```
案1                                   [案1を消す]
名前 [5件まで          ]
この案で変える要件
 変える | 要件   | 変更の種類   | 変更後の案
  [x]   | FR-005 | [内容の変更▼] | [5件まで添付できる]
結果(手間・影響・トレードオフ) [                ]
[案を足す]  おすすめの案 [案1 5件まで ▼]  おすすめの理由 [ ]
[案を保存する(下書きに戻る)] [キャンセル]
```

- 案は CR の中身なので内容タブに置いた(相談 (2))。内容を直すフォームに入れず、案だけの欄にした(相談 (3))。フォームが長くなるのを避け、107-3 の下書きの取り込みと同じ節で扱うため。
- 変える要件は、CR の対象の行ごとにチェックを入れて選ぶ。入れると CR の対象の種類と変更後の案を写して始め、案ごとに直せる(Phase 102: 案ごとに対象の変更後の案が違ってよい)。新しい要件を足す印と予測の起点は、どの案にも共通なので欄を出さない。
- 「案を書く」を押した直後は案が0件なので、「案を2つ足す」で2つ並べる(案は0件か2〜3件)。3件で「案を足す」を消す。
- 案を全部消して保存すると、案の無い CR に戻る(`items` を空で送る)。

## 2. 案の純粋関数

```ts
// src/features/change-requests/changeRequestOps.ts(抜粋)
export type OptionForm = { name: string; targets: ChangeRequestTargetIn[]; outcome: string };
export type OptionsForm = { items: OptionForm[]; recommended: number | null; reason: string };
export function optionsFormFromCr(options: ChangeRequestOptionsRead | null): OptionsForm
export function addOption(form): OptionsForm                 // 初めは2つ、3つまで
export function removeOption(form, index): OptionsForm       // おすすめの番号を詰める
export function updateOption(form, index, patch): OptionsForm
export function toggleOptionTarget(option, target, on): OptionForm
export function optionsProblems(form, crTargets, addsRequirement): string[]
export function toOptionsBody(form): ChangeRequestOptionsIn
export function decidedOptionLabel(cr: ChangeRequestRead): string
```

- `optionsProblems` は devex-api の `normalize_options`・`option_target_problems`(`app/change_requests/options.py`)と同じ規則を、送る前に確かめる。案は2〜3件・名前と結果が要る・名前が重ならない・対象は CR の対象のうち・新しい要件を足す CR でなければ対象が1つ以上・おすすめを選んだら理由が要る・選ばずに理由は書けない。API の 422 も actionError で出す。
- 案が0件なら問題なしにする(おすすめの欄は消えるので、`toOptionsBody` が空の案・おすすめなしで送る)。
- `removeOption`: 消した案がおすすめならおすすめを外し、後ろの案がおすすめなら番号を1つ詰める。
- 案の対象の種類・変更後の案は、作成のフォームの `setTargetKind`・`setTargetProposal` をそのまま使う(削除にすると案を消す)。

## 3. 合意で案を選ぶ

- `DecisionDialog` に `options` を渡し、合意で案があればラジオを出す。初めは選ばず(おすすめは名前に「(おすすめ)」)、選ばずに記録を押すと「合意した案を選んでください」。開発者がクライアントの判断を書き写す場なので、おすすめを既定にすると、選び違いがそのまま記録に残るため(Claude の判断、計画で承認)。
- 案の欄は `<span role="radiogroup">` にした。確かめのダイアログの説明は `<p>` の中に描かれ、`<fieldset>` を入れると DOM の入れ子の誤りになるため(ブラウザで動かして見つけた)。
- 却下では案を聞かず、本文に `option` を入れない。
- 合意の後、内容タブの合意の記録に「選んだ案: 案1 名前」と「出どころ: 共有リンク / 開発者が記録」を出す(`decidedOptionLabel`。記録を足す前の判断は出どころが null なので出さない)。

## 4. ストア

- `updateOptions(projectId, number, options)`: `updateChangeRequestOptions` を状態の操作の共通の流れ(`act`)で呼び、詳細を置き換える(説明済みは下書きに戻り、予測・説明書も変わるので、タブの内容を捨てる)。
- `ChangeRequestUpdate`(内容を直すフォームの本文)には案を足していない。devex-api は `options` を送らなければ案を変えず、対象を変えたときだけ今の案を確かめ直す(合わなければ 422)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `changeRequestOps.test.ts`「選択肢(案)」 | 案の純粋関数・`decidedOptionLabel` | vitest のテスト関数 | スタブ不要 ── 渡した値だけから結果が決まるため |
| `change-requests-store.test.ts` | `updateOptions` | ストアの関数を直接呼ぶ | fetch(`stubFetch`)── `PATCH` の URL・本文と、詳細の置き換えを見るため |
| `OptionsEditor.test.tsx`(新規) | `OptionsEditor` | Testing Library(選択・入力) | 保存・キャンセルの関数(`vi.fn`)── 欄の操作から作る案の形だけを見るため |
| `OptionsSection.test.tsx`(新規) | `OptionsSection`(+ `OptionCards`・`OptionsEditor`) | Testing Library | ストアの関数(`vi.fn`)── 保存で送る本文と、編集欄の出し分けを見るため |
| `ChangeRequestActions.test.tsx` | `ChangeRequestActions`・`DecisionDialog` | Testing Library | ストアの関数(`vi.fn`)── 合意の本文の `option` を見るため |
| `ContentTab.test.tsx` | `ContentTab` | Testing Library | ストアの関数(`vi.fn`)|
| `baselineOps.test.ts`・`BaselineCreateForm.test.tsx` | (既存のテスト) | ― | 合意の記録の型に項目が増えたので、固定値を足した |

- 統合スモーク: 案の無い CR で「案を書く」→「案を2つ足す」→ 空のまま保存すると問題を出して送らない → 名前・対象・結果を書くと `{items: [...2件], recommended: null, reason: ""}` を送る。
- 案ごとにおすすめ・合意した案の印が出る。直せない状態ではボタンを出さない。
- 説明済みの CR は「案を保存する(下書きに戻る)」。全部消すと空の案で送る。
- 案の種類を削除にすると変更後の案の欄が消える。3件で「案を足す」が消える。
- 案のある CR の合意は、案を選ばないと記録せず、選んだ番号を送る。却下では案を聞かない。

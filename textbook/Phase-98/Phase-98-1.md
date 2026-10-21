# Phase-98-1: 確認事項の一覧のページ

## この章の目的

Phase 94 の確認事項の一覧の API(推測の要件・推測の利用者・根拠が未決の観点。決める機会・状態・メモ・推測の採用率)を、画面に出す。置き場は別のページ `/projects/{id}/confirmations`(SCR-011)にし、プレビュー(SCR-005)・詳細設計画面(SCR-008)・合意済みの版と CR の一覧の見出し、SCR-005 の推測の要件の枠からリンクする(着手時の相談 (2))。推測の要件・利用者を確認済みにするときだけ確認のダイアログを挟み(相談 (3))、一覧から消えた項目は末尾に畳む(相談 (4))。

自動実装モード: on([introduction](./Phase-98-introduction.md) 参照)。

## この章で作成・更新したファイル

`src/features/confirmations/` を新しく作った(Phase 97 の `agreements` と同じく、ストアを持たない feature)。

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/confirmations/api/types.ts`](../samples/frontend/src/features/confirmations/api/types.ts) | 新規 | 一覧・採用率・更新の型(devex-api `app/schemas/confirmation.py` に対応) |
| [`src/features/confirmations/api/confirmationsApi.ts`](../samples/frontend/src/features/confirmations/api/confirmationsApi.ts) | 新規 | `listConfirmations`・`updateConfirmation` |
| [`src/features/confirmations/confirmationOps.ts`](../samples/frontend/src/features/confirmations/confirmationOps.ts) | 新規 | 絞り込み・分け方・採用率の文・確認のダイアログの要否(純粋関数) |
| [`src/features/confirmations/components/ConfirmationTable.tsx`](../samples/frontend/src/features/confirmations/components/ConfirmationTable.tsx) | 新規 | 行ごとの決める機会・状態・メモの表 |
| [`src/features/change-requests/components/DetailedModeOnlyNotice.tsx`](../samples/frontend/src/features/change-requests/components/DetailedModeOnlyNotice.tsx) | 更新 | 「〜は、詳細設計モードだけ」の主語を `what` で言い換える |
| [`src/features/confirmations/components/ConfirmationsPageContent.tsx`](../samples/frontend/src/features/confirmations/components/ConfirmationsPageContent.tsx) | 新規 | ページの本体(読み込み・件数・絞り込み・ダイアログ・畳む節) |
| [`src/app/projects/[id]/confirmations/page.tsx`](../samples/frontend/src/app/projects/[id]/confirmations/page.tsx) | 新規 | ページ(params の解決と `RequireAuth`) |
| [`src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | 見出しに「確認事項」(詳細設計モードだけ) |
| [`src/features/documents/components/RequirementsSummaryPanel.tsx`](../samples/frontend/src/features/documents/components/RequirementsSummaryPanel.tsx) | 更新 | 推測の要件の件数つきのリンク(詳細設計モードだけ) |
| [`src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 見出しに「確認事項 →」(詳細設計モードだけ) |
| [`src/features/baselines/components/BaselinesPageContent.tsx`](../samples/frontend/src/features/baselines/components/BaselinesPageContent.tsx) | 更新 | 見出しに「確認事項」 |
| [`src/features/change-requests/components/ChangeRequestsPageContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestsPageContent.tsx) | 更新 | 見出しに「確認事項」 |
| [`src/features/confirmations/test-utils/confirmationFixtures.ts`](../samples/frontend/src/features/confirmations/test-utils/confirmationFixtures.ts) | 新規 | テストの応答(`makeItem`・`makeList`) |
| [`src/features/confirmations/__tests__/confirmationOps.test.ts`](../samples/frontend/src/features/confirmations/__tests__/confirmationOps.test.ts) | 新規 | 純粋関数 |
| [`src/features/confirmations/api/__tests__/confirmationsApi.test.ts`](../samples/frontend/src/features/confirmations/api/__tests__/confirmationsApi.test.ts) | 新規 | URL・キーの符号化・本文 |
| [`src/features/confirmations/components/__tests__/ConfirmationsPageContent.test.tsx`](../samples/frontend/src/features/confirmations/components/__tests__/ConfirmationsPageContent.test.tsx) | 新規 | ページと表 |
| [`src/app/projects/[id]/confirmations/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/confirmations/__tests__/page.test.tsx) | 新規 | params の受け渡し |
| [`src/features/documents/components/__tests__/DocumentsPageContent.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx) | 更新 | リンクの出し分け |
| [`src/features/documents/components/__tests__/RequirementsSummaryPanel.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/RequirementsSummaryPanel.test.tsx) | 更新 | 件数つきのリンクの出し分け |
| [`src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | リンク |
| [`src/features/baselines/components/__tests__/BaselinesPageContent.test.tsx`](../samples/frontend/src/features/baselines/components/__tests__/BaselinesPageContent.test.tsx) | 更新 | リンク |
| [`src/features/change-requests/components/__tests__/ChangeRequestsPageContent.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestsPageContent.test.tsx) | 更新 | リンク |

samples の `src/app/projects/...` は、本体の `src/app/(pages)/(protected)/projects/...` にあたる(route group の違いは `samples_check.py` が吸収する)。

## 1. 置き場と見た目

```
確認事項                         ← ドキュメント  詳細設計  変更要求(CR)  合意済みの版
AI が推測した要件・利用者と、要件の根拠でまだ決まっていない観点です。…
未確認: 推測の要件 12 / 推測の利用者 2 / 未決の観点 6
推測の採用率: ─(確認済み 0 / 却下 0・未確認 14)
種類 [すべて ▼]  状態 [未確認 ▼]
┌────────┬──────────────────┬──────────┬─────────────────┬────────┐
│種類    │項目              │決める機会│状態             │メモ    │
│推測の要件│FR-004 通知…     │[未設定 ▼]│未確認           │メモを書く│
│        │                  │          │[確認済みにする][却下]│     │
│未決の観点│規模             │[メール ▼]│未確認 …         │        │
│        │関わる要件: FR-002, 1.2 │    │                 │        │
└────────┴──────────────────┴──────────┴─────────────────┴────────┘
▸ 一覧から消えた項目(決めた記録) 1件
```

- 別のページにしたのは、要件定義書のタブにはすでに「要件の出どころ」と「合意の状態」(Phase 97)の2つの枠が並び、3つ目を足すと md の本文がさらに下へ押されるためである(相談 (2)。画面のイメージで比べた)。CR の一覧のタブにする案は、確認事項が CR を通らない(採用・却下は文書を直接変える / 変えない)ので採らなかった。
- 画面一覧では SCR-011 とした([`docs/external_design.md`](../../docs/external_design.md) の画面一覧と 2.15節)。
- リンクは、SCR-005・SCR-008・合意済みの版・CR の一覧の見出しと、SCR-005 の推測の要件の枠の下(「推測の要件 n件の決める機会・状態を、確認事項の一覧で決める →」)。SCR-005・SCR-008 は詳細設計モードのときだけ出す(合意済みの版・CR のページは、もともと詳細設計モードだけ)。推測の要件の枠の「採用にする」はそのまま残す(その場で確かめたいときの近道)。
- 簡易ドキュメントモードで URL を直に開くと、API が 409 `DESIGN_STAGES_NOT_AVAILABLE` を返すので、本体の代わりに `DetailedModeOnlyNotice` を出す。主語を `what` で「確認事項の一覧」に言い換えられるようにした(既定は今までの「変更要求と合意済みの版」)。

## 2. 表示の文と判断(純粋関数)

```ts
// src/features/confirmations/confirmationOps.ts(抜粋)
export const DEFAULT_FILTER: ConfirmationFilter = { kind: "all", status: "unconfirmed" };
export function splitByPresence(items): { present; gone }      // 今の一覧 / 一覧から消えた項目
export function filterItems(items, filter): ConfirmationItemRead[]
export function unconfirmedCountsText(items): string             // 推測の要件 n / 推測の利用者 n / 未決の観点 n
export function adoptionText(adoption: AdoptionRead): string     // 推測の採用率: 75%(確認済み 3 / 却下 1・未確認 5)
export function needsAdoptConfirm(item, status): boolean
```

- 絞り込みの既定は未確認だけ(決めることが残っている項目から見る)。種類・状態の名前は画面の選択肢に要るので、サーバーの `status_label` とは別にここにも持つ(表の行の状態はサーバーの `status_label` を出す)。
- 採用率の分母(確認済み + 却下)が0なら「─」(サーバーの `rate: null`)。
- `needsAdoptConfirm`: 推測の要件・推測の利用者を、今の一覧にあり、まだ確認済みでない状態から確認済みにするときだけ真。このとき devex-api は行を採用にして合意を記録する(Phase 94。利用者は 1.2 全体)。合意の記録は追記型で取り消せず、要件定義書の出どころも変わるので、確認のダイアログを挟む(相談 (3))。観点の確認済み(観点の状態は観点の表で決めるので、ここでは印だけ)・却下(文書は変えない)・決める機会・メモはすぐ保存する。

## 3. ページと表(部品)

- `ConfirmationsPageContent` は開いたときに一覧を読み、ローカルの state に持つ(Phase 97 の枠と同じく、ほかの画面と共有しないのでストアを作らない)。保存(`PATCH`)の応答は作り直した一覧なので、それで丸ごと差し替える。採用して推測でなくなった行は今の一覧から消え、決めた記録の節へ移り、採用率も変わる。
- 保存中は、その行の状態に「保存中…」を出し、すべての行の操作を止める(同時に2つの保存を走らせない)。失敗は `role="alert"` で出す。
- `ConfirmationTable` は、今の一覧と決めた記録の両方を描く。決めた記録は `readOnly` で操作を出さない(一覧から消えた項目の状態を変えても、一覧には戻らないため)。
- 状態のボタンは「確認済みにする / 却下 / 未確認に戻す」から今の状態を除いたもの。メモは「メモを書く(直す)」で欄を開き、保存で送る。
- 観点の行には、その観点に頼っている要件の ID(`refs`。1.2 は `1.2`)を「関わる要件」として出す。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `confirmationOps.test.ts`(新規) | `splitByPresence`・`filterItems`・`unconfirmedCountsText`・`adoptionText`・`needsAdoptConfirm` | vitest のテスト関数 | スタブ不要 ── 渡した値だけから結果が決まり、外部依存を呼ばないため |
| `confirmationsApi.test.ts`(新規) | `listConfirmations`・`updateConfirmation` | vitest のテスト関数 | fetch(`stubFetch`)── 送った URL(キーの符号化)・メソッド・本文を確かめるため |
| `ConfirmationsPageContent.test.tsx`(新規) | `ConfirmationsPageContent`・`ConfirmationTable`(応答は `confirmationFixtures.ts`。`DetailedModeOnlyNotice` も 409 の経路で通る) | render・userEvent | fetch(`stubFetch`)── devex-api の一覧・更新の応答を積む |
| `page.test.tsx`(新規) | ページ(`page.tsx`) | ページ関数を呼んで描く | `ConfirmationsPageContent` を `vi.mock` で置き換える ── params の受け渡しと `RequireAuth` だけを見るため |
| 見出しのリンクのテスト(更新5本) | `DocumentsPageContent`・`RequirementsSummaryPanel`・`DetailedDesignPageContent`・`BaselinesPageContent`・`ChangeRequestsPageContent` | render | 既存のとおり(ストアの状態・関数の差し替え) |

- 統合スモーク: ページを開くと一覧を読み、未確認の件数・採用率・未確認の項目を出す。決めた記録は畳まれていて、開くと読むだけの表が出る。
- 種類で絞り込める。
- 推測の要件を確認済みにすると確認のダイアログが出て、まだ送らない。確かめると `PATCH .../confirmations/req%3AFR-004` に `{status: "confirmed"}` を送り、応答で一覧を差し替える。
- 観点の確認済み・決める機会はダイアログなしで送る。メモは欄を開いて保存で送る。
- 保存の失敗を出す。項目が無ければその旨を出す。409 は「確認事項の一覧は、詳細設計モードのプロジェクトだけで使えます」。
- 表: 今の状態のボタンを出さず、保存中は操作を止める。
- リンク: 詳細設計モードだけ見出しと推測の要件の枠に出る(簡易モードでは出ない)。

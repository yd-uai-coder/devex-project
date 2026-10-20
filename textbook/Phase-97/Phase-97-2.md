# Phase-97-2: プレビューの「合意の状態」の枠

## この章の目的

97-1 の状態の API と、Phase 95 の履歴の API を、ドキュメントプレビュー(SCR-005)に出す。要件定義書・外部設計書のタブで、md の上に「合意の状態」の枠を置き、行ごとの合意の印と出どころ(B-n / 採用にする / CR-n)、その版で合意の形に戻した要素、行の履歴を見せる(着手時の相談 (2))。CR を反映した版の戻しは「CR の予測に無い変更を戻した」と言い分ける(相談 (4)。Phase 93 の申し送り「予測に無い要素を戻したことの見せ方」)。

自動実装モード: on([introduction](./Phase-97-introduction.md) 参照)。

## この章で作成・更新したファイル

`src/features/agreements/` を新しく作った(束の feature と同じ形)。

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/agreements/api/types.ts`](../samples/frontend/src/features/agreements/api/types.ts) | 新規 | 状態・履歴の応答の型(devex-api のスキーマに対応) |
| [`src/features/agreements/api/agreementsApi.ts`](../samples/frontend/src/features/agreements/api/agreementsApi.ts) | 新規 | `getAgreementStatus`・`getAgreementHistory` |
| [`src/features/agreements/agreementOps.ts`](../samples/frontend/src/features/agreements/agreementOps.ts) | 新規 | 表示の文を決める純粋関数 |
| [`src/features/agreements/components/ElementHistoryView.tsx`](../samples/frontend/src/features/agreements/components/ElementHistoryView.tsx) | 新規 | 要素1つの履歴 |
| [`src/features/agreements/components/AgreementStatusPanel.tsx`](../samples/frontend/src/features/agreements/components/AgreementStatusPanel.tsx) | 新規 | 「合意の状態」の枠 |
| [`src/features/documents/components/DocumentMarkdownView.tsx`](../samples/frontend/src/features/documents/components/DocumentMarkdownView.tsx) | 更新 | 詳細設計モードの2文書だけ枠を出す |
| [`src/features/agreements/test-utils/agreementFixtures.ts`](../samples/frontend/src/features/agreements/test-utils/agreementFixtures.ts) | 新規 | テストの応答(`makeStatus`・`makeElement`・`makeHistory`) |
| [`src/features/agreements/__tests__/agreementOps.test.ts`](../samples/frontend/src/features/agreements/__tests__/agreementOps.test.ts) | 新規 | 純粋関数 |
| [`src/features/agreements/api/__tests__/agreementsApi.test.ts`](../samples/frontend/src/features/agreements/api/__tests__/agreementsApi.test.ts) | 新規 | URL とクエリの符号化 |
| [`src/features/agreements/components/__tests__/AgreementStatusPanel.test.tsx`](../samples/frontend/src/features/agreements/components/__tests__/AgreementStatusPanel.test.tsx) | 新規 | 枠と履歴 |
| [`src/features/documents/components/__tests__/DocumentMarkdownView.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentMarkdownView.test.tsx) | 更新 | モードと文書の種類で出し分ける |

## 1. 置き場と見た目

```
[要件定義書] [外部設計書] ...
┌ 合意の状態: 合意済み 12 / 合意と違う 0 / 未合意 2 ──────────┐
│ 合意済みの行は、CR を渡さない再生成では変わりません …          │
│ この版(v7・CR-3 で反映)で、CR-3 の予測に無い変更を合意の形に │
│ 戻しました: 1件(書き換えを戻した 1・落ちた要素を戻した 0) CR-3 を開く │
│   ・FR-004 通知を送る: 書き換えを戻した                       │
│ FR-001 ログインできる            合意 B-2       [履歴]        │
│ FR-009 CSV 出力                  未合意          [履歴]        │
│ 利用者と使う場面                 合意 採用にする [閉じる]      │
│     2026/10/19 10:00 合意(B-1)                               │
│     2026/10/20 09:00 合意の中身が変わった(採用にする)        │
│     関わる CR: CR-3 …(検証済み・予測に入る)                 │
└──────────────────────────────────────┘
(md の本文は今までどおり)
```

- 枠は `DocumentMarkdownView` の要約の枠(要件の出どころ・外部設計書の一覧)の後、md の本文の前に置く。md は変えない(ダウンロードする md と画面の本文が同じまま)。md の表の行に印を差し込む案は、表の形(列の位置・API の書き方)に依存して壊れやすいので採らなかった(相談 (2))。
- 詳細設計モードの要件定義書・外部設計書だけに出す。簡易モード・ほかの文書では、枠を描かず API も呼ばない(決定9)。モードは文書のストアの `projectMode`(プレビューの見出しのリンクと同じ)。

## 2. 表示の文(純粋関数)

```ts
// src/features/agreements/agreementOps.ts(抜粋)
export function stateCountsText(elements: ElementStatusRead[]): string   // 合意済み n / 合意と違う n / 未合意 n(/ 今の版に無い n)
export function elementBadge(element: ElementStatusRead): string         // 合意 B-2 / 合意と違う(合意 CR-3) / 未合意 / 今の版に無い(合意 B-2)
export function restoredHeading(status: AgreementStatusRead): string | null
export function historyEntryText(entry: HistoryEntryRead): string
export function relationText(cr: RelatedChangeRequestRead): string
```

- 「今の版に無い」は、ふつうは0件なので、1件以上のときだけ件数に出す。
- 戻しの見出しは、版の `change_request_number` で言い分ける。CR を反映した版で書き換えてよいのは対象の要件と保存した予測の画面・API だけ(Phase 93)なので、そこで戻したものは「予測に無い変更」である。CR を渡さない版は「再生成で、合意の形に戻しました」。内訳は書き換え / 脱落の件数。
- 状態の名前は API も返す(`state_label`)が、印は出どころと組み合わせるので画面で組み立てる。

## 3. 枠と履歴(部品)

- `AgreementStatusPanel` は、プロジェクト・文書の種類・取り直しの鍵(`refreshKey`)が変わるたびに状態を読む。鍵は `文書の id:中身`。版を切り替える(再生成・復元)と id が変わり、「採用にする」(同じ版の md が書き換わり、合意が記録される。Phase 91)では中身が変わる。読み終える前に鍵が変わったら、古い応答は捨てる。
- 文書が無い・要素が無いときは何も出さない。取得の失敗は `role="alert"` で出す。
- 行の「履歴」は、その行の下に `ElementHistoryView` を開く(もう一度押すと閉じる)。履歴は開いたときに初めて読む(版の履歴と同じく、必要なときだけ見る補助の情報のため)。未合意の行にも出す: CR で足した新しい要件は、合意の記録が無くても関わる CR を持つためである(計画では合意の記録のある行だけとしていたが、作業中に改めた)。
- 履歴は日時・出来事・出どころ(または文書と版、CR-n で反映)の1行ずつと、関わる CR(CR の詳細へのリンク・状態・対象の種類か「予測に入る」)。合意の記録が無ければ「次の合意済みの版で合意になります」と出す。
- CR へのリンクは CR の feature の `changeRequestHref` を使う(束の画面と同じ)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `agreementOps.test.ts`(新規) | `stateCountsText`・`elementBadge`・`restoredHeading`・`historyEntryText`・`relationText` | vitest のテスト関数 | スタブ不要 ── 渡した値だけから文が決まり、外部依存を呼ばないため |
| `agreementsApi.test.ts`(新規) | `getAgreementStatus`・`getAgreementHistory` | vitest のテスト関数 | fetch(`stubFetch`)── 送った URL(キーの符号化)と応答の受け渡しを確かめるため |
| `AgreementStatusPanel.test.tsx`(新規) | `AgreementStatusPanel`・`ElementHistoryView`(テスト用の応答は `agreementFixtures.ts`) | render・userEvent | fetch(`stubFetch`)── devex-api の状態・履歴の応答を積む |
| `DocumentMarkdownView.test.tsx`(更新) | `DocumentMarkdownView` の出し分け | render | fetch(`stubFetch`)と文書のストアの `projectMode` |

- 統合スモーク: 詳細設計モードの要件定義書を描くと、枠が出て `GET .../agreements/status?doc_type=requirements` を読む。
- 件数と印・出どころ(B-1・CR-3・未合意)。戻した要素が無ければ戻しの見出しは出ない。
- CR を反映した版の戻しは「CR-3 の予測に無い変更を合意の形に戻しました: 1件」と要素の行、「CR-3 を開く」のリンク。
- 行の履歴を開くと、履歴のキーを符号化して読み、合意(B-1)・戻した版(CR-2 で反映)・関わる CR のリンクを出す。もう一度押すと閉じる。
- 文書が無い・要素が無いと何も出さない。取得の失敗は知らせる。取り直しの鍵が変わると読み直す。
- 簡易モードと内部設計書などでは枠を出さず、API を呼ばない。

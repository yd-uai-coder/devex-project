# Phase-116-3: 違いの一覧と CR の下書き

## この章の目的

資料のページに、最新の束と比べた違いの取り出しと、違いの一覧を足す。開発者が未確認の追加・変更・削除を選び、画面・API・外部連携の違いはつながる要件を選んで、1つの CR の下書きを作り、CR の詳細へ移る。確かめる点は理由をつけて閉じ、捨てた違いは戻せる。

自動実装モード: on([introduction](./Phase-116-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`features/materials/components/ExtractionPanel.tsx`](../samples/frontend/src/features/materials/components/ExtractionPanel.tsx) | 新規 | 取り出しの回と、取り出す / 取り出し直すボタン |
| [`features/materials/components/DismissForm.tsx`](../samples/frontend/src/features/materials/components/DismissForm.tsx) | 新規 | 捨てる・閉じる理由の入力 |
| [`features/materials/components/DifferenceTable.tsx`](../samples/frontend/src/features/materials/components/DifferenceTable.tsx) | 新規 | 違いの一覧・選んで CR の下書き・捨てる / 戻す |
| [`features/materials/components/MaterialDetailContent.tsx`](../samples/frontend/src/features/materials/components/MaterialDetailContent.tsx) | 更新 | 「違いの一覧」の節 |
| [`features/materials/components/__tests__/ExtractionPanel.test.tsx`](../samples/frontend/src/features/materials/components/__tests__/ExtractionPanel.test.tsx) | 新規 | 束が無い・取り出す前・後に束が作られた・取り出し中 |
| [`features/materials/components/__tests__/DifferenceTable.test.tsx`](../samples/frontend/src/features/materials/components/__tests__/DifferenceTable.test.tsx) | 新規 | 群・選び方・候補の要件・作れないとき・捨てる / 戻す |
| [`features/materials/components/__tests__/MaterialDetailContent.test.tsx`](../samples/frontend/src/features/materials/components/__tests__/MaterialDetailContent.test.tsx) | 更新 | 違いの一覧の節 |

## 1. 取り出し(`ExtractionPanel`)

- 直近の取り出しの回(「B-2 と比べて取り出しました(モデル・日時)」)を出す。取り出した後に束が作られていれば(`isExtractionOutdated`)、取り出し直しを促す。
- ボタンは「最新の版 B-n と比べて違いを取り出す / 取り出し直す」。AI を同期で1回呼ぶこと、やり直すと未確認と弾いたが置き換わり、CR にした・捨てたは残ることを添える(Phase 114)。
- 束が無ければボタンを出さず、合意済みの版へ案内する。

## 2. 違いの一覧(`DifferenceTable`)

| 列 | 中身 |
|---|---|
| 選ぶ | 未確認の追加・変更・削除だけにチェックボックス(未確認の群だけ) |
| 種類 | 色の印(追加 = 緑・変更 = 橙・削除 = 赤・確かめる点 = 紫) |
| 対象 | 追加は「新規 起点 …」、変更・削除は要素のキー。画面・API・外部連携で候補があれば「対象にする要件」のチェックボックス(既定は全部。違いを選ぶまで押せない) |
| 内容・根拠 | 違いの内容と、資料の文の引用 |
| 操作 / 状態 | 未確認は「捨てる(理由)」「閉じる(理由)」、CR にしたは CR の番号のリンク、捨てたは理由と「未確認に戻す」、弾いたは検査の理由 |

- 作れないとき(Claude の判断): 0件、候補を全部外した違いがある、取り出した後に束が作られた(409 を画面で先に止める)。理由を下に出す。
- 作ったら `changeRequestHref` で CR の詳細へ移る。直すのは今の CR の編集(Phase 115 の決定1)。
- 捨てる理由はダイアログでなく、一覧の下の入力欄で書く(`DismissForm`。Claude の判断)。確かめる点は「閉じる」と呼ぶ(API は同じ dismiss)。
- 選んだ状態は部品の中に持ち、取り出し直し・捨てたで無くなった違いは数えない(`isDraftable` の違いだけを数える)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `ExtractionPanel.test.tsx` | `ExtractionPanel` | Testing Library(描画・クリック) | 資料のストアの取り出しの関数(vi.fn)── 出し分けとボタンの配線だけを見るため |
| `DifferenceTable.test.tsx` | `DifferenceTable` と `DismissForm` | Testing Library(描画・チェック・クリック・入力) | 資料のストアの関数(vi.fn)と router ── 群・選べる違い・候補の外し方から作る本文・作った後の移動だけを見るため |
| `MaterialDetailContent.test.tsx`(更新) | `MaterialDetailContent` | Testing Library | 同上 ── 違いの一覧の節が出ること |

- Tamagui の `Button` の無効は `disabled` 属性でなく `aria-disabled="true"` で確かめる(既存のテストと同じ)。

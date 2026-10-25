# Phase 107 導入: CR の画面 ── 規模・選択肢・共有リンクの管理(ステージ13)

## 目的

ステージ13(説明とすり合わせ)の7つ目の実装 Phase。[100-4](../Phase-100/Phase-100-4.md) の Phase 107 にあたる。

Phase 101〜104 で、変更の規模・選択肢(案)と LLM の下書き・共有リンク・コメントと返信・リンクからの合意の API を作った。この Phase では、それを開発者の CR の詳細(SCR-010)から扱えるようにする。クライアント向けのページ(SCR-012)は Phase 108、Phase 106 の分の画面は Phase 109。

- 変更の規模を、内容タブ(合意の前。案ごとの列)と影響タブ(反映の後。予測と実際)に出す ── [107-1](./Phase-107-1.md)
- 選択肢を内容タブで表示・編集し、案のある CR の合意で案を選ぶ ── [107-2](./Phase-107-2.md)
- 選択肢の LLM の下書きを作り・確かめ・取り込む ── [107-3](./Phase-107-3.md)
- 新しい「共有」タブで共有リンクを作り・延ばし・取り消し、古い要約を知らせる ── [107-4](./Phase-107-4.md)
- 共有タブでコメントに返信し、たどる記録の型に新しい行を足す ── [107-5](./Phase-107-5.md)

## パイプライン上の位置づけ・前提

```
CR の詳細(SCR-010)
 内容   ── 対象 → 選択肢(案)[107-2] ← LLM の下書き[107-3] → 変更の規模[107-1] → 合意の記録(選んだ案・出どころ)[107-2]
 影響   ── 予測 → (反映の後)規模の予測と実際[107-1]・印の比較
 検証   ── (今のまま)
 説明書 ── 要約(古い要約の知らせ[107-4])→ 出力のプレビュー
 共有   ── 共有リンク[107-4] → コメントと返信[107-5]   ─▶ クライアントの画面(Phase 108)
 たどる記録 ── 共有・コメント・返信の行(型[107-5])
見出しの操作: 合意のダイアログで案を選ぶ[107-2]
```

- **前提として読むもの**: [100-4](../Phase-100/Phase-100-4.md)(Phase 107〜109 の未確定事項)・[Phase 101](../Phase-101/Phase-101-introduction.md)(規模・`needs_reconfirm`)・[Phase 102](../Phase-102/Phase-102-introduction.md)(案・下書き・案を選ぶ合意)・[Phase 103](../Phase-103/Phase-103-introduction.md)(共有リンク)・[Phase 104](../Phase-104/Phase-104-introduction.md)(コメント・リンクからの合意)・[Phase 88](../Phase-88/Phase-88-introduction.md)(説明書のタブ・要約の確認)。ステージ13 の完成イメージ(Phase 103 の途中で作った非公開の見本)の「開発者の CR の画面」も参考にした。
- **今の仕組み**(調べて分かったこと):
  - devex-ui の CR の型には、Phase 101〜104 の項目(規模・案・下書き・共有リンク・コメント・合意の記録の出どころ)が1つも無かった。
  - 案のある CR の合意は `option` が要る(Phase 102)のに、合意のダイアログが送らなかった。案のある CR は画面から合意できなかった。
  - 規模は説明書の応答(`scale`・`option_scales`)と比較の応答(`scale`)にだけあり、影響の応答には無い。
  - 共有リンクの URL(トークン)は作った応答でだけ返る。下書きの CR で作ると説明済みになる。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `e46e7f9`、devex-api は `stage11-15` ブランチの `806fee4`(変えていない)、devex-ui は `main` の `511c5e6`。devex-ui には、前からの未コミットの変更が2つある(`confirmationsApi.ts` のコメント・`tableStyles.ts` の `minWidth`)。この Phase では触っていない。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。変えるのは devex-ui だけ(devex-api は変えない)。

E2E: この Phase では流さない。今の E2E の CR の流れは案の無い CR だけで、合意のダイアログの変化は案のある CR だけに出る。共有タブは新しいタブで、既存の操作の位置は変えていない。Phase 110 で、共有リンクの流れの spec を足して全部流す(#36)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 107 開始時」を参照する。計画モードで1回(4問)聞いた。置き場は、Phase 88・97・98 と同じく画面のイメージを並べて聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 置き場 | 内容タブに選択肢の節と規模の表、新しい「共有」タブにリンクとコメント。反映の後の規模は影響タブの比較(推奨どおり) |
| 3 | 案の編集 | 案だけの編集欄(保存は案だけを送る。下書きの取り込みも同じ節)(推奨どおり) |
| 4 | 古い要約のまま共有リンクを作るとき | 知らせるが、作るのは止めない(推奨どおり) |

Claude の判断(計画の承認で確定、または実装中):

- 合意のダイアログの案は、初めは選ばない(おすすめを既定にしない)。選ばないと記録できない。却下では案を聞かない。
- 規模は説明書の応答から読む。案があれば種類 × 案、なければ1列と内訳。数えられない種類は「数えられない」と、理由・注記を表の下にまとめる。
- 案の確かめは devex-api と同じ規則の純粋関数。案を全部消すと、おすすめも外して空の案で送る。
- 共有リンクの URL は、作った応答の `path` に今の origin を付け、作った直後だけ出す(ストアのメモリだけ。別の CR を開く・リロードで消える)。期限の日数の欄は作る・延ばすで共有する。
- 古い要約の知らせは、説明書タブと共有タブの作成の確かめの両方。
- コメントの削除・編集は作らない(画面確認で決める)。今の説明書と指紋が違うコメントには「前の版の説明書を見て書かれました」。
- たどる記録の型に共有・コメント・返信の行を足す(表示はサーバーのラベルのままで変わらない)。
- 実装中: 案のカード(`OptionCards`)を別のファイルにした(選択肢の節と下書きの枠が両方使い、同じファイルに置くと循環 import になるため)。下書きの 404 は「下書きなし」として読む。下書き・共有リンク・返信の実行中と失敗は、要約と同じく操作ごとに持つ(CR の状態の操作の `acting` と分け、LLM の待ちの間に見出しの操作を止めない)。
- 完了報告の後、ユーザーの求めでヘッドレスのブラウザで画面を動かした(E2E が残した捨てのプロジェクトに、下書きで案つきの CR-2 を作った)。合意のダイアログの案の欄が `<fieldset>` で、ダイアログの説明の `<p>` の中に入り、React が DOM の入れ子の誤りを出したので、`<span role="radiogroup">` に直した([107-2](./Phase-107-2.md) の分として samples も直した)。ほかの画面(内容タブの選択肢・規模、案の編集欄、共有タブ、リンクの作成)は描けていた。
- 簡易ドキュメントモードは、CR の詳細ごと `DetailedModeOnlyNotice` で断るので、新しい入口は増えない(既存のテストで確かめている)。
- テンプレートから取り込むものは無い。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-107-1.md`](./Phase-107-1.md) | 変更の規模の表示 | あり(本体 5 + テスト 5。新規 2) | なし |
| [`Phase-107-2.md`](./Phase-107-2.md) | 選択肢の表示・編集と、案を選ぶ合意 | あり(本体 10 + テスト 10。新規 5) | 107-1(内容タブ) |
| [`Phase-107-3.md`](./Phase-107-3.md) | 選択肢の LLM の下書き | あり(本体 5 + テスト 5。新規 2) | 107-2(案のカード・選択肢の節) |
| [`Phase-107-4.md`](./Phase-107-4.md) | 共有リンクの管理と共有タブ | あり(本体 8 + テスト 7。新規 3) | なし(説明書のビューは 107-1 と共有) |
| [`Phase-107-5.md`](./Phase-107-5.md) | コメントと返信・たどる記録の新しい行 | あり(本体 6 + テスト 5。新規 2) | 107-4(共有タブ) |

## サンプルコード一覧

`textbook/samples/frontend/src/features/change-requests/`(107-2 は `features/baselines/` のテスト2本も)。

- 107-1: `components/ScaleTable.tsx`・`components/__tests__/ScaleTable.test.tsx`(新規)、`api/types.ts`・`changeRequestOps.ts`・`components/ContentTab.tsx`・`components/ImpactTab.tsx`・`test-utils/changeRequestFixtures.ts`・テスト3本(更新)。
- 107-2: `components/OptionCards.tsx`・`OptionsEditor.tsx`・`OptionsSection.tsx`・テスト2本(新規)、`api/changeRequestsApi.ts`・`change-requests-store.ts`・`components/DecisionDialog.tsx`・`ChangeRequestActions.tsx`・`ContentTab.tsx`・`test-utils/renderWithStore.tsx`ほか(更新)。
- 107-3: `components/OptionDraftReview.tsx`・テスト1本(新規)、`api/*`・ストア・`OptionsSection.tsx`ほか(更新)。
- 107-4: `components/ShareLinkPanel.tsx`・`ShareTab.tsx`・テスト1本(新規)、`ChangeRequestDetailContent.tsx`・`ExplanationTab.tsx`ほか(更新)。
- 107-5: `components/CommentThread.tsx`・テスト1本(新規)、`ShareTab.tsx`ほか(更新)。
- 更新したファイルは `tagmerge.py` で当てた。いくつかのファイル(型・API・純粋関数・ストア・テストの準備)は複数の章が触るので、章の終わりごとに本体の形を保存しておき、章の順に「前の章の終わり → この章の終わり」の差分を当てた(Phase 105・106 の手順)。「要手当て」は出なかった。案のカードを別のファイルにしたのは 107-3 の作業中だが、107-2 の分として保存し直した(107-3 で循環 import を避けるためだけの移動で、107-2 の時点で分けても同じ形のため)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 107-1 | `types.ts`・`changeRequestOps.ts` | 規模の型と、列・セル・理由の行・実際の数え方 | 1列 / 案ごと・0件と数えられない・理由のまとめ |
| 107-1 | `ScaleTable.tsx`・`ContentTab.tsx`・`ImpactTab.tsx` | 規模の表と、内容タブ・比較への置き場 | 説明書のビューを読む・おすすめの列・予測と実際 |
| 107-2 | `types.ts`・`changeRequestsApi.ts`・`changeRequestOps.ts`・ストア | 案の型・案だけの PATCH・案のフォームの確かめと変換 | 規則・本文・おすすめの番号の詰め方・詳細の置き換え |
| 107-2 | `OptionCards.tsx`・`OptionsEditor.tsx`・`OptionsSection.tsx`・`ContentTab.tsx` | 案の表示と編集 | 書く・全部消す・削除の案・3つまで・選んだ案の印 |
| 107-2 | `DecisionDialog.tsx`・`ChangeRequestActions.tsx` | 案のある CR の合意で案を選ぶ | 選ばないと記録しない・番号を送る・却下では聞かない |
| 107-3 | `types.ts`・API・ストア・`OptionDraftReview.tsx`・`OptionsSection.tsx` | 下書きの作成・確かめ・取り込み | 404 は下書きなし・取り込めない理由・古い・取り込み済み |
| 107-4 | `types.ts`・API・`changeRequestOps.ts`・ストア | 共有リンクの型・操作・URL・日数 | 作ると CR を読み直す・行の置き換え・日数の範囲 |
| 107-4 | `ShareLinkPanel.tsx`・`ShareTab.tsx`・`ChangeRequestDetailContent.tsx`・`ExplanationTab.tsx` | 共有タブとリンクの枠・古い要約の知らせ | 確かめの文・URL は作った直後だけ・延ばす / 取り消す |
| 107-5 | `types.ts`・API・`changeRequestOps.ts`・ストア・`CommentThread.tsx`・`ShareTab.tsx` | コメント欄と返信・記録の型 | 返信の欄の出し分け・前の版の印・一覧の置き換え |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30。型 → API → 純粋関数 → ストア → 部品(使われる側が先)→ テスト)。

実 import 監査(#15)として、新規ファイルと、更新したファイルの足した import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。

- `ScaleTable.tsx`(107-1)→ `scaleCell`・`scaleColumns`・`scaleRemarkLines`(107-1)、`ScaleCountRead`・`ScaleKind`(107-1)。`ContentTab.tsx`(107-1)→ `ScaleTable`(107-1)。`ImpactTab.tsx`(107-1)→ `ScaleComparisonRead`・`scaleCell`・`scaleComparisonBasis`(107-1)。
- `OptionCards.tsx`(107-2)→ `ChangeRequestOptionsRead`(107-2)。`OptionsEditor.tsx`(107-2)→ 案の純粋関数・`OPTIONS_MAX`(107-2)、`TARGET_KIND_OPTIONS`・`setTargetKind`・`setTargetProposal`(既存)。`OptionsSection.tsx`(107-2)→ `OptionCards`・`OptionsEditor`・`optionsFormFromCr`・`toOptionsBody`(107-2)。`ContentTab.tsx`(107-2)→ `OptionsSection`・`decidedOptionLabel`(107-2)。`DecisionDialog.tsx`(107-2)→ `ChangeRequestOptionsRead`(107-2)。ストア(107-2)→ `updateChangeRequestOptions`・`ChangeRequestOptionsIn`(107-2)。
- `OptionDraftReview.tsx`(107-3)→ `OptionCards`(107-2)、`ConfirmDialog`(既存)。`OptionsSection.tsx`(107-3)→ `OptionDraftReview`(107-3)。ストア(107-3)→ `createOptionDraft`・`getOptionDraft`・`adoptOptionDraft`・`OptionDraftRead`(107-3)、`isNotFound`(既存)。
- `ShareLinkPanel.tsx`(107-4)→ 共有リンクの純粋関数(107-4)、`ShareLinkRead`(107-4)。`ShareTab.tsx`(107-4)→ `ShareLinkPanel`(107-4)。`ChangeRequestDetailContent.tsx`(107-4)→ `ShareTab`(107-4)。ストア(107-4)→ 共有リンクの API(107-4)。
- `CommentThread.tsx`(107-5)→ `ChangeRequestCommentRead`・`COMMENT_BODY_MAX`・`commentAuthor`・`commentedOnOlderVersion`(107-5)。`ShareTab.tsx`(107-5)→ `CommentThread`(107-5)。ストア(107-5)→ `listComments`・`replyComment`(107-5)。
- テスト: 各章のテストは、その章の fixtures の関数(`makeScale` 107-1・`makeOptions` 107-2・`makeOptionDraft` 107-3・`makeShareLink`・`makeCreatedShareLink` 107-4・`makeComment` 107-5)だけを使う。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。107-1 は `changeRequestOps.test.ts`・`ScaleTable.test.tsx`・`ContentTab.test.tsx`・`ImpactTab.test.tsx`(型は fixtures 経由)。107-2 は `OptionsSection.test.tsx`(`OptionCards`・`OptionsEditor` を通る)・`OptionsEditor.test.tsx`・`ChangeRequestActions.test.tsx`(`DecisionDialog`)・`change-requests-store.test.ts`(API)。107-3 は `OptionDraftReview.test.tsx`・ストアのテスト(`OptionsSection.tsx` は `OptionsSection.test.tsx`)。107-4 は `ShareLinkPanel.test.tsx`(`ShareTab` を描く)・`ChangeRequestDetailContent.test.tsx`・`ExplanationTab.test.tsx`・ストアのテスト。107-5 は `CommentThread.test.tsx`・ストアのテスト(`ShareTab.tsx` は `ShareLinkPanel.test.tsx`)。

## 検証結果

- ユニット: 章ごとに `src/features/change-requests` のテストを流した(最後は 147 件)。
- devex-ui: `npx tsc --noEmit`: 0 件。`npm run lint`: エラー 0(警告は既存の `streamChat.test.ts` の1件だけ)。全体テスト `npx vitest run --maxWorkers=4`: 201 ファイル・1286 件がすべて通った(既定の並列数だと、フォームのテストが時間切れになることがある。devex-ui の `CLAUDE.md` のとおり)。
- devex-api: 変えていないので流していない。
- `textbook/tools/samples_check.py --api-since 806fee4 --ui-since 511c5e6`: 不一致 0・本体のみ 0(一致 1041 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 実 LLM: 使っていない(費用 0。下書きはストアの関数と fetch のスタブでテストした)。E2E: 流していない(Phase 110)。開発環境での画面確認: していない(#37 の運用注記で Phase 110 にまとめる。申し送り参照)。

## 未消化の申し送り(#37)

[Phase 106](../Phase-106/Phase-106-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ13 の中で扱うもの**(行き先は [100-4](../Phase-100/Phase-100-4.md)):
- **クライアントの画面**(P103・P104)→ Phase 108。URL は `/share/<トークン>`(この Phase の共有タブが作る URL と同じ形)。
- **コメントの削除・編集**(P104)→ Phase 107〜109 の画面確認で、要るかを決める(この Phase では作っていない)。
- **段階2・3・7 の機能一覧に無い処理の一覧**(P106)→ Phase 109。そのまま。
- **確認事項の「CR-n で変わった」の表示**(P106)→ Phase 109。そのまま。
- **起点の欄の処理**(P106)→ Phase 109。起点の候補に `kind = function` が入る。devex-ui の `ORIGIN_KIND_LABEL` にはまだ `function` が無い(この Phase では触っていない)。
- **束の一覧の入れた CR**(P106)→ Phase 109。そのまま。
- **束の段階が古いと、予測が少なく出る**(P100)→ Phase 110 の新しい CR の前に決める(残す)。
- **Phase 110 の新しい CR の題材**: 選択肢が自然に2つ以上ある変更(100-4)。下書きを実 LLM で作るなら、費用の見積もりを計画に出す。E2E に共有リンクの流れの spec を足す(この Phase の共有タブでリンクを作り、Phase 108 の画面で閲覧・コメント・合意)。
- **言い換えの E2E の spec**(P105)→ Phase 110。そのまま。
- **実 LLM が利用者の `prev_id` を書くか**(P105)→ Phase 110 の効果測定。そのまま。
- **この Phase の画面確認**(この Phase で生まれた)→ Phase 110 の開発環境での画面確認でまとめて行う。見るもの: 内容タブの選択肢の節と規模の表(案ごとの列の幅)・案の編集欄の長さ・合意のダイアログの案・下書きの枠・共有タブ(URL の枠・一覧・ダイアログの文)・コメント欄。画面確認の後の調整は通常の工程(#38)。

**ステージ13 の範囲の外**:
- **使い勝手(主に UI)の見直し**: ステージ13 の後に回す。
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。マイグレーション `a7c3e5d91f20`(P102)・`c5d8e2f4a613`(P103)・`d7e1f3a5b802`・`e8f2a4b6c913`(P104)・`f3b7d9a2c514`・`a9c2e4f6b318`(P106)を 10.8節に入れる(Phase 110)。Phase 101 の説明書の md の変化で以前の要約がすべて「古い」になること、本番の `.env` に共有リンクの上限を置かないこと、確認事項の古いキーの付け直し(P105)、巡回で消えた版の戻しは反映より前の分は戻らないこと(P106)も 10.8節に書く(Phase 110)。この Phase はマイグレーションが無い。
- **要約・選択肢の下書きの生成の回数の上限**: 使われ方を見て決める。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 100 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)。この Phase も既定の並列数では CR のテストの一部が時間切れになり、`--maxWorkers=4` で通した。
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(Phase 80 から)
- 反映の後の CR の流れの部品・束の写しの取り出し(#17。触るときに寄せる)
- `tagmerge.py` の、複数の章が触るファイルの章の振り分け(振り返り 17.7)と、メソッドの中身を移す変更の扱い(P104)。P105・P106 の「章の終わりごとに本体の形を保存し、前の章の終わりからの差分を章の順に当てる」を、この Phase は最初から手順にして使った(複数の章が触るファイルが 12 本あり、手での振り分けは0件)。手順に書くかは振り返りで決める。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト。「トレンド追跡アプリ」は Phase 110 の効果測定の題材なので残す(この Phase では触っていない)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples・q_a)・devex-ui。devex-api のタグ `phase-101`〜`phase-106` も未作成。devex-ui のタグ `phase-107` も。コミットはユーザーが行う(#35)。
- **devex-ui の前からの未コミット**: `confirmationsApi.ts` のコメント(Phase 105 の分と思われる)・`tableStyles.ts` の `minWidth`(手の変更と思われる)。この Phase では触っていない。コミットに含めるかはユーザーが決める。
- **前の Phase のコミットの題**: 外側 `1da37ba`・devex-api `6209bd7` の題の件(P106)。そのまま。

**この Phase で解決したもの**:
- **規模・要約・選択肢・共有リンクの画面**(P101〜P104)→ [107-1](./Phase-107-1.md)〜[107-5](./Phase-107-5.md)。要約の古さの知らせは [107-4](./Phase-107-4.md)。
- **案のある CR を画面から合意できない**(調べて分かったこと)→ [107-2](./Phase-107-2.md)。
- Phase 107 の未確定事項(100-4。画面の置き場・イメージを先に見せる)→ 「着手時の相談で決めたこと」。共有リンクの画面の見た目とクライアントに見せない情報の範囲は Phase 108。

**この Phase で生まれたもの**:
- 上の「この Phase の画面確認」。
- **セッションの区切りの記録**: Phase 107 は1セッションで行った。
  1. 計画モードで調査(調べるエージェントは使わず、直接読んだ)・質問1回(4問。置き場は画面のイメージつき)・計画の承認
  2. 107-1〜107-5 の実装とテスト(章の終わりごとに本体の形を保存)
  3. 全体テスト・lint・型
  4. samples(`tagmerge.py` を章の順に当てる)
  5. docs・教材
  6. (同じセッションで)ヘッドレスのブラウザで画面を動かし、合意のダイアログの入れ子の誤りを直した

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 規模を影響の応答でなく説明書の応答から読むのはなぜか。案のある CR で、案ごとの列には内訳を出さないのはなぜか。
2. 案の編集を内容を直すフォームに入れず、案だけを送る欄にしたのはなぜか。案を全部消したとき、おすすめの理由が残っていても送れるのはなぜか。
3. 合意のダイアログで、おすすめの案を既定にしなかったのはなぜか。
4. 下書きの 404 を失敗にせず「下書きなし」として読むのはなぜか。ビューの値を `{draft}` で包んだのはなぜか。
5. 共有リンクの URL を、作った直後のメモリだけに持つのはなぜか。古い要約のまま作るのを止めないのに、知らせるのはなぜか。

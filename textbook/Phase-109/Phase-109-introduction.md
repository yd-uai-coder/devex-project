# Phase 109 導入: 残りの画面(ステージ13)

## 目的

ステージ13(説明とすり合わせ)の9つ目の実装 Phase。[100-4](../Phase-100/Phase-100-4.md) の Phase 109 にあたる。

Phase 106 で API の側を済ませた4つを、devex-ui の画面に通す。devex-api は変えない。

- 段階2・3・7 の機能一覧に無い処理の一覧(段階5 と同じ「付け替え・消す」)── [109-1](./Phase-109-1.md)
- CR の予測の起点の処理と、束の入れた CR ── [109-2](./Phase-109-2.md)
- 確認事項の「CR-n で変わった」 ── [109-3](./Phase-109-3.md)

## パイプライン上の位置づけ・前提

```
段階1 を作り直す(処理 ID が変わる)
  → 段階2・3・7 に人が保存した行が残る(検証の UNKNOWN_FUNCTION・UNKNOWN_DFD_GROUP で承認できない)
  → 一覧で付け替える・消す [109-1](段階5 は Phase 99 で済み)

CR の作成: 新しい要件の起点 ← 束の要件・画面・API・処理 [109-2](API は Phase 106-5)
束の一覧・中身: 入れた CR ← 束の応答 [109-2](API は Phase 106-5)
CR の反映: 文が変わった要件の確認事項を未確認に戻す(Phase 106-2)→ 確認事項の表に「CR-n で変わった」[109-3]
```

- **前提として読むもの**: [Phase 106](../Phase-106/Phase-106-introduction.md)(API の4項目)・[Phase 99](../Phase-99/Phase-99-introduction.md)(段階5 の `StrayProcedureTable`)・[Phase 88](../Phase-88/Phase-88-introduction.md)(束の画面)・[Phase 98](../Phase-98/Phase-98-introduction.md)(確認事項・起点の欄)。
- **今の仕組み**(調べて分かったこと):
  - 段階2 の処理概要表・段階3 の CRUD 図は、機能一覧の処理だけを行にする。機能一覧に無い処理の行は画面に出ず、手で直せなかった(保存では残る)。段階2 の DFD を描くグループの選択も、機能一覧のグループだけを出す。段階7 のタスクの処理は自由入力で直せるが、どれが切れているかは検証の文でしか分からなかった。
  - 段階7 のパネルは段階1 の機能一覧を読んでいなかった。
  - 起点の候補(`GET .../baselines/{n}/origins`)は、束に段階1 が入っているときだけ処理(`fn:F-01`)を返す。
  - 束の応答は `included_change_requests`(番号と題)を持つ。CR の表示名(`CR-n`)は持たない。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `b86f1c3`、devex-api は `stage11-15` ブランチの `806fee4`(変えていない)、devex-ui は `main` の `b32d932`(Phase 108 の分。未コミットの変更は無し)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。変えるのは devex-ui だけ(devex-api は変えない)。

E2E: この Phase では流さない。画面の流れは変えていない(段階の作業領域に一覧が増え、束・確認事項の表示が変わっただけ)。Phase 110 で全部流す(#36)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 109 開始時」を参照する。計画モードで1回(4問)聞いた。一覧の形と確認事項の置き場は、画面のイメージを並べて聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 段階2・3・7 の一覧の形 | 共通の部品1つ(`StrayFunctionTable`)に段階ごとの純粋関数を渡す。段階5 の表は変えない(推奨どおり) |
| 3 | 束の中身のページの CR の状態の印 | 外す(束に入る CR は検証済みだけ)。中身のページは CR の一覧を読まない(推奨どおり) |
| 4 | 確認事項の「CR-n で変わった」の置き場 | 状態の欄の下の段にリンクで(推奨どおり) |

Claude の判断(計画の承認で確定、または実装中):

- 段階5 の `StrayProcedureTable` を共通の部品へ移さない(#17 の (b)。移すことを今駆動する消費者がいない)。
- 段階2 の機能一覧に無いグループは外すだけ(付け替えると、そのグループの DFD の図の主題も変える必要があるため)。段階3 の付け替え先はセルの無い処理だけ(セルの重なりを合わせる規則を作らないため)。段階7 は外してもタスクを残す(Phase 106-1 の再生成と同じ)。
- 段階7 のパネルに、ほかの段階と同じく段階1 の機能一覧の読み込みを足した。
- CR の表示名は `changeRequestLabel`(`CR-<番号>`。devex-api の label と同じ形)を足して、束と確認事項で使う。
- 実装中: ヘッドレスのブラウザでの確認で、束の一覧のページに前からある React の警告(getSnapshot の結果がキャッシュされていない)を見つけ、空の CR の一覧を定数にして直した([109-2](./Phase-109-2.md)。#38)。
- テンプレートから取り込むものは無い。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-109-1.md`](./Phase-109-1.md) | 段階2・3・7 の機能一覧に無い処理 | あり(本体 8 + テスト 7。新規 2) | なし |
| [`Phase-109-2.md`](./Phase-109-2.md) | 起点の処理と束の入れた CR | あり(本体 8 + テスト 5) | なし |
| [`Phase-109-3.md`](./Phase-109-3.md) | 確認事項の「CR-n で変わった」 | あり(本体 4 + テスト 2) | 109-2(`changeRequestLabel`) |

## サンプルコード一覧

`textbook/samples/frontend/src/features/` の `detailed-design/`・`baselines/`・`change-requests/`・`confirmations/`。

- 109-1: `components/StrayFunctionTable.tsx`・テスト1本(新規)、`dataFlowOps.ts`・`crudOps.ts`・`planOps.ts`・3つのパネル・fixtures・テスト6本(更新)。
- 109-2: 束の型・`changeRequestOps.ts`・`ChangeRequestForm.tsx`・`baselineOps.ts`・束の一覧と中身とページ・fixtures・テスト4本(更新)。
- 109-3: 確認事項の型・`confirmationOps.ts`・`ConfirmationTable.tsx`・fixtures・テスト2本(更新)。
- 章の終わりごとに本体の形を保存し、新規ファイルは初出の章の形に `作成` のヘッダーを付け、後の章の分は「前の章の終わり → この章の終わり」の差分を `tagmerge.py` で章の順に当てた(Phase 107・108 と同じ手順。この Phase はどのファイルも1つの章だけが触った)。「要手当て」は出なかった。手で直したのは2件: `BaselineDetailContent.tsx`・`BaselineList.tsx` は samples のヘッダーが2行目(`"use client"` の後)にあったので、tagmerge が1行目に新しいヘッダーを足した。1行目の元の形に1行でまとめた。あわせて、`BaselineDetailContent.tsx` の import 区間の中にあった名前なしの `Phase-88(完了後の調整):追記` の3行(tagmerge が区間の直前へ移した)を、#29 の特則の形の1行(名前つき)にまとめた。
- 作業の中で、当てる処理を1度誤って2回流した。当てたファイルを外側のリポジトリの HEAD の中身に書き戻してから、1回だけ当て直した。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 109-1 | `dataFlowOps.ts`・`crudOps.ts`・`planOps.ts` | 段階ごとの機能一覧に無い行の拾い方・付け替え先・付け替え・消す | 中身を保つ・付け替え先の絞り方・タスクは残す |
| 109-1 | `StrayFunctionTable.tsx` | 段階2・3・7 で共通の一覧の表(選択と押した行) | 選ぶまで付け替えられない・付け替え先が無い |
| 109-1 | 3つのパネル | 一覧を置き、変更を下書きに入れる | 消す・付け替えると保存の内容が変わる |
| 109-2 | 束の型・`changeRequestOps.ts`・`ChangeRequestForm.tsx` | 起点の処理と CR の表示名 | 処理を起点に選べる |
| 109-2 | `baselineOps.ts`・束の一覧・中身・ページ | 入れた CR を束の応答から | 中身のページは CR の一覧を読まない |
| 109-3 | 確認事項の型・`confirmationOps.ts`・`ConfirmationTable.tsx` | CR で変わった旨と CR へのリンク | 値のある行だけに出る |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30。純粋関数 → 部品(使われる側が先)→ パネル・ページ → テスト。テスト用の準備はテスト群の先頭)。

実 import 監査(#15)として、新規ファイルと、更新したファイルの足した import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。章の終わりごとに保存した本体の形で、その章までのテストが通ることも確かめている。

- 109-1: `StrayFunctionTable.tsx` → `FunctionRow`(既存)・`tableStyles`(既存)・`StyledButton`(既存)。`dataFlowOps.ts`・`crudOps.ts`・`planOps.ts` → `FunctionListModel`・`FunctionRow`(既存)。`DataFlowPanel.tsx` → `StrayFunctionTable`・段階2 の関数(109-1)。`DataModelPanel.tsx` → `StrayFunctionTable`・段階3 の関数(109-1)。`PlanPanel.tsx` → `StrayFunctionTable`・段階7 の関数(109-1)・`toFunctionList`(既存)。
- 109-2: `BaselineList.tsx`・`BaselineDetailContent.tsx` → `changeRequestLabel`(109-2)。`BaselinesPageContent.tsx` → `ChangeRequestSummaryRead`(既存)。
- 109-3: `confirmationOps.ts` → `changeRequestLabel`(109-2)。`ConfirmationTable.tsx` → `changedByLabel`(109-3)・`changeRequestHref`(既存)。
- テスト: 109-1 は `makeFunctionListWithSpare`(109-1)を使う。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。109-1 は ops のテスト3本・`StrayFunctionTable.test.tsx`・パネルのテスト3本。109-2 は `changeRequestOps.test.ts`・`ChangeRequestForm.test.tsx`・`BaselinesPageContent.test.tsx`(`BaselineList` を通る)・`BaselineDetailContent.test.tsx`・`baselineOps.test.ts`(型は経由)。109-3 は `confirmationOps.test.ts`・`ConfirmationsPageContent.test.tsx`(`ConfirmationTable`)。

## 検証結果

- ユニット: 章ごとに `src/features/detailed-design`(400 件)・`src/features/baselines`・`src/features/change-requests`(175 件)・`src/features/confirmations`(19 件)を流した。
- devex-ui: `npx tsc --noEmit`: 0 件。`npm run lint`: エラー 0(警告は既存の `streamChat.test.ts` の1件だけ)。全体テスト `npx vitest run --maxWorkers=4`: 209 ファイル・1349 件がすべて通った(警告の直しの後に `src/features/baselines` を流し直した)。
- devex-api: 変えていないので流していない。
- `textbook/tools/samples_check.py --api-since 806fee4 --ui-since b32d932`: 不一致 0・本体のみ 0(一致 1065 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- ヘッドレスのブラウザ(run-devex-ui の手順):
  - E2E が残した捨てのプロジェクト(`e2e-detailed-1792586976733@example.com` の「備品予約」)の段階2・3・7 の保存した model に、機能一覧に無い処理 `F-09`(段階2 は処理概要の行と「消えたグループ」、段階3 はセル、段階7 はタスクの処理)を DB で直接足した。段階2 で一覧・消えたグループ・検証のエラー3件が出て、外す・消すで一覧が消えた(保存はしていない)。段階3 で一覧と検証のエラーが出た。段階7 はこのプロジェクトでは閉じていて(段階4〜6 が古い)、作業領域が出ないので画面では見ていない(ユニットのテストだけ。申し送り)。確認の後、足した行は DB で元に戻した。
  - 同じプロジェクトに、確認事項 `req:NFR-002` の記録(`changed_by_change_request_number = 1`)を DB で足し、表に「CR-1 の反映で文が変わりました →」が出て CR-1 へのリンクになることを確かめた。確認の後、足した記録は消した。
  - 同じプロジェクトに、束 B-1 を API で作った(段階1 が入るように。入れた CR は無し)。B-1 を基準に CR の作成のフォームを開き、起点に「処理: F-01 予約を登録する」を選べた(CR は作っていない)。**この束 B-1 は残っている**。
  - `e2e-cr-1792586956692@example.com` の「予約の CR」で、束の一覧の「入れた CR」に CR-1、B-2 の中身に「CR-1 予約の取り消しを足す」(状態の印なし)が出た。
  - 想定外のブラウザの誤り: 束の一覧のページの「getSnapshot の結果がキャッシュされていない」の警告(変更前の本体でも出ることを確かめた)。直した後は出ない。ほかはログイン前の `401 POST /auth/refresh` と、テスト仕様書の無いプロジェクトの `404 GET .../test-spec` だけ。
- 実 LLM: 使っていない(費用 0)。E2E: 流していない(Phase 110)。開発環境での画面確認: 上のヘッドレスの確認だけ(#37 の運用注記で Phase 110 にまとめる。申し送り参照)。トレンド追跡アプリは触っていない。

## 未消化の申し送り(#37)

[Phase 108](../Phase-108/Phase-108-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ13 の中で扱うもの**(行き先は [100-4](../Phase-100/Phase-100-4.md)):
- **コメントの削除・編集**(P104)→ Phase 110 の画面確認で、要るかを決める(開発者の側もクライアントの側も作っていない)。
- **束の段階が古いと、予測が少なく出る**(P100)→ Phase 110 の新しい CR の前に決める(残す)。
- **Phase 110 の新しい CR の題材**: 選択肢が自然に2つ以上ある変更(100-4)。下書きを実 LLM で作るなら、費用の見積もりを計画に出す。E2E に共有リンクの流れの spec を足す(Phase 107 の共有タブでリンクを作り、Phase 108 の画面で閲覧・コメント・合意)。確かめのダイアログの locator は `getByRole("dialog", { name: … })` で絞る(Phase 108 の注意)。
- **言い換えの E2E の spec**(P105)→ Phase 110。そのまま。
- **実 LLM が利用者の `prev_id` を書くか**(P105)→ Phase 110 の効果測定。そのまま。
- **Phase 107・108 の画面確認** → Phase 110 の開発環境での画面確認でまとめて行う。見るもの(Phase 107): 内容タブの選択肢の節と規模の表(案ごとの列の幅)・案の編集欄の長さ・合意のダイアログの案・下書きの枠・共有タブ(URL の枠・一覧・ダイアログの文)・コメント欄。(Phase 108): スマートフォンの幅での並び(案のカード・名前の欄の幅)・直している / 期限切れ / 取り消しの表示・前回から変わった点の枠(長い節のとき)・判断済みの結果の枠・暗いテーマ。
- **この Phase の画面確認**(この Phase で生まれた)→ Phase 110 でまとめて行う。見るもの: 段階7 の一覧(このPhase の確認では段階7 が開いたプロジェクトが無かった)・段階2・3 の一覧の文の長さと位置・確認事項の「CR-n で変わった」の段・束の中身の入れた CR の並び。画面確認の後の調整は通常の工程(#38)。
- **効果測定の読み方**: Phase 110 は、クライアント役が共有リンクの画面(説明書の md と案のカード)で読む。

**ステージ13 の範囲の外**:
- **使い勝手(主に UI)の見直し**: ステージ13 の後に回す。
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。マイグレーション `a7c3e5d91f20`(P102)・`c5d8e2f4a613`(P103)・`d7e1f3a5b802`・`e8f2a4b6c913`(P104)・`f3b7d9a2c514`・`a9c2e4f6b318`(P106)を 10.8節に入れる(Phase 110)。Phase 101 の説明書の md の変化で以前の要約がすべて「古い」になること、本番の `.env` に共有リンクの上限を置かないこと、確認事項の古いキーの付け直し(P105)、巡回で消えた版の戻しは反映より前の分は戻らないこと(P106)も 10.8節に書く(Phase 110)。この Phase はマイグレーションが無い。本番の nginx が `/share/…` を devex-ui に渡すことは、反映のときに確かめる(P108)。
- **要約・選択肢の下書きの生成の回数の上限**: 使われ方を見て決める。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 100 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)。この Phase も、既定の並列数では `src/features/detailed-design` で31件が時間切れになり、`--maxWorkers=4` で流した。
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(Phase 80 から)
- 反映の後の CR の流れの部品・束の写しの取り出し(#17。触るときに寄せる)
- `tagmerge.py` の、複数の章が触るファイルの章の振り分け(振り返り 17.7)と、メソッドの中身を移す変更の扱い(P104)。P105〜P108 と同じく「章の終わりごとに本体の形を保存し、前の章の終わりからの差分を章の順に当てる」を使った。手順に書くかは振り返りで決める。この Phase で見つけたもの: samples のヘッダーが1行目に無いファイル(`"use client"` の後にある)では、tagmerge が新しいヘッダーを1行目に足す(手で2件まとめた)。import 区間の中にあった名前なしの追記のタグは、区間の直前に名前なしのまま移る(手で1件まとめた)。
- 段階5 の `StrayProcedureTable` と、この Phase の `StrayFunctionTable` の重なり(#17。段階5 の表を触るときに共通の部品へ寄せる)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト(Phase 108 で、捨てのプロジェクトの CR-2 に共有リンクを作り合意した。この Phase で、`e2e-detailed-1792586976733` のプロジェクトに束 B-1 を作った。段階・確認事項に足した行は元に戻した)。「トレンド追跡アプリ」は Phase 110 の効果測定の題材なので残す(触っていない)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples・q_a)・devex-ui。devex-api のタグ `phase-101`〜`phase-106`、devex-ui のタグ `phase-107`〜`phase-109` は未作成(作ってあれば不要)。コミットはユーザーが行う(#35)。
- **前の Phase のコミットの題**: 外側 `1da37ba`・devex-api `6209bd7` の題の件(P106)。そのまま。

**この Phase で解決したもの**:
- **段階2・3・7 の機能一覧に無い処理の一覧**(P106)→ [109-1](./Phase-109-1.md)。
- **起点の欄の処理**(P106)→ [109-2](./Phase-109-2.md)。
- **束の一覧の入れた CR**(P106)→ [109-2](./Phase-109-2.md)。
- **確認事項の「CR-n で変わった」の表示**(P106)→ [109-3](./Phase-109-3.md)。
- Phase 109 の未確定事項(100-4。画面の置き場)→ 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の「この Phase の画面確認」と、`StrayProcedureTable` との重なり・tagmerge のヘッダーの件。
- **セッションの区切りの記録**: Phase 109 は1セッションで行った。
  1. 計画モードで調査(調べるエージェントは使わず、直接読んだ)・質問1回(4問。一覧の形と確認事項の置き場は画面のイメージつき)・計画の承認
  2. 109-1〜109-3 の実装とテスト(章の終わりごとに本体の形を保存)
  3. 全体テスト・lint・型
  4. ヘッドレスのブラウザでの確認(警告の直し)
  5. samples(`tagmerge.py` を章の順に当てる)
  6. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 段階2 の処理概要表・段階3 の CRUD 図で、機能一覧に無い処理の行が手で直せなかったのはなぜか。一覧を自動で消さず、人に付け替えか消すかを選ばせるのはなぜか。
2. 共通の表の部品がモデルの変換を持たず、押した行を `key` で返すのはなぜか。段階5 の表を共通の部品へ移さなかったのはなぜか。
3. 段階3 の付け替え先をセルの無い処理に限り、段階7 では処理 ID を外してもタスクを残すのはなぜか。
4. 束の中身のページで CR の一覧を読まなくなったのはなぜか。状態の印を外してよいのはなぜか。
5. 確認事項の「CR-n で変わった」を、画面が消す操作を持たずに API の値のまま出すのはなぜか。

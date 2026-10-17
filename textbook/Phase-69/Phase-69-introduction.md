# Phase 69 導入: 生成の知らせ(ステージ9)

## 目的

ステージ9の8つ目の実装 Phase。[61-3](../Phase-61/Phase-61-3.md) の Phase 69 として、Phase 53・54・57 から持ち越した「生成の知らせ」の3件を片付ける。

- 再生成・テスト仕様書の作り直し・チャットからの最初の生成が失敗しても、画面に出なかった(前が「完了」なら成功に見え、それ以外は3分の上限まで「生成中」が続いた)→ 失敗をプロジェクトに記録し([69-1](./Phase-69-1.md))、各画面の上に知らせる([69-3](./Phase-69-3.md))
- 詳細設計モードのテスト仕様書を作っている最中に開き直すと、作っていると分からなかった → 開き直したときにプロジェクトの状態と進み具合を読む([69-3](./Phase-69-3.md))
- 差し戻しで作り直した段階に検証のエラーが残って承認できないとき、理由が出なかった → 渡した指摘を段階に記録し([69-2](./Phase-69-2.md))、承認の横に理由とリンク・渡した指摘を出す([69-4](./Phase-69-4.md))

あわせて、Phase 68 の申し送り「キーが無くて LLM を解決できないときも、段階の文言が『下書きの生成に失敗しました』になる」を、理由のコード `LLM_UNAVAILABLE` で分けた([69-1](./Phase-69-1.md))。

## パイプライン上の位置づけ・前提

```
生成の受け付け(POST /generate)── generating にする・generation_failure を消す            ──[69-1]
  └ バックグラウンドの生成
      ├ 成功 → completed
      └ 失敗 → 生成の前の状態に戻す + generation_failure = {理由, 文言, 対象, 日時}        ──[69-1]
              (理由 = classify_failure。キーが無い LlmUnavailableError は LLM_UNAVAILABLE)
  止まった生成の回収(15分)→ STALE_GENERATION を記録                                     ──[69-1]

画面のポーリング(useGenerationPolling): generating でなくなったら、読んだプロジェクトを渡す    ──[69-3]
  ├ プレビュー: 記録を持ち、上に知らせ(前の版を表示している旨)
  ├ チャット: 成功ならプレビューへ。失敗なら読み直して知らせ・完了のバナーを戻す
  └ 詳細設計画面のテスト仕様書: テスト仕様書を作り直そうとした失敗だけ。開き直しで作っているかを読む

段階の差し戻し(POST /design-stages/{n}/generate {finding_ids})── generation_finding_ids を記録 ──[69-2]
  └ 段階の読み出し: generation_findings(重要度・対象・問題)
      └ 作業領域: 承認できない理由 + 「検証の結果へ」 + 「この作り直しで渡した指摘」         ──[69-4]
```

- **前提として読むもの**: [61-3](../Phase-61/Phase-61-3.md)(Phase 69 のスコープと未確定事項)、[外部設計書](../../docs/external_design.md) 2.12節の「生成の知らせ」、[Phase 53](../Phase-53/Phase-53-introduction.md)(再生成の進み具合・3分の上限)、[Phase 54](../Phase-54/Phase-54-introduction.md)(差し戻し)、[Phase 57](../Phase-57/Phase-57-introduction.md)(テスト仕様書)。
- **今の仕組み**: 設計書の生成の失敗は、状態を戻し `sender="others"` のチャットの行(画面では出さない)を1つ書くだけだった。テスト仕様書は設計書と同じ `/generate` で作り、同じ `project.status` を使う(専用のテーブルは無い)。段階の下書きは `design_stages.generation_status`・`generation_error` を持つ。段階の検証のエラーは読み出しのたびに計算し、承認は 409 `DESIGN_STAGE_INVALID` で断る。差し戻しの指摘は実行のたびに `review_findings` から修正指示を組み立て、記録していなかった。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `7d7d90f`、devex-ui は `acea660`(Phase 68)。外側のリポジトリは Phase 68 までコミット済み(`5ae216f`)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(Phase 72 で既存を含めて全部流す)。E2E の流れ(生成が成功する経路)は、終わりの判定が「`completed`」から「`generating` でない」に変わっても同じに動く見込み。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 69 開始時」を参照。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 失敗の知らせの置き場 | 各画面の上の固定の知らせ。次の生成を始めるまで残る。プレビューには前の版を表示している旨を添える(推奨どおり) |
| 3 | 失敗の記録の置き場 | プロジェクトに直近の失敗の列(`projects.generation_failure`)(推奨どおり) |
| 4 | 段階のエラーと指示の関係の示し方 | 承認の横に理由とエラーへのリンク + 作り直しで渡した指摘の一覧(エラーとの紐付けはしない)(推奨どおり) |

Claude の判断(計画の承認で確定、または作業中):

- 理由の分類は UML 図・段階と同じ `classify_failure` を使い、`LLM_UNAVAILABLE` を足す。文言は使う側(設計書・段階・UML 図)ごとに持つ。
- チャットからの最初の生成の失敗も同じ仕組みで知らせる(同じポーリングで、同じ不具合を持っていたため)。
- **作業中**: 失敗の記録の「作り直そうとした文書」は、止まった生成の回収では Redis の進み具合から読む。起点の不正そのものの失敗では、モードの全部に読み替える(`_failure_targets`)。
- **作業中**: テスト仕様書の「作っている」の印は、ストアの読み込みでは立てるだけにした(受け付けの直後に読んだ古い状態で下ろさないため)。
- **作業中**: 渡した指摘の一覧は、8つの段階のパネルでなく `StageWorkArea` の共通の部分に置いた。検証の結果へのリンクはページ内のリンク(`<a href="#stage-issue-list">`)にした(キーボードで移れるため)。
- **作業中**: 出力を解釈できない失敗の文言が「AIの出力を設計書として解釈できませんでした。もう一度生成してください。」に変わるので、既存の `test_doc_generation_guard.py` の期待を替えた。

推奨と違った選択は無し。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-69-1.md`](./Phase-69-1.md) | 生成の失敗の記録 | あり(本体 6 + マイグレーション 1 + テスト 2) | なし(Phase 68 の `LlmUnavailableError`) |
| [`Phase-69-2.md`](./Phase-69-2.md) | 作り直しに渡した指摘の記録 | あり(本体 5 + マイグレーション 1 + テスト 1) | 69-1(マイグレーションの順) |
| [`Phase-69-3.md`](./Phase-69-3.md) | 文書・テスト仕様書・チャットの知らせ | あり(UI 13 + テスト 13) | 69-1(API の `generation_failure`) |
| [`Phase-69-4.md`](./Phase-69-4.md) | 承認できない理由と渡した指摘 | あり(UI 5 + テスト 4) | 69-2(API の `generation_findings`) |

## サンプルコード一覧

`textbook/samples/backend/`・`textbook/samples/frontend/` の新規・更新:

- 69-1: `app/uml/generation/failures.py`・`app/services/design_stage_generation_service.py`・`app/models/project.py`・`alembic/versions/a7d3c9e1f5b2_add_generation_failure_to_projects.py`(新規)・`app/schemas/project.py`・`app/services/doc_generator_service.py`・`app/services/project.py`・`tests/unit/test_generation_failure.py`(新規)・`tests/unit/test_doc_generation_guard.py`
- 69-2: `app/models/design_stage.py`・`alembic/versions/b8e4d0f2a6c3_add_generation_finding_ids_to_design_stages.py`(新規)・`app/schemas/design_stage.py`・`app/repositories/review.py`・`app/services/design_stage_generation_service.py`・`app/services/design_stage_service.py`・`tests/unit/test_stage_generation_findings.py`(新規)
- 69-3: `src/lib/generation-failure.ts`(新規)・`src/features/dashboard/api/projects.ts`・`src/components/errors/GenerationFailureNotice.tsx`(新規)・`src/hooks/useGenerationPolling.ts`・`src/features/documents/`(`documents-store.ts`・`components/DocumentsPageContent.tsx`・`testSpecOps.ts`・`test-spec-store.ts`・`components/TestSpecPanel.tsx`)・`src/features/detailed-design/components/`(`StageStepper.tsx`・`DetailedDesignPageContent.tsx`)・`src/features/hearing/`(`hearing-store.ts`・`components/ChatPageContent.tsx`)・テスト(新規2・更新11)
- 69-4: `src/features/detailed-design/`(`api/types.ts`・`labels.ts`・`components/StageIssueList.tsx`・`components/StageGenerationFindings.tsx`(新規)・`components/StageWorkArea.tsx`)・テスト(新規1・更新3)
- 画面の確認のスクリプトはジョブの一時フォルダに置き、samples にミラーしない。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [69-1](./Phase-69-1.md) | `failures.py`・`doc_generator_service.py`・`project.py`(モデル・スキーマ・サービス) | 生成の失敗の理由・対象・日時をプロジェクトに書き、受け付けで消し、詳細で返す | 理由の分類(キーが無い)/ 失敗・回収で書く / 受け付けで消す / 対象(起点から・進み具合から)/ 読み出し |
| [69-2](./Phase-69-2.md) | `design_stage_generation_service.py`・`design_stage_service.py`・`review.py`(リポジトリ) | 差し戻しで渡した指摘の ID を段階に書き、読み出しで要約を返す | 記録・渡した順 / 指摘なしで消す / 消えた・別のプロジェクトの指摘を返さない |
| [69-3](./Phase-69-3.md) | `useGenerationPolling.ts`・`GenerationFailureNotice.tsx`・各ストアと画面 | 生成の終わりを「生成中でなくなった」で知り、記録で失敗を各画面の上に出す | 失敗が成功に見えない / 読めない回 / 画面ごとの出し分け(対象・生成中)/ 開き直しでテスト仕様書を作っている |
| [69-4](./Phase-69-4.md) | `labels.ts`・`StageWorkArea.tsx`・`StageGenerationFindings.tsx` | 承認できない理由とエラーへのリンク、渡した指摘を出す | 理由の優先と件数 / リンクの移り先 / 指摘の並び |

## 写経順序(#23)

章番号順(69-1 → 69-2 → 69-3 → 69-4)。各章の表の順(依存順。#30)に写す。

- マイグレーションは2本(`a7d3c9e1f5b2` → `b8e4d0f2a6c3`)。69-1 の後で `alembic upgrade head` を流す。
- 69-3 の `useGenerationPolling` の引数の変更は、呼び出し元3つ(プレビュー・チャット・詳細設計画面)を同じ章で替える(受け取らない関数のままでも型は通るが、失敗が成功に見えるのを直すのが章の目的のため)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 69-1: `failures.py` → `LlmUnavailableError`(Phase 68)。`doc_generator_service.py` → `ReasonCode`・`classify_failure`(既存の `failures.py`。`LLM_UNAVAILABLE` は 69-1 の表で先に置く)、`LLMQuotaExceededError` の import は消した。`schemas/project.py` → 既存のみ。テスト → `failure_record`(69-1)・`_MESSAGES`(既存)・`stub_llm_resolver`(Phase 68)・`GenerationProgressStore`(既存)。
- 69-2: `schemas/design_stage.py` → 既存の `uuid`。`review.py` → 既存のみ。`design_stage_service.py` → `ReviewFinding`(既存)・`ReviewRunRepository`(既存。`list_findings` は 69-2 で表の先に置く)・`GenerationFindingRead`(69-2。表で先に置く)。テスト → `create_detailed_project`・`review_finding`(既存のフィクスチャ)。
- 69-3: `projects.ts` → `GenerationFailure`(69-3。表で先に置く)。`GenerationFailureNotice.tsx` → `failureHeading`(69-3)。`useGenerationPolling.ts` → `ProjectRead`(既存)。`documents-store.ts`・`test-spec-store.ts`・`hearing-store.ts` → `ProjectRead`・`GenerationFailure`・`failureFor`(69-3)・`getGenerationProgress`(既存)。画面 → `GenerationFailureNotice`・`failureFor`(69-3)。
- 69-4: `labels.ts` → 既存のみ。`StageIssueList.tsx` → `STAGE_ISSUE_LIST_ID`(69-4。表で先に置く)。`StageGenerationFindings.tsx` → `GenerationFinding`(69-4)・`LEVEL_LABEL`・`ReviewLevel`(既存)。`StageWorkArea.tsx` → `approveBlocker`・`STAGE_ISSUE_LIST_ID`・`StageGenerationFindings`(69-4。表で先に置く)。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する(各章の「テスト観点」の末尾)。

## 検証結果

- 章ごとの部分テスト: 69-1・69-2(生成・段階・レビュー・プロジェクトにかかわる 516件)。devex-ui は文書・詳細設計・ヒアリング・フック・lib(662件。`--maxWorkers=4`)。すべて成功。
- Phase 完了時の全体テスト(#18): devex-api **1404 件成功**(integration は除外)。integration **19 件成功**(実際の PostgreSQL。既存を含む全部)。devex-ui **1029 件成功**(158 ファイル。`--maxWorkers=4`)。
- `ruff check`(全体)成功。`pyright`: この Phase で変えたファイルは 0 件。`tsc --noEmit` 成功。変えた機能の `eslint` はエラー 0(警告1件は以前からの `streamChat.test.ts`)。
- Alembic: dev の DB で `upgrade head`(`9e1c5a7b3d20` → `a7d3c9e1f5b2` → `b8e4d0f2a6c3`)、2本の downgrade → upgrade の往復を確かめた。リビジョン ID の重なりが無いこと・head が1つであることを先に確かめた。
- **画面の確認**(Playwright、手元の dev、幅 1280・375): superuser の簡易のプロジェクトと詳細のプロジェクトに、SQL で `generation_failure`(`LLM_UNAVAILABLE`)と段階1の `generation_finding_ids`(採用した指摘2件)を一時的に入れ、詳細の段階1は応答を書き換えて「作り直した・未承認・エラー1件」に見せた。プレビュー・チャット・テスト仕様書(ステッパーの行「前回の作成に失敗」)の知らせ、段階1の承認の横の理由・「検証の結果へ」(`#stage-issue-list` へ移る)・「この作り直しで渡した指摘」を確かめた。確かめた後に、入れた値は NULL に戻した。実際の生成の失敗(ジョブが記録を書く経路)は単体テストで確かめた(実 LLM は呼んでいない)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 作り忘れ 0 件。不一致 1 件は Phase 65 から残る `ProjectListControls.tsx`(下の「未消化の申し送り」)。この Phase のファイルはすべて一致(一致 770 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は以前からの `change-impact-demo` のルート)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 68 から引き継いだもの:

- **ステージ9の計画の残り**(Phase 70〜72): カードで選ぶと観点の要約が置き換わる・値のカードが論点の一部しか値にしない・要件ごとのテストの書き方が浅い・変更のきっかけを列挙する再生成の設計(→ 70)・実装手順書のゴールと単位の食い違い(PR-7)・DFD のデータストアの書き漏れ・画面の文の変更は、その画面のすべての処理へ届く(→ 71)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から。全体では `test_chat_stream_errors.py`・`test_doc_generation_start.py` の3件も出ている)・**並列のテストのタイムアウト**(Phase 44 から。この Phase でも devex-ui を既定の並列で流すと 19 件が 5 秒で落ち、`--maxWorkers=4` で通った)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。
- **Phase 70〜72 の未確定事項**: [61-3](../Phase-61/Phase-61-3.md)「未確定事項」(62〜69 の分は解決)。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する(表は [`app/ai/llm/catalog.py`](../samples/backend/app/ai/llm/catalog.py))。
- **確認メールの送信**: 範囲の外。
- **画面確認(#37 の運用注記)**: ヘッダー・メニュー・モード選択(Phase 62)・認証ページの振り分け(Phase 63)・削除のボタン・ダイアログ・トースト(Phase 64)・検索・絞込み・ページ送り(Phase 65)・マイページのアカウント(Phase 66)・**生成の失敗の知らせ・承認できない理由・渡した指摘(Phase 69)** は、Phase 72 の本番確認でまとめて見る。本番は https なので、印に `Secure` が付くこともそこで確かめる。マイページ(アカウント・モデル・API キー)の操作感は、Phase 67 の直後にユーザーが確かめる([61-3](../Phase-61/Phase-61-3.md))。手元で試すには、`devex-api/.env` に `ENCRYPTION_KEY` を足して API を起動し直す。
- **登録の上限と手元の確認**: 既存の `test_auth_flow.py`・`test_projects_flow.py` は API で登録するので、integration を流し直すと登録・ログインの上限(10回/時)に当たる。[`retrospective-memo.md`](../retrospective-memo.md) の「統合テストとレート制限のカウンタを分ける」と同じ問題(この Phase は1回目で通った)。
- **削除したプロジェクトの URL を開いたときの表示**(Phase 64 から): 「Project {id} not found」がそのまま出る。直すなら、404 のときの文言を画面で「このプロジェクトは見つかりません(削除された可能性があります)」とし、ダッシュボードへのリンクを出す。
- **AlertDialog の開発時の警告**(Phase 64 から): Tamagui 2.6.0 の AlertDialog が、開く前に説明文を探して警告を出す(誤検知)。版を上げるときに消えるか確かめる。
- **トーストの v2 の API**(Phase 64 から): `@tamagui/toast/v2` の `Toaster` は 2.6.0 の web で `accessibilityLabel` を DOM に渡す。版を上げて直っていれば、v2 に寄せてもよい。
- **新規作成の後の一覧の cache**(Phase 65 から): `dashboard-store` の `invalidate` を呼ぶ所が無い。プロジェクトを作ってから20秒以内に同じ条件のダッシュボードへ戻ると、新しいプロジェクトが出ない。気になるなら、作成の成功で `invalidate()` を呼ぶ。
- **ダッシュボードの見出しの折り返し**(Phase 65 から): 幅 375px で「ダッシュボード」の見出しが3行に折り返す。Phase 72 の画面確認で見る。
- **`ProjectListControls.tsx` の samples と本体の食い違い**(Phase 65 の完了後の調整から): 本体のコミット(`5269927`)の検索欄に `maxWidth="480px"` が無く、samples にはある。どちらが正しいかをユーザーが決め、もう一方を合わせる。
- **ほかの端末のアクセストークン**(Phase 66 から): パスワードを変えても、ほかの端末のアクセストークン(30分)はその寿命まで使える(今は入れない)。
- **アカウントのフォームの縦の余白**(Phase 66 から): `FormGeneral` はボタンの下にスピナーの場所(40px)を持つので、3つのフォームの下に空きが出る。アコーディオンの中での見た目を、操作感の確認で見る。
- **閉じると保存していない編集が消える**(Phase 67 の完了後の調整から): アコーディオンで節を閉じると中身が外れる。気になるなら、`Accordion.Content` に `forceMount` を付けて中身を残す。
- **本番の既定値の行と暗号の鍵**(Phase 67 から → Phase 72): 本番で既定値の行を `seed_default_models` だけ流して入れるか、行が無くても `.env` の値で補う今の形のままにするかを決める。`ENCRYPTION_KEY` の作り方と置き場、鍵を回す手順を `OPERATIONS.md` に書く。この Phase の Alembic 2本も本番の手順に入れる。
- **dev の DB に残った確認用の利用者**(Phase 67 から): ブラウザでの確認で作った `mypage67-…@example.com` の利用者が2人ある。消してもよい。
- **レビューを使えることの案内**(Phase 68 から): 一般ユーザーには、レビューのパネルがまるごと出ない。「マイページでレビューの AI のキーを登録すると、設計レビューを使えます」の案内を出すかを、Phase 72 の画面確認で決める。
- **判定の既定のキー**(Phase 68 から): 自分の Claude キーでレビューを使う一般ユーザーが、判定の用途に Gemini を選び、その自分のキーが無い場合は、既定の Gemini キーで判定を呼ぶ(既定のキーの回は1日の上限で数える)。
- **受け付けと実行のモデル**(Phase 68 から): レビューの回の `model` は受け付けのときに解決したモデルで、実行はジョブの中で解決し直す。受け付けと実行の間にマイページでモデルを替えると、記録と実際が食い違う(数秒の間)。
- **Claude Haiku の推論のトークン**(Phase 68 から): Haiku 5.5 はチャットでも推論のトークンを使った(出力 3,310 のうち 2,628)。Phase 70 の効果の確かめで見る。
- **Gemini の温度の警告**(Phase 68 から): `gemini-3.5-flash-lite` は温度を無視すると langchain-google-genai が警告する。動作には影響しない。

この Phase で生まれたもの:

- **押せないボタンの見た目**: `StyledButton` は押せないとき(`disabled`)の見た目を変えないので、承認できない段階の「承認する」が押せるボタンと同じ緑に見える(画面の確認で気づいた。以前から)。この Phase で理由を横に出したので分かるようにはなった。見た目も変えるなら、`StyledButton` に `disabled` のときの不透明度を足す(ほかの画面のボタンにも効く)。
- **チャットの知らせの範囲**: チャットの上の知らせは、プレビューからの再生成の失敗も出す(記録は直近の1件で、どこから始めた生成かは持たない)。気になるなら、記録に起点の画面を足すか、チャットではヒアリングからの生成(全部を作る)の失敗だけを出す。
- **一覧の失敗の記録**: `GET /projects` の項目にも `generation_failure` が載るが、ダッシュボードは使っていない。カードに「前回の生成に失敗」を出すかは、Phase 72 の画面確認で決める。
- **セッションの区切りの記録**: Phase 69 は1セッションで行った(計画モードで調査(調査エージェント2つ)→ 質問1回(4問)→ 計画の承認 → 69-1〜69-4 の実装 → 画面の確認 → samples → docs → 教材)。

この Phase で解決したもの:

- **再生成の失敗を画面で知らせていない**(Phase 53 から。テスト仕様書の作り直しも): [69-1](./Phase-69-1.md)・[69-3](./Phase-69-3.md)。チャットからの最初の生成も同じ。
- **詳細設計モードのテスト仕様書を生成中に画面を開き直す**(Phase 57 から): [69-3](./Phase-69-3.md)。
- **段階の作り直しの後に承認できない**(Phase 54 から。エラーの見せ方): [69-2](./Phase-69-2.md)・[69-4](./Phase-69-4.md)。
- **解決できないときの段階の文言**(Phase 68 から): [69-1](./Phase-69-1.md)(`LLM_UNAVAILABLE`)。
- **61-3 の Phase 69 の未確定事項**(失敗の知らせの置き場・失敗の記録の持ち方・段階のエラーと指示の関係の示し方): 着手時の相談。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 生成の終わりを「`completed` になった」で判定すると、失敗がどう見えていたか。「`generating` でなくなった」に替えると、成否は何で見分けるか。
2. 失敗の記録を、生成の記録のテーブルでなくプロジェクトの1列にしたのはなぜか。`targets` を持つのはどの画面のためか。
3. 詳細設計画面のテスト仕様書で、「作っている」の印をストアの読み込みでは立てるだけにしたのはなぜか。
4. 承認できない理由を、`canApprove` と別の規則でなく、その裏返しで作ったのはなぜか。
5. 差し戻しで渡した指摘を、指示の本文でなく ID で記録したのはなぜか。

## 次のフェーズ

**Phase 70**: ヒアリングとテスト仕様書の質(カードで選んだときに前の要約を残す・値のカードが論点ごとに値を取る・要件ごとのテストの書き方を深める・変更のきっかけを列挙する再生成の設計の見直し)。着手時に自動実装モード(#21)と [61-3](../Phase-61/Phase-61-3.md) の未確定事項(4件それぞれの直し方・効果の確かめ方)を決める。実 Gemini で効果を確かめる。

# Phase 68 導入: LLM の呼び出しをユーザーごとに解決する(ステージ9)

## 目的

ステージ9の7つ目の実装 Phase。[61-3](../Phase-61/Phase-61-3.md) の Phase 68 として、[Phase 67](../Phase-67/Phase-67-introduction.md) でマイページから登録した用途ごとのモデルと API キーで、実際に LLM を呼ぶようにする。今までは `.env` の全体で1つの取得関数(`get_gemini_llm`・`get_review_llm`・`get_judge_llm`)だった。

- provider・モデル・キー・用途からクライアントを作る部品と、provider に固有の処理を両方で通す ── [68-1](./Phase-68-1.md)
- 「ユーザーと用途 → (provider, モデル, キー)」の解決と、レビューを使えるかの判定 ── [68-2](./Phase-68-2.md)
- チャット・生成・PDF の取り込み・汎用チャットの呼び出しを替える ── [68-3](./Phase-68-3.md)
- レビュー・判定の呼び出しと、レビューを使える人を広げる ── [68-4](./Phase-68-4.md)

## パイプライン上の位置づけ・前提

```
各サービス(チャット・生成・段階・PDF・汎用チャット・レビュー・判定)
  └ LlmResolver(session).resolve(project.user_id, 用途)                       ──[68-2]
      ├ モデル = マイページの選択(無ければ既定値。key_missing は既定値へ)   (Phase 67 の LlmSettingsService)
      ├ キー   = 復号できる自分のキー → 無ければ .env の既定のキー
      │          → どちらも無い: レビュー・判定は ReviewUnavailableError / ほかは LlmUnavailableError
      └ build_llm(provider, モデル, キー, 用途, 温度)                          ──[68-1]
          ├ タイムアウト = カタログのモデルごと / 出力の上限 = 用途ごと(Claude は必須)
          ├ 構造化出力 = 両 provider で json_schema / SDK の中の再試行は止める
          └ lru_cache(maxsize=64)。E2E_FAKE_LLM なら偽物
  invoke_with_retry: 混雑(503・504・529)は 5秒 → 15秒 で待つ / Claude の入力の超過も再試行しない ──[68-1]
レビューを使える = superuser か、レビューの用途の AI の自分のキーがある(GET /users/me の review_allowed) ──[68-2 / 68-4]
```

- **前提として読むもの**: [61-3](../Phase-61/Phase-61-3.md)(Phase 68 のスコープと未確定事項)、[Phase 67 の introduction](../Phase-67/Phase-67-introduction.md) の「Phase 68 への引き継ぎ」、[内部設計書](../../docs/internal_design.md) 3.3節「9. 使い勝手とアカウント・モデル設定」の「LLM の解決」、[外部設計書](../../docs/external_design.md) 2.12節の「レビューを使える人」。
- **今の仕組み**: 取得関数は `lru_cache` でプロセスに1つ。呼び出しは約8か所(チャット3・生成2・PDF・汎用チャットのグラフ・レビュー・判定)。langchain-anthropic の構造化出力の既定は function_calling で、レビュー・判定だけが `"json_schema"` を渡していた。入力の超過・混雑の判定は Gemini だけを見ていた。レビュー・判定は `settings.ANTHROPIC_API_KEY` を直接見ていた。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `8e2de3e`、devex-ui は `4aa95cd`(Phase 67)。外側のリポジトリは Phase 67 までコミット済み(`c6a19da`)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(Phase 72 で既存を含めて全部流す)。E2E の偽物(`E2E_FAKE_LLM`)は `build_llm` が返し、解決はキーが無くても偽物を返すので、E2E の流れは変わらない見込み。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 68 開始時」を参照。

| # | 問い | 決定 |
|---|---|---|
| 1 | 解決の置き場 | LLM を呼ぶ各サービスが自分のセッションで解決する。テストの `llm=` の差し替えは残す(推奨どおり) |
| 2 | 自分のキーで流すレビュー・判定に1日の上限を残すか | 自分のキーなら数えない。1回の判定の件数の上限は残す(推奨どおり) |
| 3 | モデルごとのタイムアウトの持ち方 | カタログにモデルごとの秒数(推奨どおり) |
| 4 | 混雑(503・504・529)の再試行 | 試行の間を 5秒 → 15秒 に伸ばす。試行は最大3回のまま(推奨どおり) |

自動実装モードは、Phase 7 以降と同じ on として計画に書き、計画の承認で確定した。

Claude の判断(計画の承認で確定、または作業中):

- 構造化出力の方式を両 provider で `json_schema` に揃える。Claude の出力の上限はチャット 4000・生成 16000(レビュー・判定は設定値)。
- PDF の取り込みは Gemini 固定(生成の用途が Gemini ならそのモデル、違えば `GEMINI_MODEL`)。解決できなければ取り込みの失敗として記録する。
- 汎用チャットのグラフは `RunnableConfig` で LLM を渡す(グラフはプロセスで1つにコンパイルするため)。検索結果の評価は温度0のクライアントを別に解決する。
- レビューを使えるかを `GET /users/me` の `review_allowed` で返し、レビューのパネルはそれで出す。
- **作業中**: キャッシュの鍵に用途と温度も入れた(用途で出力の上限が変わるため)。E2E の分岐はキャッシュの外に置いた(テストが切り替えても実物が返らないように)。
- **作業中**: 68-1 では呼び出しを替えないので、3つの取得関数を `build_llm` を呼ぶ薄い関数にして残し、呼び出しを替え終えた 68-3・68-4 で削除した(章をまたいで動く状態を保つため)。`review_effective` の引数を変えるのも、呼び出し元をまとめて替える 68-4 にした。
- **作業中**: 実効値の判定を `LlmResolver.review_effective(user)` に1つにまとめた(呼び出し元5か所)。`UserRead` の計算プロパティをやめ、ルートの側の `app/api/user_read.py` で値を埋める(キーの登録を読むため)。
- **作業中**: 段階の生成では、解決を失敗の記録の `try` の中に入れた(解決の失敗で段階が「生成中」のまま残らないように)。
- **作業中**: テストで解決をフェイクに差し替える `tests/fixtures/llm_resolver.py` を作った。

推奨と違った選択は無し。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-68-1.md`](./Phase-68-1.md) | LLM の組み立てと provider に固有の処理 | あり(本体 7(うち2つは後の章で削除)+ テスト 6) | なし(Phase 67 のカタログ) |
| [`Phase-68-2.md`](./Phase-68-2.md) | 解決とレビューを使えるか | あり(本体 5 + テスト 1) | 68-1 |
| [`Phase-68-3.md`](./Phase-68-3.md) | チャットと生成の呼び出し | あり(本体 10 + フィクスチャ 2 + テスト 6。削除 1) | 68-1・68-2 |
| [`Phase-68-4.md`](./Phase-68-4.md) | レビューと判定の呼び出し・画面 | あり(本体 11 + UI 4 + フィクスチャ 1 + テスト 5。削除 1) | 68-2・68-3(フィクスチャ) |

## サンプルコード一覧

`textbook/samples/backend/`・`textbook/samples/frontend/` の新規・更新・削除:

- 68-1: `app/core/config.py`・`app/ai/llm/catalog.py`・`app/ai/llm/content.py`(新規)・`app/ai/llm/factory.py`(新規)・`app/services/llm_retry.py`・`tests/unit/test_llm_factory.py`(新規)・`tests/unit/test_llm_content.py`(新規。`test_gemini.py` は削除)・`tests/unit/test_llm_retry.py`・`tests/unit/test_llm_catalog.py`・`tests/unit/test_review_llm.py`・`tests/unit/test_review_fix_check.py`
- 68-2: `app/services/errors.py`・`app/services/llm_settings_service.py`・`app/review/policy.py`・`app/review/__init__.py`・`app/services/llm_resolver.py`(新規)・`tests/unit/test_llm_resolver.py`(新規)
- 68-3: `app/ai/llm/fake.py`・`app/services/intake_file_processor.py`・`app/services/chat_service.py`・`app/services/doc_generator_service.py`・`app/services/design_stage_generation_service.py`・`app/services/project.py`・`app/api/routes/projects.py`・`app/ai/graph/nodes.py`・`app/ai/graph/workflow.py`・`app/services/chat.py`(この3つはテンプレート由来で初めて載せた)・`tests/fixtures/fake_llm.py`・`tests/fixtures/llm_resolver.py`(新規)・`tests/unit/test_llm_call_sites.py`(新規)・`tests/unit/test_ai_graph_nodes.py`(初めて載せた)・`tests/unit/test_generic_chat_and_refresh.py`・`tests/unit/test_chat_service.py`・`tests/unit/test_chat_stream_errors.py`・`tests/integration/test_projects_flow.py`。`app/ai/llm/gemini.py` は削除
- 68-4: `app/review/policy.py`・`app/services/llm_resolver.py`・`app/schemas/user.py`・`app/api/user_read.py`(新規)・`app/services/user.py`・`app/services/review_service.py`・`app/services/fix_check_service.py`・`app/services/doc_generator_service.py`・`app/api/routes/design_stages.py`・`app/api/routes/users.py`・`app/api/routes/auth.py`・`tests/fixtures/llm_resolver.py`・テスト4つ・`src/features/design-review/`(`api/reviewApi.ts`・`review-store.ts`・`components/ReviewPanel.tsx`・`test-utils/reviewFixtures.ts`・`components/__tests__/ReviewPanel.test.tsx`)。`app/ai/llm/claude.py` は削除
- 実 LLM の確認のスクリプトはジョブの一時フォルダに置き、samples にミラーしない。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [68-1](./Phase-68-1.md) | `factory.py`・`content.py`・`catalog.py`・`llm_retry.py` | provider・モデル・キー・用途からクライアントを作る / provider の違い(方式・上限・タイムアウト・超過と混雑の判定)を吸収する | provider ごとの引数・キャッシュの鍵・E2E の分岐 / 混雑の待ち・Claude の入力の超過 / 本文のブロック |
| [68-2](./Phase-68-2.md) | `llm_resolver.py`・`policy.py`・`llm_settings_service.py` | ユーザーと用途から provider・モデル・キーを決める / レビューを使えるかを決める | 既定・選択・key_missing・自分のキー優先・読めないキー・キーなしの2種の例外・PDF は Gemini・レビューを使える条件 |
| [68-3](./Phase-68-3.md) | チャット・生成・段階・PDF・汎用チャットのサービス | 持ち主のチャット・生成の用途で呼ぶ | 呼び出し箇所ごとに用途と持ち主で解決する・解決の失敗の扱い(作成は成功・段階は failed・PDF は取り込みの失敗)・グラフの config |
| [68-4](./Phase-68-4.md) | レビュー・判定のサービス・`user_read.py`・`ReviewPanel.tsx` | 持ち主のレビュー・判定の用途で呼ぶ / 自分のキーの回は上限で数えない / 使える人に画面を出す | 一般ユーザーが自分のキーで使える・上限・記録するモデル・パネルの出し分け |

## 写経順序(#23)

章番号順(68-1 → 68-2 → 68-3 → 68-4)。各章の表の順(依存順。#30)に写す。

- 68-1 で `gemini.py`・`claude.py` は `build_llm` を呼ぶ薄い関数にする(呼び出しを替え終えるまで既存のコードを動かすため)。68-3 で `gemini.py`、68-4 で `claude.py` を消す。
- マイグレーションは無い。`.env` の `LLM_TIMEOUT_SECONDS`・`REVIEW_TIMEOUT_SECONDS`・`JUDGE_TIMEOUT_SECONDS` は使われなくなる(書いてあっても無視される。手元の `.env` には無かった)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 68-1: `factory.py` → `langchain_anthropic`・`langchain_google_genai`・`pydantic`(既存の依存)・`Provider`・`Purpose`・`find_model`(Phase 67)・`get_e2e_fake_llm`(既存)・`settings`(既存)。`content.py` → なし。`llm_retry.py` → `STRUCTURED_METHOD`(68-1。表で先に置く)。68-1 の間の `gemini.py` → `content`・`factory`・`catalog`(68-1 / Phase 67)、`claude.py` → `factory`(68-1)・`ReviewUnavailableError`(既存)。テスト → この章のものと既存。
- 68-2: `errors.py` → 既存の基底だけ。`llm_settings_service.py` → 既存の import のまま(`decrypt_secret`・`encryption_available`・`DecryptionFailedError` は Phase 67)。`policy.py` → なし。`review/__init__.py` → `review_allowed`(68-2。表で先に置く)。`llm_resolver.py` → `Provider`・`Purpose`(Phase 67)・`build_llm`(68-1)・`settings`・`User`(既存)・`review_allowed`(68-2)・`LlmUnavailableError`(68-2)・`ReviewUnavailableError`(既存)・`LlmSettingsService`・`PurposeSetting`(Phase 67)。テスト → この章までのもの。
- 68-3: 各サービス → `Purpose`(Phase 67)・`STRUCTURED_METHOD`・`extract_text_content`(68-1)・`LlmResolver`・`LlmUnavailableError`(68-2)。`nodes.py` → `RunnableConfig`(langchain_core)・`extract_text_content`・`STRUCTURED_METHOD`(68-1)。`chat.py` → `RunnableConfig`・`Purpose`・`LlmResolver`(68-2)。フィクスチャ `llm_resolver.py` → `LlmResolver`・`ResolvedLlm`(68-2)。テスト → この章までのもの(`DEFAULT_GEMINI_TEMPERATURE` は 68-1)。
- 68-4: `policy.py` → なし。`llm_resolver.py` → `env_default_models`(Phase 67)・`app.review.policy`(68-2/68-4)。`user_read.py` → `User`・`UserRead`(既存)・`review_effective`(68-4。表で先に置く)・`LlmResolver`(68-2)。`user.py` → `LlmResolver`(68-2)。`review_service.py`・`fix_check_service.py` → `Purpose`(Phase 67)・`LlmResolver`・`ResolvedLlm`(68-2)・`injected_llm`(68-4。表で先に置く)。ルート → `user_read`(68-4。表で先に置く)・`LlmResolver`(68-2)。UI → 既存のものだけ。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する(各章の「テスト観点」の末尾。テンプレート由来の `workflow.py` とコメントだけの `fake.py` などは、そのファイルを import するテストで確かめた)。

## 検証結果

- 章ごとの部分テスト: 68-1(57件)・68-2(24件)・68-3(呼び出し箇所・チャット・グラフ 82件)・68-4(レビュー・判定 22件)。devex-ui はレビューの機能(51件)。すべて成功。
- Phase 完了時の全体テスト(#18): devex-api **1393 件成功**(19 件は integration で除外)。integration **19 件成功**(実際の PostgreSQL。既存を含む全部)。devex-ui **1002 件成功**(155 ファイル。`--maxWorkers=4`)。
- `ruff check`(全体)成功。`pyright`: この Phase で変えたファイルは、既存の5件(`test_chat_service.py` の4件・`test_chat_stream_errors.py` の1件。Phase 40 からの持ち越し)を除いて 0 件。`tsc --noEmit`・レビューの機能の `eslint` 成功。
- **実 LLM の確認**(手元の dev DB にサービスを直接呼ぶスクリプト。HTTP の登録の上限を避けるため):
  - 一般ユーザー(superuser でない)に自分の Claude キー(`.env` のキーを一時の暗号の鍵で暗号化して登録)を持たせ、チャット・生成・レビューを Claude Haiku 5.5 に選んだ。解決は4用途とも Claude・自分のキー(判定は既定の Haiku で自分のキー)、`review_allowed` は真。
  - 最初の発話・チャット1往復(Haiku): 構造化出力(json_schema)の返信とカードが返った。入力 15,138 / 出力 3,310 トークン(うち推論 2,628)。
  - 簡易モードの4文書の生成(Haiku)と生成の後のレビュー(Haiku、自分のキー): 4文書ができ、レビューの回は `succeeded`・`model=claude-haiku-5-5`・指摘20件。入力 52,330 / 出力 24,047 トークン。
  - 既定の Gemini(キーの無い一般ユーザー): チャットの用途は `gemini-3.5-flash-lite`・タイムアウト30秒・既定のキーで、最初の発話が返った(入力 2,257 / 出力 188。無料枠)。`review_allowed` は偽。
  - 費用(Haiku $0.10 / $0.50): 入力 67,468 → 約 $0.007、出力 27,357 → 約 $0.014、**合計 約 $0.02**(見込み $0.06。Sonnet は回していない)。
  - 確認で作った利用者2人とプロジェクトは、削除と物理削除の後に消した。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 作り忘れ 0 件。不一致 1 件は Phase 65 から残る `ProjectListControls.tsx`(下の「未消化の申し送り」)。この Phase のファイルはすべて一致(一致 760 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は以前からの `change-impact-demo` のルート)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 67 から引き継いだもの:

- **ステージ9の計画の残り**(Phase 69〜72): 再生成の失敗を画面で知らせていない・段階の作り直しの後に承認できない・テスト仕様書を生成中に画面を開き直す(→ 69)・カードで選ぶと観点の要約が置き換わる・値のカードが論点の一部しか値にしない・要件ごとのテストの書き方が浅い・変更のきっかけを列挙する再生成の設計(→ 70)・実装手順書のゴールと単位の食い違い(PR-7)・DFD のデータストアの書き漏れ・画面の文の変更は、その画面のすべての処理へ届く(→ 71)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から。全体では `test_chat_stream_errors.py`・`test_doc_generation_start.py` の3件も出ている)・**並列のテストのタイムアウト**(Phase 44 から)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。
- **Phase 69〜72 の未確定事項**: [61-3](../Phase-61/Phase-61-3.md)「未確定事項」(62〜68 の分は解決)。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する(表は [`app/ai/llm/catalog.py`](../samples/backend/app/ai/llm/catalog.py))。
- **確認メールの送信**: 範囲の外。
- **画面確認(#37 の運用注記)**: ヘッダー・メニュー・モード選択(Phase 62)・認証ページの振り分け(Phase 63)・削除のボタン・ダイアログ・トースト(Phase 64)・検索・絞込み・ページ送り(Phase 65)・マイページのアカウント(Phase 66)は、Phase 72 の本番確認でまとめて見る。本番は https なので、印に `Secure` が付くこともそこで確かめる。マイページ(アカウント・モデル・API キー)の操作感は、Phase 67 の直後にユーザーが確かめる([61-3](../Phase-61/Phase-61-3.md))。手元で試すには、`devex-api/.env` に `ENCRYPTION_KEY` を足して API を起動し直す。
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
- **本番の既定値の行と暗号の鍵**(Phase 67 から → Phase 72): 本番で既定値の行を `seed_default_models` だけ流して入れるか、行が無くても `.env` の値で補う今の形のままにするかを決める。`ENCRYPTION_KEY` の作り方と置き場、鍵を回す手順を `OPERATIONS.md` に書く。
- **dev の DB に残った確認用の利用者**(Phase 67 から): ブラウザでの確認で作った `mypage67-…@example.com` の利用者が2人ある。消してもよい。

この Phase で生まれたもの:

- **レビューを使えることの案内**: 一般ユーザーには、レビューのパネルがまるごと出ない(今までと同じ)。自分のキーで使えるようになったので、「マイページでレビューの AI のキーを登録すると、設計レビューを使えます」の案内を出すかを、Phase 72 の画面確認で決める(マイページのモデルの節のレビューの用途の説明に足す案もある)。
- **判定の既定のキー**: 自分の Claude キーでレビューを使う一般ユーザーが、判定の用途に既定と同じ provider 以外(Gemini)を選び、その自分のキーが無い場合は、既定の Gemini キーで判定を呼ぶ(Phase 67 の「既定値と同じ provider は既定のキーで選べる」の規則。既定のキーの回は1日の上限で数える)。判定の既定は Claude なので、選び直さなければ自分の Claude キーで呼ぶ。
- **解決できないときの段階の文言**: 段階の生成で LLM を解決できない(`LlmUnavailableError`)ときも、段階のエラーは「下書きの生成に失敗しました。時間をおいて、もう一度生成してください。」になる(理由の分類に「キーが無い」が無い)。superuser が既定のキーの無い provider を選んだときにしか起きない。気になるなら Phase 69(生成の知らせ)で分ける。
- **受け付けと実行のモデル**: レビューの回の `model` は受け付けのときに解決したモデルで、実行はジョブの中で解決し直す。受け付けと実行の間にマイページでモデルを替えると、記録と実際が食い違う(数秒の間)。
- **Claude Haiku の推論のトークン**: Haiku 5.5 はチャットでも推論のトークンを使った(出力 3,310 のうち 2,628)。チャットを Claude にしたときの費用・待ち時間の目安として、Phase 70 の効果の確かめで見る。
- **Gemini の温度の警告**: `gemini-3.5-flash-lite` は温度を無視する(固定のサンプリング)と langchain-google-genai が警告する。今までと同じで、動作には影響しない。
- **セッションの区切りの記録**: Phase 68 は1セッションで行った(計画モードで調査(調査エージェント1つ)→ 質問1回(4問)→ 計画の承認 → 68-1〜68-4 の実装 → 実 LLM の確認 → samples → docs → 教材)。

この Phase で解決したもの:

- **生成のモデルと Gemini の無料枠**(Phase 60 から): ユーザーが用途ごとにモデルを選べるようになり、3.8 Flash を選んでもタイムアウト(240秒)に収まる。混雑は待ちを伸ばして再試行する([68-1](./Phase-68-1.md))。無料枠(3.8 Flash は1日20回)は、自分の Gemini キーを登録すれば自分の枠で使える。
- **Phase 68 への引き継ぎ**(Phase 67 から): 解決は `get_model_settings` の結果と復号できる自分のキーから作った([68-2](./Phase-68-2.md))。レビューの実効値の条件を改めた([68-4](./Phase-68-4.md))。
- **61-3 の Phase 68 の未確定事項**(解決の置き場・provider に固有の処理の差・自分のキーのレビューの上限・モデルごとのタイムアウトと混雑の再試行): 着手時の相談と [68-1](./Phase-68-1.md)・[68-2](./Phase-68-2.md)・[68-4](./Phase-68-4.md)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 解決をルート・ジョブの入口でなく各サービスで行うと、何が変わらずに済むか。代わりに何を各サービスが持つことになるか。
2. タイムアウトを用途でなくモデルに持たせたのはなぜか。キャッシュの鍵に用途と温度を足したのはなぜか。
3. 構造化出力の方式を `json_schema` に揃えないと、チャット・生成を Claude に替えたときに何が起きるか。
4. 自分のキーで流すレビュー・判定を1日の上限で数えないのはなぜか。それでも1回の判定の件数の上限を残したのはなぜか。
5. レビューを使えるかを `UserRead` の計算プロパティでなく、ルートの側(`user_read`)で埋めるようにしたのはなぜか。

## 次のフェーズ

**Phase 69**: 生成の知らせ(再生成・テスト仕様書の作り直しの失敗を画面で知らせる・テスト仕様書の生成中の表示・作り直した段階の検証のエラーの見せ方)。着手時に自動実装モード(#21)と [61-3](../Phase-61/Phase-61-3.md) の未確定事項(失敗の知らせの置き場・失敗の記録の持ち方・段階のエラーと指示の関係の示し方)を決める。

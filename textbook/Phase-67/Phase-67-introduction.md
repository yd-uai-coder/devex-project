# Phase 67 導入: モデルと API キーの登録(ステージ9)

## 目的

ステージ9の6つ目の実装 Phase。[61-3](../Phase-61/Phase-61-3.md) の Phase 67 として、マイページ(SCR-009)に「モデル」と「API キー」の節を足し、superuser でなくても自分の API キーを登録して、用途(チャット・生成・レビュー・判定)ごとのモデルを選べるようにする([外部設計書](../../docs/external_design.md) 2.12節)。**この Phase は登録まで**で、LLM の呼び出しをこの設定で解決するのは Phase 68。

- キーを暗号化する仕組みと、選べるモデルの表を作る ── [67-1](./Phase-67-1.md)
- 用途ごとのモデルと API キーのテーブル、既定値の seed を作る ── [67-2](./Phase-67-2.md)
- 登録の API(保存の前のキーの確かめを含む)を作る ── [67-3](./Phase-67-3.md)
- マイページに2つの節を足す ── [67-4](./Phase-67-4.md)

## パイプライン上の位置づけ・前提

```
マイページ(/mypage)
 ├ AccountSection(Phase 66)
 ├ ModelSection ── GET /llm/catalog(静的な表 catalog.py)              ──[67-4 / 67-3 / 67-1]
 │                └ GET・PUT /users/me/models ── LlmSettingsService
 │                      ├ 既定値 = user_model_settings の user_id が null の行(seed が .env から)
 │                      │          + 行が無い用途は .env の値で補う                     ──[67-2]
 │                      └ 選べる provider = superuser はすべて / ほかは既定値と同じ provider
 │                                            + 今の鍵で復号できる自分のキーの provider
 └ ApiKeySection ── GET /users/me/api-keys・PUT・DELETE /users/me/api-keys/{provider}
                      ├ 試行の上限(1時間10回)→ 鍵が無ければ 503 → モデルの一覧で確かめる
                      │   (400・401・403 は 422 / 通信の失敗・429・5xx は 502。どちらも保存しない)
                      └ Fernet(MultiFernet。ENCRYPTION_KEY をカンマ区切り)で暗号化 + 末尾4文字
                                                                           ──[67-3 / 67-1]
Phase 68: 用途とユーザー → (provider, モデル, キー) → LLM。key_missing の用途は既定値に読み替える
```

- **前提として読むもの**: [61-3](../Phase-61/Phase-61-3.md)(Phase 67 のスコープと未確定事項)、[61-1](../Phase-61/Phase-61-1.md) の決定5〜10 とモデルのカタログ、[外部設計書](../../docs/external_design.md) 2.12節「マイページ」、[内部設計書](../../docs/internal_design.md) 3.3節「9. 使い勝手とアカウント・モデル設定」の「モデルと API キー」。
- **今の仕組み**: モデルは `.env` の全体で1つ(`GEMINI_MODEL`・`REVIEW_MODEL`・`JUDGE_MODEL`)、キーも `GOOGLE_API_KEY`・`ANTHROPIC_API_KEY` だけ。LLM の取得関数は `lru_cache` でプロセスに1つ(`app/ai/llm/gemini.py`・`claude.py`)。暗号化の仕組みは無く、`cryptography` は推移的な依存としてだけ入っていた。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `ee6c31f`、devex-ui は `ec4798c`(Phase 66)。外側のリポジトリは Phase 66 までコミット済み(`4bdfa23`)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(Phase 72 で既存を含めて全部流す)。`get_key_verifier` は `E2E_FAKE_LLM` のときキーを確かめずに有効とみなすので、E2E でキーの登録を通せる。画面は Playwright のスクリプトでブラウザを動かして確かめた(下の「検証結果」)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 67 開始時」を参照。

| # | 問い | 決定 |
|---|---|---|
| 1 | テーブルの形と seed | 用途ごとに1行。`user_id` が null の行が既定値。seed は実行のたびに `.env` の値で上書き(推奨どおり) |
| 2 | 一般ユーザーが、キーの無い provider を用途に選んだとき | 保存で断る(既定のキーで使えるのは既定値と同じ provider だけ。キーを消しても選択は残し、使うときに既定値)(推奨どおり) |
| 3 | キーの確かめの失敗の分け方 | 無効は 422・通信の失敗は 502。どちらも保存しない(推奨どおり) |
| 4 | 暗号の鍵の回し方 | `MultiFernet` で複数の鍵を並べる。読めないキーは登録し直しを促す(推奨どおり) |

自動実装モードは、Phase 7 以降と同じ on として計画に書き、計画の承認で確定した。

Claude の判断(計画の承認で確定、または作業中):

- カタログは別の API(`GET /llm/catalog`)。`PUT /users/me/models` は選択の全体の置き換え。
- キーの確かめは `httpx` で直接呼ぶ(URL とヘッダーは Context7 で公式の資料を確かめた)。キーは URL に載せない。`E2E_FAKE_LLM` のときは確かめない。
- キーの登録の試行を、ユーザーごとに1時間10回で数える。末尾は4文字だけ平文で持ち、API はキー本体を返さない。
- `cryptography` を直接の依存に足し、422・503 の基底の例外を `app/core/errors.py` に足した。
- **作業中**: 既定値を `.env` から作る関数(`env_default_models`)を、seed と API の両方が使うので `app/services/llm_defaults.py` に置いた(67-2)。
- **作業中**: 判定の「費用の低いモデルを推奨」の文言を API の用途の説明から外し、画面が `recommend_low_cost` の印で出す形にした(67-4)。
- **作業中**: モデルの選択欄を、計画の `SelectGroupWithLabel`(Tamagui の Select)からブラウザ標準の `<select>` に変えた(jsdom でテストしにくいため。詳細設計の表と同じ)(67-4)。
- **作業中**: ブラウザでの確認で、幅 375px のとき「既定に従う(…)」のラベルと選択欄が枠からはみ出したので、折り返すように直した(67-4)。

推奨と違った選択は無し。計画の差し戻しは無し。#39 の材料。

完了後の調整(#38):

- **マイページの3つの節を排他のアコーディオンに**(ユーザーの指示): 初めはアカウントを開く。閉じた節の中身は外れ、開くたびに読み直すので、節どうしの読み直しの仕組み(`reloadKey`・`onChanged`)を外した。`AccordionInner` に項目の `flex` を渡せるようにした(縦に並べると見出しが重なったため)。詳細は [67-4](./Phase-67-4.md)「完了後の調整」。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-67-1.md`](./Phase-67-1.md) | 暗号とモデルのカタログ | あり(本体 6 + テスト 2) | なし |
| [`Phase-67-2.md`](./Phase-67-2.md) | モデルと API キーのテーブル・seed | あり(本体 8 + テスト 1) | 67-1(カタログ) |
| [`Phase-67-3.md`](./Phase-67-3.md) | モデルと API キーの API | あり(本体 6 + テスト 3) | 67-1・67-2 |
| [`Phase-67-4.md`](./Phase-67-4.md) | マイページのモデルと API キーの節 | あり(本体 5 + フィクスチャ 1 + テスト 5) | 67-3(API) |

## サンプルコード一覧

`textbook/samples/backend/`・`textbook/samples/frontend/` の新規・更新:

- 67-1: `pyproject.toml`・`app/core/config.py`・`app/core/errors.py`・`app/services/errors.py`・`app/core/crypto.py`(新規)・`app/ai/llm/catalog.py`(新規)・`tests/unit/test_crypto.py`(新規)・`tests/unit/test_llm_catalog.py`(新規)
- 67-2: `app/models/user_model_setting.py`・`app/models/user_api_key.py`(新規)・`app/models/__init__.py`・`alembic/versions/9e1c5a7b3d20_add_user_llm_settings.py`(新規)・`app/repositories/user_model_setting.py`・`app/repositories/user_api_key.py`(新規)・`app/services/llm_defaults.py`(新規)・`scripts/seed.py`・`tests/unit/test_seed_models.py`(新規)
- 67-3: `app/ai/llm/key_check.py`・`app/schemas/llm_settings.py`・`app/services/llm_settings_service.py`・`app/api/routes/llm.py`(新規)・`app/api/routes/__init__.py`・`app/api/routes/users.py`・`tests/unit/test_key_check.py`・`tests/unit/test_llm_settings_service.py`・`tests/integration/test_llm_settings_flow.py`(新規)
- 67-4: `src/features/mypage/`(`api/llmSettingsApi.ts`・`model-draft.ts`・`components/ModelSection.tsx`・`components/ApiKeySection.tsx`・`test-utils/llmFixtures.ts`。新規)・`src/app/mypage/page.tsx` とテスト5つ(`page.test.tsx` 以外は新規)
- `.env.example`(外側・backend)の `ENCRYPTION_KEY` は設定ファイルなので samples にミラーしない(#21)。ブラウザでの確認のスクリプトはジョブの一時フォルダに置き、samples にミラーしない。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [67-1](./Phase-67-1.md) | `crypto.py`・`catalog.py`・設定・例外 | キーを暗号化する(鍵は複数並べて回せる)/ 選べるモデルと用途を静的な表で持つ | 往復・鍵の回し方・古い鍵を外すと読めない・鍵が無いと 503 / 表の形と検索 |
| [67-2](./Phase-67-2.md) | 2つのモデル・マイグレーション・2つのリポジトリ・`llm_defaults.py`・seed | 用途ごとの選択とキーを保存する / 既定値は null の行で、`.env` が正 | 用途への割り当て・カタログの外は失敗・seed の上書きと冪等・置き換えで省いた用途が消える・マイグレーションの往復 |
| [67-3](./Phase-67-3.md) | `key_check.py`・スキーマ・`LlmSettingsService`・ルート | 保存の前にキーを確かめて暗号化する / 選べる provider をサーバーが決めて返す | ヘッダーと失敗の分け方・一般ユーザーと superuser の選べる範囲・`key_missing`・`needs_reregister`・503 は外部を呼ぶ前・試行の上限・既定値の一意(実 Postgres) |
| [67-4](./Phase-67-4.md) | `llmSettingsApi.ts`・`model-draft.ts`・2つの節・ページ | 用途ごとに AI とモデルを選んでまとめて保存する / キーを登録・削除して末尾だけを見せる | 選べない AI の無効と理由・判定の注記・送る選択・欄のエラーとメッセージ・鍵なし・削除の確認・キーの変更でモデルの節を読み直す |

## 写経順序(#23)

章番号順(67-1 → 67-2 → 67-3 → 67-4)。各章の表の順(依存順。#30)に写す。

- 67-2 のマイグレーションを写したら、`alembic upgrade head` を流す(流さなくても既存の画面は動くが、67-3 の API は新しいテーブルを読む)。
- 67-3 まで写したら、`.env` に `ENCRYPTION_KEY` を足して API を起動し直す(無ければキーの登録だけが 503 になる。作り方は `.env.example`)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 67-1: `crypto.py` → `cryptography.fernet`(外部。67-1 で直接の依存に)・`settings`(既存)・`DecryptionFailedError`・`EncryptionUnavailableError`(67-1 の `services/errors.py`。表で先に置く)。`services/errors.py` → `ServiceUnavailableError`・`UnprocessableEntityError`(67-1 の `core/errors.py`。表で先に置く)。`catalog.py` → 標準(`dataclasses`・`enum`)だけ。テスト → この章のものと `settings`。
- 67-2: 2つのモデル → `sqlalchemy`・`Base`(既存)。`models/__init__.py` → 2つのモデル(67-2。表で先に置く)。リポジトリ → 2つのモデル(67-2)・`CRUDRepository`(既存)。`llm_defaults.py` → `Provider`・`Purpose`・`provider_of`(67-1)・`Settings`(既存)。`seed.py` → `settings`(既存)・`UserModelSettingRepository`・`env_default_models`(67-2。表で先に置く)。マイグレーション → `alembic`・`sqlalchemy` だけ。
- 67-3: `key_check.py` → `httpx`(既存の依存)・`Provider`(67-1)・`settings`(既存)。スキーマ → `Provider`・`Purpose`(67-1)。サービス → `PURPOSES`・`Provider`・`Purpose`・`find_model`(67-1)・`KeyCheckResult`・`KeyVerifier`(67-3。表で先に置く)・`crypto` の4関数(67-1)・2つのリポジトリ・`env_default_models`(67-2)・5つの例外(67-1)・`User`(既存)。`routes/llm.py` → `CATALOG`・`PROVIDER_LABELS`・`PURPOSES`(67-1)・`CurrentUserDep`(既存)・スキーマ(67-3)。`routes/users.py` → `Provider`(67-1)・`KeyVerifier`・`get_key_verifier`・スキーマ・サービス(67-3)・`encryption_available`(67-1)・`RateLimit`・`RateLimiter`(既存)。`routes/__init__.py` → `routes/llm.py`(67-3)。
- 67-4: `llmSettingsApi.ts` → `apiFetch`(既存)。`model-draft.ts` → `llmSettingsApi` の型(67-4。表で先に置く)。`ModelSection.tsx` → `RadioGroupItem`・`StyledButton`・`RadioGroupWithLabel.module.css`・`ApiError`・`useToastController`(既存)・`llmSettingsApi`・`model-draft`(67-4)。`ApiKeySection.tsx` → `InputPassword`・`ConfirmDialog`・`StyledButton`・`ApiError`(既存)・`llmSettingsApi`(67-4)。ページ → 2つの節(67-4)。テスト → `stubFetch`(既存)・`llmFixtures`(67-4)。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する(マイグレーションは往復の実行で、`pyproject.toml` は `cryptography` の import で確かめた)。

## 検証結果

- 章ごとの部分テスト: devex-api は 67-1〜67-3 のテストと seed のテスト(43件)。devex-ui はマイページ(28件。ページのテストを含め 30 件)。すべて成功。
- Phase 完了時の全体テスト(#18): devex-api **1360 件成功**(19 件は integration で除外)。integration **19 件成功**(既存を含む全部。実際の PostgreSQL。この Phase で3件増えた。1度目は今日の実行の積み重ねで登録の上限(接続元 127.0.0.1 が 15/10)に当たり、既存の `test_projects_flow.py` の5件が落ちた。カウンタが切れてから流し直した)。devex-ui **1001 件成功**(155 ファイル。`--maxWorkers=4`)。
- `ruff check`(全体)成功。`pyright`: この Phase のファイルとテストは 0 件。全体では既存の7件(`test_chat_service.py` の4件・`test_chat_stream_errors.py` の1件・`test_doc_generation_start.py` の2件。この Phase では触っていない)。`tsc --noEmit`・マイページの `eslint` 成功。
- マイグレーション: リビジョン ID の衝突なし・head は1つ(`9e1c5a7b3d20`)。dev の DB で `upgrade 9e1c5a7b3d20` → `downgrade 4b7e2d9c1a6f` → `upgrade 9e1c5a7b3d20` の往復が通り、一意の制約が `NULLS NOT DISTINCT` で作られた(`\d user_model_settings`)。
- ブラウザでの確認(Playwright のスクリプト。dev の UI):
  - 手元の API(暗号の鍵なし): マイページに「モデル」「API キー」の節が出る。チャットは「既定に従う」が選ばれ、Claude は無効。判定に低費用の注記。キーの節に「暗号の鍵が設定されていない」の知らせ。
  - 暗号の鍵を渡した一時の API(ポート 8001。`E2E_FAKE_LLM` でキーの確かめを飛ばす。ブラウザの要求を 8000 から回した): 生成に「Gemini 3.8 Flash」を選んで保存するとトースト「モデルを保存しました」。Claude のキーを登録すると「登録済み(末尾 …4321)」になり、チャットの Claude が選べるようになる。Claude を選んで保存した後にキーを削除すると「Claude のキーが無いので、使うときは既定(Gemini 3.5 Flash-Lite)に従います。」。
  - 幅 375px: 1度目はラジオのラベルと選択欄が枠からはみ出した。直した後は右端を越える要素が無く、ページの横スクロールも無い。幅 1280px で崩れない。
  - コンソールのエラー: 401(ログイン前の refresh の既存の応答)だけ。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 作り忘れ 0 件。不一致 1 件は Phase 65 から残る `ProjectListControls.tsx`(下の「未消化の申し送り」)。この Phase のファイルはすべて一致(一致 750 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は以前からの `change-impact-demo` のルート)。`link_check.py`: 切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。キーの確かめも外部を呼んでいない(テストは `MockTransport`、ブラウザは `E2E_FAKE_LLM`)。

## 未消化の申し送り(#37)

Phase 66 から引き継いだもの:

- **ステージ9の計画の残り**(Phase 68〜72): 生成のモデルと Gemini の無料枠(→ 68)・再生成の失敗を画面で知らせていない・段階の作り直しの後に承認できない・テスト仕様書を生成中に画面を開き直す(→ 69)・カードで選ぶと観点の要約が置き換わる・値のカードが論点の一部しか値にしない・要件ごとのテストの書き方が浅い・変更のきっかけを列挙する再生成の設計(→ 70)・実装手順書のゴールと単位の食い違い(PR-7)・DFD のデータストアの書き漏れ・画面の文の変更は、その画面のすべての処理へ届く(→ 71)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から。全体では `test_chat_stream_errors.py`・`test_doc_generation_start.py` の3件も出ている)・**並列のテストのタイムアウト**(Phase 44 から。この Phase も devex-ui は `--maxWorkers=4` で流した)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。
- **Phase 68〜72 の未確定事項**: [61-3](../Phase-61/Phase-61-3.md)「未確定事項」(62〜67 の分は解決)。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する(表は [`app/ai/llm/catalog.py`](../samples/backend/app/ai/llm/catalog.py))。
- **確認メールの送信**: 範囲の外。
- **画面確認(#37 の運用注記)**: ヘッダー・メニュー・モード選択(Phase 62)・認証ページの振り分け(Phase 63)・削除のボタン・ダイアログ・トースト(Phase 64)・検索・絞込み・ページ送り(Phase 65)・マイページのアカウント(Phase 66)は、Phase 72 の本番確認でまとめて見る。本番は https なので、印に `Secure` が付くこともそこで確かめる。**マイページ(アカウント・モデル・API キー)の操作感は、この Phase の直後にユーザーが確かめる**([61-3](../Phase-61/Phase-61-3.md))。手元で試すには、`devex-api/.env` に `ENCRYPTION_KEY` を足して API を起動し直す。
- **登録の上限と手元の確認**: 既存の `test_auth_flow.py`・`test_projects_flow.py` は API で登録するので、integration を流し直すと登録・ログインの上限(10回/時)に当たる。この Phase でも、1度目の全体の integration で `test_projects_flow.py` の5件が登録の上限で落ちた(流し直しで成功)。この Phase の integration は利用者を DB に直接作った。[`retrospective-memo.md`](../retrospective-memo.md) の「統合テストとレート制限のカウンタを分ける」と同じ問題。
- **削除したプロジェクトの URL を開いたときの表示**(Phase 64 から): 「Project {id} not found」がそのまま出る。直すなら、404 のときの文言を画面で「このプロジェクトは見つかりません(削除された可能性があります)」とし、ダッシュボードへのリンクを出す。
- **AlertDialog の開発時の警告**(Phase 64 から): Tamagui 2.6.0 の AlertDialog が、開く前に説明文を探して警告を出す(誤検知)。版を上げるときに消えるか確かめる。
- **トーストの v2 の API**(Phase 64 から): `@tamagui/toast/v2` の `Toaster` は 2.6.0 の web で `accessibilityLabel` を DOM に渡す。版を上げて直っていれば、v2 に寄せてもよい。
- **新規作成の後の一覧の cache**(Phase 65 から): `dashboard-store` の `invalidate` を呼ぶ所が無い。プロジェクトを作ってから20秒以内に同じ条件のダッシュボードへ戻ると、新しいプロジェクトが出ない。気になるなら、作成の成功で `invalidate()` を呼ぶ。
- **ダッシュボードの見出しの折り返し**(Phase 65 から): 幅 375px で「ダッシュボード」の見出しが3行に折り返す。Phase 72 の画面確認で見る。
- **`ProjectListControls.tsx` の samples と本体の食い違い**(Phase 65 の完了後の調整から): 本体のコミット(`5269927`)の検索欄に `maxWidth="480px"` が無く、samples にはある。どちらが正しいかをユーザーが決め、もう一方を合わせる。
- **ほかの端末のアクセストークン**(Phase 66 から): パスワードを変えても、ほかの端末のアクセストークン(30分)はその寿命まで使える。すぐに切りたいなら、トークンに発行の時刻を持たせ、パスワードの変更の時刻と比べる仕組みが要る(今は入れない)。
- **アカウントのフォームの縦の余白**(Phase 66 から): `FormGeneral` はボタンの下にスピナーの場所(40px)を持つので、3つのフォームの下に空きが出る。アコーディオンの中での見た目を、操作感の確認で見る。
- **閉じると保存していない編集が消える**(完了後の調整から): アコーディオンで節を閉じると中身が外れるので、モデルの節で選んで保存しないまま API キーの節を開くと、選んだものは消える。気になるなら、`Accordion.Content` に `forceMount` を付けて中身を残す(そのときは節どうしの読み直しの仕組みを戻す)。

この Phase で生まれたもの:

- **本番の既定値の行と暗号の鍵**(→ Phase 72): `scripts/seed.py` は dev 専用と書かれている。本番で既定値の行を `seed_default_models` だけ流して入れるか、行が無くても `.env` の値で補う今の形のままにするかを決める。`ENCRYPTION_KEY` の作り方と置き場、鍵を回す手順を `OPERATIONS.md` に書く。
- **Phase 68 への引き継ぎ**: 解決は `LlmSettingsService.get_model_settings` の結果(`key_missing` の用途は既定値)と、`UserApiKeyRepository` の暗号文(`decrypt_secret`。読めなければ既定値)から作れる。一般ユーザーは既定値と違う provider を自分のキーがあるときだけ選べるので、解決で「既定のキーで別の provider」を呼ぶ経路は生まれない。レビューの実効値の条件は Phase 68 で改める([内部設計書](../../docs/internal_design.md) 3.3節 9項)。
- **dev の DB に残った確認用の利用者**: ブラウザでの確認で作った `mypage67-…@example.com` の利用者が2人ある(一時の API の鍵で暗号化したキーは削除済み。モデルの選択の行は残る)。消してもよい。
- **セッションの区切りの記録**: Phase 67 は1セッションで行った(計画モードで調査 → 質問1回(4問)→ 計画の承認 → 67-1〜67-4 の実装 → ブラウザでの確認と 375px の修正 → samples → docs → 教材)。

この Phase で解決したもの:

- **61-3 の Phase 67 の未確定事項**(テーブルの形・既定値の行と seed の上書きの規則・カタログの取得の API・キーの確かめの失敗の分け方・暗号の鍵の回し方): 着手時の相談と [67-2](./Phase-67-2.md)・[67-3](./Phase-67-3.md)・[67-1](./Phase-67-1.md)。
- **ステージ9 で足すエラーのコードの名前**([内部設計書](../../docs/internal_design.md) 3.4節): Phase 66 の `CURRENT_PASSWORD_MISMATCH` とこの Phase の5つを書いた。

## 後続 Phase での改訂

- Phase 68: カタログのモデルに `timeout_seconds` を足した([68-1](../Phase-68/Phase-68-1.md))。`LlmSettingsService` に、自分のキーを復号して返す `decrypted_api_key` を足した(LLM の解決が使う。[68-2](../Phase-68/Phase-68-2.md))。

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 既定値を `user_id` が null の行で持つとき、普通の一意制約では何が起きるか。`NULLS NOT DISTINCT` は何を防ぐか。
2. 一般ユーザーが既定のキーで選べる provider を「既定値と同じ provider」に絞ったのはなぜか。キーを消したとき、選択の行を消さずに `key_missing` で返すのはなぜか。
3. キーの確かめで、429 を「無効」でなく「確かめられない」に分けたのはなぜか。どちらの失敗も保存しないのはなぜか。
4. `MultiFernet` で鍵を並べると、鍵を替えるときに何が楽になるか。古い鍵を外したキーはどう扱われるか。
5. 選べる provider をサーバーが判定して `selectable_providers` で返し、画面が同じ規則を持たないのはなぜか。

## 次のフェーズ

**Phase 68**: LLM の呼び出しをユーザーごとに解決する(取得関数を「ユーザーと用途 → LLM」に。キャッシュの鍵は (provider, モデル, キー)・呼び出し約8か所・provider に固有の処理を両方で通す・レビューの実効値の条件・モデルごとのタイムアウトと混雑の再試行)。着手時に自動実装モード(#21)と [61-3](../Phase-61/Phase-61-3.md) の未確定事項(解決の置き場・provider に固有の処理の差・自分のキーで流すレビューに1日の上限を残すか・モデルごとのタイムアウトの既定値と 503・504 を待つ再試行の回数)を決める。Claude・Gemini の切り替えの確認で実 LLM を呼ぶので、Sonnet を回すなら見込みの費用の表を出す。

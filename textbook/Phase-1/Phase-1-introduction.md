# Phase 1 導入: 環境構築

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.2節 WBS区分1(要件確認・環境構築タスク)の残タスクを完了させ、Phase 2(バックエンド開発)以降がこの上で安全に開発を始められる状態にする。対象は次の2点:

1. Docker Compose 環境構築(Next.js / FastAPI / PostgreSQL のコンテナ連携)の動作確認
2. 外部APIキー取得・`.env` 管理方針の確立

WBS区分1の残り5項目のうち「①キックオフ・要件確認」「②リポジトリ構成の最終確認(独立2リポジトリ)」は [`Phase-0-2.md`](../Phase-0/Phase-0-2.md) の実装ロードマップ確定をもって完了済み。本 Phase はその続きを扱う。

## モード宣言(#21)

本 Phase(1-1・1-2 の全2章)は**納期モード**で実施する。

- 条件(a): 扱う対象(Docker Compose 起動・`.env` の値の整合)はいずれも定型的なインフラ設定であり、ドメイン判断を体現する箇所が過半数を下回る。
- 条件(b): MVPコアループ(チャット↔4文書生成、[`Phase-0-2.md`](../Phase-0/Phase-0-2.md) の Phase 2-3・2-4)そのものではなく、その土台となる付随作業である。

したがって #14 の SUT/ドライバ/スタブの言語化は省略し、各章の「テスト観点」は「動くこと」の確認(既存テストの実行・起動確認)に留める。学習の回収は Phase 完了時の振り返りに委ねる(#10、別セッション)。

## パイプライン上の位置づけ・前提

- 前提として読むべきもの: [`Phase-0-2.md`](../Phase-0/Phase-0-2.md)(実装ロードマップ、Phase 1 のスコープが「環境構築」に確定した経緯)、[`decision-digest.md`](../decision-digest.md)(LLM=Gemini Flash-Lite無料枠 等、Phase 0 の確定事項)、[`devex-api/CLAUDE.md`](../../devex-api/CLAUDE.md)(レイヤー構成・Docker構成の意図)、[`devex-ui/CLAUDE.md`](../../devex-ui/CLAUDE.md)(バックエンド連携の前提)。
- 本 Phase 開始時点で、Docker Compose 一式(`docker-compose.yml`/`docker-compose.prod.yml`/`backend/Dockerfile`/`nginx/`)と `.env.example`(root・`backend/` の2種)は devex-api のスターターテンプレートとして**既に用意されている**。よって本 Phase の作業は「新規構築」ではなく「動作確認」「方針のドキュメント化」「spec(`docs/requirements.md` で確定済みの LLM=Gemini Flash-Lite 等)とのズレの是正」が中心になる。
- devex-ui は docker-compose に含めない設計(`npm run dev` で起動し、`NEXT_PUBLIC_API_URL` 経由で別リポジトリの FastAPI を叩く)。これは [`devex-ui/CLAUDE.md`](../../devex-ui/CLAUDE.md)「バックエンド連携」節の既存方針であり、本 Phase で変更しない。

## 章一覧

| 章 | トピック | 依存 |
|---|---|---|
| [`Phase-1-1.md`](./Phase-1-1.md) | Docker Compose 環境の動作確認(postgres/redis/backend/nginx 起動、マイグレーション、devex-ui との疎通) | 前提: 上記 CLAUDE.md 2本 |
| [`Phase-1-2.md`](./Phase-1-2.md) | 外部APIキー取得・`.env` 管理方針(`GEMINI_MODEL` の spec 整合、`TAVILY_API_KEY` の位置づけ) | `Phase-1-1.md`(起動確認済みのスタックを使って動作確認する) |

両章とも `docker-compose.yml`/`.env*` という設定ファイルと、`conftest.py` の文字列リテラル1箇所の修正のみを扱い、新規シンボル(関数・クラス)を導入しない。したがって #13(全ファイル解説)は上のチェックリスト表で代替し、#15 の前方import監査は対象外(import グラフに変化がない)。

## サンプルコード一覧

**`textbook/samples/` への追加なし。** 本 Phase で扱うファイル(`docker-compose.yml`・`.env.example`・`.env` 等)は devex-api 直下に唯一の正本として既に存在し、「写経元(サンプル)を用意し実プロジェクトへ複写する」という [CLAUDE.md](../../CLAUDE.md) #3 の三重管理回避の分離自体が適用されない(正本を直接編集する)。各章では対象ファイルの相対パスを明記した上で差分を示す。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

触るファイル一覧・役割・テスト観点(納期モードのため簡潔)。事前の想定では「確認作業のみで変更ファイルなし」の章もあったが、実際に動作確認したところ複数の不整合(旧テンプレートのプレースホルダ値の残留)が見つかり、以下の修正を伴った(詳細は各章参照):

| # | ファイル | 役割 | テスト観点 |
|---|---|---|---|
| 1-1 | [`devex-api/docker-compose.yml`](../../devex-api/docker-compose.yml) | postgres/redis の `ports` 追加(ホストからの統合テストを可能にする) | `docker compose ps` で healthy |
| 1-1 | [`devex-api/.env`](../../devex-api/.env) | `DATABASE_URL` の認証情報不整合を修正、`POSTGRES_PORT`/`REDIS_PORT` 追加 | `curl .../health` が `database: ok` |
| 1-1 | [`devex-api/.env.example`](../../devex-api/.env.example)(root) | 同上の項目をテンプレートにも反映 | 実ファイルとの整合(目視) |
| 1-1 | [`devex-api/backend/tests/conftest.py`](../../devex-api/backend/tests/conftest.py) | 統合テストの `DATABASE_URL` フォールバックを実環境の認証情報に合わせて修正 | `pytest -m integration tests/integration/test_health.py` が green |
| 1-2 | [`devex-api/.env.example`](../../devex-api/.env.example)(root) | `GEMINI_MODEL` を spec(Gemini Flash-Lite)に修正 | 目視 + grep |
| 1-2 | [`devex-api/backend/.env.example`](../../devex-api/backend/.env.example) | 同上 | 同上、root版との値の整合 |
| 1-2 | [`devex-api/.env`](../../devex-api/.env) | 実行時の実値、`GEMINI_MODEL` 修正 | `pytest tests/unit/test_config_safety.py` が green、`get_settings().GEMINI_MODEL` が期待値 |

## 写経順序(#23)

章番号順(1-1 → 1-2)。1-2 の疎通確認は 1-1 で起動したスタックをそのまま使う。

## Phase完了チェック(#22)

1. なぜ devex-ui は `docker-compose.yml` に含めず `npm run dev` で起動する設計になっているか、`devex-ui/CLAUDE.md` の方針を踏まえて説明できるか。
2. root の `.env.example`(`devex-api/.env.example`)と `devex-api/backend/.env.example` は、それぞれどの起動方法(Docker Compose 経由 / ホスト直接実行)に対応するか説明できるか。
3. `Settings._reject_unsafe_production_settings` が `ENVIRONMENT=production` の起動時にだけ弱い `JWT_SECRET_KEY`/`DEBUG=true` を拒否するのはなぜか(実行時ではなく起動時に落とす理由を含めて)説明できるか。
4. `GOOGLE_API_KEY` と `TAVILY_API_KEY` は、それぞれ現在の devex-api のどの機能に対応し、将来の Devex 本体(`chat_service.py`/`doc_generator_service.py`、Phase 2-3・2-4)ではどちらが不要になるか説明できるか。
5. 本 Phase がなぜ納期モードの対象になり得たか、#21 の条件(a)(b)に照らして説明できるか。

## 次のフェーズ

**Phase 2**: バックエンド開発(2-1 DB移行〜2-5 エクスポート・エラーハンドリング)。詳細は [`Phase-0-2.md`](../Phase-0/Phase-0-2.md) のロードマップを参照。ユーザーが「Phase 2 を開始する」と発話するまでは着手しない(#5)。

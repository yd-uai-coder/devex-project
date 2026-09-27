# Phase 5 導入: デプロイ・運用準備

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.2節 WBS区分5(デプロイ・運用準備タスク)を実装する: 本番用Dockerイメージの監査・最終確認、本番相当環境での動作検証+実API検証、運用マニュアル・READMEの整備、README整備+GitHub Actions自動デプロイの4章構成。加えて[`Phase-4-introduction.md`](../Phase-4/Phase-4-introduction.md)「Phase 4全体としての既知の残課題」が本Phaseへ申し送った2点 ── 実Gemini APIキーでの動作確認、`LLM_TIMEOUT_SECONDS`の実測調整 ── にも対応する。

**5-4は5-1〜5-3完了後、ユーザーからの追加依頼(README群がテンプレート説明のままであること・GitHub Actionsでの自動デプロイ)を受けて追加した章である**(Phase 4が完了後に複数の「Phase N完了後」decision-digestエントリを積み重ねた前例と同じ扱い)。

Phase 1〜4で完成したMVP(認証・チャットヒアリング・4文書生成・E2Eテスト一式)を、実際にConoHa VPS(devex-api)・Vercel(devex-ui)へデプロイできる状態に仕上げることが目的である。ただし本Phase自体で実際のライブデプロイは行わない(下記「スコープ」参照)。

## スコープ

ユーザーとの相談で以下を確定した:

- **対象範囲**: WBS区分5の3項目 + Phase 4申し送りの2項目のみ。以下は**本Phaseの対象外**とし、decision-digestに将来課題として記録するに留める(詳細は本introduction末尾「対象外にした既知の課題」参照): `prompt_templates`テーブルの放置(モデル・マイグレーションのみ存在、repository/service/route/UI一切なし)、レガシーな汎用`conversations`/`messages`/`chat.py`の残存、ドキュメント生成がLangGraphを使わず手続き的な`llm.ainvoke()`呼び出しである点。
- **デプロイ先**: devex-ui → Vercel。devex-api(FastAPI+PostgreSQL+Redis) → 契約済みのConoHa VPS(生VPS、マネージドPaaSではなく自前Docker運用)。
- **実施深度**: ローカルの本番相当環境(`docker-compose.prod.yml`)での検証+運用マニュアル整備までに留める。実際のVPS/Vercelへのライブデプロイはユーザー自身が運用マニュアルに沿って別途行う。

## モード宣言(#21)

本Phase(5-1・5-2・5-4の3章)は**納期モード**で実施する。5-3は実装ファイルを作らない章のためモード宣言の対象外([`Phase-0-1.md`](../Phase-0/Phase-0-1.md)等の設計章と同様の扱い)。

- 条件(a): 扱う対象(Docker/nginx/compose設定の監査、TLS証明書取得手順、運用マニュアル)は大半が定型的なインフラ作業であり、ドメイン判断を体現する箇所(タイムアウト値の実測決定等)は少数。
- 条件(b): MVPコアループ(チャット↔4文書生成)そのものではなく、その運用面の付随作業である。

したがって#14のSUT/ドライバ/スタブの言語化は省略し、各章の「テスト観点」は「動くこと」の確認に留める。ただし判断点(`LLM_TIMEOUT_SECONDS`の値、`GEMINI_MODEL`の変更等)は理由を明記する。

## パイプライン上の位置づけ・前提

- 前提として読むべきもの: [`Phase-4-introduction.md`](../Phase-4/Phase-4-introduction.md)(申し送り2点の原文)、[`Phase-1-introduction.md`](../Phase-1/Phase-1-introduction.md)(devex-api直下のインフラ設定ファイルをsamplesへミラーせず直接編集する前例、本Phaseもこれを踏襲する)、[`decision-digest.md`](../decision-digest.md)。
- 本Phase開始時点で、`devex-api`には**すでに本番用Docker一式がスターターテンプレート由来で存在する**([`Phase-1-introduction.md`](../Phase-1/Phase-1-introduction.md)が既に記録済み): `backend/Dockerfile`(`base → builder → runtime`の3段構成)、`docker-compose.prod.yml`(postgres/redis/backend/nginxの4サービス)、`nginx/nginx.prod.conf`(HTTP→HTTPSリダイレクト+TLS終端+certbot webroot対応の場所)。したがって本Phaseの「Docker最適化」「デプロイ検証」は**ゼロからの構築ではなく既存インフラの監査・不足分の補完・実際の検証**が中心になる。
- `/health`エンドポイント(`app/main.py`)、`CORS_ORIGINS`環境変数(`app/core/config.py`)はいずれも既存(Phase 1〜4で用意済み)。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-5-1.md`](./Phase-5-1.md) | 本番用Dockerイメージの監査・最終確認 | 納期 | なし |
| [`Phase-5-2.md`](./Phase-5-2.md) | 本番相当環境での動作検証+実API検証 | 納期 | 5-1(監査済みのイメージを使う) |
| [`Phase-5-3.md`](./Phase-5-3.md) | 運用マニュアル・README整備 | 対象外(設計章) | 5-1, 5-2(検証結果を手順書に反映) |
| [`Phase-5-4.md`](./Phase-5-4.md) | README整備の続き(root/devex-api/devex-ui) + GitHub Actionsでの自動デプロイ + 既存lintエラー是正 | 納期 | 5-3(READMEを土台に追記) |

5-1・5-2は`docker-compose.prod.yml`・`nginx/*.conf`・`backend/Dockerfile`という設定ファイルと、`app/core/config.py`(既にPhase 4-3からsamples対象)の値変更のみを扱い、新規シンボル(関数・クラス)を導入しない。したがって#13(全ファイル解説)は各章の「この章で作成・更新したファイル」表で代替し、#15の前方import監査はPythonコード(`config.py`)のみが対象、Docker/nginx/compose部分は対象外(コマンド実行結果で検証する。詳細は各章「テスト観点」参照)。5-3はコードを作成しないため#13・#15・#12リファクタ追従いずれも対象外。5-4も新規GitHub Actionsワークフロー(YAML、import概念が無い)とREADME/OPERATIONS.mdの追記が中心のため#15の前方import監査は対象外。既存backendコードのlint是正(コメント・docstringの折り返しのみ、ロジック不変)は#13の対象だが新規シンボルを導入しないため簡潔に扱う(詳細は[`Phase-5-4.md`](./Phase-5-4.md)参照)。

## サンプルコード一覧

[`textbook/samples/backend/app/core/config.py`](../samples/backend/app/core/config.py)の`GEMINI_MODEL`・`LLM_TIMEOUT_SECONDS`をPhase-5-2タグで更新した(#29の更新規約に従い旧値をコメントアウト+新値)。これが本Phase唯一のsamples反映。

`docker-compose.prod.yml`・`nginx/nginx.prod.conf`・`backend/Dockerfile`・`devex-api/OPERATIONS.md`・`devex-api/README.md`・`devex-ui/README.md`・`.env`/`.env.example`(root・backend)は、[`Phase-1-introduction.md`](../Phase-1/Phase-1-introduction.md)が確立した前例(devex-api直下のインフラ設定ファイルはsamplesへミラーせず直接編集する)を踏襲し、samplesへの追加なし。各章では対象ファイルの相対パスを明記した上で差分を示す。

5-4で新規追加した`devex-api/.github/workflows/deploy.yml`・`devex-ui/.github/workflows/ci.yml`、root`README.md`・root`CLAUDE.md`(リポジトリ間リンク・ルール#34追加)も同じ理由でsamples対象外。5-4で行った既存backendコードのlint是正(ruff `E501`等49件、コメント・docstringの折り返しのみ)は、`textbook/samples/backend/`のミラーへは反映していない ── クラス名・シグネチャ・型に変更が無い純粋な整形であり、rule #9が対象とする「検討・相談の中で提示するコード」の変更ではないため(詳細な判断根拠は[`Phase-5-4.md`](./Phase-5-4.md)参照)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| # | ファイル | 役割 | テスト観点 |
|---|---|---|---|
| 5-1 | [`devex-api/backend/Dockerfile`](../../devex-api/backend/Dockerfile) | runtimeステージに`HEALTHCHECK`追加(`docker compose ps`のHEALTH列、`depends_on: condition: service_healthy`のため) | `docker build --target runtime`成功+`docker inspect`のHealthcheck設定確認 |
| 5-2 | [`devex-api/docker-compose.prod.yml`](../../devex-api/docker-compose.prod.yml) | backendに`healthcheck:`追加、nginxの`depends_on`を`condition: service_healthy`化、証明書取得専用の`certbot`サービス(`profiles: ["certbot"]`)追加 | `docker compose -f docker-compose.prod.yml config`が通る、実際に`up`してpostgres/redis/backend/nginx全て healthy |
| 5-2 | [`devex-api/backend/app/core/config.py`](../../devex-api/backend/app/core/config.py) | `GEMINI_MODEL`既定値・`LLM_TIMEOUT_SECONDS`既定値を実測結果に基づき更新 | `uv run pytest -m "not integration"`(既存121件)がgreen |
| 5-2 | [`devex-api/.env`](../../devex-api/.env)・[`.env.example`](../../devex-api/.env.example)(root・backend) | `GEMINI_MODEL`を`gemini-3.5-flash-lite`に修正 | 実Gemini API呼び出しが成功する(下記5-2「実測結果」参照) |
| 5-3 | [`devex-api/OPERATIONS.md`](../../devex-api/OPERATIONS.md)(新規) | VPS初期セットアップ〜TLS証明書取得〜バックアップ〜ロールバック〜Vercelデプロイの手順書 | 目視レビュー(実装ファイルを作らない章のためテスト対象外) |
| 5-3 | [`devex-api/README.md`](../../devex-api/README.md)・[`devex-ui/README.md`](../../devex-ui/README.md) | OPERATIONS.mdへのリンク追加、Devex固有のVercelデプロイ手順追記 | 目視レビュー、リンク切れが無いこと |
| 5-4 | root [`README.md`](../../README.md)・root [`CLAUDE.md`](../../CLAUDE.md) | devex-api/devex-uiへのリンク追加、ルール#34(完了報告は日本語)追加 | 目視レビュー |
| 5-4 | [`devex-api/README.md`](../../devex-api/README.md)・[`devex-ui/README.md`](../../devex-ui/README.md) | テンプレート説明主体だった冒頭をDevex機能の説明に書き換え(既存のテンプレートとしての説明は「本リポジトリの位置づけ」節として保持) | 目視レビュー、リンク切れが無いこと |
| 5-4 | [`devex-api/.github/workflows/deploy.yml`](../../devex-api/.github/workflows/deploy.yml)(新規) | push/PR時のlint+test、`main`へのpush時にConoHa VPSへSSHデプロイ | YAML構文チェック(`yaml.safe_load`)、ローカルで`uv run ruff check .`・`uv run pytest -m "not integration"`が通ること |
| 5-4 | [`devex-ui/.github/workflows/ci.yml`](../../devex-ui/.github/workflows/ci.yml)(新規) | push/PR時のlint+test+build(デプロイはVercelネイティブ連携に委ねる) | YAML構文チェック、ローカルで`npm run lint`・`npm run test`・`npm run build`が通ること |
| 5-4 | [`devex-api/OPERATIONS.md`](../../devex-api/OPERATIONS.md) | 「9. GitHub Actionsによる自動デプロイ」節新設、ロールバック手順にrevert運用を追記 | 目視レビュー |
| 5-4 | `devex-api/backend/`配下の既存lintエラー是正(49件のE501+1件のSIM105、詳細は[`Phase-5-4.md`](./Phase-5-4.md)参照) | コメント・docstringの折り返し、`contextlib.suppress`への置換(ロジック不変) | `uv run ruff check .`が0件、`uv run pytest -m "not integration"`が既存121件green、`uvx pyright`に新規エラー無し |
| 5-4 | `devex-ui/vitest.config.mts`・`HearingCompletionBanner.tsx`・`useGenerationPolling.ts`等(詳細は[`Phase-5-4.md`](./Phase-5-4.md)参照) | `e2e/`誤収集の除外、Hooksルール違反の是正、`set-state-in-effect`の解消、未使用import削除 | `npm run lint`が0件、`npm run test`が190件green(3回連続)、`npm run build`成功、`npx tsc --noEmit`エラー無し |

## 写経順序(#23)

章番号順(5-1 → 5-2 → 5-3 → 5-4)。5-2は5-1で監査・改修したDockerfileを使ってスタックを起動する。5-3は5-1・5-2の検証結果(HEALTHCHECK追加、証明書取得手順、実測値)を運用マニュアルに反映するため両方の完了を前提にする。5-4は5-3が整備したREADME・OPERATIONS.mdを土台に追記するため、5-3の完了を前提にする。

## Phase完了チェック(#22)

1. `backend/Dockerfile`にHEALTHCHECK命令を追加した理由を、nginxの`depends_on: condition: service_healthy`との関係を含めて説明できるか。
2. `docker-compose.prod.yml`の`certbot`サービスがなぜ`profiles: ["certbot"]`で通常の`up`から除外されているか説明できるか。
3. `LLM_TIMEOUT_SECONDS`を60秒から30秒に変更した根拠(実測値・マージンの考え方)を説明できるか。
4. `GEMINI_MODEL`を`gemini-2.5-flash-lite`から`gemini-3.5-flash-lite`に変更するに至った経緯(実API検証で何が起きたか)を説明できるか。
5. なぜ本Phaseは実際のConoHa VPS/Vercelへのライブデプロイを行わず、ローカルの本番相当環境での検証に留めたか、その判断の理由を説明できるか。
6. `devex-api`には自動デプロイ用のGitHub Actionsワークフローがあるのに、`devex-ui`には無い(Vercelネイティブ連携に委ねている)のはなぜか、両者のデプロイ先の違いに照らして説明できるか。
7. 既存のlintエラー(49件のE501等)を「今回のCI導入」のタイミングで是正した判断根拠を、CLAUDE.md #17の判定基準(「今この作業を駆動している実在の消費者は何か」)に沿って説明できるか。

## 対象外にした既知の課題(将来課題、decision-digest参照)

- `prompt_templates`テーブルの放置(model+migrationのみ存在)。実装するか削除するかは未定。
- レガシーな汎用`conversations`/`messages`/`chat.py`(元テンプレートの`User → Gemini → Tavily → 評価 → Gemini → 最終回答`ワークフロー)がDevexのヒアリングチャットと並存したまま。
- ドキュメント生成(`doc_generator_service.py`)がLangGraphの`StateGraph`を使わず、手続き的な`llm.ainvoke()`の逐次呼び出しである点。`app/ai/graph/`のLangGraphワークフローは現状Devexの実機能から未使用のまま。

いずれも本Phaseのスコープ確定時にユーザーと合意の上、意図的に対象外とした([`decision-digest.md`](../decision-digest.md)「Phase 5完了後」節参照)。

## 申し送り: CL開発プロセス自体の負債(rule #18に基づき本Phaseでは着手しない)

[`Phase-4-introduction.md`](../Phase-4/Phase-4-introduction.md)が申し送った「`textbook/appendix/*-retrospective.md`(振り返り、rule #10)がPhase 0〜4のいずれについても未作成」という既知の負債は、本Phase完了時点でも解消していない。rule #18のセッション分離に従い、本Phaseでも振り返りの作成には着手せず、**別セッションでPhase 0〜5の振り返り・decision digestの整理・`q_a.md`の追記をまとめて行う**ことを推奨する。

## 次のフェーズ

`docs/implementation_plan.md`のWBSはPhase 5で完結する。ステージ2の Should have 要件(バージョン管理、プロンプトテンプレート選択、エラーハンドリング堅牢化)を新規Phaseとして立てるかどうかは未定であり、ユーザーの判断を待つ。上記「対象外にした既知の課題」もその際の検討材料になる。

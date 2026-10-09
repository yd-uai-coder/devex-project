# 実装計画書: Devex

## 1 マイルストーン

| M-ID | 名前 | 優先度 | ゴール | 処理 |
|---|---|---|---|---|
| M-01 | 環境構築と認証基盤の実装 | Must | 開発環境の土台が整い、ユーザーの新規登録とログイン認証が利用できるようになること | F-01, F-02 |
| M-02 | プロジェクト管理とAI対話ヒアリング機能の実装 | Must | プロジェクトの作成、参考資料のアップロード、およびLLMを用いたヒアリングチャットと構造化サマリの取得ができるようになること | F-03, F-04, F-05, F-06, F-07, F-08 |
| M-03 | 非同期設計書生成とジョブ管理機能の実装 | Must | 構造化サマリを承認してバックグラウンドワーカーで4種設計書を一括生成し、進捗を確認して最新版を取得できるようになること | F-09, F-10, F-11 |
| M-04 | 設計書の自己診断、版管理、および再生成機能の実装 | Must | 生成された設計書の自己診断、版一覧の取得、および追加修正指示に基づく再生成と版管理が完全に機能するようになること | F-12, F-13, F-14 |

### M-01 環境構築と認証基盤の実装(Must)

ゴール: 開発環境の土台が整い、ユーザーの新規登録とログイン認証が利用できるようになること

| ID | 種別 | タスク | 処理 | 依存 | モジュール | 環境・設定のファイル(例) |
|---|---|---|---|---|---|---|
| M-01-T01 | 基盤 | 開発環境、データベース接続、および横断的関心事(認証・例外・ログ)の土台構築 | — | — | app/main.py | Dockerfile, docker-compose.yml |
| M-01-T02 | 機能 | 新規ユーザー登録機能の実装 | F-01 | M-01-T01 | app/api/auth.py, app/services/auth.py, app/repositories/user.py | — |
| M-01-T03 | 機能 | ログイン認証とJWT発行機能の実装 | F-02 | M-01-T02 | app/api/auth.py, app/services/auth.py, app/repositories/user.py | — |

### M-02 プロジェクト管理とAI対話ヒアリング機能の実装(Must)

ゴール: プロジェクトの作成、参考資料のアップロード、およびLLMを用いたヒアリングチャットと構造化サマリの取得ができるようになること

| ID | 種別 | タスク | 処理 | 依存 | モジュール | 環境・設定のファイル(例) |
|---|---|---|---|---|---|---|
| M-02-T01 | 機能 | プロジェクト一覧取得機能の実装 | F-03 | M-01-T03 | app/api/projects.py, app/services/project.py, app/repositories/project.py | — |
| M-02-T02 | 機能 | プロジェクト新規作成機能の実装 | F-04 | M-02-T01 | app/api/projects.py, app/services/project.py, app/repositories/project.py | — |
| M-02-T03 | 機能 | 参考資料アップロード機能の実装 | F-05 | M-02-T02 | app/api/projects.py, app/services/document.py, app/repositories/document.py | — |
| M-02-T04 | 機能 | チャット履歴取得機能の実装 | F-06 | M-02-T02 | app/api/projects.py, app/services/chat.py, app/repositories/chat.py | — |
| M-02-T05 | 機能 | ヒアリングチャットメッセージ送信とAI応答機能の実装 | F-07 | M-02-T04 | app/api/projects.py, app/services/chat.py, app/clients/ai.py, app/repositories/chat.py | — |
| M-02-T06 | 機能 | 構造化サマリ取得機能の実装 | F-08 | M-02-T05 | app/api/documents.py, app/services/summary.py, app/repositories/summary.py | — |

### M-03 非同期設計書生成とジョブ管理機能の実装(Must)

ゴール: 構造化サマリを承認してバックグラウンドワーカーで4種設計書を一括生成し、進捗を確認して最新版を取得できるようになること

| ID | 種別 | タスク | 処理 | 依存 | モジュール | 環境・設定のファイル(例) |
|---|---|---|---|---|---|---|
| M-03-T01 | 機能 | 構造化サマリ承認と設計書非同期生成トリガー機能の実装 | F-09 | M-02-T06 | app/api/documents.py, app/services/job.py, app/repositories/summary.py, app/workers/generator.py | — |
| M-03-T02 | 機能 | 非同期生成ジョブの進捗ステータス確認機能の実装 | F-10 | M-03-T01 | app/api/documents.py, app/services/job.py, app/repositories/summary.py | — |
| M-03-T03 | 機能 | 生成された4種設計書の一覧・最新版取得機能の実装 | F-11 | M-03-T02 | app/api/documents.py, app/services/document.py, app/repositories/project.py, app/repositories/document.py | — |

### M-04 設計書の自己診断、版管理、および再生成機能の実装(Must)

ゴール: 生成された設計書の自己診断、版一覧の取得、および追加修正指示に基づく再生成と版管理が完全に機能するようになること

| ID | 種別 | タスク | 処理 | 依存 | モジュール | 環境・設定のファイル(例) |
|---|---|---|---|---|---|---|
| M-04-T01 | 機能 | 指定文書の版一覧取得機能の実装 | F-12 | M-03-T03 | app/api/documents.py, app/services/document.py, app/repositories/document.py | — |
| M-04-T02 | 機能 | 追加修正指示による文書再生成機能の実装 | F-13 | M-04-T01 | app/api/documents.py, app/services/document.py, app/clients/ai.py, app/repositories/document.py | — |
| M-04-T03 | 機能 | AIによる自己診断結果取得機能の実装 | F-14 | M-04-T02 | app/api/documents.py, app/services/document.py, app/clients/ai.py, app/repositories/document.py | — |

## 2 処理の割り当て

| 処理ID | 名称 | 単位 |
|---|---|---|
| F-01 | 新規ユーザー登録 | M-01-T02 |
| F-02 | ログイン認証 | M-01-T03 |
| F-03 | プロジェクト一覧取得 | M-02-T01 |
| F-04 | プロジェクト新規作成 | M-02-T02 |
| F-05 | 参考資料アップロード | M-02-T03 |
| F-06 | チャット履歴取得 | M-02-T04 |
| F-07 | ヒアリングチャットメッセージ送信 | M-02-T05 |
| F-08 | 構造化サマリ取得 | M-02-T06 |
| F-09 | 構造化サマリ承認・設計書非同期生成トリガー | M-03-T01 |
| F-10 | 非同期生成ジョブの進捗ステータス確認 | M-03-T02 |
| F-11 | 生成された4種設計書の一覧・最新版取得 | M-03-T03 |
| F-12 | 指定文書の版一覧取得 | M-04-T01 |
| F-13 | 追加修正指示による文書再生成 | M-04-T02 |
| F-14 | AIによる自己診断結果取得 | M-04-T03 |

## 3 開発環境・事前準備

DockerおよびDocker Composeによるコンテナ化された開発環境。バックエンドにはPython/FastAPI、データベースにはPostgreSQL、非同期キューイング機構にはCeleryとRedisを採用する。LLM連携にはOpenAI API等の抽象化レイヤーを設け、単体テストおよび結合テストにはpytestを使用する。CI/CDパイプラインにより自動テストとリントを実施する方針とする。

## 4 想定リスクと対策

| リスク | 対策 |
|---|---|
| LLMプロバイダの応答遅延やAPI制限（レートリミット）により、チャット応答や非同期の4種設計書一括生成がタイムアウトまたは失敗するリスク | 外部連携層に適切なリトライロジックとタイムアウト設定を実装する。スケジュールがひっ迫した場合は、一括生成から順次生成への切り替えや、プロンプトの最適化による応答時間短縮で対応する。 |
| 非同期処理キュー（Celery / Redis）の構築・運用におけるトラブルやジョブ管理の複雑化によるスケジュール遅延リスク | シンプルなジョブステータス監視構造を採用し、万が一遅延する場合は一時的に同期的なフォールバックを検討するか、Should/Could機能（履歴の比較UI等）を削りMVPのコア機能の安定化を最優先とする。 |
| 版管理（直近3件保持）の実装において、データ競合やストレージ・DBの肥大化・整合性エラーが発生するリスク | ドキュメント保存時にトリガーまたはサービス層のトランザクション内で古い版を安全に削除・維持するロジックを厳密にテストする。スケジュールに余裕がない場合は版保持数を固定のまま変更せず拡張を後回しにする。 |

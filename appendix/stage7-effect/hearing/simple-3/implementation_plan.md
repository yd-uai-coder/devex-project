# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

フェーズ1(MVP): アカウント登録・認証基盤の構築、対話型チャットによるヒアリング機能、参考資料読み込み、4種の設計書の一括生成・自己診断機能の実装、およびプレビュー・コピー・ダウンロード機能の結合を行います。優先度はすべて Must の機能要件を網羅する構成とします。

## 4.2 タスク分解（WBS）

### M-01: プロジェクト基盤構築 ── 【Must】
- ゴール: Next.jsとFastAPIの基本リポジトリ構造とDocker環境が起動するようになること
- [ ] M-01-T01 [基盤] プロジェクトリポジトリおよびDocker環境構築
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: なし
  - 環境・設定: Dockerfile, docker-compose.yml, nginx/nginx.conf

### M-02: 認証基盤・アカウント機能 ── 【Must】
- ゴール: ユーザーがアカウント登録とメール/パスワードによるログインを行えるようになること
- [ ] M-02-T01 [機能] アカウント登録・ログイン機能の実装
  - 処理: DF-1, DF-2
  - 要件: FR-001, FR-002
  - 依存: M-01-T01
  - モジュール: app/api/auth.py, app/services/auth_service.py, app/repositories/user_repository.py
  - 環境・設定: なし

### M-03: チャットヒアリング機能 ── 【Must】
- ゴール: 対話型チャットによるヒアリングと参考資料の読み込み、例外時の再送制御ができるようになること
- [ ] M-03-T01 [機能] 対話チャットおよび参考資料読み込み、例外ハンドリングの実装
  - 処理: DF-3
  - 要件: FR-003, FR-004, FR-008, FR-009
  - 依存: M-02-T01
  - モジュール: app/api/chat.py, app/services/chat_service.py, app/repositories/chat_repository.py, app/services/ai_agent.py
  - 環境・設定: なし

### M-04: 設計書一括生成・自己診断・プレビュー機能 ── 【Must】
- ゴール: 4種の設計書の自動生成、AI自己診断結果の提示、プレビュー・コピー・ダウンロード機能が動作すること
- [ ] M-04-T01 [機能] 設計書一括生成、自己診断、プレビュー・コピー・ダウンロード機能の実装
  - 処理: DF-4
  - 要件: FR-005, FR-006, FR-007
  - 依存: M-03-T01
  - モジュール: app/api/documents.py, app/services/document_service.py, app/repositories/document_repository.py, app/services/ai_agent.py
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

開発環境として Python 3.13, FastAPI, Next.js (App Router), PostgreSQL, Redis, Docker Compose を利用する。CI/CD パイプラインは GitHub Actions を用いて構築し、自動テストやコンテナのビルド・デプロイを行う。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: Gemini Flash-Lite API の応答速度やレートリミットによる遅延**

*対策*: 非同期処理の活用とエラー時の再送促しUIによりUXの低下を防ぐ

**リスク2: 機密保持要件によるログ出力制限下でのデバッグ困難性**

*対策*: ローカル環境における厳格なモックテストと例外ハンドリングの単体テストを強化する

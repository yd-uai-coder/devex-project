# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

フェーズ1(MVP)では、プロジェクトの基盤構築、認証機能、チャットヒアリング・参考資料読み込み機能、設計書の一括生成・自己診断およびプレビュー機能までの主要な縦割り機能の実装と、DBマイグレーション・バックアップ・CI/CD等のインフラ整備を行い、安全かつ確実なデプロイを実現する。

## 4.2 タスク分解（WBS）

### M-01: M-01: 基盤構築とDocker・インフラ環境整備 ── 【Must】
- ゴール: コンテナ環境、データベース、Redis、リポジトリおよびCI/CD・バックアップ基盤が整うこと。
- [ ] M-01-T01 [基盤] プロジェクトリポジトリおよびDocker環境の構築
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: なし
  - 環境・設定: Dockerfile, docker-compose.yml, nginx/conf.d/default.conf

### M-02: M-02: 認証機能の実装 ── 【Must】
- ゴール: ユーザーのサインアップおよびログイン機能、Redisレート制限が動作すること。
- [ ] M-02-T01 [機能] ログイン認証・サインアップ機能の実装
  - 処理: DF-5, DF-1
  - 要件: FR-001, FR-006
  - 依存: M-01-T01
  - モジュール: backend/app/api/v1/auth.py, backend/app/core/security.py, backend/app/models/db_models.py, backend/app/repositories/user_repo.py
  - 環境・設定: なし

### M-03: M-03: チャットヒアリングと参考資料読み込み機能の実装 ── 【Must】
- ゴール: セッション管理、メッセージ履歴取得、ファイル添付付きチャットの送受信ができること。
- [ ] M-03-T01 [機能] チャットヒアリングおよび参考資料読み込み機能の実装
  - 処理: DF-6, DF-7, DF-8, DF-2
  - 要件: FR-005, FR-007, FR-008, FR-006
  - 依存: M-02-T01
  - モジュール: backend/app/api/v1/chat.py, backend/app/services/chat_service.py, backend/app/services/ai_service.py, backend/app/repositories/chat_repo.py
  - 環境・設定: なし

### M-04: M-04: 設計書一括生成・自己診断およびプレビュー機能の実装 ── 【Must】
- ゴール: 4種の設計書および自己診断結果の生成・個別詳細・履歴一覧取得ができること。
- [ ] M-04-T01 [機能] 設計書一括生成・自己診断およびプレビュー機能の実装
  - 処理: DF-3, DF-4, DF-9
  - 要件: FR-002, FR-003, FR-004, FR-006, FR-007
  - 依存: M-03-T01
  - モジュール: backend/app/api/v1/documents.py, backend/app/services/ai_service.py, backend/app/repositories/document_repo.py
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

開発言語はPython 3.13およびNext.js(App Router)を用い、データベースにはPostgreSQLおよびRedisを採用する。サーバー環境としてDocker ComposeとnginxをVPS上に構築し、GitHub Actionsを用いて自動デプロイを実施する。テスト・自動化およびコード品質維持のため、適切なユニットテスト・統合テストを継続的に行う方針とする。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: Gemini Flash-LiteのAPI制限や応答遅延によるタイムアウト発生**

*対策*: リトライ機構および適切なエラーハンドリング(500応答・再送要請)を実装し、ユーザーへ明確なフィードバックを提供する。

**リスク2: チャットの文字数超過や不正利用によるリソース枯渇**

*対策*: Redisを用いたレート制限ミドルウェアと文字数バリデーションを確実に実装し、無料枠とシステムリソースを保護する。

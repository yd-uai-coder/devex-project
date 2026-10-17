# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

フェーズ1(MVP)では、プロジェクトの基盤構築、ログイン認証およびサインアップ機能の実装、チャットヒアリングと参考資料読み込み機能の実装、最後に設計書一括生成・自己診断およびプレビュー機能の実装を行います。優先度はいずれもMustとなります。

- M-01: プロジェクトリポジトリおよび環境構築 (優先度: Must)
- M-02: ログイン認証・サインアップ機能の実装 (優先度: Must)
- M-03: チャットヒアリングおよび参考資料読み込み機能の実装 (優先度: Must)
- M-04: 設計書一括生成・自己診断およびプレビュー機能の実装 (優先度: Must)

## 4.2 タスク分解（WBS）

### M-01: プロジェクト基盤構築 ── 【Must】
- ゴール: Docker環境、データベース接続、およびnginxの設定が完了し、バックエンドの起動確認ができること。
- [ ] M-01-T01 [基盤] プロジェクトリポジトリおよびDocker環境の構築
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: なし
  - 環境・設定: Dockerfile, docker-compose.yml, nginx/conf.d/default.conf

### M-02: 認証機能の実装 ── 【Must】
- ゴール: ユーザーの新規登録（サインアップ）およびログイン認証が正常に動作し、JWTトークンによるアクセス制御ができること。
- [ ] M-02-T01 [機能] ログイン認証・サインアップ機能の実装
  - 処理: DF-5, DF-1
  - 要件: FR-001, FR-006
  - 依存: M-01-T01
  - モジュール: backend/app/api/v1/auth.py, backend/app/core/security.py, backend/app/models/db_models.py, backend/app/repositories/user_repo.py
  - 環境・設定: なし

### M-03: チャットヒアリング機能の実装 ── 【Must】
- ゴール: チャットセッションの作成・一覧取得・メッセージ履歴取得・メッセージ送信（参考資料読み込み含む）が動作すること。
- [ ] M-03-T01 [機能] チャットヒアリングおよび参考資料読み込み機能の実装
  - 処理: DF-6, DF-7, DF-8, DF-2
  - 要件: FR-005, FR-007, FR-008, FR-006
  - 依存: M-02-T01
  - モジュール: backend/app/api/v1/chat.py, backend/app/services/chat_service.py, backend/app/services/ai_service.py, backend/app/repositories/chat_repo.py
  - 環境・設定: なし

### M-04: 設計書一括生成・プレビュー機能の実装 ── 【Must】
- ゴール: 4種の設計書一括生成、自己診断の実行、および生成済み文書のプレビュー・詳細取得ができること。
- [ ] M-04-T01 [機能] 設計書一括生成・自己診断およびプレビュー機能の実装
  - 処理: DF-3, DF-4, DF-9
  - 要件: FR-002, FR-003, FR-004, FR-006, FR-007
  - 依存: M-03-T01
  - モジュール: backend/app/api/v1/documents.py, backend/app/services/ai_service.py, backend/app/repositories/document_repo.py
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

開発はPython 3.13、FastAPI、Next.js (App Router)、Tamaguiを使用し、Docker Composeを用いてローカル開発環境およびVPS環境を構築する。バージョン管理にはGitを使用し、GitHub Actionsによる自動デプロイを前提とする。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: Gemini Flash-LiteのAPI制限や応答遅延によるタイムアウト**

*対策*: 非同期処理の活用とリトライ機構の導入により、一時的な接続エラーに対応する。

**リスク2: 参考資料のファイルサイズやパース処理による負荷増大**

*対策*: 対応ファイル形式を制限し、アップロード時に最大3件までのバリデーションを確実に実行する。

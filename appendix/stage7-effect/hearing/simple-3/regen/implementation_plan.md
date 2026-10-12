# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

フェーズ1(MVP): プロジェクト基盤の構築と、アカウント登録・ログイン機能、対話チャットおよび参考資料読み込み・例外ハンドリング、設計書一括生成・自己診断機能のコア機能を一括して実装する。

## 4.2 タスク分解（WBS）

### M-01: 基盤構築マイルストーン ── 【Must】
- ゴール: アプリケーションのビルドとDocker環境による起動ができること。
- [ ] M-01-T01 [基盤] プロジェクトリポジトリおよびDocker環境構築
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: なし
  - 環境・設定: Dockerfile, docker-compose.yml, nginx/nginx.conf

### M-02: 認証機能マイルストーン ── 【Must】
- ゴール: アカウント登録とログインができること。
- [ ] M-02-T01 [機能] アカウント登録・ログイン機能の実装
  - 処理: DF-1, DF-2
  - 要件: FR-001, FR-002
  - 依存: M-01-T01
  - モジュール: app/api/auth.py, app/services/auth_service.py, app/repositories/user_repository.py
  - 環境・設定: なし

### M-03: チャット・参考資料読み込みマイルストーン ── 【Must】
- ゴール: 対話チャットを行い、参考資料読み込みと例外ハンドリングが機能すること。
- [ ] M-03-T01 [機能] 対話チャットおよび参考資料読み込み、例外ハンドリングの実装
  - 処理: DF-3
  - 要件: FR-003, FR-004, FR-008, FR-009
  - 依存: M-02-T01
  - モジュール: app/api/chat.py, app/services/chat_service.py, app/repositories/chat_repository.py, app/services/ai_agent.py
  - 環境・設定: なし

### M-04: 設計書生成・自己診断マイルストーン ── 【Must】
- ゴール: 4種のMarkdown設計書の一括生成、自己診断、プレビュー・コピー・ダウンロードができること。
- [ ] M-04-T01 [機能] 設計書一括生成、自己診断、プレビュー・コピー・ダウンロード機能の実装
  - 処理: DF-4
  - 要件: FR-005, FR-006, FR-007
  - 依存: M-03-T01
  - モジュール: app/api/documents.py, app/services/document_service.py, app/repositories/document_repository.py, app/services/ai_agent.py
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

開発環境として Docker および Docker Compose を使用し、Python 3.13環境上でFastAPIおよびNext.js (App Router) + Tamaguiを動作させます。CI/CDにはGitHub Actionsを使用し、VPS環境への自動デプロイを構築します。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: 外部AIモデル(Gemini Flash-Lite API)の仕様変更やレートリミットによる応答遅延・失敗**

*対策*: 例外ハンドリングおよび再送処理を確実に実装し、ユーザーへ適切にエラーを通知する仕組みを徹底する。

**リスク2: 初期参考資料の読み込みサイズ超過や不正フォーマットによる処理失敗**

*対策*: ファイル形式・件数チェックのバリデーションを厳格に実装し、事前にはじくことで対応する。

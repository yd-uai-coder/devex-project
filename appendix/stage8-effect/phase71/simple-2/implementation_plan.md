# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

フェーズ1(MVP): プロジェクト基盤の構築、認証機能、チャットヒアリングおよび参考資料読み込み機能、設計書一括生成・自己診断およびプレビュー機能のすべてを実装する。

## 4.2 タスク分解（WBS）

### M-01: プロジェクト基盤構築 ── 【Must】
- ゴール: Dockerfile、docker-compose.yml、nginx/conf.d/default.confを用いたプロジェクトリポジトリおよびDocker環境の構築が完了していること
- [ ] M-01-T01 [基盤] プロジェクトリポジトリおよびDocker環境の構築
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: なし
  - 環境・設定: Dockerfile, docker-compose.yml, nginx/conf.d/default.conf

### M-02: 認証機能の実装 ── 【Must】
- ゴール: メールアドレスとパスワードによるサインアップおよびログイン機能が動作し、自分のデータのみ閲覧可能となること
- [ ] M-02-T01 [機能] ログイン認証・サインアップ機能の実装
  - 処理: DF-5, DF-1
  - 要件: FR-001, FR-006
  - 依存: M-01-T01
  - モジュール: backend/app/api/v1/auth.py, backend/app/core/security.py, backend/app/models/db_models.py, backend/app/repositories/user_repo.py
  - 環境・設定: なし

### M-03: チャットヒアリング・参考資料読み込み機能の実装 ── 【Must】
- ゴール: チャットセッションの作成・一覧取得・メッセージ履歴取得・メッセージ送信（参考資料読み込み含む）が動作すること
- [ ] M-03-T01 [機能] チャットヒアリングおよび参考資料読み込み機能の実装
  - 処理: DF-6, DF-7, DF-8, DF-2
  - 要件: FR-005, FR-007, FR-008, FR-006
  - 依存: M-02-T01
  - モジュール: backend/app/api/v1/chat.py, backend/app/services/chat_service.py, backend/app/services/ai_service.py, backend/app/repositories/chat_repo.py
  - 環境・設定: なし

### M-04: 設計書一括生成・自己診断・プレビュー機能の実装 ── 【Must】
- ゴール: 4種の設計書一括生成、自己診断の提示、プレビュー・コピー・ダウンロード、保存済み設計書の履歴および個別詳細取得が動作すること
- [ ] M-04-T01 [機能] 設計書一括生成・自己診断およびプレビュー機能の実装
  - 処理: DF-3, DF-4, DF-9
  - 要件: FR-002, FR-003, FR-004, FR-006, FR-007
  - 依存: M-03-T01
  - モジュール: backend/app/api/v1/documents.py, backend/app/services/ai_service.py, backend/app/repositories/document_repo.py
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

開発環境としてPython 3.13、FastAPI、Next.js (App Router)、Tamagui、PostgreSQL、Redisを使用する。リポジトリ管理はGit/GitHubを利用し、GitHub Actionsを用いてVPSのDocker Compose環境へ自動デプロイを行う。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: Gemini Flash-LiteのAPI制限や応答遅延によるタイムアウト発生**

*対策*: タイムアウト処理および例外発生時の再送プロンプト案内、エラーハンドリングを適切に実装する。

**リスク2: 参考資料（PDF等）の読み込み時におけるパースエラーやデータ容量超過**

*対策*: 最大3件かつテキスト抽出可能なフォーマットへの制限バリデーションをバックエンド側で厳格に実施する。

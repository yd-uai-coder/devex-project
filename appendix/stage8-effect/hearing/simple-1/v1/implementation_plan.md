# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

フェーズ1(MVP)では、基盤構築、認証機能、チャットヒアリングおよび参考資料の読み込み、4種の設計書一括生成と自己診断機能、プレビュー・ダウンロード機能までのコア機能(Must要件)をひと通り実装する。優先度は高く、段階的リリースとしてMVPを完成させる。

## 4.2 タスク分解（WBS）

### M-01: 基盤構築と環境設定 ── 【Must】
- ゴール: Docker Composeによる開発・稼働環境が構築され、FastAPIとNext.jsの基本設定が完了する
- [ ] M-01-T01 [基盤] プロジェクトリポジトリおよびDocker環境の構築
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: なし
  - 環境・設定: Dockerfile, docker-compose.yml, nginx/conf.d/default.conf

### M-02: 認証機能の実装 ── 【Must】
- ゴール: メールアドレスとパスワードによるログイン機能が動作し、自分のデータのみ閲覧可能となる
- [ ] M-02-T01 [機能] ログイン認証機能の実装
  - 処理: DF-1
  - 要件: FR-001, FR-006
  - 依存: M-01-T01
  - モジュール: backend/app/api/v1/auth.py, backend/app/core/security.py, backend/app/models/db_models.py, backend/app/repositories/user_repo.py
  - 環境・設定: なし

### M-03: チャットヒアリング機能の実装 ── 【Must】
- ゴール: 参考資料の読み込みと数千文字までのチャット送信・バリデーション、例外時の再送促し機能が動作する
- [ ] M-03-T01 [機能] チャットヒアリングおよび参考資料読み込み機能の実装
  - 処理: DF-2
  - 要件: FR-005, FR-007, FR-008, FR-006
  - 依存: M-02-T01
  - モジュール: backend/app/api/v1/chat.py, backend/app/services/chat_service.py, backend/app/services/ai_service.py, backend/app/repositories/chat_repo.py
  - 環境・設定: なし

### M-04: 設計書一括生成・自己診断・プレビュー機能の実装 ── 【Must】
- ゴール: 4種の設計書一括生成と自己診断、プレビュー・コピー・ダウンロード、および保存済み履歴取得機能が完成する
- [ ] M-04-T01 [機能] 設計書一括生成・自己診断およびプレビュー機能の実装
  - 処理: DF-3, DF-4
  - 要件: FR-002, FR-003, FR-004, FR-006, FR-007
  - 依存: M-03-T01
  - モジュール: backend/app/api/v1/documents.py, backend/app/services/ai_service.py, backend/app/repositories/document_repo.py
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

開発環境はPython 3.13とFastAPI、Next.js(App Router)およびTamaguiを用い、コンテナ管理にはDocker Composeを採用する。データベースにはPostgreSQLおよびRedisを利用し、外部APIとしてGemini Flash-Liteを使用する。本番環境へのデプロイメントはGitHub Actionsによる自動デプロイパイプラインを構築してVPS環境へ反映させる。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: Gemini Flash-LiteのAPI制限や応答遅延によるチャット・生成処理の失敗**

*対策*: 例外処理(FR-007)を確実に実装し、失敗時はメッセージを保存せずに再送を促すUIおよびエラーハンドリングを徹底する。

**リスク2: 大規模な参考資料やプロンプトによるトークン数超過・文字数制限の考慮漏れ**

*対策*: チャット入力時の文字数制限および空送信チェック(FR-008)をフロントエンド・バックエンド双方で厳格にバリデーションする。

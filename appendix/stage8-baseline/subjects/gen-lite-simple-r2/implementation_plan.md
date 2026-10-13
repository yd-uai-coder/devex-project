# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

フェーズ1(MVP): ユーザー登録・ログイン認証、参考資料読み込みを伴うチャットヒアリング、4種設計書の生成と自己診断、プレビュー・コピー・ダウンロード機能までのコア機能の実装を優先的に行い、基盤構築から順次インテグレーションを進める。フェーズ2: 将来の拡張要件や高度な非機能対応などを段階的に実施する。

## 4.2 タスク分解（WBS）

### M-01: 基盤構築とデータベース・認証機能の実装 ── 【Must】
- ゴール: プロジェクトの枠組みが整い、ユーザー登録とJWTによるログイン認証が正常に動作すること。
- [ ] M-01-T01 [基盤] プロジェクトの基本構成とDocker環境の構築
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: なし
  - 環境・設定: Dockerfile, docker-compose.yml
- [ ] M-01-T02 [基盤] データベースとRedisの接続設定・ORMモデルの定義
  - 処理: なし
  - 要件: なし
  - 依存: M-01-T01
  - モジュール: backend/app/models/orm.py, backend/app/core/redis.py, backend/app/core/config.py
  - 環境・設定: なし
- [ ] M-01-T03 [機能] ユーザー登録機能の実装
  - 処理: DF-1
  - 要件: FR-001
  - 依存: M-01-T02
  - モジュール: backend/app/api/v1/auth.py, backend/app/services/auth_service.py, backend/app/core/security.py, backend/app/schemas/pydantic_schemas.py
  - 環境・設定: なし
- [ ] M-01-T04 [機能] JWT認証によるログイン機能の実装
  - 処理: DF-2
  - 要件: FR-002
  - 依存: M-01-T03
  - モジュール: backend/app/api/v1/auth.py, backend/app/services/auth_service.py, backend/app/core/security.py
  - 環境・設定: なし

### M-02: チャットヒアリングおよび参考資料読み込み機能の実装 ── 【Must】
- ゴール: 参考資料の読み込みと、空送信・文字数・レート制限を考慮したチャットヒアリング対話が動作すること。
- [ ] M-02-T01 [機能] 参考資料読み込みとチャットメッセージ送信・例外処理の実装
  - 処理: DF-3
  - 要件: FR-006, FR-007
  - 依存: M-01-T04
  - モジュール: backend/app/api/v1/chat.py, backend/app/services/chat_service.py, backend/app/services/llm_service.py, backend/app/core/redis.py
  - 環境・設定: なし

### M-03: 設計書一括生成・自己診断およびプレビュー・コピー・ダウンロード機能の実装 ── 【Must】
- ゴール: LangGraph/LangChainを利用した4種設計書の一括生成と自己診断、さらにプレビュー・コピー・ダウンロードが完結すること。
- [ ] M-03-T01 [機能] LangChain/LangGraphによる4種設計書一括生成と自己診断の実装
  - 処理: DF-4
  - 要件: FR-003, FR-004
  - 依存: M-02-T01
  - モジュール: backend/app/api/v1/documents.py, backend/app/services/llm_service.py
  - 環境・設定: なし
- [ ] M-03-T02 [機能] 生成された設計書および自己診断結果の取得機能の実装
  - 処理: DF-5
  - 要件: FR-005
  - 依存: M-03-T01
  - モジュール: backend/app/api/v1/documents.py
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

開発環境として Python 3.13、FastAPI、Next.js (App Router) + Tamagui を用いる。データベースは PostgreSQL、キャッシュおよびレート制限に Redis を使用。本番環境は VPS に Docker Compose と nginx を配置し、GitHub Actions による自動デプロイを行う。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: Gemini Flash-Lite の応答遅延やレート制限超過によるUXの悪化**

*対策*: 非同期処理の適切化とRedisによるレート制限の徹底、例外発生時の適切な再送誘導メッセージの表示により対応する。

**リスク2: 4種設計書を一括生成する際のトークン上限や生成時間の超過**

*対策*: プロンプトの最適化とLangGraphによる確実なステート管理を行い、タイムアウトや生成失敗時のリカバリフローを設計に含める。

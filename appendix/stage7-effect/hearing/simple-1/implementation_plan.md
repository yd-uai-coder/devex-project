# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

フェーズ1(MVP)では、ユーザー登録・認証機能、チャットヒアリング機能、参考資料アップロード機能、および4種の設計書生成と自己診断機能の実装を行います。優先度「Must」の要件をすべて満たし、セキュアな対話とドキュメント生成がローカルおよびVPS環境で動作することをゴールとします。

## 4.2 タスク分解（WBS）

### M-01: 基盤構築と認証機能 ── 【Must】
- ゴール: プロジェクトの枠組みが整い、ユーザー登録とログインによるJWT認証が動作するようになること
- [ ] M-01-T01 [基盤] プロジェクト初期化とDocker環境構築
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: なし
  - 環境・設定: Dockerfile, docker-compose.yml, nginx/nginx.conf
- [ ] M-01-T02 [機能] ユーザー登録およびログイン機能の実装
  - 処理: DF-1, DF-2
  - 要件: FR-001
  - 依存: M-01-T01
  - モジュール: backend/app/api/v1/auth.py, backend/app/services/auth_service.py, backend/app/repositories/user_repository.py, backend/app/core/security.py
  - 環境・設定: なし

### M-02: チャットヒアリングと参考資料管理機能 ── 【Must】
- ゴール: チャット形式でのAI対話と、参考資料のアップロードが正常に行えるようになること
- [ ] M-02-T01 [機能] 参考資料アップロード機能の実装
  - 処理: DF-5
  - 要件: FR-006
  - 依存: M-01-T02
  - モジュール: backend/app/api/v1/documents.py, backend/app/services/document_service.py, backend/app/repositories/document_repository.py
  - 環境・設定: なし
- [ ] M-02-T02 [機能] チャットヒアリングとAI対話機能の実装
  - 処理: DF-3
  - 要件: FR-002, FR-008, FR-009
  - 依存: M-02-T01
  - モジュール: backend/app/api/v1/chat.py, backend/app/services/chat_service.py, backend/app/repositories/chat_repository.py, backend/app/agents/chat_agent.py
  - 環境・設定: なし

### M-03: 設計書一括生成と自己診断機能 ── 【Must】
- ゴール: ヒアリング履歴から4種の設計書の一括生成と3段階自己診断が実行できること
- [ ] M-03-T01 [機能] 設計書一括生成と自己診断機能の実装
  - 処理: DF-4
  - 要件: FR-003, FR-004, FR-005, FR-007
  - 依存: M-02-T02
  - モジュール: backend/app/api/v1/documents.py, backend/app/services/document_service.py, backend/app/repositories/document_repository.py, backend/app/agents/document_agent.py
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

開発環境としてPython 3.13、Next.js(App Router)+ Tamagui、PostgreSQL、Redisを使用する。コンテナ化にはDockerおよびDocker Composeを利用する。CI/CD方針として、GitHub Actionsを用いてmainブランチへのプッシュ時に自動テストおよびVPSへの自動デプロイを行う。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: Gemini Flash-Lite APIの応答遅延やレート制限による生成失敗**

*対策*: エラーハンドリング機構を実装し、失敗時は適切に再生成を促すUI・UX処理を確保する。Redisを用いたレート制限により不正利用を防ぐ。

**リスク2: 要件定義書に記載されたLLM連携処理の複雑化によるスケジュール遅延**

*対策*: LangChain/LangGraphを利用したシンプルなエージェント構成に留め、MVP範囲外の機能(テンプレート選択や版履歴)には着手しない。

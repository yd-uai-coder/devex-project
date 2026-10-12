# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

フェーズ1(MVP)として、ユーザー認証、初期資料読み込み、AIチャットヒアリング、4種のMarkdown設計書の一括生成・プレビュー・コピー・ダウンロード機能、およびPostgreSQLへのデータ保存を実装する。優先度はすべてMustの機能要件を対象とする。インフラ構成およびデプロイ基盤の構築もフェーズ1に含める。

## 4.2 タスク分解（WBS）

### M-01: 基盤構築と環境設定 ── 【Must】
- ゴール: Docker Composeによるデータベースおよびコンテナ環境が起動し、バックエンド・フロントエンドの雛形が動作すること。
- [ ] M-01-T01 [基盤] プロジェクト初期構成とDocker環境構築
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: なし
  - 環境・設定: Dockerfile, docker-compose.yml, nginx.conf

### M-02: ユーザー認証とプロジェクト・初期資料管理機能 ── 【Must】
- ゴール: ユーザー登録・ログインができ、初期資料を含むプロジェクトを作成できること。
- [ ] M-02-T01 [機能] ユーザー登録・ログイン機能の実装
  - 処理: DF-1, DF-2
  - 要件: FR-001, NFR-008
  - 依存: M-01-T01
  - モジュール: backend/main.py, backend/routers/auth.py, backend/services/auth_service.py, backend/repositories/user_repository.py, backend/models/database_models.py
  - 環境・設定: なし
- [ ] M-02-T02 [機能] 初期資料読込とプロジェクト作成機能の実装
  - 処理: DF-6
  - 要件: FR-006, FR-007
  - 依存: M-02-T01
  - モジュール: backend/routers/projects.py, backend/services/chat_service.py, backend/repositories/project_repository.py, backend/models/database_models.py
  - 環境・設定: なし

### M-03: チャットヒアリングおよび設計書生成機能 ── 【Must】
- ゴール: AIとのチャットヒアリングを行い、4種のMarkdown設計書の一括生成と閲覧ができること。
- [ ] M-03-T01 [機能] チャットヒアリングと例外処理・保存制御の実装
  - 処理: DF-7
  - 要件: FR-002, FR-008, FR-009
  - 依存: M-02-T02
  - モジュール: backend/routers/projects.py, backend/services/chat_service.py, backend/repositories/project_repository.py
  - 環境・設定: なし
- [ ] M-03-T02 [機能] 4種設計書の一括生成とドキュメント取得機能の実装
  - 処理: DF-8, DF-9
  - 要件: FR-003, FR-005, FR-007
  - 依存: M-03-T01
  - モジュール: backend/routers/projects.py, backend/services/generator_service.py, backend/repositories/project_repository.py, backend/repositories/document_repository.py, backend/models/database_models.py
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

開発環境としてPython 3.13、Node.js、DockerおよびDocker Composeを利用する。フロントエンドはNext.js(App Router)とTamagui、バックエンドはFastAPIとLangChain・LangGraphを使用する。データベースにはPostgreSQL、レート制限・トークン失効管理にRedisを用いる。インフラ環境はVPS上にDocker Composeとnginxを配置し、GitHub Actionsによるmainブランチへのプッシュで自動デプロイを行う。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: Gemini Flash-Lite APIの応答遅延や一時的な障害による生成失敗**

*対策*: 例外処理において失敗理由をクライアントへ返却しメッセージ保存を行わない設計とし、再生成や再送を促すフローを徹底する。

**リスク2: GitHub Actionsによる自動デプロイ時のインフラ環境差異トラブル**

*対策*: Docker Composeを用いたコンテナ化により開発環境と本番環境を一致させ、事前に検証を行う。

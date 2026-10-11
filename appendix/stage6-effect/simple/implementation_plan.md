# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン
- フェーズ1（MVP / 必須機能）: ── 【Must】
  - M-01: プロジェクト基盤とデータベース構築 ── 【Must】 (M-01)
  - M-02: プロジェクト作成と参考資料読み込み機能 ── 【Must】 (M-02)
  - M-03: チャットヒアリングと例外処理機能 ── 【Must】 (M-03)
  - M-04: 4種設計書一括生成と自己診断機能 ── 【Must】 (M-04)
  - M-05: 文書プレビュー・ダウンロードとデータ取得API ── 【Must】 (M-05)
- フェーズ2（拡張・デプロイ機能）: ── 【Should】
  - M-06: Docker・Nginx・CI/CDによるデプロイ基盤構築 ── 【Should】 (M-06)

## 4.2 タスク分解（WBS）

### M-01: プロジェクト基盤とデータベース構築 ── 【Must】
- ゴール: バックエンド・フロントエンドの雛形が立ち上がり、PostgreSQLに接続できること
- [ ] M-01-T01 [基盤] 開発環境とDB・Docker構成を用意する
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: backend/app/main.py, backend/app/core/config.py, backend/app/core/database.py
  - 環境・設定: docker-compose.yml, backend/Dockerfile, backend/requirements.txt
- [ ] M-01-T02 [基盤] SQLAlchemyによるORMモデルとPydanticスキーマを定義する
  - 処理: なし
  - 要件: FR-006
  - 依存: M-01-T01
  - モジュール: backend/app/models/orm.py, backend/app/schemas/pydantic.py
  - 環境・設定: なし

### M-02: プロジェクト作成と参考資料読み込み機能 ── 【Must】
- ゴール: プロジェクトを作成し、初期要望と参考資料をDBに保存できること
- [ ] M-02-T01 [機能] プロジェクト作成と参考資料解析のエンドポイントを実装する
  - 処理: DF-001
  - 要件: FR-005, FR-006
  - 依存: M-01-T02
  - モジュール: backend/app/api/v1/endpoints/projects.py, backend/app/api/v1/router.py
  - 環境・設定: なし

### M-03: チャットヒアリングと例外処理機能 ── 【Must】
- ゴール: チャットでAIと対話し、バリデーションやLLMエラー時の例外処理が正しく動作すること
- [ ] M-03-T01 [機能] チャットヒアリングとLangGraph対話処理・エラーハンドリングを実装する
  - 処理: DF-002
  - 要件: FR-001, FR-006, FR-012, FR-013
  - 依存: M-02-T01
  - モジュール: backend/app/services/ai_agent.py, backend/app/services/chat_service.py, backend/app/api/v1/endpoints/chat.py
  - 環境・設定: なし

### M-04: 4種設計書一括生成と自己診断機能 ── 【Must】
- ゴール: チャット履歴をもとに4種のMarkdown設計書とAI自己診断結果を生成しDBに保存できること
- [ ] M-04-T01 [機能] 設計書一括生成および自己診断AIパイプラインを実装する
  - 処理: DF-003
  - 要件: FR-002, FR-003, FR-006
  - 依存: M-03-T01
  - モジュール: backend/app/services/ai_agent.py, backend/app/services/document_service.py, backend/app/api/v1/endpoints/documents.py
  - 環境・設定: なし

### M-05: 文書プレビュー・ダウンロードとデータ取得API ── 【Must】
- ゴール: 生成された設計書や診断結果をAPI経由で取得し、フロントエンド側でプレビュー・コピー・ダウンロードできること
- [ ] M-05-T01 [機能] 設計書・診断結果の取得APIとNext.jsフロントエンドのUIを実装する
  - 処理: DF-004
  - 要件: FR-004, FR-006
  - 依存: M-04-T01
  - モジュール: backend/app/api/v1/endpoints/documents.py, frontend/app/projects/[id]/page.tsx, frontend/components/
  - 環境・設定: frontend/package.json, frontend/next.config.js

### M-06: Docker・Nginx・CI/CDによるデプロイ基盤構築 ── 【Should】
- ゴール: GitHub ActionsからVPSのDocker環境へ自動デプロイされ、Nginx経由でサービスにアクセスできること
- [ ] M-06-T01 [基盤] NginxリバースプロキシとVPS用Docker Compose設定を構築する
  - 処理: なし
  - 要件: NFR-005, CON-004
  - 依存: M-05-T01
  - モジュール: nginx/conf.d/default.conf
  - 環境・設定: docker-compose.yml, nginx/Dockerfile
- [ ] M-06-T02 [基盤] GitHub Actionsによる自動デプロイワークフローを設定する
  - 処理: なし
  - 要件: CON-006
  - 依存: M-06-T01
  - モジュール: なし
  - 環境・設定: .github/workflows/deploy.yml

## 4.3 開発環境・CI/CD・事前準備事項

### ### 1. 開発に必要なツール・技術スタック
- **言語・ランタイム**: Python 3.13, Node.js (LTS)
- **コンテナ技術**: Docker, Docker Compose
- **データベース**: PostgreSQL, Redis
- **外部AI**: Google Gemini API (Flash-Lite)

### ### 2. リポジトリ構成
```text
/
├── backend/            # FastAPIバックエンド
├── frontend/           # Next.jsフロントエンド
├── nginx/              # Nginx設定ファイル
├── .github/workflows/  # GitHub Actions CI/CD設定
└── docker-compose.yml  # 統合Docker Compose定義
```

### ### 3. 自動テスト・CI/CD方針
- **テスト方針**: MVPフェーズでは自動テストコードの作成は後回しとし、APIエンドポイントの動作確認（Postman/curl等）を中心に手動テストで品質を担保する。
- **CI/CD方針**: mainブランチへのプッシュをトリガーとして、GitHub ActionsによりVPS上のDocker Compose環境へ自動ビルドおよびコンテナ再起動（デプロイ）を行う。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

### **リスク1: Gemini APIのレート制限（無料枠）やトークン上限超過による処理停止**
*対策*: エラーハンドリング（FR-012）を確実に実装し、上限超過時はメッセージをDBに保存せずにユーザーへ再送を促す。必要に応じてリトライロジックをサービス層に組み込む。

### **リスク2: 4種設計書の一括生成処理におけるタイムアウト（数分待ち）**
*対策*: FastAPI側の非同期処理（`async/def`）を活用し、クライアント側ではローディング表示やポーリング、または適切に長いタイムアウト設定を行いユーザー体験の低下を防ぐ。

### **リスク3: 納期超過時のトレードオフ策（機能削減）**
*対策*: 開発遅延が発生した場合は、参考資料読み込み（FR-005）やAI自己診断の詳細表示（FR-003の一部）を簡易化・後回しにし、チャットヒアリング（FR-001）と基本の設計書一括生成（FR-002）を最優先のMVPとして死守する。
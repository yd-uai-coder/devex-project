# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

**フェーズ1 (MVP開発フェーズ)**
- **優先度**: Must
- **対象マイルストーン**: M-01, M-02, M-03, M-04, M-05
- **目的**: ユーザー認証、参考資料の読み込み、AIチャット対話ヒアリング、4種設計書(要件定義・外部設計・内部設計・実装計画)の一括生成と3段階不足点自己診断、プレビュー・ダウンロード機能を提供し、コア価値である設計書自動生成を安全に動作させる。

**フェーズ2 (運用改善・拡張フェーズ)**
- **優先度**: Should / Could
- **対象マイルストーン**: 将来リリース
- **目的**: エラー追跡ツールおよび死活監視の導入(NFR-004)、プロジェクト削除・アカウント退会機能、設計書テンプレート選択や履歴管理、マルチテナント対応など、MVP運用後のフィードバックを反映した機能拡充を行う。

## 4.2 タスク分解（WBS）

### M-01: 基盤環境構築・ユーザー認証機能 ── 【Must】
- ゴール: コンテナ仮想環境およびDBモデルが立ち上がり、メールアドレス・パスワードでのユーザー登録・ログイン・トークンリフレッシュ・ログアウトがセキュアに動作すること
- [ ] M-01-T01 [基盤] Docker環境・FastAPI/Next.js初期構成およびDBモデル定義
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: app/main.py, app/db/models.py
  - 環境・設定: Dockerfile, docker-compose.yml, nginx.conf
- [ ] M-01-T02 [機能] アカウント登録・ログイン認証機能の実装
  - 処理: DF-1, DF-2
  - 要件: FR-001
  - 依存: M-01-T01
  - モジュール: app/api/auth.py, app/services/auth_service.py, app/core/security.py, app/core/limiter.py
  - 環境・設定: なし
- [ ] M-01-T03 [機能] JWTトークンリフレッシュ・ログアウト機能の実装
  - 処理: DF-3, DF-4
  - 要件: FR-001
  - 依存: M-01-T02
  - モジュール: app/api/auth.py, app/services/auth_service.py, app/core/security.py, app/core/limiter.py
  - 環境・設定: なし

### M-02: プロジェクト管理および参考資料取込機能 ── 【Must】
- ゴール: プロジェクトの作成・取得、および最大3件までの参考資料(txt/md/pdf)のアップロードとテキスト抽出・保存が行えること
- [ ] M-02-T01 [機能] プロジェクト作成・一覧・詳細取得機能の実装
  - 処理: DF-5, DF-6, DF-7
  - 要件: FR-001
  - 依存: M-01-T03
  - モジュール: app/api/projects.py, app/services/project_service.py
  - 環境・設定: なし
- [ ] M-02-T02 [機能] 参考資料アップロードおよびテキスト解析保存機能の実装
  - 処理: DF-8
  - 要件: FR-002
  - 依存: M-02-T01
  - モジュール: app/api/files.py, app/services/file_service.py, app/services/project_service.py
  - 環境・設定: なし

### M-03: 対話型AIヒアリングチャット機能 ── 【Must】
- ゴール: チャットバリデーション・レート制限を備え、Gemini Flash-Liteと連携して過去履歴と参考資料を踏まえた要件ヒアリング対話が行えること
- [ ] M-03-T01 [機能] チャット履歴取得およびAI対話ヒアリング機能の実装
  - 処理: DF-9, DF-10
  - 要件: FR-003, FR-004
  - 依存: M-02-T02
  - モジュール: app/api/messages.py, app/services/chat_service.py, app/llm/hearing_graph.py, app/llm/client.py, app/core/limiter.py
  - 環境・設定: なし

### M-04: 4種設計書一括生成・自己診断およびエクスポート機能 ── 【Must】
- ゴール: ヒアリング対話内容から4種のMarkdown設計書を一括生成し、3段階の不足点自己診断を提示するとともに、プレビュー・コピー・ダウンロードができること
- [ ] M-04-T01 [機能] 4種設計書一括生成および3段階自己診断機能の実装
  - 処理: DF-11
  - 要件: FR-005, FR-006
  - 依存: M-03-T01
  - モジュール: app/api/documents.py, app/services/document_service.py, app/llm/generator_graph.py, app/llm/client.py, app/core/limiter.py
  - 環境・設定: なし
- [ ] M-04-T02 [機能] 設計書プレビュー・クリップボードコピー・ダウンロード機能の実装
  - 処理: DF-12, DF-13
  - 要件: FR-007
  - 依存: M-04-T01
  - モジュール: app/api/documents.py, app/services/document_service.py
  - 環境・設定: なし

### M-05: VPSデプロイ・CI/CD自動化基盤整備 ── 【Must】
- ゴール: mainブランチへのプッシュをトリガーとしたGitHub Actions経由でのコンテナ自動ビルド・デプロイがVPS環境上で完了すること
- [ ] M-05-T01 [基盤] GitHub Actionsによる自動テスト・デプロイパイプライン構築
  - 処理: なし
  - 要件: なし
  - 依存: M-04-T02
  - モジュール: なし
  - 環境・設定: .github/workflows/deploy.yml, docker-compose.prod.yml, nginx.conf

## 4.3 開発環境・CI/CD・事前準備事項

**開発に必要なツール・技術環境**
- **言語・実行環境**: Python 3.13, Node.js 20 LTS
- **バックエンド**: FastAPI, LangChain, LangGraph, SQLAlchemy (asyncpg), Pydantic v2
- **フロントエンド**: Next.js 14+ (App Router), React, Tamagui
- **データストア**: PostgreSQL 16+, Redis 7+
- **コンテナ・Webサーバ**: Docker / Docker Compose, nginx
- **LLM API**: Google Gemini Flash-Lite API

**リポジトリ構成**
モノレポ構成を採用し、フロントエンドとバックエンドを単一リポジトリ内で管理します。
- `frontend/`: Next.jsおよびTamaguiのコンポーネント・画面ロジック
- `backend/`: FastAPIアプリケーション、LLMワークフロー、DBモデル、セキュリティ共通処理
- `docker/`: nginx設定ファイルおよび環境別Dockerfile
- `.github/workflows/`: 自動テストおよびVPSデプロイ用ワークフロー定義

**自動テスト・CI/CD方針**
- **自動テスト**: pytestによるバックエンドAPI・認証・LangGraphワークフローの統合テスト、Jest/React Testing Libraryによるフロントエンド主要画面のコンポーネントテストを実施。
- **静的解析**: Ruff (Pythonコードフォーマッタ・リンター)、ESLint / Prettier (TypeScript/Next.js) をコミット・PR時に実行。
- **CI/CD**: GitHub Actionsを活用し、Pull Request作成時に静的解析と自動テストを実行。mainブランチへのマージを契機としてVPS環境へのSSHデプロイ・Docker Composeビルド・再起動を自動化。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: Gemini Flash-Lite API（無料枠）のレートリミット超過（429エラー）や一時的なAPIダウンによるチャット応答・設計書生成の中断**

*対策*: Redisによるクライアント側API呼び出しレート制限の徹底、指数バックオフによる自動再試行ハンドリングを実装。また対話メッセージはAI応答成功時のみコミットし、生成失敗時はステータスをfailedとして安全な再試行UIを提供する。

**リスク2: 4文書一括生成処理が長時間化（タイムアウト・クライアント切断）し、サーバーリソースを枯渇させるリスク**

*対策*: LangGraphワークフローで並列生成と逐次生成を最適化し、FastAPI非同期タスクとして実行。生成中は新規チャット送信を排他ロックし、フロントエンド側で進捗スピナーおよびタイムアウト防止のポーリング制御を行う。

**リスク3: 参考資料PDF/テキストのサイズ肥大化によるコンテキスト長超過やメモリ消費の増大**

*対策*: アップロード時にファイル件数を最大3件、1ファイルあたりのサイズ上限を設定し、バックエンド抽出時にプレーンテキストの切り詰めバリデーションを実施してLLM入力プロンプト長を安全域に抑える。

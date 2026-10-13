# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

本プロジェクトは、短期間で高品質な設計書自動生成を実現するため、単一のMVP（フェーズ1）として開発を推進します。

- フェーズ1（MVPリリース）: 優先度【Must】
  - M-01: 開発基盤および認証・認可機能の構築
  - M-02: プロジェクト管理および参考資料管理機能の構築
  - M-03: AIヒアリングチャット機能の構築
  - M-04: 設計書一括生成・プレビュー・ダウンロード機能の構築
  - M-05: 本番インフラ・CI/CDデプロイ基盤の構築

## 4.2 タスク分解（WBS）

### M-01: 開発基盤および認証・認可機能の構築 ── 【Must】
- ゴール: FastAPIとNext.jsの基盤上で、アカウント登録、ログイン、JWT/Cookieによる認証・認可およびログアウトが安全に動作すること
- [ ] M-01-T01 [基盤] 開発環境・リポジトリ構成の初期セットアップ
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: app/models/*.py
  - 環境・設定: docker-compose.yml, backend/Dockerfile, frontend/Dockerfile
- [ ] M-01-T02 [機能] ユーザー登録およびログイン認証機能の実装
  - 処理: DF-1, DF-2
  - 要件: FR-001, FR-002, FR-010
  - 依存: M-01-T01
  - モジュール: app/api/auth.py, app/services/auth_service.py, app/middleware/rate_limit.py, app/repositories/*.py, app/models/*.py
  - 環境・設定: なし
- [ ] M-01-T03 [機能] トークン再発行およびログアウト機能の実装
  - 処理: DF-3, DF-4
  - 要件: FR-002
  - 依存: M-01-T02
  - モジュール: app/api/auth.py, app/services/auth_service.py, app/middleware/auth.py, app/repositories/*.py, app/models/*.py
  - 環境・設定: なし

### M-02: プロジェクト管理および参考資料管理機能の構築 ── 【Must】
- ゴール: ユーザーが自分専用のプロジェクトを作成・照会し、参考資料（txt, md, pdf）をアップロードして抽出テキストを保持できること
- [ ] M-02-T01 [機能] プロジェクト作成・一覧・詳細取得機能の実装
  - 処理: DF-5, DF-6, DF-7
  - 要件: FR-003, FR-010
  - 依存: M-01-T03
  - モジュール: app/api/projects.py, app/services/project_service.py, app/middleware/auth.py, app/repositories/*.py, app/models/*.py
  - 環境・設定: なし
- [ ] M-02-T02 [機能] 参考資料ファイルアップロード・テキスト抽出機能の実装
  - 処理: DF-8
  - 要件: FR-003, FR-004, FR-010
  - 依存: M-02-T01
  - モジュール: app/api/files.py, app/services/file_service.py, app/middleware/auth.py, app/repositories/*.py, app/models/*.py
  - 環境・設定: なし

### M-03: AIヒアリングチャット機能の構築 ── 【Must】
- ゴール: 対話履歴の参照および参考資料を踏まえたGeminiとのストリーミングチャット対話、文字数制御、エラーハンドリングが動作すること
- [ ] M-03-T01 [機能] ヒアリング対話履歴取得・表示機能の実装
  - 処理: DF-9
  - 要件: FR-003, FR-005, FR-010
  - 依存: M-02-T01
  - モジュール: app/api/messages.py, app/services/chat_service.py, app/middleware/auth.py, app/repositories/*.py, app/models/*.py
  - 環境・設定: なし
- [ ] M-03-T02 [機能] AI対話メッセージ送信およびSSEストリーミング応答機能の実装
  - 処理: DF-10
  - 要件: FR-005, FR-006, FR-010, FR-011
  - 依存: M-03-T01, M-02-T02
  - モジュール: app/api/messages.py, app/services/chat_service.py, app/llm/client.py, app/middleware/auth.py, app/middleware/rate_limit.py, app/repositories/*.py, app/models/*.py
  - 環境・設定: なし

### M-04: 設計書一括生成・プレビュー・ダウンロード機能の構築 ── 【Must】
- ゴール: 対話内容から4種のMarkdown設計書を一括生成し、自己診断結果の表示、画面プレビュー、コピー、ZIP/個別ダウンロードが正常に行えること
- [ ] M-04-T01 [機能] 4種設計書一括生成およびAI自己診断機能の実装
  - 処理: DF-11
  - 要件: FR-007, FR-008, FR-010, FR-011
  - 依存: M-03-T02
  - モジュール: app/api/specifications.py, app/services/spec_generator_service.py, app/llm/graphs.py, app/llm/client.py, app/middleware/auth.py, app/middleware/rate_limit.py, app/repositories/*.py, app/models/*.py
  - 環境・設定: なし
- [ ] M-04-T02 [機能] 生成設計書プレビュー・自己診断結果表示およびコピー機能の実装
  - 処理: DF-12
  - 要件: FR-007, FR-008, FR-009
  - 依存: M-04-T01
  - モジュール: app/api/specifications.py, app/services/spec_generator_service.py, app/middleware/auth.py, app/repositories/*.py, app/models/*.py
  - 環境・設定: なし
- [ ] M-04-T03 [機能] 設計書ダウンロード機能（個別Markdown・一括ZIP）の実装
  - 処理: DF-13
  - 要件: FR-009
  - 依存: M-04-T02
  - モジュール: app/api/specifications.py, app/services/spec_generator_service.py, app/middleware/auth.py, app/repositories/*.py, app/models/*.py
  - 環境・設定: なし

### M-05: 本番インフラ・CI/CDデプロイ基盤の構築 ── 【Must】
- ゴール: VPS上でnginx・コンテナ群が稼働し、GitHub Actionsによる自動テストおよびデプロイ、DBバックアップ体制が確立すること
- [ ] M-05-T01 [基盤] 本番Docker環境構築・nginx設定およびCI/CDパイプライン整備
  - 処理: なし
  - 要件: なし
  - 依存: M-04-T03
  - モジュール: なし
  - 環境・設定: docker-compose.yml, nginx.conf, .github/workflows/deploy.yml

## 4.3 開発環境・CI/CD・事前準備事項

**開発に必要なツール・技術環境**
- 言語・ランタイム: Python 3.13, Node.js (Next.js App Router, React 19)
- フロントエンド: Next.js, Tamagui
- バックエンド: FastAPI, LangChain, LangGraph, SQLAlchemy 2.0, Pydantic, pypdf, PyJWT, bcrypt
- データベース / キャッシュ: PostgreSQL, Redis
- コンテナ / 仮想化: Docker, Docker Compose
- プロキシ / Webサーバー: nginx
- 外部API: Google Gemini API (Gemini Flash-Lite)

**リポジトリ構成**
- backend/: FastAPIアプリケーションコード、モデル定義、プロンプト、LangGraph定義
- frontend/: Next.jsおよびTamaguiによるUIコンポーネント、状態管理、APIクライアント
- docker/: nginx設定ファイル、Dockerfile各種
- .github/workflows/: 自動テストおよびデプロイ用GitHub Actionsワークフロー
- docker-compose.yml: ローカル開発および本番環境立ち上げ用定義

**自動テスト・CI/CD方針**
- バックエンドテスト: pytestを用い、認証、ファイル検証、対話制御、設計書生成サービス、レート制限の単体・統合テストを実装します。
- フロントエンドテスト: コンポーネントレンダリングおよび主要操作フローの結合テストを実施します。
- CI/CDパイプライン: GitHub Actionsによりmainブランチプッシュ時にLintチェック、型チェック、テスト自動実行を行い、成功後にVPSへSSH経由でDocker Composeデプロイを実行します。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: Gemini Flash-Lite無料枠のレートリミット（分間リクエスト上限および日次クォータ）超過によるチャット・設計書生成エラーの発生**

*対策*: Redisを用いたスライディングウィンドウ型レート制限により短時間の集中アクセスを未然に抑制します。またAPI上限検知時はトランザクションをロールバックして未完了データを残さず、ユーザーへ分かりやすい再試行ガイダンスを表示します。

**リスク2: 4種の設計書一括生成処理に数分程度を要し、リバースプロキシやブラウザ側でタイムアウトが発生するリスク**

*対策*: nginxのproxy_read_timeoutを十分に長く設定し、設計書生成中はUI側に入力不可のローディング表示と進捗ガイダンスを提供して二重送信や中断を防止します。

**リスク3: 参考資料（特に大容量PDFファイル）の読み込み時にテキスト抽出が遅延またはメモリ不足に陥るリスク**

*対策*: ファイル容量上限を1件あたり5MB、最大3件までに厳格に制限し、pypdfを用いたストリーム処理により軽量なテキスト抽出を行います。

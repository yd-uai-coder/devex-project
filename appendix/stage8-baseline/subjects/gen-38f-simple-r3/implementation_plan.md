# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

本計画では、コア機能の検証と安全なリリースを最短で実現するため、2段階のフェーズに分割して開発を進めます。

- **フェーズ1 (MVPリリース)**: ユーザー登録・認証から、添付資料付きプロジェクト作成、AIヒアリング対話、4種Markdown設計書の一括自動生成、自己診断提示、およびプレビュー・ダウンロードまでの基本業務フローを網羅します。 (優先度: Must / 対象マイルストーン: M-01, M-02, M-03, M-04)
- **フェーズ2 (運用強化・将来拡張)**: MVP稼働後の運用データとフィードバックに基づき、エラー追跡や外部死活監視の導入、テンプレート選択、版履歴管理などの拡張機能開発を検討します。 (優先度: Could / 今回の開発スコープ外)

## 4.2 タスク分解（WBS）

### M-01: M-01: 開発環境構築および認証・プロジェクト基盤整備 ── 【Must】
- ゴール: コンテナ環境上でユーザー登録・ログイン認証、セッション管理、および参考資料添付を含むプロジェクト作成・一覧・詳細取得が正常に動作すること。
- [ ] M-01-T01 [基盤] ローカルコンテナ環境および共通基盤の構築
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: backend/app/main.py, backend/app/core/config.py, backend/app/core/database.py, backend/app/core/exceptions.py
  - 環境・設定: docker-compose.yml, Dockerfile, nginx/nginx.conf
- [ ] M-01-T02 [機能] ユーザー新規登録およびログイン認証機能の実装
  - 処理: DF-1, DF-2
  - 要件: FR-001, FR-007, FR-009
  - 依存: M-01-T01
  - モジュール: backend/app/routers/auth.py, backend/app/services/auth_service.py, backend/app/repositories/user_repo.py, backend/app/core/security.py, backend/app/core/rate_limit.py, backend/app/schemas/auth.py
  - 環境・設定: なし
- [ ] M-01-T03 [機能] トークンリフレッシュおよびログアウト機能の実装
  - 処理: DF-3, DF-4
  - 要件: FR-001, FR-009
  - 依存: M-01-T02
  - モジュール: backend/app/routers/auth.py, backend/app/services/auth_service.py, backend/app/core/security.py, backend/app/core/rate_limit.py, backend/app/schemas/auth.py
  - 環境・設定: なし
- [ ] M-01-T04 [機能] プロジェクト管理および添付資料解析・保存機能の実装
  - 処理: DF-5, DF-6, DF-7
  - 要件: FR-002, FR-007, FR-009
  - 依存: M-01-T03
  - モジュール: backend/app/routers/projects.py, backend/app/services/project_service.py, backend/app/services/file_service.py, backend/app/repositories/project_repo.py, backend/app/core/rate_limit.py, backend/app/schemas/project.py
  - 環境・設定: なし

### M-02: M-02: AIヒアリング対話機能の実装 ── 【Must】
- ゴール: チャット画面にてユーザーがメッセージを送信し、Gemini APIによるストリーミング応答を受信して対話履歴が正常に蓄積・表示されること。
- [ ] M-02-T01 [機能] AIヒアリング対話およびSSEストリーミング応答機能の実装
  - 処理: DF-8, DF-9
  - 要件: FR-003, FR-007, FR-008, FR-009
  - 依存: M-01-T04
  - モジュール: backend/app/routers/messages.py, backend/app/services/chat_service.py, backend/app/ai/client.py, backend/app/repositories/message_repo.py, backend/app/repositories/project_repo.py, backend/app/core/rate_limit.py, backend/app/schemas/message.py
  - 環境・設定: なし

### M-03: M-03: 設計書一括自動生成および出力機能の実装 ── 【Must】
- ゴール: ヒアリング対話履歴を基に4種のMarkdown設計書と自己診断結果が一括生成され、画面上でプレビュー、コピー、ダウンロードができること。
- [ ] M-03-T01 [機能] LangGraphワークフローによる4種設計書生成および自己診断機能の実装
  - 処理: DF-10
  - 要件: FR-004, FR-005, FR-007, FR-008, FR-009
  - 依存: M-02-T01
  - モジュール: backend/app/routers/documents.py, backend/app/services/document_service.py, backend/app/ai/workflows.py, backend/app/ai/prompts.py, backend/app/ai/client.py, backend/app/repositories/document_repo.py, backend/app/repositories/project_repo.py, backend/app/core/rate_limit.py, backend/app/schemas/document.py
  - 環境・設定: なし
- [ ] M-03-T02 [機能] 生成設計書プレビュー・コピー・ダウンロード機能の実装
  - 処理: DF-11, DF-12
  - 要件: FR-006
  - 依存: M-03-T01
  - モジュール: backend/app/routers/documents.py, backend/app/services/document_service.py, backend/app/repositories/document_repo.py, backend/app/schemas/document.py
  - 環境・設定: なし

### M-04: M-04: 運用保守・データ保全および本番デプロイ自動化 ── 【Must】
- ゴール: データベースの定期自動バックアップおよびGitHub ActionsによるクラウドVPSへのCI/CDデプロイが正常に実行されること。
- [ ] M-04-T01 [機能] データベース定期バックアップ・退避機能の実装
  - 処理: DF-13
  - 要件: なし
  - 依存: M-01-T01
  - モジュール: backend/scripts/backup.sh
  - 環境・設定: なし
- [ ] M-04-T02 [基盤] GitHub Actionsによる自動テスト・VPSデプロイパイプライン構築
  - 処理: なし
  - 要件: なし
  - 依存: M-03-T02, M-04-T01
  - モジュール: なし
  - 環境・設定: .github/workflows/deploy.yml, docker-compose.prod.yml

## 4.3 開発環境・CI/CD・事前準備事項

**開発環境・ツール**
- **言語・ランタイム**: Python 3.13, Node.js (Next.js 実行環境)
- **主要ライブラリ**: FastAPI, LangChain, LangGraph, Tamagui, pypdf, SQLAlchemy, pyjwt, passlib, redis-py
- **コンテナ・インフラ**: Docker, Docker Compose, nginx
- **ミドルウェア**: PostgreSQL, Redis
- **外部API**: Google Gemini API (Gemini Flash-Lite)

**リポジトリ構成**
- フロントエンド(Next.js App Router)とバックエンド(FastAPI)を単一リポジトリで管理するモノレポ構成を採用します。
- `backend/`: FastAPI アプリケーションコード、データベース設定、マイグレーションスクリプト、運用スクリプト(`scripts/`)
- `frontend/`: Next.js、Tamagui UI コンポーネント、API クライアント
- ルートディレクトリ: `docker-compose.yml`, `nginx/`, `.github/workflows/`

**CI/CD方針および自動テスト**
- **自動テスト**: pytest を用いたバックエンドの単体・統合テスト、およびフロントエンドのビルドチェックをプルリクエスト時に実行します。
- **CI/CD**: GitHub Actions を利用し、`main` ブランチへの push をトリガーとしてリント・自動テスト・Dockerイメージビルドを実行後、SSH経由でクラウドVPS上の Docker Compose 環境を自動更新・デプロイします。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: Gemini API無料枠の利用に伴うレートリミット(HTTP 429)や一時的な障害による設計書一括生成処理の中断**

*対策*: バックエンド(backend/app/ai/client.py)にて指数バックオフを伴う自動再試行を実装するとともに、失敗時はプロジェクト状態を'failed'に更新して画面上でユーザーが簡単に再生成を実行できるようにします。また、生成中はチャット送信を制限してAPI消費を抑制します。

**リスク2: 参考資料PDFの構造やサイズによるテキスト抽出処理の遅延または失敗**

*対策*: ファイル添付数を最大3件に制限し、pypdfを用いた抽出処理でタイムアウトおよびサイズ上限を厳格にバリデーションします。抽出不可の異常なPDFについては明確なエラーメッセージを返し、再添付を促します。

**リスク3: 短納期またはAPI仕様変更に伴うドキュメント生成品質のばらつき**

*対策*: プロンプトテンプレート(backend/app/ai/prompts.py)をコードから分離して迅速にチューニング可能な構造とし、出力形式のパースエラーが発生した際も段階的なフォールバックを行えるようにLangGraphワークフローを設計します。

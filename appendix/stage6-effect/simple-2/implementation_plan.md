# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン
- フェーズ1（MVP / 必須機能） ── 【Must】
  - M-01: 基盤構築・認証・プロジェクト管理機能 ── 【Must】
  - M-02: チャットヒアリング・資料読み込み機能 ── 【Must】
  - M-03: 設計書一括生成・AI自己診断・プレビュー機能 ── 【Must】
- フェーズ2（拡張機能） ── 【Could】
  - M-04: テンプレート選択・版履歴・UML生成機能 ── 【Could】

## 4.2 タスク分解（WBS）

### M-01: 基盤構築・認証・プロジェクト管理機能 ── 【Must】
- ゴール: Docker環境が立ち上がり、ユーザー登録・ログインおよびプロジェクトの作成・一覧取得ができること
- [ ] M-01-T01 [基盤] 開発環境・Docker Composeおよびデータベース・Redisを用意する
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: backend/app/core/database.py, backend/app/models/orm.py
  - 環境・設定: Dockerfile, docker-compose.txt, backend/requirements.txt
- [ ] M-01-T02 [機能] ユーザー新規登録およびログイン機能を実装する
  - 処理: DF-001, DF-002
  - 要件: FR-009, NFR-005
  - 依存: M-01-T01
  - モジュール: backend/app/api/v1/auth.py, backend/app/services/auth_service.py, backend/app/core/security.py
  - 環境・設定: なし
- [ ] M-01-T03 [機能] リフレッシュトークンによるアクセストークン再発行機能を実装する
  - 処理: DF-003
  - 要件: FR-009, NFR-005
  - 依存: M-01-T02
  - モジュール: backend/app/api/v1/auth.py, backend/app/services/auth_service.py
  - 環境・設定: なし
- [ ] M-01-T04 [機能] プロジェクトの作成および参考資料ファイル保存機能を実装する
  - 処理: DF-005
  - 要件: FR-006
  - 依存: M-01-T02
  - モジュール: backend/app/api/v1/projects.py
  - 環境・設定: なし
- [ ] M-01-T05 [機能] 認証ユーザーのプロジェクト一覧取得機能を実装する
  - 処理: DF-004
  - 要件: FR-009
  - 依存: M-01-T04
  - モジュール: backend/app/api/v1/projects.py
  - 環境・設定: なし

### M-02: チャットヒアリング・資料読み込み機能 ── 【Must】
- ゴール: チャット履歴の取得、メッセージのバリデーション（数千文字以内・非空）、AI（Gemini）との対話および失敗時のリカバリができること
- [ ] M-02-T01 [機能] 指定プロジェクトのチャット履歴一覧取得機能を実装する
  - 処理: DF-006
  - 要件: FR-001, FR-005
  - 依存: M-01-T05
  - モジュール: backend/app/api/v1/chats.py
  - 環境・設定: なし
- [ ] M-02-T02 [機能] チャットメッセージ送信・LangChain連携およびエラーハンドリング機能を実装する
  - 処理: DF-007
  - 要件: FR-001, FR-007, FR-008, CON-006
  - 依存: M-02-T01
  - モジュール: backend/app/api/v1/chats.py, backend/app/services/chat_service.py, backend/app/services/ai_service.py
  - 環境・設定: なし

### M-03: 設計書一括生成・AI自己診断・プレビュー機能 ── 【Must】
- ゴール: チャットと参考資料を基に4種の設計書と自己診断結果を生成し、DB保存・取得およびプレビュー・コピー・ダウンロードができること
- [ ] M-03-T01 [機能] LangGraphを用いた4種の設計書一括生成およびAI自己診断機能を実装する
  - 処理: DF-008
  - 要件: FR-002, FR-003, CON-006
  - 依存: M-02-T02
  - モジュール: backend/app/services/ai_service.py, backend/app/services/document_service.py
  - 環境・設定: なし
- [ ] M-03-T02 [機能] 生成済みの設計書およびAI自己診断結果の取得APIを実装する
  - 処理: DF-009
  - 要件: FR-002, FR-003, FR-004
  - 依存: M-03-T01
  - モジュール: backend/app/api/v1/documents.py
  - 環境・設定: なし

### M-04: テンプレート選択・版履歴・UML生成機能 ── 【Could】
- ゴール: 将来拡張であるテンプレート選択、版の履歴、設計図(UML)生成機能が利用可能になること
- [ ] M-04-T01 [機能] テンプレート選択機能を実装する
  - 処理: なし
  - 要件: FR-015
  - 依存: M-03-T02
  - モジュール: backend/app/api/v1/projects.py
  - 環境・設定: なし
- [ ] M-04-T02 [機能] 版の履歴管理機能を実装する
  - 処理: なし
  - 要件: FR-016
  - 依存: M-03-T02
  - モジュール: backend/app/api/v1/documents.py
  - 環境・設定: なし
- [ ] M-04-T03 [機能] 設計図(UML)の生成機能を実装する
  - 処理: なし
  - 要件: FR-017
  - 依存: M-03-T01
  - モジュール: backend/app/services/ai_service.py
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

### 1. 開発に必要なツール・リポジトリ構成
- **開発ツール**: Python 3.13, Node.js (App Router対応), Docker & Docker Compose, Git
- **リポジトリ構成**:
  ```text
  .
  ├── backend/        # FastAPI, LangChain/LangGraph
  ├── frontend/       # Next.js, Tamagui
  ├── nginx/          # リバースプロキシ設定
  ├── .github/workflows/ # GitHub Actions CI/CD設定
  └── docker-compose.yml
  ```

### 2. 自動テスト・CI/CD方針
- **CI/CD方針**: GitHub Actionsを利用し、`main`ブランチへのプッシュをトリガーとして自動ビルドおよびVPSへのDocker Composeによる自動デプロイを実施する。
- **自動テスト方針**: バックエンドは `pytest` によるAPIエンドポイントおよびサービス層の単体・結合テストを実行する。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

- **リスク1: Gemini Flash-Lite無料枠のレートリミット（上限超過）や応答遅延**
  *対策*: エラー発生時は例外処理（FR-007）に則り、メッセージを保存せずにエラー理由を通知する。また、バックオフ処理をAIサービス層に実装する。

- **リスク2: 4文書一括生成時の処理時間の長期化（数分に及ぶ可能性）**
  *対策*: FastAPIの非同期処理を活用し、フロントエンド側でタイムアウト対策としてのローディング表示およびポーリングまたはSSE（Server-Sent Events）の導入を検討する。

- **リスク3: 納期・予算超過時のトレードオフ策**
  *対策*: 開発遅延が生じた場合、フェーズ2の機能（FR-015, FR-016, FR-017）をすべてスコープ外（Won't have）として完全に後回しにし、MVPであるフェーズ1（M-01〜M-03）の品質担保を最優先とする。
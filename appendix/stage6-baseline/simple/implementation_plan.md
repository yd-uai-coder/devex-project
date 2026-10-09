# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン
- フェーズ1（MVP / 必須機能） ── 【Must】
  - ユーザー認証基盤、参考資料アップロード、AI対話チャット、構造化サマリ、4種設計書一括生成・版管理、自己診断機能、エラーハンドリングを包含する最小限の製品リリース。
  - マイルストーン: M-01, M-02, M-03, M-04, M-05
- フェーズ2（拡張機能） ── 【Should】
  - 過去のチャット履歴・生成文書の閲覧・比較・復元画面を追加。
  - マイルストーン: M-06

## 4.2 タスク分解（WBS）

### M-01: 開発基盤と認証機能 ── 【Must】
- ゴール: バックエンド・フロントエンドの基盤が整い、ユーザー登録・ログインができるようになること
- [ ] M-01-T01 [基盤] 開発環境とDB接続・Prismaの初期設定を行う
  - 処理: なし
  - 依存: なし
  - モジュール: backend/src/main.ts, backend/prisma/schema.prisma
  - 環境・設定: docker-compose.yml, backend/.env
- [ ] M-01-T02 [機能] ユーザー登録・ログイン認証機能を実装する
  - 処理: DF-01
  - 依存: M-01-T01
  - モジュール: backend/src/modules/auth/auth.controller.ts, backend/src/modules/auth/auth.service.ts, backend/src/modules/auth/strategies/jwt.strategy.ts
  - 環境・設定: なし

### M-02: プロジェクト管理と参考資料アップロード ── 【Must】
- ゴール: プロジェクトを作成し、参考資料をアップロードできるようになること
- [ ] M-02-T01 [機能] プロジェクトの作成および一覧取得機能を実装する
  - 処理: なし
  - 依存: M-01-T02
  - モジュール: backend/src/modules/projects/projects.controller.ts, backend/src/modules/projects/projects.service.ts
  - 環境・設定: なし
- [ ] M-02-T02 [機能] 参考資料のアップロードおよびMIMEタイプ・拡張子検証を実装する
  - 処理: DF-02
  - 依存: M-02-T01
  - モジュール: backend/src/modules/documents/documents.controller.ts, backend/src/modules/documents/documents.service.ts
  - 環境・設定: backend/src/config/multer.config.ts

### M-03: AI対話チャットと構造化サマリ ── 【Must】
- ゴール: AIとチャットで対話してヒアリングを進め、構造化サマリを確認・承認できるようになること
- [ ] M-03-T01 [機能] AI対話チャットとGemini API連携機能を実装する
  - 処理: DF-03
  - 依存: M-02-T02
  - モジュール: backend/src/modules/chats/chats.controller.ts, backend/src/modules/chats/chats.service.ts, backend/src/modules/chats/gemini.service.ts
  - 環境・設定: backend/.env
- [ ] M-03-T02 [機能] 構造化サマリの生成と承認フロー機能を実装する
  - 処理: なし
  - 依存: M-03-T01
  - モジュール: backend/src/modules/summaries/summaries.controller.ts, backend/src/modules/summaries/summaries.service.ts
  - 環境・設定: なし

### M-04: 設計書一括生成と版管理・自己診断 ── 【Must】
- ゴール: 4種のMarkdown設計書の一括生成（直近3件の版管理）と、AIによる自己診断結果を取得できるようになること
- [ ] M-04-T01 [機能] 4種設計書の並行生成および版管理機能を実装する
  - 処理: DF-04
  - 依存: M-03-T02
  - モジュール: backend/src/modules/specifications/specifications.controller.ts, backend/src/modules/specifications/specifications.service.ts
  - 環境・設定: なし
- [ ] M-04-T02 [機能] AI自己診断（3段階評価）機能を実装する
  - 処理: DF-05
  - 依存: M-04-T01
  - モジュール: backend/src/modules/diagnostics/diagnostics.controller.ts, backend/src/modules/diagnostics/diagnostics.service.ts
  - 環境・設定: なし

### M-05: 共通エラーハンドリングとフロントエンド統合 ── 【Must】
- ゴール: LLM上限超過エラーなどの例外処理が正しく動作し、フロントエンドから一連の操作が完結すること
- [ ] M-05-T01 [基盤] 共通エラーレスポンス形式およびLLMレートリミット用例外フィルターを実装する
  - 処理: なし
  - 依存: M-04-T02
  - モジュール: backend/src/common/filters/http-exception.filter.ts, backend/src/common/interceptors/logging.interceptor.ts
  - 環境・設定: なし
- [ ] M-05-T02 [機能] フロントエンドの認証・チャット・プレビュー画面を結合する
  - 処理: なし
  - 依存: M-05-T01
  - モジュール: frontend/src/app/page.tsx, frontend/src/components/chat/ChatInterface.tsx, frontend/src/components/preview/MarkdownPreview.tsx
  - 環境・設定: frontend/.env.local

### M-06: 履歴閲覧・比較・復元機能 ── 【Should】
- ゴール: 過去のチャット履歴や生成文書の閲覧・比較・復元ができるようになること
- [ ] M-06-T01 [機能] 過去のチャット履歴・生成文書の閲覧および復元APIを実装する
  - 処理: なし
  - 依存: M-05-T02
  - モジュール: backend/src/modules/projects/projects.controller.ts, backend/src/modules/specifications/specifications.service.ts
  - 環境・設定: なし
- [ ] M-06-T02 [機能] 履歴閲覧・比較・復元用のフロントエンド画面を実装する
  - 処理: なし
  - 依存: M-06-T01
  - モジュール: frontend/src/app/history/page.tsx, frontend/src/components/history/HistoryView.tsx
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

### 1. 開発に必要なツール・技術スタック
- **言語・ランタイム**: Node.js (LTS), TypeScript
- **フレームワーク**: NestJS (バックエンド), Next.js App Router (フロントエンド)
- **データベース**: PostgreSQL (Docker環境でローカル起動)
- **外部AI**: Gemini Flash-Lite API

### 2. リポジトリ構成
- モノレポ構成またはバックエンド/フロントエンド分離リポジトリ（ここではモノレポを想定）
```text
/
├── backend/          # NestJSアプリケーション
├── frontend/         # Next.jsアプリケーション
├── docker-compose.yml # PostgreSQL等のローカルインフラ
└── README.md
```

### 3. 自動テスト・CI/CD方針
- **テスト方針**: バックエンドはJestを用いたサービス層の単体テストを実施。フロントエンドは主要コンポーネントの表示確認。
- **CI/CD方針**: GitHub Actionsを利用し、mainブランチへのプルリクエスト時にビルドおよびテストを自動実行する。デプロイはVercel（フロント）およびRender/AWS（バックエンド）へ自動連携する。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

- **リスク1: Gemini Flash-Liteの無料枠レートリミット（429 Too Many Requests）の頻発**
  *対策*: エラーハンドリング層で検知し、ユーザーに対して「しばらく待ってから再送してください」という専用メッセージと再試行ボタンをUI上で提供する。

- **リスク2: 4種設計書の一括生成時におけるLLMのタイムアウト発生**
  *対策*: バックエンド側で非同期処理（キューイングまたはプロミス並列実行）を適切に行うとともに、フロントエンド側でローディング表示と長めのタイムアウト設定（60秒以上）を施す。

- **リスク3: 納期・スケジュール超過時のトレードオフ策**
  *対策*: 開発遅延が発生した場合は、Should要件である「M-06: 履歴閲覧・比較・復元機能」をスコープ外（Won't have）に変更し、MVP必須機能の品質担保を最優先とする。
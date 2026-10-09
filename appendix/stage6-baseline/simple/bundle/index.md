# 実装手順書: Devex

## 1. 実装概要

### 対象

実装計画書のマイルストーン M-01〜M-06。

| M-ID | 名前 | 優先度 | ゴール |
|---|---|---|---|
| M-01 | 開発基盤と認証機能 | Must | バックエンド・フロントエンドの基盤が整い、ユーザー登録・ログインができるようになること |
| M-02 | プロジェクト管理と参考資料アップロード | Must | プロジェクトを作成し、参考資料をアップロードできるようになること |
| M-03 | AI対話チャットと構造化サマリ | Must | AIとチャットで対話してヒアリングを進め、構造化サマリを確認・承認できるようになること |
| M-04 | 設計書一括生成と版管理・自己診断 | Must | 4種のMarkdown設計書の一括生成（直近3件の版管理）と、AIによる自己診断結果を取得できるようになること |
| M-05 | 共通エラーハンドリングとフロントエンド統合 | Must | LLM上限超過エラーなどの例外処理が正しく動作し、フロントエンドから一連の操作が完結すること |
| M-06 | 履歴閲覧・比較・復元機能 | Should | 過去のチャット履歴や生成文書の閲覧・比較・復元ができるようになること |

### 対象外

—

## 2. 実装前提・制約

### 技術スタック・開発環境(実装計画書 4.3・内部設計書 3.1)

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

- **フロントエンド**: 
  - **選定理由**: 開発スピードとインタラクティブなUI構築（マークダウンプレビューやチャットインターフェース）のしやすさを考慮し、React / Next.js（App Router）を採用する。
  - **構成方針**: コンポーネント指向に基づき、画面ごとのUIコンポーネントとAPIクライアント層を分離。状態管理にはReact Query (TanStack Query)を利用してサーバーサイドの状態を効率的にキャッシュ・同期する。
- **バックエンド**: 
  - **選定理由**: 型安全性、非同期処理の堅牢性、AI連携ライブラリの豊富さを考慮し、Node.js (TypeScript) + Express または NestJS を採用する。ここでは保守性とモジュール構造の明確さから NestJS を前提とする。
  - **構成方針**: クリーンアーキテクチャ（レイヤードアーキテクチャ）を採用し、Controller（プレゼンテーション層）、Service（ビジネスロジック層）、Repository（データアクセス層）に明確に分離する。
- **データベース**: 
  - **選定理由**: リレーショナルデータの整合性（ユーザー、プロジェクト、チャット履歴、設計書版管理）とPostgreSQLの堅牢性を評価。
  - **構成方針**: ORMには Prisma または TypeORM を利用し、スキーマ定義から型安全なクエリ操作を実現する。
- **インフラ**: 
  - **選定理由**: MVPの迅速なリリースと運用コスト削減のため、Vercel（フロントエンド）および Render / AWS (ECS/RDS) などのマネージドサービスを想定する。

### 実装ルール(内部設計書 3.3・3.4より)

- モジュールは、内部設計書のモジュール一覧の依存先にだけ依存する(層を飛び越さない)。
- 3.4 **共通エラーレスポンス形式**:
- 3.4 全てのAPIエラー時は以下のJSON形式でレスポンスを返却する。
- 3.4 **例外検知・ログ出力方針**:
- 3.4 **構造化ロギング**: Winston または NestJS 標準 Logger を使用し、JSON形式で標準出力へログを出力する。
- 3.4 **LLMエラーハンドリング**: Gemini APIのレートリミット（429 Too Many Requests）や上限超過エラー発生時は、例外フィルターで検知し、クライアントへ専用のエラーコード（例: `LLM_RATE_LIMIT_EXCEEDED`）と再試行促しメッセージを返却する。
- 3.4 **セキュリティ監査ログ**: 認証失敗、不正なリフレッシュトークン利用試行、権限外リソースアクセス試行は、警告レベル（WARN）以上で記録する。

## 3. 単位の一覧(依存順)

| 単位 | 種別 | 対象の処理 | 依存 | 作成・変更するファイル(依存順) | 確認方法 | 未定義 |
|---|---|---|---|---|---|---|
| [M-01-T01 開発環境とDB接続・Prismaの初期設定を行う](./M-01-T01_開発環境とDB接続・Prismaの初期設定を行う.md) | 基盤 | — | — | `docker-compose.yml`、`backend/.env`、`backend/prisma/schema.prisma`、`backend/src/main.ts`、`backend/src/app.module.ts` | docker-compose up -d でPostgreSQLが正常に起動すること / npx prisma migrate dev を実行してマイグレーションが成功すること / npm run start:dev でNestJSサーバーが正常に起動すること | なし |
| [M-01-T02 ユーザー登録・ログイン認証機能を実装する](./M-01-T02_ユーザー登録・ログイン認証機能を実装する.md) | 機能 | DF-01 | M-01-T01 | `backend/src/modules/auth/strategies/jwt.strategy.ts`、`backend/src/modules/auth/auth.service.ts`、`backend/src/modules/auth/auth.controller.ts`、`backend/src/modules/auth/auth.service.spec.ts` | バックエンドの単体テストが全て成功することを確認する / POST /api/v1/auth/login に対して適切なリクエストを送信し、期待通りのレスポンスとCookieが返ることを確認する | なし |
| [M-02-T01 プロジェクトの作成および一覧取得機能を実装する](./M-02-T01_プロジェクトの作成および一覧取得機能を実装する.md) | 機能 | — | M-01-T02 | `backend/src/modules/projects/projects.service.ts`、`backend/src/modules/projects/projects.controller.ts` | 実装したサービス層のJest単体テストが全て成功することを確認する / コントローラーのエンドポイントにリクエストを送り、期待通りのJSONレスポンスが返ることを確認する | 最重要1・中程度1 |
| [M-02-T02 参考資料のアップロードおよびMIMEタイプ・拡張子検証を実装する](./M-02-T02_参考資料のアップロードおよびMIMEタイプ・拡張子検証を実装する.md) | 機能 | DF-02 | M-02-T01 | `backend/src/config/multer.config.ts`、`backend/src/modules/documents/documents.service.ts`、`backend/src/modules/documents/documents.controller.ts`、`backend/src/modules/documents/documents.spec.ts` | Jestを用いた単体テストがすべて成功することを確認する。 | 最重要2 |
| [M-03-T01 AI対話チャットとGemini API連携機能を実装する](./M-03-T01_AI対話チャットとGemini_API連携機能を実装する.md) | 機能 | DF-03 | M-02-T02 | `backend/.env`、`backend/src/modules/chats/gemini.service.ts`、`backend/src/modules/chats/chats.service.ts`、`backend/src/modules/chats/chats.controller.ts`、`backend/src/modules/chats/chats.service.spec.ts` | Jestを用いた単体テストがすべて成功することを確認する。 / POST /api/v1/projects/{id}/chats エンドポイントへリクエストを送り、期待されるJSONレスポンスが返ることを確認する。 | なし |
| [M-03-T02 構造化サマリの生成と承認フロー機能を実装する](./M-03-T02_構造化サマリの生成と承認フロー機能を実装する.md) | 機能 | — | M-03-T01 | `backend/src/modules/summaries/summaries.service.ts`、`backend/src/modules/summaries/summaries.controller.ts`、`backend/src/modules/summaries/summaries.service.spec.ts` | Jestを使用したsummaries.serviceの単体テストが全て成功することを確認する。 / APIエンドポイントに対してリクエストを送り、期待されるレスポンスが返却されることを確認する。 | 最重要1・中程度2 |
| [M-04-T01 4種設計書の並行生成および版管理機能を実装する](./M-04-T01_4種設計書の並行生成および版管理機能を実装する.md) | 機能 | DF-04 | M-03-T02 | `backend/src/modules/specifications/specifications.service.ts`、`backend/src/modules/specifications/specifications.controller.ts` | バックエンドの単体テストおよび結合テストを実行し、すべてのテストが成功することを確認する。 / PostgreSQLのspecificationsテーブルに想定通りに版管理された設計書データが保存されることを確認する。 | なし |
| [M-04-T02 AI自己診断（3段階評価）機能を実装する](./M-04-T02_AI自己診断（3段階評価）機能を実装する.md) | 機能 | DF-05 | M-04-T01 | `backend/src/modules/diagnostics/diagnostics.service.ts`、`backend/src/modules/diagnostics/diagnostics.controller.ts`、`backend/src/modules/diagnostics/diagnostics.service.spec.ts` | バックエンドの単体テスト（Jest）が正常にすべてパスすることを確認する。 / GET /api/v1/projects/{id}/diagnostics エンドポイントにリクエストを送り、期待されるJSONレスポンスが返ることを確認する。 | 最重要1・中程度1 |
| [M-05-T01 共通エラーレスポンス形式およびLLMレートリミット用例外フィルターを実装する](./M-05-T01_共通エラーレスポンス形式およびLLMレートリミット用例外フィルターを実装する.md) | 基盤 | — | M-04-T02 | `backend/src/common/filters/http-exception.filter.ts`、`backend/src/common/interceptors/logging.interceptor.ts`、`backend/src/common/filters/http-exception.filter.spec.ts`、`backend/src/common/interceptors/logging.interceptor.spec.ts` | backend ディレクトリにて npm test を実行し、新規追加した例外フィルターおよびロギングインターセプターのテストが全て成功することを確認する。 | なし |
| [M-05-T02 フロントエンドの認証・チャット・プレビュー画面を結合する](./M-05-T02_フロントエンドの認証・チャット・プレビュー画面を結合する.md) | 機能 | — | M-05-T01 | `frontend/.env.local`、`frontend/src/components/chat/ChatInterface.tsx`、`frontend/src/components/preview/MarkdownPreview.tsx`、`frontend/src/app/page.tsx` | フロントエンドのビルドがエラーなく成功すること / ブラウザ上で認証からチャット、プレビューまでの導線が意図通りに動作すること | 中程度1 |
| [M-06-T01 過去のチャット履歴・生成文書の閲覧および復元APIを実装する](./M-06-T01_過去のチャット履歴・生成文書の閲覧および復元APIを実装する.md) | 機能 | — | M-05-T02 | `backend/src/modules/specifications/specifications.service.ts`、`backend/src/modules/projects/projects.controller.ts` | Jestを用いた単体テストがすべて成功することを確認する / APIエンドポイントに対してHTTPリクエストを送信し、期待されるJSONレスポンスが返却されることを確認する | 最重要1・中程度1 |
| [M-06-T02 履歴閲覧・比較・復元用のフロントエンド画面を実装する](./M-06-T02_履歴閲覧・比較・復元用のフロントエンド画面を実装する.md) | 機能 | — | M-06-T01 | `frontend/src/components/history/HistoryView.tsx`、`frontend/src/app/history/page.tsx` | frontend上でnpm run buildまたはテストを実行し、コンパイルエラーやテストエラーが発生しないことを確認する。 | 最重要1・中程度1 |

「(未生成)」は、手順書をまだ生成していない単位(人が選んだ単位を、1回に5件まで生成する)。

## 4. 未定義・要決定の一覧(実装可能性チェックの結果)

「直す先」の文書を再生成して設計を直す(手順の無い単位は、詳細設計モードで詰めることも検討する)。文書を再生成すると、この手順書は「古い」になる。手順書の上では決めない。

### 全体(単位によらない)

なし

### 単位ごと

| 重要度 | 出どころ | 単位 | 対象 | 内容 | 直す先 |
|---|---|---|---|---|---|
| 最重要 | AI | M-02-T01 | backend/src/modules/projects/projects.controller.ts | プロジェクト作成・一覧取得APIの具体的なHTTPメソッド、リクエストボディの構造、レスポンス形式のパスや仕様が外部設計書に定義されていないため。 | 外部設計書 |
| 最重要 | AI | M-02-T02 | DF-02 | 許可するMIMEタイプおよび拡張子の具体的なホワイトリストが内部設計書および外部設計書に定義されていない。 | 外部設計書 |
| 最重要 | AI | M-02-T02 | DF-02 | アップロードされたファイルの実際の保存先ストレージ（ローカルファイルシステム、S3等）と保存パスの生成ルールが定義されていない。 | 内部設計書 |
| 最重要 | AI | M-03-T02 | summaries | 構造化サマリを生成する際の詳細なプロンプト仕様やAPIのエンドポイントパス、およびHTTPメソッドが外部設計書または内部設計書に定義されていない。 | 外部設計書 |
| 最重要 | AI | M-04-T02 | DF-05 | SpecificationsService から生成済み設計書データを取得する際の詳細なデータ構造やインターフェースが内部設計書に定義されていない。 | 内部設計書 |
| 最重要 | AI | M-06-T01 | M-06-T01 API仕様 | 過去のチャット履歴・生成文書の閲覧および復元APIの具体的なHTTPメソッド、エンドポイントのパス、リクエストパラメータ、レスポンス形式が外部設計書に定義されていない。 | 外部設計書 |
| 最重要 | AI | M-06-T02 | frontend/src/app/history/page.tsx | 履歴閲覧・比較・復元機能に対応するバックエンドAPIのエンドポイント仕様やリクエスト・レスポンスの型定義が外部設計書に明記されていないため、正確なAPI連携の実装ができない。 | 外部設計書 |
| 中程度 | 検証 | M-02-T01 | M-02-T01 | M-02-T01 は機能の単位ですが、処理(DF)がありません。 | 実装計画書 |
| 中程度 | 検証 | M-03-T02 | M-03-T02 | M-03-T02 は機能の単位ですが、処理(DF)がありません。 | 実装計画書 |
| 中程度 | 検証 | M-05-T02 | M-05-T02 | M-05-T02 は機能の単位ですが、処理(DF)がありません。 | 実装計画書 |
| 中程度 | 検証 | M-06-T01 | M-06-T01 | M-06-T01 は機能の単位ですが、処理(DF)がありません。 | 実装計画書 |
| 中程度 | 検証 | M-06-T02 | M-06-T02 | M-06-T02 は機能の単位ですが、処理(DF)がありません。 | 実装計画書 |
| 中程度 | AI | M-03-T02 | summaries | サマリ承認フローにおけるリクエストパラメータおよびレスポンスのデータ構造が定義されていない。 | 外部設計書 |
| 中程度 | AI | M-04-T02 | DF-05 | Gemini APIへのプロンプト構成や3段階評価（Critical/Moderate/Minor）の具体的な出力スキーマが定義されていない。 | 内部設計書 |

## 5. 完了条件

各単位の完了条件(すべての単位に共通):

- [ ] この単位のテストが全件成功する
- [ ] 既存のテストが壊れていない
- [ ] lint・型チェックが成功する
- [ ] (テーブルを変える単位)マイグレーションの適用が成功する
- [ ] 開発環境で起動し、確認方法の操作ができる
- [ ] この単位の「未定義・要決定」がすべて決まり、設計に反映されている(手順書が「古い」なら再生成している)

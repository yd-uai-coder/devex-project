# M-01-T01 開発環境とDB接続・Prismaの初期設定を行う

> 種別: 基盤 / マイルストーン: M-01 開発基盤と認証機能 / 依存: なし

## 目的

PostgreSQLのコンテナ起動とPrismaの初期接続設定、およびNestJSの基本構成を構築する。

## 対象の処理・参照する設計

- 内部設計書 3.2 データモデル

## 作成・変更するファイル(依存順)

| ファイル | 種類 | 責務 | 根拠 |
|---|---|---|---|
| `docker-compose.yml` | 環境・設定 | PostgreSQLのローカル起動設定を行う | 実装計画書 4.3 開発環境 |
| `backend/.env` | 環境・設定 | データベース接続文字列などの環境変数を定義する | 実装計画書 4.3 開発環境 |
| `backend/prisma/schema.prisma` | モジュール | データモデル(users, projects, documents, chats, summaries, specifications, diagnostics)のスキーマ定義を行う | 内部設計書 3.2 データモデル |
| `backend/src/main.ts` | モジュール | NestJSアプリケーションのエントリーポイントとしてサーバーを起動する | 内部設計書 3.1 技術スタック・アーキテクチャ |
| `backend/src/app.module.ts` | モジュール | アプリケーション全体のルートモジュールを定義する | 内部設計書 3.1 技術スタック・アーキテクチャ |

## 実装の要点(設計に書いていないことだけ)

- Docker Composeを用いてPostgreSQLコンテナを起動した後にPrismaのマイグレーションを実行する。
- Prismaスキーマの定義では、内部設計書に記載されたすべてのエンティティとリレーションを漏れなく記述する。

## テスト観点

| # | 観点 | SUT | ドライバ | スタブ |
|---|---|---|---|---|
| TC-01 | データベースへの接続とPrisma Clientの疎通確認 | Prisma Client | 結合テスト・スクリプト | スタブ不要 ── 実DBへの接続確認のため |

- Given PostgreSQLコンテナが起動しており環境変数が正しく設定されているとき
- When Prisma Clientを通じてデータベースに接続を試みると
- Then エラーなく接続が確立されクエリを実行できる

## 確認方法

- docker-compose up -d でPostgreSQLが正常に起動すること
- npx prisma migrate dev を実行してマイグレーションが成功すること
- npm run start:dev でNestJSサーバーが正常に起動すること

## 未定義・要決定

なし

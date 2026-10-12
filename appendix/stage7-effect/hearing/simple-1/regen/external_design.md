# 2. 外部設計書

## 2.1 システム構成概要

本システムは、Next.js(App Router) + Tamaguiによるフロントエンドと、FastAPI + LangChain・LangGraph(Python 3.13)によるバックエンドで構成されるWebアプリケーションである。データベースにはPostgreSQL、レート制限・トークン失効管理にはRedisを採用し、AIモデルにはGemini Flash-Liteを使用する。インフラはVPS上にDocker Composeとnginxを配置し、GitHub Actionsによる自動デプロイを行う。

```
[ユーザー (Chrome/Edge/Firefox/Safari / スマホ閲覧)]
       |
[nginx (リバースプロキシ)]
       |
[Next.js (App Router) フロントエンド] --(API)--> [FastAPI バックエンド]
                                                    |
                                            [LangGraph / Gemini]
                                                    |
                                            [PostgreSQL / Redis]
```

## 2.2 画面一覧・画面遷移フロー（概要）

| 画面ID | 画面名 | 主要な役割 | 優先度 | 要件 |
|---|---|---|---|---|
| SCR-001 | ログイン・ユーザー登録画面 | ユーザーの新規登録およびログインを行う | Must | FR-001・NFR-008・NFR-010・NFR-011 |
| SCR-002 | チャットヒアリング・初期資料読込画面 | 初期資料のアップロードとAIとのチャット対話を通じて要件をヒアリングする | Must | FR-002・FR-006・FR-008・FR-009・NFR-003・NFR-009・NFR-010 |
| SCR-003 | 設計書プレビュー・診断画面 | 生成された4種のMarkdown設計書のプレビュー、コピー、ダウンロードを行う | Must | FR-003・FR-005・FR-007・FR-008・NFR-003・NFR-007 |

```text
SCR-001 (ログイン/登録成功) -> SCR-002 (チャットヒアリング・初期資料読込) -> (生成実行) -> SCR-003 (設計書プレビュー)
```

## 2.3 主要画面のUI/UX仕様

### SCR-001: ログイン・ユーザー登録画面

- 入力項目: メールアドレス、パスワード
- 操作ボタン: ログインボタン、ユーザー登録ボタン
- アクション: 入力情報を検証し、認証APIを呼び出してJWTを取得する

### SCR-002: チャットヒアリング・初期資料読込画面

- 入力項目: チャットメッセージ入力欄(数千文字まで)、参考資料ファイルアップロード(txt/md/pdf、最大5件)
- 表示項目: チャット履歴一覧、AIからの応答メッセージ、エラー時の理由表示
- 操作ボタン: メッセージ送信ボタン、資料追加ボタン、設計書生成開始ボタン
- アクション: 入力文字数チェックを行い、空送信を禁止した上でバックエンドへメッセージを送信する

### SCR-003: 設計書プレビュー・診断画面

- 表示項目: 「要件定義」「外部設計」「内部設計」「実装計画」の4種のMarkdown設計書プレビュー領域
- 操作ボタン: コピーボタン、ダウンロードボタン、再生成ボタン
- アクション: プレビュー内容をクリップボードにコピーするか、ファイルとしてダウンロードする

## 2.4 外部システム・API連携仕様

| サービス | 用途 | 認証 | タイミング | 要件 |
|---|---|---|---|---|
| Gemini Flash-Lite API | チャットヒアリングおよび4種設計書の自動生成 | API Key | リアルタイムおよび非同期生成時 | FR-002・FR-003・CON-004 |

## 2.5 データ入出力仕様

初期入力として参考資料(txt/md/pdf、最大5件)を受け付ける。出力として「要件定義」「外部設計」「内部設計」「実装計画」の4種のMarkdownファイルを提供する。

## 2.6 API一覧

| メソッド | パス | 概要 | 関連画面 | 要件 | 本文 | 応答 | エラー |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/auth/register | ユーザー登録 | SCR-001 | FR-001・NFR-010 | email, password | 201 ユーザー登録成功 | 400 入力値不正、409 登録済み |
| POST | /api/v1/auth/login | ログイン | SCR-001 | FR-001・NFR-008・NFR-010 | email, password | 200 ログイン成功(HttpOnly Cookie設定) | 401 認証失敗、429 レート制限超過 |
| POST | /api/v1/projects | プロジェクト作成・初期資料読込 | SCR-002 | FR-006・FR-007 | files | 201 プロジェクト作成成功 | 400 ファイル形式不正または上限超過 |
| POST | /api/v1/projects/{id}/chat | チャットメッセージ送信・AI応答取得 | SCR-002 | FR-002・FR-008・FR-009・NFR-010 | message | 200 AI応答メッセージ | 400 空メッセージまたは文字数超過、502 AI応答失敗 |
| POST | /api/v1/projects/{id}/generate | 4種設計書の一括生成 | SCR-003 | FR-003・FR-007・FR-008・NFR-010 | — | 201 設計書生成成功 | 502 生成失敗 |
| GET | /api/v1/projects/{id}/documents | 生成済み設計書の取得 | SCR-003 | FR-005・NFR-007 | — | 200 設計書一覧データ | 404 対象なし、403 アクセス権限なし |

## 付録 要件との対応(Must の機能要件)

| 要件 | 画面 | API |
|---|---|---|
| FR-001 | SCR-001 | POST /api/v1/auth/register・POST /api/v1/auth/login |
| FR-002 | SCR-002 | POST /api/v1/projects/{id}/chat |
| FR-003 | SCR-003 | POST /api/v1/projects/{id}/generate |
| FR-005 | SCR-003 | GET /api/v1/projects/{id}/documents |
| FR-006 | SCR-002 | POST /api/v1/projects |
| FR-007 | SCR-003 | POST /api/v1/projects・POST /api/v1/projects/{id}/generate |
| FR-008 | SCR-002・SCR-003 | POST /api/v1/projects/{id}/chat・POST /api/v1/projects/{id}/generate |
| FR-009 | SCR-002 | POST /api/v1/projects/{id}/chat |

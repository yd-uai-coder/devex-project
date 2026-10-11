# 2. 外部設計書

## 2.1 システム構成概要

```
[利用者ブラウザ (PC / Mobile)]
       │ (HTTPS)
       ▼
[nginx (Reverse Proxy)]
       │
       ├─► [Next.js (Frontend / App Router)]
       │         (Docker Compose)
       ▼
[FastAPI (Backend / LangChain)] ──► [PostgreSQL (Data Store)]
       │                                        │
       └────────────────────────────────► [Redis (Rate Limit / Token)]
```

## 2.2 画面一覧・画面遷移フロー（概要）

| 画面ID | 画面名 | 主要な役割 | 優先度 | 要件 |
|---|---|---|---|---|
| SCR-001 | ログイン・ユーザー登録画面 | メールアドレスとパスワードによる認証・アカウント作成を行う。 | Must | FR-009・NFR-005 |
| SCR-002 | プロジェクト一覧・新規作成画面 | 既存のプロジェクト一覧表示および新規プロジェクトの作成・参考資料のアップロードを行う。 | Must | FR-005・FR-006・FR-009 |
| SCR-003 | チャットヒアリング画面 | AIと対話形式で要件のヒアリングを行う。 | Must | FR-001・FR-007・FR-008 |
| SCR-004 | 設計書プレビュー・診断画面 | 生成された4種のMarkdown設計書のプレビュー、自己診断結果の確認、コピー・ダウンロードを行う。 | Must | FR-002・FR-003・FR-004 |

```text
SCR-001 (ログイン) ──► SCR-002 (プロジェクト一覧) ──► SCR-003 (チャットヒアリング) ──► SCR-004 (設計書プレビュー・診断)
```

## 2.3 主要画面のUI/UX仕様

### SCR-001: ログイン・ユーザー登録画面

- 入力項目: メールアドレス、パスワード
- 操作ボタン: ログインボタン、新規登録ボタン
- アクション: JWT取得およびHttpOnly Cookieへのリフレッシュトークン設定、プロジェクト一覧画面への遷移

### SCR-002: プロジェクト一覧・新規作成画面

- 表示項目: プロジェクト一覧
- 入力項目: プロジェクト名、参考資料ファイル選択(txt/md/pdf、最大3件)
- 操作ボタン: 新規プロジェクト作成ボタン、プロジェクト選択ボタン
- アクション: 選択したプロジェクトのチャットヒアリング画面へ遷移

### SCR-003: チャットヒアリング画面

- 表示項目: チャット履歴一覧、AIの応答メッセージ
- 入力項目: メッセージ入力欄(数千文字まで)
- 操作ボタン: 送信ボタン、設計書生成トリガーボタン
- アクション: メッセージ送信、AI応答失敗時の再送促し表示、設計書生成画面への遷移

### SCR-004: 設計書プレビュー・診断画面

- 表示項目: 4種のMarkdown設計書プレビュー、AIの自己診断結果(3段階: 最重要/中程度/軽微)
- 操作ボタン: コピーボタン、ダウンロードボタン
- アクション: クリップボードへのコピー、Markdownファイルのダウンロード

## 2.4 外部システム・API連携仕様

(なし)

## 2.5 データ入出力仕様

- 受付フォーマット: 参考資料として txt, md, pdf 形式に対応（最大3件）。
- ファイル入出力: 生成された4種のMarkdown設計書のダウンロード出力。

## 2.6 API一覧

| メソッド | パス | 概要 | 関連画面 | 要件 | 本文 | 応答 | エラー |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/auth/register | ユーザー新規登録 | SCR-001 | FR-009 | email, password | 201 登録成功 | 400 入力値不正, 409 メールアドレス重複 |
| POST | /api/v1/auth/login | ログイン | SCR-001 | FR-009・NFR-005 | email, password | 200 ログイン成功 (JWT返却) | 401 認証失敗 |
| POST | /api/v1/auth/refresh | トークンリフレッシュ | — | NFR-005 | — | 200 アクセストークン更新 | 401 リフレッシュトークン無効 |
| GET | /api/v1/projects | プロジェクト一覧取得 | SCR-002 | FR-005・FR-009 | — | 200 プロジェクト一覧 | 401 認証エラー |
| POST | /api/v1/projects | プロジェクト作成 | SCR-002 | FR-005・FR-006・FR-009 | project_name, reference_files | 201 プロジェクト作成成功 | 400 バリデーションエラー, 401 認証エラー |
| GET | /api/v1/projects/{id}/chats | チャット履歴取得 | SCR-003 | FR-001・FR-005 | — | 200 チャット履歴一覧 | 401 認証エラー, 404 対象なし |
| POST | /api/v1/projects/{id}/chats | チャットメッセージ送信・AI応答取得 | SCR-003 | FR-001・FR-005・FR-007・FR-008 | message | 200 AI応答メッセージ | 400 メッセージ空・文字数超過, 502 AI応答失敗 |
| POST | /api/v1/projects/{id}/generate | 設計書一括生成およびAI自己診断実行 | SCR-004 | FR-002・FR-003・FR-005 | — | 201 設計書生成および診断結果取得 | 502 生成失敗 |
| GET | /api/v1/projects/{id}/documents | 生成済み設計書・診断結果取得 | SCR-004 | FR-002・FR-003・FR-004・FR-005 | — | 200 設計書および診断結果 | 404 対象なし |

## 付録 要件との対応(Must の機能要件)

| 要件 | 画面 | API |
|---|---|---|
| FR-001 | SCR-003 | GET /api/v1/projects/{id}/chats・POST /api/v1/projects/{id}/chats |
| FR-002 | SCR-004 | POST /api/v1/projects/{id}/generate・GET /api/v1/projects/{id}/documents |
| FR-003 | SCR-004 | POST /api/v1/projects/{id}/generate・GET /api/v1/projects/{id}/documents |
| FR-004 | SCR-004 | GET /api/v1/projects/{id}/documents |
| FR-005 | SCR-002 | GET /api/v1/projects・POST /api/v1/projects・GET /api/v1/projects/{id}/chats・POST /api/v1/projects/{id}/chats・POST /api/v1/projects/{id}/generate・GET /api/v1/projects/{id}/documents |
| FR-006 | SCR-002 | POST /api/v1/projects |
| FR-007 | SCR-003 | POST /api/v1/projects/{id}/chats |
| FR-008 | SCR-003 | POST /api/v1/projects/{id}/chats |
| FR-009 | SCR-001・SCR-002 | POST /api/v1/auth/register・POST /api/v1/auth/login・GET /api/v1/projects・POST /api/v1/projects |

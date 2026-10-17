# 2. 外部設計書

## 2.1 システム構成概要

システム構成概要

```
+-----------------------+      HTTPS       +---------------------------------------------+
| フロントエンド         | <-------------> | 逆プロキシ (nginx)                          +
| Next.js (App Router)  |                 +---------------------------------------------+
| Tamagui               |                 | バックエンド (FastAPI / Python 3.13)         +
+-----------------------+                 | LangChain・LangGraph / Gemini Flash-Lite   +
                                          +---------------------------------------------+
                                            |                     |               |
                                            v                     v               v
                                     +-------------+      +--------------+  +-------+
                                     | PostgreSQL  |      | Redis        |  | Docker|
                                     +-------------+      +--------------+  +-------+
```

## 2.2 画面一覧・画面遷移フロー（概要）

| 画面ID | 画面名 | 主要な役割 | 優先度 | 要件 |
|---|---|---|---|---|
| SCR-001 | ログイン・ユーザー登録画面 | ユーザーの認証、新規アカウント登録、およびパスワード再設定を行う。 | Must | FR-001・FR-002・FR-011・FR-012 |
| SCR-002 | プロジェクト・チャットヒアリング画面 | プロジェクトの選択・作成、参考資料のアップロード、およびAIとのチャット対話(SSEストリーミング)によるヒアリングを行う。 | Must | FR-003・FR-004・FR-008・FR-009・FR-010・FR-011 |
| SCR-003 | 設計書生成・プレビュー画面 | 非同期の設計書一括生成の進捗確認、4種のMarkdown設計書のプレビュー確認、AI自己診断結果の確認、およびコピー・ダウンロードを行う。 | Must | FR-003・FR-005・FR-006・FR-007・FR-009・FR-010 |

```text
SCR-001 (ログイン・ユーザー登録画面) -> SCR-002 (プロジェクト・チャットヒアリング画面) <-> SCR-003 (設計書生成・プレビュー画面)
```

## 2.3 主要画面のUI/UX仕様

### SCR-001: ログイン・ユーザー登録画面

- 入力項目: メールアドレス、パスワード（8文字以上・英数字含む）
- 操作ボタン: ログインボタン、ユーザー登録ボタン、パスワード再設定ボタン
- アクション: 入力情報を基に認証APIを呼び出し、アクセストークンを取得してメイン画面へ遷移する。メール確認およびSameSite CookieによるCSRF対策を適用する。

### SCR-002: プロジェクト・チャットヒアリング画面

- 入力項目: チャットメッセージ入力欄、参考資料ファイル選択（txt, md, pdf形式、最大3件）、プロジェクト新規作成時名称
- 表示項目: プロジェクト一覧、選択中プロジェクトのチャット履歴一覧（SSEによる逐次表示対応）、参考資料アップロード状況
- 操作ボタン: プロジェクト作成ボタン、メッセージ送信ボタン、資料添付ボタン、設計書生成開始ボタン
- アクション: メッセージ送信時にチャットAPIを呼び出し、SSEでAIの応答を逐次表示する。エラー時は理由を表示しメッセージを保存せず再送を促す。

### SCR-003: 設計書生成・プレビュー画面

- 表示項目: 生成ジョブの進捗状況、要件定義・外部設計・内部設計・実装計画の4種Markdownプレビュー、AIによる不足点の3段階自己診断結果（最重要・中程度・軽微）
- 操作ボタン: 設計書一括生成ボタン、再生成ボタン（既存文書置き換え）、Markdownコピーボタン、ファイルダウンロードボタン
- アクション: 生成・再生成ジョブAPIを呼び出し、完了までの進捗をポーリング等で確認して結果を画面にレンダリングする。

## 2.4 外部システム・API連携仕様

(なし)

## 2.5 データ入出力仕様

- 受付フォーマット: 参考資料として txt, md, pdf 形式のファイル（最大3件）
- 出力フォーマット: 要件定義・外部設計・内部設計・実装計画の4種の Markdown ドキュメント
- バリデーション: パスワードは8文字以上かつ英数字を含むこと。ファイル形式およびアップロード数の制限チェック。

## 2.6 API一覧

| メソッド | パス | 概要 | 関連画面 | 要件 | 本文 | 応答 | エラー |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/auth/register | ユーザー登録 | SCR-001 | FR-001・FR-011・FR-012 | email, password | 201 Created | 400 バリデーションエラー, 409 重複登録エラー, 429 レート制限超過(Retry-After) |
| POST | /api/v1/auth/login | ログイン | SCR-001 | FR-001・FR-002・FR-011・FR-012 | email, password | 200 OK (Access Token返却、HttpOnly CookieにRefresh Token設定、SameSite Cookie対応) | 401 認証失敗, 429 レート制限超過(Retry-After) |
| POST | /api/v1/auth/refresh | トークンリフレッシュ | — | FR-002 | — | 200 OK (新規Access Token返却) | 401 無効なリフレッシュトークン |
| POST | /api/v1/auth/logout | ログアウト(リフレッシュトークン失効) | SCR-001 / SCR-002 / SCR-003 | FR-002・FR-012 | — | 200 OK (トークン無効化完了) | 401 認証エラー |
| GET | /api/v1/projects | プロジェクト一覧取得 | SCR-002 | FR-003・FR-009 | — | 200 OK (プロジェクト一覧) | 401 認証エラー, 403 アクセス権限なし |
| POST | /api/v1/projects | プロジェクト作成 | SCR-002 | FR-003・FR-009 | name, files | 201 Created (作成されたプロジェクト情報) | 400 バリデーションエラー, 401 認証エラー |
| GET | /api/v1/projects/{id}/messages | チャット履歴取得 | SCR-002 | FR-003・FR-004・FR-009 | — | 200 OK (チャットメッセージ一覧) | 401 認証エラー, 403 アクセス権限なし, 404 対象プロジェクトなし |
| POST | /api/v1/projects/{id}/chat | チャットメッセージ送信(SSEストリーミング応答) | SCR-002 | FR-003・FR-004・FR-010・FR-011 | message | 200 OK (SSEストリーミングによるAI応答) | 400 不正リクエスト, 401 認証エラー, 403 アクセス権限なし, 404 対象プロジェクトなし, 429 レート制限超過, 500 AI応答失敗(メッセージ未保存) |
| POST | /api/v1/projects/{id}/generate | 設計書一括生成およびAI自己診断の非同期ジョブ開始 | SCR-003 | FR-003・FR-005・FR-006・FR-010・FR-011 | — | 202 Accepted (生成ジョブID) | 401 認証エラー, 403 アクセス権限なし, 404 対象プロジェクトなし, 429 レート制限超過, 500 生成開始失敗 |
| GET | /api/v1/projects/{id}/generate/status | 設計書生成ジョブの進捗確認 | SCR-003 | FR-003・FR-005・FR-006 | — | 200 OK (ジョブステータスおよび完了時は生成文書・診断結果) | 401 認証エラー, 403 アクセス権限なし, 404 対象プロジェクトなし |
| GET | /api/v1/projects/{id}/documents | 生成文書および自己診断結果の取得 | SCR-003 | FR-003・FR-005・FR-006・FR-009 | — | 200 OK (文書一覧および診断結果) | 401 認証エラー, 403 アクセス権限なし, 404 対象プロジェクトなし |

## 付録 要件との対応(Must の機能要件)

| 要件 | 画面 | API |
|---|---|---|
| FR-001 | SCR-001 | POST /api/v1/auth/register・POST /api/v1/auth/login |
| FR-002 | SCR-001 | POST /api/v1/auth/login・POST /api/v1/auth/refresh・POST /api/v1/auth/logout |
| FR-003 | SCR-002・SCR-003 | GET /api/v1/projects・POST /api/v1/projects・GET /api/v1/projects/{id}/messages・POST /api/v1/projects/{id}/chat・POST /api/v1/projects/{id}/generate・GET /api/v1/projects/{id}/generate/status・GET /api/v1/projects/{id}/documents |
| FR-012 | SCR-001 | POST /api/v1/auth/register・POST /api/v1/auth/login・POST /api/v1/auth/logout |
| FR-004 | SCR-002 | GET /api/v1/projects/{id}/messages・POST /api/v1/projects/{id}/chat |
| FR-005 | SCR-003 | POST /api/v1/projects/{id}/generate・GET /api/v1/projects/{id}/generate/status・GET /api/v1/projects/{id}/documents |
| FR-006 | SCR-003 | POST /api/v1/projects/{id}/generate・GET /api/v1/projects/{id}/generate/status・GET /api/v1/projects/{id}/documents |
| FR-007 | SCR-003 | — |
| FR-008 | SCR-002 | — |
| FR-009 | SCR-002・SCR-003 | GET /api/v1/projects・POST /api/v1/projects・GET /api/v1/projects/{id}/messages・GET /api/v1/projects/{id}/documents |
| FR-010 | SCR-002・SCR-003 | POST /api/v1/projects/{id}/chat・POST /api/v1/projects/{id}/generate |
| FR-011 | SCR-001・SCR-002 | POST /api/v1/auth/register・POST /api/v1/auth/login・POST /api/v1/projects/{id}/chat・POST /api/v1/projects/{id}/generate |

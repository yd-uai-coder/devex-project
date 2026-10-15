# 2. 外部設計書

## 2.1 システム構成概要

本システムは、Next.js(App Router)およびTamaguiを用いたフロントエンドと、FastAPIとLangChain・LangGraphによるバックエンド、PostgreSQLおよびRedisによるデータ永続化・キャッシュ層で構成されるWebアプリケーションである。AIモデルとしてGemini Flash-Liteを使用し、VPS上のDocker Composeとnginx環境にて稼働する。

```
[ユーザー(PC/スマホ)]
       │
       ▼ (HTTPS)
[nginx (Reverse Proxy)]
       │
       ├─► [Next.jsフロントエンド (SSR/CSR)]
       │       │
       │       ▼ (REST API / JWT Auth)
       └─► [FastAPIバックエンド]
               │
               ├─► [PostgreSQL (データ永続化)]
               ├─► [Redis (レート制限 / トークン管理)]
               └─► [Gemini Flash-Lite API (AI推論)]
```

## 2.2 画面一覧・画面遷移フロー（概要）

| 画面ID | 画面名 | 主要な役割 | 優先度 | 要件 |
|---|---|---|---|---|
| SCR-001 | ログイン・ユーザー登録画面 | ユーザーの認証および新規アカウント登録を行う。 | Must | FR-001・FR-002・FR-011 |
| SCR-002 | プロジェクト・チャットヒアリング画面 | 参考資料のアップロードおよびAIとのチャット対話を通じてヒアリングを行う。 | Must | FR-003・FR-004・FR-008・FR-010・FR-011 |
| SCR-003 | 設計書生成・プレビュー画面 | 4種のMarkdown設計書のプレビュー確認、AI自己診断結果の確認、およびコピー・ダウンロードを行う。 | Must | FR-003・FR-005・FR-006・FR-007・FR-010 |

```text
SCR-001 (ログイン・ユーザー登録) ──(認証成功)──► SCR-002 (プロジェクト・チャットヒアリング) ──(生成実行)──► SCR-003 (設計書生成・プレビュー)
```

## 2.3 主要画面のUI/UX仕様

### SCR-001: ログイン・ユーザー登録画面

- 入力項目: メールアドレス、パスワード
- 操作ボタン: ログインボタン、ユーザー登録ボタン
- アクション: 入力情報を基に認証APIを呼び出し、アクセストークンを取得してメイン画面へ遷移する。

### SCR-002: プロジェクト・チャットヒアリング画面

- 入力項目: チャットメッセージ入力欄、参考資料ファイル選択（txt, md, pdf形式、最大3件）
- 表示項目: チャット履歴一覧、参考資料アップロード状況
- 操作ボタン: メッセージ送信ボタン、資料添付ボタン、設計書生成開始ボタン
- アクション: メッセージ送信時にチャットAPIを呼び出し、AIの応答を表示する。エラー時は理由を表示し再送を促す。

### SCR-003: 設計書生成・プレビュー画面

- 表示項目: 要件定義・外部設計・内部設計・実装計画の4種Markdownプレビュー、AIによる不足点の3段階自己診断結果（最重要・中程度・軽微）
- 操作ボタン: 設計書一括生成ボタン、再生成ボタン、Markdownコピーボタン、ファイルダウンロードボタン
- アクション: 生成・再生成APIを呼び出し、結果を画面にレンダリングする。

## 2.4 外部システム・API連携仕様

| サービス | 用途 | 認証 | タイミング | 要件 |
|---|---|---|---|---|
| Gemini Flash-Lite API | 対話型チャットの応答生成、4種設計書の自動一括生成、および不足点の3段階自己診断 | API Key | リアルタイム（ユーザーのリクエスト時） | FR-004・FR-005・FR-006・CON-004 |

## 2.5 データ入出力仕様

- 受付フォーマット: txt, md, pdf形式の参考資料ファイル（最大3件まで初期入力・アップロード可能）
- 出力フォーマット: Markdown形式の設計書ファイル（ダウンロード用）
- バリデーション: アップロードファイルの拡張子およびサイズ検証、APIリクエスト時のパラメータバリデーション、総当たり攻撃・大量作成を防ぐためのレート制限（Redis管理）

## 2.6 API一覧

| メソッド | パス | 概要 | 関連画面 | 要件 | 本文 | 応答 | エラー |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/auth/register | ユーザー登録 | SCR-001 | FR-001・FR-011 | email, password | 201 Created | 400 バリデーションエラー, 409 重複登録エラー |
| POST | /api/v1/auth/login | ログイン | SCR-001 | FR-001・FR-002・FR-011 | email, password | 200 OK (Access Token返却、HttpOnly CookieにRefresh Token設定) | 401 認証失敗 |
| POST | /api/v1/auth/refresh | トークンリフレッシュ | — | FR-002 | — | 200 OK (新規Access Token返却) | 401 無効なリフレッシュトークン |
| POST | /api/v1/projects/{id}/chat | チャットメッセージ送信 | SCR-002 | FR-004・FR-010・FR-011 | message, files | 200 OK (AI応答メッセージ) | 400 不正リクエスト, 429 レート制限超過, 500 AI応答失敗 |
| POST | /api/v1/projects/{id}/generate | 設計書一括生成およびAI自己診断実行 | SCR-003 | FR-005・FR-006・FR-010・FR-011 | — | 201 Created (生成された4種の設計書および自己診断結果) | 429 レート制限超過, 500 生成失敗 |
| GET | /api/v1/projects/{id}/documents | 生成文書および自己診断結果の取得 | SCR-003 | FR-003・FR-005・FR-006・FR-009 | — | 200 OK (文書一覧および診断結果) | 403 アクセス権限なし, 404 対象プロジェクトなし |

## 付録 要件との対応(Must の機能要件)

| 要件 | 画面 | API |
|---|---|---|
| FR-001 | SCR-001 | POST /api/v1/auth/register・POST /api/v1/auth/login |
| FR-002 | SCR-001 | POST /api/v1/auth/login・POST /api/v1/auth/refresh |
| FR-003 | SCR-002・SCR-003 | GET /api/v1/projects/{id}/documents |
| FR-004 | SCR-002 | POST /api/v1/projects/{id}/chat |
| FR-005 | SCR-003 | POST /api/v1/projects/{id}/generate・GET /api/v1/projects/{id}/documents |
| FR-006 | SCR-003 | POST /api/v1/projects/{id}/generate・GET /api/v1/projects/{id}/documents |
| FR-007 | SCR-003 | — |
| FR-008 | SCR-002 | — |
| FR-009 | — | GET /api/v1/projects/{id}/documents |
| FR-010 | SCR-002・SCR-003 | POST /api/v1/projects/{id}/chat・POST /api/v1/projects/{id}/generate |
| FR-011 | SCR-001・SCR-002 | POST /api/v1/auth/register・POST /api/v1/auth/login・POST /api/v1/projects/{id}/chat・POST /api/v1/projects/{id}/generate |

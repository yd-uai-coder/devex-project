# 2. 外部設計書

## 2.1 システム構成概要

本システムは、Next.js(App Router)とTamaguiを用いたフロントエンドと、FastAPI・LangChain/LangGraph(Python 3.13)を用いたバックエンドにより構成される。データベースにはPostgreSQL、レート制限・トークン失効管理にはRedisを使用する。VPS上のDocker Composeとnginx環境にデプロイされ、LLMにはGemini Flash-Liteを利用する。

## 2.2 画面一覧・画面遷移フロー（概要）

| 画面ID | 画面名 | 主要な役割 | 優先度 | 要件 |
|---|---|---|---|---|
| SCR-005 | ユーザー登録画面 | 新規ユーザーがメールアドレスとパスワードを入力してアカウントを作成する。 | Must | FR-001・CON-006 |
| SCR-001 | ログイン画面 | メールアドレスとパスワードを入力してシステムにログインする。 | Must | FR-001 |
| SCR-002 | チャットヒアリング画面 | AIと対話しながら要件をヒアリングし、参考資料をアップロードしてセッションを進める。 | Must | FR-002・FR-005・FR-007・FR-008 |
| SCR-003 | 設計書プレビュー・自己診断画面 | 生成された4種の設計書とAIによる自己診断結果を確認し、コピーやダウンロードを行う。 | Must | FR-003・FR-004 |
| SCR-004 | 履歴・データ管理画面 | PostgreSQLに保存されたユーザー自身のチャットセッション一覧、メッセージ履歴、生成文書の一覧および個別詳細を閲覧する。 | Must | FR-001・FR-006 |

```text
SCR-005 (ユーザー登録) -> SCR-001 (ログイン) -> SCR-002 (チャットヒアリング) <-> SCR-004 (履歴・データ管理)
SCR-002 -> SCR-003 (設計書プレビュー・自己診断)
```

## 2.3 主要画面のUI/UX仕様

### SCR-005: ユーザー登録画面

- 入力項目: メールアドレス、パスワード
- 操作ボタン: 登録ボタン
- アクション: 登録成功後にログイン画面またはチャット画面へ遷移する

### SCR-001: ログイン画面

- 入力項目: メールアドレス、パスワード
- 操作ボタン: ログインボタン
- アクション: 認証成功後にチャット画面へ遷移する

### SCR-002: チャットヒアリング画面

- 入力項目: チャット入力欄(数千文字まで、空送信不可)、参考資料ファイルアップロード(txt/md/pdf、最大3件)
- 表示項目: チャット履歴、AIの応答メッセージ、保存済みセッション一覧
- 操作ボタン: 送信ボタン、設計書一括生成ボタン、新規セッション作成ボタン
- アクション: エラー発生時は理由表示と再送・再生成を促す

### SCR-003: 設計書プレビュー・自己診断画面

- 表示項目: 4種の設計書プレビュー(Markdown)、AIの自己診断結果(3段階: 最重要/中程度/軽微)、非同期生成の進捗状態
- 操作ボタン: コピーボタン、ダウンロードボタン、再生成ボタン
- アクション: クリップボードへのコピーやMarkdownファイルのダウンロード、再生成を実行する

### SCR-004: 履歴・データ管理画面

- 表示項目: 保存されたチャットセッション・履歴一覧、チャット詳細メッセージ、生成文書一覧および文書詳細
- 操作ボタン: 詳細表示ボタン、文書個別参照ボタン
- アクション: 選択したセッションの履歴や文書の詳細を表示する

## 2.4 外部システム・API連携仕様

| サービス | 用途 | 認証 | タイミング | 要件 |
|---|---|---|---|---|
| Gemini Flash-Lite API | チャットヒアリングの対話応答および4種の設計書生成・自己診断の実行 | APIキー認証 | ユーザーからのメッセージ送信時および設計書生成リクエスト時 | FR-002・FR-003・CON-004 |

## 2.5 データ入出力仕様

- 受付フォーマット: JSON (APIリクエスト/レスポンス)、マルチパートフォームデータ (ファイルアップロード時)
- ファイル入出力: 参考資料として txt / md / pdf 形式に対応（最大3件、各サイズ上限あり）
- バリデーション: 入力文字数制限（数千文字以内）、空送信の禁止、ファイル形式・件数・サイズ検証、Bearerトークンによる認証および所有者検証、Redisによるレート制限(429 Too Many Requests)

## 2.6 API一覧

| メソッド | パス | 概要 | 関連画面 | 要件 | 本文 | 応答 | エラー |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/auth/register | ユーザー新規登録（サインアップ） | SCR-005 | FR-001・CON-006・NFR-008 | email, password | 201 登録成功とトークン返却 | 400 入力不備, 409 重複登録, 429 レート制限超過 |
| POST | /api/v1/auth/login | ログイン認証 | SCR-001 | FR-001・NFR-008 | email, password | 200 認証成功とトークン返却 | 401 認証失敗, 429 レート制限超過 |
| POST | /api/v1/chat/sessions | チャットセッション作成 | SCR-002 | FR-001・FR-002 | title, initial_files | 201 セッション作成成功 | 401 未認証, 403 権限エラー |
| GET | /api/v1/chat/sessions | チャットセッション一覧取得 | SCR-002 / SCR-004 | FR-001・FR-006 | — | 200 セッション一覧データ返却 | 401 未認証 |
| GET | /api/v1/chat/sessions/{id}/messages | チャットメッセージ履歴取得 | SCR-002 / SCR-004 | FR-001・FR-006 | — | 200 メッセージ履歴一覧データ返却 | 401 未認証, 403 権限エラー, 404 対象なし |
| POST | /api/v1/chat/messages | チャットメッセージ送信 | SCR-002 | FR-001・FR-002・FR-005・FR-007・FR-008・NFR-008 | session_id, message, files | 200 AI応答メッセージ返却 | 400 入力不備・空送信, 401 未認証, 403 権限エラー, 404 対象なし, 429 レート制限超過, 500 AI応答失敗 |
| POST | /api/v1/documents/generate | 設計書一括生成と自己診断実行 | SCR-002 / SCR-003 | FR-001・FR-002・FR-003・FR-007・NFR-008 | chat_session_id | 201 生成完了と設計書データ | 401 未認証, 403 権限エラー, 404 対象なし, 429 レート制限超過, 500 生成失敗 |
| GET | /api/v1/documents | 保存済み設計書・履歴一覧取得 | SCR-004 | FR-001・FR-006 | — | 200 一覧データ返却 | 401 未認証, 403 権限エラー |
| GET | /api/v1/documents/{id} | 保存済み設計書個別詳細取得 | SCR-004 | FR-001・FR-006 | — | 200 文書詳細データ返却 | 401 未認証, 403 権限エラー, 404 対象なし |

## 付録 要件との対応(Must の機能要件)

| 要件 | 画面 | API |
|---|---|---|
| FR-001 | SCR-005・SCR-001・SCR-004 | POST /api/v1/auth/register・POST /api/v1/auth/login・POST /api/v1/chat/sessions・GET /api/v1/chat/sessions・GET /api/v1/chat/sessions/{id}/messages・POST /api/v1/chat/messages・POST /api/v1/documents/generate・GET /api/v1/documents・GET /api/v1/documents/{id} |
| FR-002 | SCR-002 | POST /api/v1/chat/sessions・POST /api/v1/chat/messages・POST /api/v1/documents/generate |
| FR-003 | SCR-003 | POST /api/v1/documents/generate |
| FR-004 | SCR-003 | — |
| FR-005 | SCR-002 | POST /api/v1/chat/messages |
| FR-006 | SCR-004 | GET /api/v1/chat/sessions・GET /api/v1/chat/sessions/{id}/messages・GET /api/v1/documents・GET /api/v1/documents/{id} |
| FR-007 | SCR-002 | POST /api/v1/chat/messages・POST /api/v1/documents/generate |
| FR-008 | SCR-002 | POST /api/v1/chat/messages |

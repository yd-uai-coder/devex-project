# 2. 外部設計書

## 2.1 システム構成概要

本システムは、Next.js (App Router)によるフロントエンドと、FastAPI・LangChain/LangGraphによるバックエンド、PostgreSQLおよびRedisによるデータストアで構成される。クライアントからのリクエストはnginxを介して各コンテナにルーティングされ、外部のGemini Flash-Lite APIと連携して対話および設計書の自動生成を行う。

```
[ブラウザ: Chrome/Edge/Firefox/Safari]
       |
       v
[nginx (Reverse Proxy)]
       |
       +---> [Next.js (App Router)] (Frontend)
       |
       +---> [FastAPI (Python 3.13)] (Backend)
                    |
            +-------+-------+
            |               |
            v               v
    [PostgreSQL]        [Redis]
            |
            v
    [Gemini Flash-Lite API]
```

## 2.2 画面一覧・画面遷移フロー（概要）

| 画面ID | 画面名 | 主要な役割 | 優先度 | 要件 |
|---|---|---|---|---|
| SCR-001 | アカウント登録画面 | 新規ユーザーがアカウントを作成するための画面 | Must | FR-001 |
| SCR-002 | ログイン画面 | 既存ユーザーが認証を行ってシステムにアクセスするための画面 | Must | FR-002 |
| SCR-003 | AI対話・ヒアリング画面 | AIと対話しながらヒアリングを進め、参考資料をアップロードする画面 | Must | FR-003・FR-006・FR-008・FR-010 |
| SCR-004 | 設計書生成・プレビュー画面 | 生成された4種のMarkdown設計書を確認し、不足点の自己診断結果を確認・操作する画面 | Must | FR-003・FR-004・FR-005・FR-009 |

```text
SCR-001 (アカウント登録) <---> SCR-002 (ログイン)
SCR-002 (ログイン) ---> SCR-003 (AI対話・ヒアリング)
SCR-003 (AI対話・ヒアリング) ---> SCR-004 (設計書生成・プレビュー)
SCR-004 (設計書生成・プレビュー) ---> SCR-003 (AI対話・ヒアリング / 再対話)
```

## 2.3 主要画面のUI/UX仕様

### SCR-001: アカウント登録画面

- 入力項目: メールアドレス、パスワード
- 操作ボタン: 登録ボタン
- アクション: 入力情報を基にアカウント登録APIを呼び出し、成功時はログイン画面へ遷移する

### SCR-002: ログイン画面

- 入力項目: メールアドレス、パスワード
- 操作ボタン: ログインボタン
- アクション: 認証APIを呼び出し、JWTを取得してメインの対話画面へ遷移する

### SCR-003: AI対話・ヒアリング画面

- 入力項目: チャットメッセージ入力欄（数千文字の文字数制限あり・空送信防止）、参考資料アップロード（txt/md/pdf、最大3件）
- 表示項目: チャット履歴一覧、AIからの応答メッセージ、エラー理由表示（エラー時）
- 操作ボタン: メッセージ送信ボタン、ファイル添付ボタン、設計書生成開始ボタン、再送ボタン
- アクション: メッセージ送信時にバリデーションチェックを行いAPIを呼び出す。AI応答失敗時は再送を促すUIを表示する

### SCR-004: 設計書生成・プレビュー画面

- 表示項目: 「要件定義」「外部設計」「内部設計」「実装計画」の4種のMarkdownプレビュー、各文書の不足点3段階自己診断結果（最重要/中程度/軽微）
- 操作ボタン: コピーボタン、ダウンロードボタン、再生成ボタン
- アクション: 選択したタブのMarkdownをプレビュー表示する。再生成ボタン押下により設計書を再生成するAPIを呼び出す

## 2.4 外部システム・API連携仕様

| サービス | 用途 | 認証 | タイミング | 要件 |
|---|---|---|---|---|
| Gemini Flash-Lite API | LLMを利用した対話ヒアリングおよび設計書自動生成、不足点の自己診断 | API Key | チャット送信時および設計書生成・自己診断実行時 | FR-003・FR-004・CON-004 |

## 2.5 データ入出力仕様

- 受付フォーマット: 参考資料として txt, md, pdf 形式（最大3件）を受け付ける。
- バリデーション: チャット入力時は数千文字の文字制限と空送信防止のチェックを行う。ファイルアップロード時は拡張子と件数の制限を検証する。

## 2.6 API一覧

| メソッド | パス | 概要 | 関連画面 | 要件 | 本文 | 応答 | エラー |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/auth/register | アカウント登録 | SCR-001 | FR-001 | email, password | 201 Created | 400 Bad Request, 409 Conflict |
| POST | /api/v1/auth/login | ログイン | SCR-002 | FR-002 | email, password | 200 OK (HttpOnly Cookieにリフレッシュトークン設定、アクセストークン返却) | 400 Bad Request, 401 Unauthorized |
| POST | /api/v1/chats | チャットメッセージ送信とAI応答 | SCR-003 | FR-003・FR-006・FR-008・FR-010 | message, files | 200 OK | 400 Bad Request, 500 Internal Server Error (AI応答失敗) |
| POST | /api/v1/documents/generate | 設計書一括生成と自己診断の実行 | SCR-004 | FR-003・FR-004・FR-009 | session_id | 201 Created | 400 Bad Request, 500 Internal Server Error (生成失敗) |

## 付録 要件との対応(Must の機能要件)

| 要件 | 画面 | API |
|---|---|---|
| FR-001 | SCR-001 | POST /api/v1/auth/register |
| FR-002 | SCR-002 | POST /api/v1/auth/login |
| FR-003 | SCR-003・SCR-004 | POST /api/v1/chats・POST /api/v1/documents/generate |
| FR-004 | SCR-004 | POST /api/v1/documents/generate |
| FR-005 | SCR-004 | — |
| FR-006 | SCR-003 | POST /api/v1/chats |
| FR-007 | — | — |
| FR-008 | SCR-003 | POST /api/v1/chats |
| FR-009 | SCR-004 | POST /api/v1/documents/generate |
| FR-010 | SCR-003 | POST /api/v1/chats |

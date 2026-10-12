# 2. 外部設計書

## 2.1 システム構成概要

### 2.1 システム構成概要

```
[ブラウザ: Chrome/Edge/Firefox/Safari]
       |
       +-- HTTPS
       |
v
[VPS (Docker Compose + nginx)]
       |
       +-- Next.js (App Router) + Tamagui [フロントエンド]
       |
       +-- FastAPI + LangChain/LangGraph (Python 3.13) [バックエンド]
                     |
                     +-- PostgreSQL / Redis [データベース]
                     |
                     +-- Gemini Flash-Lite [外部AIモデル]
```

## 2.2 画面一覧・画面遷移フロー（概要）

| 画面ID | 画面名 | 主要な役割 | 優先度 | 要件 |
|---|---|---|---|---|
| SCR-001 | アカウント登録・ログイン画面 | ユーザーが新規アカウント登録およびログインを行うための画面 | Must | FR-001・FR-002 |
| SCR-002 | チャット・参考資料アップロード画面 | 対話型チャットによるヒアリングと初期参考資料の読み込みを行う画面 | Must | FR-003・FR-004・FR-009 |
| SCR-003 | 設計書プレビュー・自己診断画面 | 生成された4種のMarkdown設計書のプレビュー、自己診断結果の確認、コピー、ダウンロード、再生成を行う画面 | Must | FR-005・FR-006・FR-007・FR-009 |

```text
SCR-001 (ログイン/登録) -> SCR-002 (チャット・資料アップロード) -> SCR-003 (設計書プレビュー・自己診断)
```

## 2.3 主要画面のUI/UX仕様

### SCR-001: アカウント登録・ログイン画面

- 入力項目: メールアドレス、パスワード
- 操作ボタン: 登録ボタン、ログインボタン
- アクション: 入力内容をもとに認証APIを呼び出し、JWTを取得してメイン画面へ遷移する

### SCR-002: チャット・参考資料アップロード画面

- 入力項目: チャットメッセージ入力欄、参考資料ファイル選択(txt, md, pdf、最大5件)
- 表示項目: チャット履歴一覧、ファイルアップロード状況
- 操作ボタン: 送信ボタン、資料アップロードボタン、設計書生成開始ボタン
- アクション: メッセージ送信および資料アップロードを行い、AIからの応答をストリーミング表示する。エラー時は理由を表示し再送を促す

### SCR-003: 設計書プレビュー・自己診断画面

- 表示項目: 4種のMarkdown設計書プレビュー領域、AIによる自己診断結果(3段階: 最重要/中程度/軽微)
- 操作ボタン: コピーボタン、ダウンロードボタン、設計書再生成ボタン
- アクション: 選択した設計書のMarkdownをクリップボードにコピーまたはファイルとしてダウンロードする。再生成要求時は生成処理を再度実行する

## 2.4 外部システム・API連携仕様

| サービス | 用途 | 認証 | タイミング | 要件 |
|---|---|---|---|---|
| Gemini Flash-Lite | 対話型ヒアリングの応答生成および4種のMarkdown設計書・自己診断の生成 | APIキーによるサーバー間認証 | チャットメッセージ送信時および設計書一括生成時 | FR-003・FR-005・FR-006・CON-004 |

## 2.5 データ入出力仕様

- 受付フォーマット: テキスト (txt, md)、PDF (pdf)
- アップロード制限: 最大5件まで
- バリデーション: ファイル形式チェック、ファイル数上限チェック、ファイルサイズ制限チェック

## 2.6 API一覧

| メソッド | パス | 概要 | 関連画面 | 要件 | 本文 | 応答 | エラー |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/auth/register | アカウント登録 | SCR-001 | FR-001 | email, password | 201 Created | 400 バリデーションエラー, 409 すでに存在するメールアドレス |
| POST | /api/v1/auth/login | ログイン | SCR-001 | FR-002・NFR-007 | email, password | 200 OK (JWT Access Token) | 401 認証失敗 |
| POST | /api/v1/chat/messages | チャットメッセージ送信 | SCR-002 | FR-003・FR-008・FR-009 | message, session_id | 200 OK | 400 リクエスト不正, 500 API連携失敗 |
| POST | /api/v1/documents/generate | 設計書一括生成および自己診断 | SCR-003 | FR-005・FR-006・FR-008・FR-009 | session_id, files | 201 Created (生成された4種設計書および自己診断結果) | 400 リクエスト不正, 500 生成失敗 |

## 付録 要件との対応(Must の機能要件)

| 要件 | 画面 | API |
|---|---|---|
| FR-001 | SCR-001 | POST /api/v1/auth/register |
| FR-002 | SCR-001 | POST /api/v1/auth/login |
| FR-003 | SCR-002 | POST /api/v1/chat/messages |
| FR-004 | SCR-002 | — |
| FR-005 | SCR-003 | POST /api/v1/documents/generate |
| FR-006 | SCR-003 | POST /api/v1/documents/generate |
| FR-007 | SCR-003 | — |
| FR-008 | — | POST /api/v1/chat/messages・POST /api/v1/documents/generate |
| FR-009 | SCR-002・SCR-003 | POST /api/v1/chat/messages・POST /api/v1/documents/generate |

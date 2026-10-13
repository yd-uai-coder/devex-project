# 2. 外部設計書

## 2.1 システム構成概要

```
[ユーザー / PC・スマホブラウザ(Chrome/Edge/Firefox/Safari)]
       │ (HTTPS)
       ▼
[nginx (VPS)]
       │
       ├─► [Next.js (App Router) + Tamagui (フロントエンド)]
       │         │
       │         ▼ (REST API / JSON)
       └─► [FastAPI + LangChain/LangGraph (バックエンド)]
                 │
                 ├─► [PostgreSQL (データベース)]
                 ├─► [Redis (レート制限・トークン失効用)]
                 └─► [Gemini Flash-Lite (外部LLM)]
```

## 2.2 画面一覧・画面遷移フロー（概要）

| 画面ID | 画面名 | 主要な役割 | 優先度 | 要件 |
|---|---|---|---|---|
| SCR-001 | ログイン画面 | アカウント登録およびログインを行う | Must | FR-007・NFR-005 |
| SCR-002 | プロジェクト一覧・初期入力画面 | 新規プロジェクトの作成と参考資料のアップロードを行う | Must | FR-001・FR-006 |
| SCR-003 | チャットヒアリング画面 | AIと対話形式でアイデアや要望をヒアリングする | Must | FR-001・FR-009・FR-010 |
| SCR-004 | 構造化サマリ確認画面 | ヒアリング完了後の構造化サマリを確認し承認する | Must | FR-002 |
| SCR-005 | 設計書ビューア・診断画面 | 生成された4種の設計書の閲覧、プレビュー、コピー、ダウンロード、自己診断結果の確認を行う | Must | FR-003・FR-004・FR-005・FR-008・FR-009 |

```text
SCR-001 (ログイン) ──► SCR-002 (一覧・初期入力) ──► SCR-003 (チャットヒアリング) ──► SCR-004 (構造化サマリ確認) ──► SCR-005 (設計書ビューア・診断)
```

## 2.3 主要画面のUI/UX仕様

### SCR-001: ログイン画面

- 入力項目: メールアドレス、パスワード
- 操作ボタン: ログインボタン、アカウント登録切替ボタン
- アクション: 認証情報を送信し、成功時はプロジェクト一覧画面へ遷移する

### SCR-002: プロジェクト一覧・初期入力画面

- 入力項目: プロジェクト名、アイデア・要望の初期入力、参考資料ファイル選択(txt/md/pdf、最大3件)
- 操作ボタン: チャットヒアリング開始ボタン、プロジェクト選択リンク
- アクション: 入力内容とファイルを送信し、チャット画面へ遷移する

### SCR-003: チャットヒアリング画面

- 表示項目: チャット履歴、AIの応答メッセージ、エラー理由表示
- 入力項目: メッセージ入力欄(数千文字まで、空送信不可)
- 操作ボタン: メッセージ送信ボタン、再送ボタン
- アクション: メッセージを送信してAIの返答を受け取る。エラー時は再送を促す

### SCR-004: 構造化サマリ確認画面

- 表示項目: 構造化サマリの内容
- 操作ボタン: 承認して設計書生成開始ボタン、修正のためチャットに戻るボタン
- アクション: 承認時に設計書生成APIを呼び出し、設計書ビューア画面へ遷移する

### SCR-005: 設計書ビューア・診断画面

- 表示項目: 4種の設計書タブ(要件定義・外部設計・内部設計・実装計画)、Markdownプレビュー、自己診断結果(最重要・中程度・軽微の3段階)、版管理一覧(直近3件)
- 操作ボタン: コピーボタン、ダウンロードボタン、再生成ボタン、版切り替えリンク
- アクション: 設計書のコピーやファイルダウンロード、自己診断の確認、版の切り替えを行う

## 2.4 外部システム・API連携仕様

| サービス | 用途 | 認証 | タイミング | 要件 |
|---|---|---|---|---|
| Gemini Flash-Lite | チャットヒアリング、構造化サマリ生成、4種設計書の逐次生成および自己診断 | APIキー認証 | ユーザーからのメッセージ送信時および生成指示時 | FR-001・FR-002・FR-003・FR-004・CON-004 |

## 2.5 データ入出力仕様

- 受付フォーマット: 参考資料として txt, md, pdf ファイル(最大3件)、チャットメッセージ(数千文字以内)
- バリデーション: 空送信の不許可、ファイル形式および件数の制限、レート制限・トークン上限超過時のエラーハンドリング

## 2.6 API一覧

| メソッド | パス | 概要 | 関連画面 | 要件 | 本文 | 応答 | エラー |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/auth/register | アカウント登録 | SCR-001 | FR-007・NFR-005 | email, password | 201 Created | 400 Bad Request, 409 Conflict |
| POST | /api/v1/auth/login | ログイン | SCR-001 | FR-007・NFR-005 | email, password | 200 OK | 401 Unauthorized |
| POST | /api/v1/projects | プロジェクト作成・初期入力 | SCR-002 | FR-001・FR-006 | project_name, initial_idea, files | 201 Created | 400 Bad Request |
| POST | /api/v1/projects/{id}/chat | チャットメッセージ送信 | SCR-003 | FR-001・FR-009・FR-010 | message | 200 OK | 400 Bad Request, 500 Internal Server Error |
| POST | /api/v1/projects/{id}/summary | 構造化サマリ承認と設計書生成開始 | SCR-004 / SCR-005 | FR-002・FR-003 | approved | 202 Accepted | 400 Bad Request, 500 Internal Server Error |
| GET | /api/v1/projects/{id}/documents | 設計書および自己診断結果・版一覧の取得 | SCR-005 | FR-003・FR-004・FR-008 | — | 200 OK | 404 Not Found |
| POST | /api/v1/projects/{id}/documents/regenerate | 設計書の再生成 | SCR-005 | FR-003・FR-009 | none | 202 Accepted | 500 Internal Server Error |

## 付録 要件との対応(Must の機能要件)

| 要件 | 画面 | API |
|---|---|---|
| FR-001 | SCR-002・SCR-003 | POST /api/v1/projects・POST /api/v1/projects/{id}/chat |
| FR-002 | SCR-004 | POST /api/v1/projects/{id}/summary |
| FR-003 | SCR-005 | POST /api/v1/projects/{id}/summary・GET /api/v1/projects/{id}/documents・POST /api/v1/projects/{id}/documents/regenerate |
| FR-004 | SCR-005 | GET /api/v1/projects/{id}/documents |
| FR-005 | SCR-005 | — |
| FR-006 | SCR-002 | POST /api/v1/projects |
| FR-007 | SCR-001 | POST /api/v1/auth/register・POST /api/v1/auth/login |
| FR-008 | SCR-005 | GET /api/v1/projects/{id}/documents |
| FR-009 | SCR-003・SCR-005 | POST /api/v1/projects/{id}/chat・POST /api/v1/projects/{id}/documents/regenerate |
| FR-010 | SCR-003 | POST /api/v1/projects/{id}/chat |

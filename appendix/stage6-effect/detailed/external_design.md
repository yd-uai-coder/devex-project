# 2. 外部設計書

## 2.1 システム構成概要

```
[ユーザー / ブラウザ] 
       │ (HTTPS)
       ▼
[Webアプリケーション (本システム)]
       │
       ├─ チャットヒアリング / 文書一括生成 / 自己診断
       └─ PostgreSQL (データベース: ユーザー・チャット履歴・生成文書)
```

## 2.2 画面一覧・画面遷移フロー（概要）

| 画面ID | 画面名 | 主要な役割 | 優先度 | 要件 |
|---|---|---|---|---|
| SCR-001 | 初期入力・参考資料アップロード画面 | プロジェクトの開始と参考資料の読み込みを行う | Must | FR-005・NFR-008 |
| SCR-002 | 対話型チャットヒアリング画面 | AIとの対話を通じて要件のヒアリングを行う | Must | FR-001・FR-011・NFR-003 |
| SCR-003 | 設計書プレビュー・診断画面 | 生成された4種設計書のプレビュー、コピー、ダウンロード、および自己診断結果を確認する | Must | FR-002・FR-003・FR-004・FR-012 |

```text
SCR-001 (初期入力) ──> SCR-002 (チャットヒアリング) ──> SCR-003 (設計書プレビュー・診断)
```

## 2.3 主要画面のUI/UX仕様

### SCR-001: 初期入力・参考資料アップロード画面

- 入力項目: プロジェクト概要テキスト、参考資料ファイル(txt, md, pdf形式、最大3件)
- 操作ボタン: チャットヒアリング開始ボタン
- アクション: 入力内容と参考資料を送信し、チャット画面へ遷移する

### SCR-002: 対話型チャットヒアリング画面

- 表示項目: チャット履歴一覧、AIからの応答メッセージ、ストリーミング出力
- 入力項目: メッセージ入力欄
- 操作ボタン: メッセージ送信ボタン、設計書生成へ進むボタン
- アクション: ユーザーの回答を送信しAI応答を表示する。エラー時は理由を表示しメッセージを保存せずに再送を促す

### SCR-003: 設計書プレビュー・診断画面

- 表示項目: 要件定義・外部設計・内部設計・実装計画の4種Markdown設計書プレビュー、AIによる不足点の3段階自己診断結果
- 操作ボタン: クリップボードへコピーボタン、ダウンロードボタン、再生成(再試行)ボタン
- アクション: Markdownのコピーやファイルダウンロードを実行する。生成失敗時は再試行を行う

## 2.4 外部システム・API連携仕様

(なし)

## 2.5 データ入出力仕様

- 受付フォーマット: txt, md, pdf形式の参考資料(最大3件)
- ファイル入出力: 生成されたMarkdown設計書のダウンロード

## 2.6 API一覧

| メソッド | パス | 概要 | 関連画面 | 要件 | 本文 | 応答 | エラー |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/projects | プロジェクト作成と参考資料の初期登録 | SCR-001 | FR-005 | project_name, initial_description, files | 201 Created | 400 Bad Request, 413 Payload Too Large |
| POST | /api/v1/chats | チャットメッセージの送信とAI応答の取得 | SCR-002 | FR-001・FR-011・NFR-003 | project_id, message | 200 OK | 500 Internal Server Error |
| POST | /api/v1/documents/generate | 4種設計書の一括生成と自己診断の実行 | SCR-003 | FR-002・FR-003・FR-012・NFR-004 | project_id | 201 Created | 500 Internal Server Error |
| GET | /api/v1/documents/{id} | 生成された設計書と自己診断結果の取得 | SCR-003 | FR-002・FR-003・FR-004 | — | 200 OK | 404 Not Found |

## 付録 要件との対応(Must の機能要件)

| 要件 | 画面 | API |
|---|---|---|
| FR-001 | SCR-002 | POST /api/v1/chats |
| FR-002 | SCR-003 | POST /api/v1/documents/generate・GET /api/v1/documents/{id} |
| FR-003 | SCR-003 | POST /api/v1/documents/generate・GET /api/v1/documents/{id} |
| FR-004 | SCR-003 | GET /api/v1/documents/{id} |
| FR-005 | SCR-001 | POST /api/v1/projects |
| FR-011 | SCR-002 | POST /api/v1/chats |
| FR-012 | SCR-003 | POST /api/v1/documents/generate |

# 2. 外部設計書

## 2.1 システム構成概要

本システムは、Next.js (App Router) + Tamaguiを用いたフロントエンドと、FastAPI + LangChain・LangGraph (Python 3.13)を用いたバックエンドにより構成される。データベースにはPostgreSQLを採用し、認証・セッション管理等のレート制限にはRedisを使用する。VPS上にDocker Composeでデプロイされ、フロントエンドの前段にnginxを配置する。

```
[ブラウザ/Next.js] ---> [nginx] ---> [FastAPI / LangGraph] <---> [PostgreSQL]
                                          |
                                          v
                                      [Redis]
```

## 2.2 画面一覧・画面遷移フロー（概要）

| 画面ID | 画面名 | 主要な役割 | 優先度 | 要件 |
|---|---|---|---|---|
| SCR-001 | 初期入力・参考資料読み込み画面 | プロジェクトの開始と参考資料のアップロードを行う | Must | FR-005 |
| SCR-002 | チャットヒアリング画面 | AIと対話形式で要件のヒアリングを行う | Must | FR-001・FR-012・FR-013 |
| SCR-003 | 設計書プレビュー・ダウンロード画面 | 生成された4種のMarkdown設計書およびAI自己診断結果の確認・コピー・ダウンロードを行う | Must | FR-002・FR-003・FR-004・FR-012 |

```text
SCR-001 (初期入力) -> SCR-002 (チャットヒアリング) -> SCR-003 (設計書プレビュー・ダウンロード)
```

## 2.3 主要画面のUI/UX仕様

### SCR-001: 初期入力・参考資料読み込み画面

- 入力項目: プロジェクト名・初期要望テキスト、参考資料ファイル選択(txt/md/pdf、最大3件)
- 操作ボタン: 「ヒアリング開始」ボタン
- アクション: 入力内容とファイルを送信してチャット画面へ遷移する

### SCR-002: チャットヒアリング画面

- 表示項目: チャット履歴一覧、AI応答時のローディング表示
- 入力項目: メッセージ入力欄(数千文字まで・空送信禁止)
- 操作ボタン: 「送信」ボタン、「設計書生成へ進む」ボタン
- アクション: メッセージ送信時にエラーが発生した場合は例外理由を表示して再送を促す

### SCR-003: 設計書プレビュー・ダウンロード画面

- 表示項目: 4種のMarkdown設計書プレビュー(要件定義・外部設計・内部設計・実装計画)、3段階(最重要/中程度/軽微)のAI自己診断結果
- 操作ボタン: 「コピー」ボタン、「ダウンロード」ボタン、「再生成」ボタン
- アクション: 生成失敗時は再生成ボタンから再処理を実行する

## 2.4 外部システム・API連携仕様

(なし)

## 2.5 データ入出力仕様

- ファイル入出力: 初期入力時に参考資料(txt, md, pdf)を最大3件までアップロード可能
- バリデーション: チャット送信時は文字数制限(数千文字まで)および空文字チェックを実施

## 2.6 API一覧

| メソッド | パス | 概要 | 関連画面 | 要件 | 本文 | 応答 | エラー |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/projects | プロジェクト作成および初期資料アップロード | SCR-001 | FR-005・FR-006 | project_name, initial_prompt, files | 201 作成成功 (project_idを含む) | 400 バリデーションエラー, 413 ファイルサイズ超過 |
| POST | /api/v1/projects/{id}/chat | チャットメッセージの送信とAI応答取得 | SCR-002 | FR-001・FR-012・FR-013 | message | 200 応答成功 | 400 空送信・文字数超過, 429 上限超過エラー |
| POST | /api/v1/projects/{id}/generate | 4種設計書の一括生成とAI自己診断の実行 | SCR-003 | FR-002・FR-003・FR-006・FR-012 | — | 200 生成成功 | 500 生成失敗・タイムアウト |
| GET | /api/v1/projects/{id}/documents | 生成された設計書および自己診断結果の取得 | SCR-003 | FR-002・FR-003・FR-004・NFR-005 | — | 200 取得成功 | 404 対象なし, 403 権限エラー |

## 付録 要件との対応(Must の機能要件)

| 要件 | 画面 | API |
|---|---|---|
| FR-001 | SCR-002 | POST /api/v1/projects/{id}/chat |
| FR-002 | SCR-003 | POST /api/v1/projects/{id}/generate・GET /api/v1/projects/{id}/documents |
| FR-003 | SCR-003 | POST /api/v1/projects/{id}/generate・GET /api/v1/projects/{id}/documents |
| FR-004 | SCR-003 | GET /api/v1/projects/{id}/documents |
| FR-005 | SCR-001 | POST /api/v1/projects |
| FR-006 | — | POST /api/v1/projects・POST /api/v1/projects/{id}/generate |
| FR-012 | SCR-002・SCR-003 | POST /api/v1/projects/{id}/chat・POST /api/v1/projects/{id}/generate |
| FR-013 | SCR-002 | POST /api/v1/projects/{id}/chat |

# 2. 外部設計書

## 2.1 システム構成概要

本システムは、Next.js(App Router)+ Tamaguiによるフロントエンドと、FastAPI + LangChain・LangGraph(Python 3.13)によるバックエンド、PostgreSQLおよびRedisを用いた構成をとる。VPS上にDocker Composeとnginxでデプロイされ、外部のGemini Flash-Lite APIと連携してチャットヒアリングおよび各種設計書の逐次生成を行う。

## 2.2 画面一覧・画面遷移フロー（概要）

| 画面ID | 画面名 | 主要な役割 | 優先度 | 要件 |
|---|---|---|---|---|
| SCR-001 | ログイン画面 | ユーザー認証を行う | Must | FR-007 |
| SCR-002 | チャットヒアリング画面 | AIとの対話を通じて要件を深掘りする | Must | FR-001・FR-006・FR-009・FR-010 |
| SCR-003 | 構造化サマリ確認・生成承認画面 | ヒアリング完了後のサマリ提示と生成承認を行う | Must | FR-002 |
| SCR-004 | 設計書生成・プレビュー画面 | 4種の設計書の逐次生成およびプレビュー・コピー・ダウンロード・自己診断結果の確認を行う | Must | FR-003・FR-004・FR-005・FR-008・FR-009 |

```text
SCR-001 (ログイン) -> SCR-002 (チャットヒアリング) -> SCR-003 (構造化サマリ確認) -> SCR-004 (設計書生成・プレビュー)
```

## 2.3 主要画面のUI/UX仕様

### SCR-001: ログイン画面

- メールアドレス入力欄
- パスワード入力欄
- ログインボタン

### SCR-002: チャットヒアリング画面

- メッセージ表示エリア
- メッセージ入力欄(数千文字まで)
- 空送信防止機能付き送信ボタン
- 参考資料アップロード欄(txt/md/pdf、最大3件)
- エラー時の再送促し表示

### SCR-003: 構造化サマリ確認・生成承認画面

- 構造化サマリ表示エリア
- 承認ボタン
- 修正要求ボタン

### SCR-004: 設計書生成・プレビュー画面

- 設計書選択タブ(要件定義・外部設計・内部設計・実装計画)
- Markdownプレビューエリア
- コピーボタン
- ダウンロードボタン
- 自己診断結果表示エリア(不足点を3段階で提示)
- 版管理一覧(直近3件の版切り替え)
- 追加回答用チャット・再生成ボタン

## 2.4 外部システム・API連携仕様

| サービス | 用途 | 認証 | タイミング | 要件 |
|---|---|---|---|---|
| Gemini Flash-Lite API | チャットヒアリングの対話生成および設計書の逐次生成 | APIキー | リアルタイム対話時および生成時 | CON-006 |

## 2.5 データ入出力仕様

- 参考資料ファイル入出力: txt, md, pdf形式、最大3件のアップロードを受け付け、テキスト化してPostgreSQLのDBに保存する。
- Markdownファイル入出力: 生成された設計書のダウンロード対応。

## 2.6 API一覧

| メソッド | パス | 概要 | 関連画面 | 要件 | 本文 | 応答 | エラー |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/auth/login | ログイン認証 | SCR-001 | FR-007 | email, password | 200 認証成功とトークン | 401 認証失敗、429 レート制限超過 |
| POST | /api/v1/projects | プロジェクト作成・チャットメッセージ送信 | SCR-002 | FR-001・FR-010 | message | 201 メッセージ受付 | 400 空送信エラー、429 レート制限超過 |
| POST | /api/v1/projects/{id}/documents/summary | 構造化サマリの取得・承認 | SCR-003 | FR-002 | approved | 200 承認完了 | 404 対象なし |
| POST | /api/v1/projects/{id}/documents/generate | 設計書の逐次生成および自己診断実行 | SCR-004 | FR-003・FR-004・FR-009 | document_types | 201 生成開始・結果 | 500 LLMエラー時の再生成促し |
| GET | /api/v1/projects/{id}/documents | 設計書および版履歴の取得 | SCR-004 | FR-005・FR-008 | — | 200 設計書一覧と版情報(直近3件) | 404 対象なし |

## 付録 要件との対応(Must の機能要件)

| 要件 | 画面 | API |
|---|---|---|
| FR-001 | SCR-002 | POST /api/v1/projects |
| FR-002 | SCR-003 | POST /api/v1/projects/{id}/documents/summary |
| FR-003 | SCR-004 | POST /api/v1/projects/{id}/documents/generate |
| FR-004 | SCR-004 | POST /api/v1/projects/{id}/documents/generate |
| FR-005 | SCR-004 | GET /api/v1/projects/{id}/documents |
| FR-006 | SCR-002 | — |
| FR-007 | SCR-001 | POST /api/v1/auth/login |
| FR-008 | SCR-004 | GET /api/v1/projects/{id}/documents |
| FR-009 | SCR-002・SCR-004 | POST /api/v1/projects/{id}/documents/generate |
| FR-010 | SCR-002 | POST /api/v1/projects |

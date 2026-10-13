# 2. 外部設計書

## 2.1 システム構成概要

本システムは、ブラウザからアクセスするWebフロントエンド（Next.js / Tamagui）と、ビジネスロジック・AIオーケストレーションを担うバックエンドAPI（FastAPI / LangChain / LangGraph）、データストア（PostgreSQL）、およびレート制限／セッション制御用キャッシュ（Redis）で構成されます。外部サービスとしてGoogle Gemini API（Gemini Flash-Lite）と連携します。

```text
+-------------------------------------------------------------------------+
| クライアント環境 (PC主要ブラウザ / スマートフォン閲覧)                   |
|   +-----------------------------------------------------------------+   |
|   | Next.js (App Router) + Tamagui (UI)                             |   |
|   +-----------------------------------------------------------------+   |
+------------------------------------+------------------------------------+
                                     | HTTPS / WSS / JWT
+------------------------------------v------------------------------------+
| VPS インフラ (Docker Compose + nginx リバースプロキシ)                  |
|                                                                         |
|   +-----------------------------------------------------------------+   |
|   | FastAPI バックエンド (Python 3.13)                              |   |
|   |   - 認証・認可 (JWT, HttpOnly Cookie)                           |   |
|   |   - レート制限ミドルウェア                                       |   |
|   |   - LangChain / LangGraph (ヒアリング対話制御・設計書一括生成)  |   |
|   +-------------------+----------------------------+----------------+   |
|                       |                            |                    |
|   +-------------------v---+    +-------------------v---+                |
|   | PostgreSQL データベース|    | Redis キャッシュ      |                |
|   | (ユーザー・対話・設計書)|    | (レート制限・トークン) |                |
|   +-----------------------+    +-----------------------+                |
+------------------------------------+------------------------------------+
                                     | HTTPS (API Key)
+------------------------------------v------------------------------------+
| 外部サービス                                                            |
|   +-----------------------------------------------------------------+   |
|   | Google Gemini API (Gemini Flash-Lite 無料枠)                    |   |
|   +-----------------------------------------------------------------+   |
+-------------------------------------------------------------------------+
```

## 2.2 画面一覧・画面遷移フロー（概要）

| 画面ID | 画面名 | 主要な役割 | 優先度 | 要件 |
|---|---|---|---|---|
| SCR-001 | 認証（ログイン／新規登録）画面 | メールアドレスとパスワードによるアカウント新規作成およびログインを行う。 | Must | FR-001・FR-002・NFR-006・CON-001 |
| SCR-002 | プロジェクト一覧・新規作成画面 | 自身が作成したヒアリングプロジェクトの一覧を確認し、新規プロジェクトを開始する。 | Must | FR-003・FR-010・CON-001 |
| SCR-003 | ヒアリングチャット・資料登録画面 | 参考資料の登録およびAIとの対話型チャットを通じて要件のヒアリングを進める。 | Must | FR-003・FR-004・FR-005・FR-006・FR-010・FR-011・NFR-003・NFR-006・NFR-008・CON-001・CON-004 |
| SCR-004 | 設計書プレビュー・自己診断画面 | 生成された4種のMarkdown設計書および自己診断結果を確認・コピー・ダウンロードする。 | Must | FR-003・FR-007・FR-008・FR-009・FR-010・FR-011・NFR-003・NFR-008・CON-001 |

```text
SCR-001 [ログイン成功] --> SCR-002
SCR-002 [新規作成またはプロジェクト選択] --> SCR-003
SCR-003 [設計書生成実行] --> SCR-004
SCR-004 [チャットに戻る] --> SCR-003
SCR-002 [ログアウト] --> SCR-001
```

## 2.3 主要画面のUI/UX仕様

### SCR-001: 認証（ログイン／新規登録）画面

- タブ切替（ログイン／新規登録）
- 入力フォーム：メールアドレス、パスワード
- 送信ボタン（「ログイン」または「アカウント登録」）
- エラーメッセージ表示領域（認証失敗、レート制限エラー「一定時間後に再試行してください」、バリデーションエラー）

### SCR-002: プロジェクト一覧・新規作成画面

- プロジェクト一覧カード（プロジェクト名、作成日時、最終更新日時、ステータス）
- 「新規プロジェクト開始」ボタン
- プロジェクト作成モーダル（プロジェクト名入力欄、作成ボタン）
- ログアウトボタン

### SCR-003: ヒアリングチャット・資料登録画面

- 参考資料アップロードエリア（txt/md/pdf対応、最大3件、添付済ファイル一覧・削除チップ）
- チャット履歴タイムライン（ユーザー発言、AI発言、タイムスタンプ）
- メッセージ入力エリア（複数行テキストエリア、入力文字数カウンタ、空送信防止制御）
- 送信ボタン（ストリーミング出力中および設計書生成中は非活性化）
- エラー表示トースト／バナー（LLM上限超過時の再送促進メッセージ等）
- 「設計書を一括生成する」アクションボタン（生成進行中はプログレスインジケータ表示）

### SCR-004: 設計書プレビュー・自己診断画面

- 設計書切替タブ（「要件定義書」「外部設計書」「内部設計書」「実装計画書」「AI自己診断」）
- Markdownプレビュー領域（リッチ表示およびRaw Markdown表示の切替スイッチ）
- 自己診断表示パネル（3段階バッジ「最重要」「中程度」「軽微」による不足点一覧）
- アクションツールバー（「クリップボードにコピー」ボタン、「Markdown形式で保存」ボタン、「4種一括ダウンロード」ボタン、「再生成」ボタン）
- 「チャットに戻る」リンクボタン

## 2.4 外部システム・API連携仕様

| サービス | 用途 | 認証 | タイミング | 要件 |
|---|---|---|---|---|
| Google Gemini API (Gemini Flash-Lite) | ヒアリング対話チャットの応答生成、および4種のMarkdown設計書の一括ドラフト生成・3段階の自己診断の実施 | API Key認証（バックエンド環境変数管理） | チャットメッセージ送信時（リアルタイム・ストリーミング）、および設計書生成ボタン押下時（バッチ・非同期生成処理） | FR-005・FR-007・FR-008・FR-011・CON-004 |

## 2.5 データ入出力仕様

### 1. 入力ファイル仕様
- **対象機能**: 参考資料登録（SCR-003）
- **許容形式**: プレーンテキスト (`.txt`)、Markdown (`.md`)、PDF (`.pdf`)
- **件数制限**: 1プロジェクトあたり最大3件
- **サイズ制限**: 1ファイルあたり最大5MB
- **バリデーション**: 拡張子およびMIMEタイプの検証を実施。規定外の形式や上限件数（3件超）の場合はエラーメッセージを表示して受付を拒否。

### 2. 出力ファイル仕様
- **対象機能**: 設計書ダウンロード（SCR-004）
- **個別ダウンロード**: 各設計書をUTF-8エンコーディングのMarkdown形式（`.md`）として出力。
  - `requirements.md`（要件定義書）
  - `external_design.md`（外部設計書）
  - `internal_design.md`（内部設計書）
  - `implementation_plan.md`（実装計画書）
- **一括ダウンロード**: 4種の設計書および自己診断レポート（`diagnosis.md`）をまとめたZIP形式（`.zip`）として出力。

## 2.6 API一覧

| メソッド | パス | 概要 | 関連画面 | 要件 | 本文 | 応答 | エラー |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/auth/register | ユーザー新規アカウント登録 | SCR-001 | FR-001・FR-002・NFR-006・CON-002 | email, password | 201 作成成功（ユーザー情報・アクセストークン。HttpOnly Cookieにリフレッシュトークン設定） | 400 入力形式不正、409 既存メールアドレス重複、429 レート制限超過 |
| POST | /api/v1/auth/login | ログイン認証 | SCR-001 | FR-001・FR-002・NFR-006・CON-002 | email, password | 200 認証成功（アクセストークン。HttpOnly Cookieにリフレッシュトークン設定） | 401 認証情報不一致、429 レート制限超過 |
| POST | /api/v1/auth/refresh | アクセストークン再発行 | SCR-001 / SCR-002 / SCR-003 / SCR-004 | FR-002・CON-002 | — | 200 新規アクセストークン | 401 トークン無効または期限切れ |
| POST | /api/v1/auth/logout | ログアウト処理 | SCR-002 | FR-002・CON-002 | — | 200 ログアウト成功（Cookie削除） | 401 未認証 |
| GET | /api/v1/projects | ログインユーザーのプロジェクト一覧取得 | SCR-002 | FR-003・FR-010・CON-002 | — | 200 プロジェクト一覧配列 | 401 未認証 |
| POST | /api/v1/projects | 新規プロジェクト作成 | SCR-002 | FR-003・FR-010・CON-002 | name | 201 作成されたプロジェクト情報 | 400 入力形式不正、401 未認証 |
| GET | /api/v1/projects/{id} | プロジェクト詳細情報取得 | SCR-003 / SCR-004 | FR-003・FR-010・CON-002 | — | 200 プロジェクト詳細情報（参考資料リスト含む） | 401 未認証、403 他ユーザーのプロジェクト、404 対象なし |
| POST | /api/v1/projects/{id}/files | 参考資料ファイルのアップロード | SCR-003 | FR-003・FR-004・CON-002 | file (multipart/form-data) | 201 アップロード済みファイル情報（ID、ファイル名） | 400 形式不正・容量超過・件数上限(3件)超過、401 未認証、403 権限なし、404 プロジェクトなし |
| GET | /api/v1/projects/{id}/messages | ヒアリングチャット履歴取得 | SCR-003 | FR-003・FR-005・FR-010・CON-002 | — | 200 チャットメッセージ履歴配列 | 401 未認証、403 権限なし、404 プロジェクトなし |
| POST | /api/v1/projects/{id}/messages | チャットメッセージ送信とAI応答ストリーミング | SCR-003 | FR-003・FR-005・FR-006・FR-010・FR-011・NFR-003・NFR-006・CON-002・CON-004 | content | 200 AI応答テキスト（Server-Sent Eventsストリーミング） | 400 空送信・文字数上限超過、401 未認証、403 権限なし、429 レート制限／Gemini上限超過、503 AIサービス一時利用不可 |
| POST | /api/v1/projects/{id}/specifications/generate | 4種の設計書一括生成および自己診断の実行 | SCR-003 / SCR-004 | FR-003・FR-007・FR-008・FR-010・FR-011・NFR-003・NFR-006・CON-002・CON-004 | — | 200 生成された設計書群（要件定義、外部設計、内部設計、実装計画）および自己診断結果 | 401 未認証、403 権限なし、404 プロジェクトなし、429 レート制限／Gemini上限超過、500 生成失敗（再実行可能） |
| GET | /api/v1/projects/{id}/specifications | 生成済み設計書群および自己診断結果の取得 | SCR-004 | FR-003・FR-007・FR-008・FR-009・FR-010・CON-002 | — | 200 設計書群（4種Markdown本文）および自己診断結果データ | 401 未認証、403 権限なし、404 未生成またはプロジェクトなし |
| GET | /api/v1/projects/{id}/specifications/download | 設計書ファイル（個別Markdownまたは一括ZIP）ダウンロード | SCR-004 | FR-003・FR-009・CON-002 | — | 200 ファイルバイナリ（text/markdown または application/zip） | 401 未認証、403 権限なし、404 設計書データなし |

## 付録 要件との対応(Must の機能要件)

| 要件 | 画面 | API |
|---|---|---|
| FR-001 | SCR-001 | POST /api/v1/auth/register・POST /api/v1/auth/login |
| FR-002 | SCR-001 | POST /api/v1/auth/register・POST /api/v1/auth/login・POST /api/v1/auth/refresh・POST /api/v1/auth/logout |
| FR-003 | SCR-002・SCR-003・SCR-004 | GET /api/v1/projects・POST /api/v1/projects・GET /api/v1/projects/{id}・POST /api/v1/projects/{id}/files・GET /api/v1/projects/{id}/messages・POST /api/v1/projects/{id}/messages・POST /api/v1/projects/{id}/specifications/generate・GET /api/v1/projects/{id}/specifications・GET /api/v1/projects/{id}/specifications/download |
| FR-004 | SCR-003 | POST /api/v1/projects/{id}/files |
| FR-005 | SCR-003 | GET /api/v1/projects/{id}/messages・POST /api/v1/projects/{id}/messages |
| FR-006 | SCR-003 | POST /api/v1/projects/{id}/messages |
| FR-007 | SCR-004 | POST /api/v1/projects/{id}/specifications/generate・GET /api/v1/projects/{id}/specifications |
| FR-008 | SCR-004 | POST /api/v1/projects/{id}/specifications/generate・GET /api/v1/projects/{id}/specifications |
| FR-009 | SCR-004 | GET /api/v1/projects/{id}/specifications・GET /api/v1/projects/{id}/specifications/download |
| FR-010 | SCR-002・SCR-003・SCR-004 | GET /api/v1/projects・POST /api/v1/projects・GET /api/v1/projects/{id}・GET /api/v1/projects/{id}/messages・POST /api/v1/projects/{id}/messages・POST /api/v1/projects/{id}/specifications/generate・GET /api/v1/projects/{id}/specifications |
| FR-011 | SCR-003・SCR-004 | POST /api/v1/projects/{id}/messages・POST /api/v1/projects/{id}/specifications/generate |

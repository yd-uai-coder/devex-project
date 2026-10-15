# 2. 外部設計書

## 2.1 システム構成概要

```
+-----------------------+
| ユーザー (ブラウザ)   |
+-----------------------+
           |
           | HTTPS / HTTP
           v
+-----------------------+
| FastAPI アプリケーション |
| (Python / PostgreSQL) |
+-----------------------+
```

## 2.2 画面一覧・画面遷移フロー（概要）

| 画面ID | 画面名 | 主要な役割 | 優先度 | 要件 |
|---|---|---|---|---|
| SCR-001 | 献立管理・生成画面 | 献立の記録、一覧表示およびAIによる献立生成を行うメイン画面。 | Must | FR-001・FR-002・FR-003・FR-004 |

```text
SCR-001 (単一画面構成)
```

## 2.3 主要画面のUI/UX仕様

### SCR-001: 献立管理・生成画面

- 入力項目: 献立内容テキスト、APIキー/パスワード入力欄
- 表示項目: 登録済み献立一覧、AI生成された献立結果、エラーメッセージ表示エリア
- 操作ボタン: 「献立生成」ボタン、「献立登録」ボタン、「データ削除」ボタン
- アクション: ボタン押下によるAPI呼び出しと画面上の状態更新

## 2.4 外部システム・API連携仕様

(なし)

## 2.5 データ入出力仕様

なし

## 2.6 API一覧

| メソッド | パス | 概要 | 関連画面 | 要件 | 本文 | 応答 | エラー |
|---|---|---|---|---|---|---|---|
| POST | /api/v1/users | アカウント作成およびトークン発行 | SCR-001 | FR-004 | password | 201 Created | 400 Bad Request, 500 Internal Server Error |
| GET | /api/v1/menus | 登録済み献立一覧の取得 | SCR-001 | FR-001・FR-004 | — | 200 OK | 401 Unauthorized, 500 Internal Server Error |
| POST | /api/v1/menus | 献立の記録またはAI生成 | SCR-001 | FR-001・FR-002・FR-004 | content, token | 201 Created | 400 Bad Request, 401 Unauthorized, 500 Internal Server Error |
| DELETE | /api/v1/account | アカウントおよび献立データの削除 | SCR-001 | FR-003・FR-004 | token | 204 No Content | 401 Unauthorized, 404 Not Found |

## 付録 要件との対応(Must の機能要件)

| 要件 | 画面 | API |
|---|---|---|
| FR-001 | SCR-001 | GET /api/v1/menus・POST /api/v1/menus |
| FR-002 | SCR-001 | POST /api/v1/menus |
| FR-003 | SCR-001 | DELETE /api/v1/account |
| FR-004 | SCR-001 | POST /api/v1/users・GET /api/v1/menus・POST /api/v1/menus・DELETE /api/v1/account |


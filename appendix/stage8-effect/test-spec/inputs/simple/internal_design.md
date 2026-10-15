# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

技術スタック:
- フロントエンド: HTML/CSS/JavaScript (FastAPIの静的ファイル配信またはテンプレートを使用)
- バックエンド: Python 3.11+, FastAPI
- データベース: PostgreSQL 15+
- インフラ: 手元のパソコンまたは社内サーバー (Dockerコンテナによるデプロイを想定)

アーキテクチャ方針:
レイヤードアーキテクチャを採用し、ルーター層、サービス層、データモデル層を分離する。非同期処理を活用し、AI生成やデータベースI/Oの効率を高める。

```
+-------------------------------------------------------------+
|                   FastAPI Application                       |
|  +-----------------+  +-----------------+  +-------------+  |
|  |   Routers 層    |->|   Services 層   |->|  Models 層  |  |
|  +-----------------+  +-----------------+  +-------------+  |
+-------------------------------------------------------------+
                                                        |
                                                        v
                                           +---------------------+
                                           |     PostgreSQL      |
                                           +---------------------+
```

## 3.2 データモデル定義

主要エンティティとして、認証用トークンやアカウント情報を保持する users テーブルと、ユーザーごとの献立データを保持する menus テーブルを定義する。

```
+---------------------+         +---------------------+
|        users        | 1     N |        menus        |
+---------------------+<--------+---------------------+
| id (PK)             |         | id (PK)             |
| token               |         | user_id (FK)        |
| created_at          |         | content             |
+---------------------+         | created_at          |
                                +---------------------+
```

### テーブル: users

認証用のトークンやアカウント情報を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | Integer | PK, NOT NULL | 一意のユーザーID |
| token | String | NOT NULL, UNIQUE | 認証用APIキー/トークン |
| created_at | DateTime | NOT NULL | 作成日時 |

### テーブル: menus

記録された献立データを保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | Integer | PK, NOT NULL | 一意の献立ID |
| user_id | Integer | FK, NOT NULL | ユーザーID |
| content | Text | NOT NULL | 献立内容テキスト |
| created_at | DateTime | NOT NULL | 作成日時 |

## 3.3 バックエンド処理・モジュール設計

主要処理ロジックの分割方針:
FastAPIの標準的なディレクトリ構成に従い、ルーティング、ビジネスロジック、データモデルを明確に分離する。

```
app/
├── main.py
├── routers/
│   ├── users.py
│   ├── menus.py
│   └── account.py
├── services/
│   ├── user_service.py
│   ├── menu_service.py
│   └── ai_service.py
└── models/
    └── database.py
```

### APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/users | アカウント作成およびトークン発行を行うエンドポイント |
| GET | /api/v1/menus | 登録済み献立一覧を取得するエンドポイント |
| POST | /api/v1/menus | 献立の記録またはAI生成を行うエンドポイント |
| DELETE | /api/v1/account | アカウントおよび献立データを削除するエンドポイント |

### モジュール一覧

| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| app/main.py | ルート | アプリケーションのエントリーポイントおよびミドルウェア設定を行う。 | app/routers/users.py, app/routers/menus.py, app/routers/account.py, fastapi |
| app/routers/users.py | ルート | アカウント作成APIのリクエストを受け取り、サービス層へ渡す。 | app/services/user_service.py, fastapi |
| app/routers/menus.py | ルート | 献立一覧取得・作成・生成APIのリクエストを受け取り、サービス層へ渡す。 | app/services/menu_service.py, fastapi |
| app/routers/account.py | ルート | アカウント削除APIのリクエストを受け取り、サービス層へ渡す。 | app/services/menu_service.py, fastapi |
| app/services/user_service.py | サービス | ユーザー登録とトークン発行のビジネスロジックを制御する。 | app/models/ |
| app/services/menu_service.py | サービス | 献立一覧取得、生成、登録、削除のビジネスロジックを制御する。 | app/services/ai_service.py, app/models/ |
| app/services/ai_service.py | サービス | AIによる献立生成処理を行う。 | fastapi |
| app/models/* | モデル | PostgreSQLのテーブルに対応するORMモデルを定義する。 | sqlalchemy |

### 処理別データフロー

#### DF-3: POST /api/v1/users

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | password | バリデーション | app/routers/users.py |
| app/routers/users.py | password | トークン生成 | app/services/user_service.py |
| app/services/user_service.py | user_data | INSERT | users |
| users | token | — | 利用者 |

- データ項目: ユーザー登録リクエスト(password)
- データ項目: ユーザー登録レスポンス(token)

#### DF-4: GET /api/v1/menus

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | token | バリデーション | app/routers/menus.py |
| app/routers/menus.py | token | トークン検証 | users |
| app/routers/menus.py | user_id | SELECT | menus |
| menus | menu_list | — | 利用者 |

- データ項目: 献立一覧リクエスト(token)
- データ項目: 献立一覧レスポンス(id, content, created_at)

#### DF-1: POST /api/v1/menus

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | content, token | バリデーション | app/routers/menus.py |
| app/routers/menus.py | token | トークン検証 | users |
| app/routers/menus.py | content | AI生成または登録処理 | app/services/menu_service.py |
| app/services/menu_service.py | menu_data | INSERT | menus |
| menus | result | — | 利用者 |

- データ項目: 献立リクエスト(content, token)
- データ項目: 献立レスポンス(id, content, created_at)

#### DF-2: DELETE /api/v1/account

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | token | バリデーション | app/routers/account.py |
| app/routers/account.py | token | トークン検証と削除対象特定 | users |
| app/routers/account.py | user_id | 関連献立データの削除 | menus |
| app/routers/account.py | user_id | アカウント削除 | users |
| app/routers/account.py | 204 No Content | — | 利用者 |

- データ項目: 削除リクエスト(token)

## 3.4 例外処理・エラーハンドリング・ログ設計

共通エラーレスポンス形式:
すべてのエラー発生時には、HTTPステータスコードに加え、JSON形式でエラーメッセージを返却する。

```json
{
  "detail": "エラーメッセージの内容"
}
```

例外検知・ログ出力方針:
FastAPIの標準例外ハンドラを使用し、予期せぬエラー（500 Internal Server Error）が発生した場合はサーバーの標準出力にスタックトレースを出力する。認証エラー（401 Unauthorized）やバリデーションエラー（400 Bad Request）は適切なHTTPステータスコードとともにクライアントへ返却する。


# M-01-T02 SQLAlchemyによるORMモデルとPydanticスキーマを定義する

> 種別: 基盤 / マイルストーン: M-01 プロジェクト基盤とデータベース構築 / 要件: FR-006 / 依存: M-01-T01

## 目的

SQLAlchemyによるORMモデルとPydanticスキーマを定義し、データベースのエンティティ構造とAPIの入出力バリデーションの基盤を構築する。

## 対象の処理・参照する設計

- 内部設計書 3.2 データモデル
- 内部設計書 3.3 `backend/app/models/orm.py`
- 内部設計書 3.3 `backend/app/schemas/pydantic.py`

## 作成・変更するファイル(依存順)

| ファイル | 種類 | 責務 | 根拠 |
|---|---|---|---|
| `backend/app/models/orm.py` | モジュール | PostgreSQLのテーブル構造に対応するSQLAlchemyのORMモデルを定義する | 段階4のモジュール |
| `backend/app/schemas/pydantic.py` | モジュール | APIの入出力データを検証するためのPydanticスキーマを定義する | 段階4のモジュール |

## 実装の要点(設計に書いていないことだけ)

- 内部設計書3.2に記載されている4つの主要エンティティ(projects, chat_messages, documents, diagnostics)に対応するORMモデルを実装する。
- backend/app/models/orm.pyを先に作成し、そのデータ構造を参照する形でbackend/app/schemas/pydantic.pyを実装する。

## テスト観点

| # | 観点 | SUT | ドライバ | スタブ |
|---|---|---|---|---|
| TC-01 | 定義したORMモデルを通じてテーブル構造が正しく構築され、Pydanticスキーマによるバリデーションが期待通りに機能すること | backend/app/models/orm.py および backend/app/schemas/pydantic.py | 単体テストまたは対話型シェルによるインポートおよびスキーマ検証 | スタブ不要 ── データベース接続やモジュール単体のインポート確認のため |

- Given データベースモデルとPydanticスキーマが定義されていること
- When モデルおよびスキーマをインポートしてインスタンス化する
- Then 期待される属性と制約を持ったオブジェクトが正しく生成されること

## 確認方法

- Python環境で backend/app/models/orm.py と backend/app/schemas/pydantic.py がエラーなくインポートできることを確認する。

## 未定義・要決定

なし

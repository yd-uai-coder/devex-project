# Phase-2-1: DB移行

## この章の目的

`docs/internal_design.md`が定めるDevexドメインのテーブル(`projects`/`chat_histories`/`generated_documents`/`prompt_templates`/`intake_files`)をSQLAlchemyモデル+Alembicマイグレーションとして実装し、対応するリポジトリ層(CRUD)を用意する。以降の章(2-2〜2-5)が扱う永続化の土台になる。

納期モード([`Phase-2-introduction.md`](./Phase-2-introduction.md)参照)。#14のSUT/ドライバ/スタブの言語化は省略し、テスト観点は簡潔に記す。

サンプルは [`textbook/samples/backend/`](../samples/backend/) に置いた(構成は `devex-api/backend/` と同一パス)。各ファイルは既存の `devex-api/backend/` へ写経すること(devex-api の実ファイルは未変更のまま)。写経後は `docker compose exec backend uv run alembic upgrade head` でマイグレーションを適用する。

## マイグレーションファイルの生成コマンド

`alembic/versions/9c91eca2a657_devex_domain_tables.py`(モデル定義から自動生成した差分マイグレーション)は`alembic revision --autogenerate`で生成した。写経時に自分の手で再生成したい場合、またはPhase 2-1以降で新しいテーブルを追加する際に同じ手順を再現する場合は、以下いずれかのコマンドを使う(生成される内容はどちらも同じ)。

- **Docker環境**(backendコンテナ内で実行。本Phaseで実際に使った方法):
  
  ```bash
  cd devex-api
  docker compose exec backend uv run alembic revision --autogenerate -m "devex domain tables"
  ```
- **ホスト環境**(`devex-api/backend`で`uv run`を直接実行): Phase 1で`docker-compose.yml`に`POSTGRES_PORT`(postgresのホスト公開ポート)を追加済みのため、`backend/.env`(`backend/.env.example`のホスト用テンプレートどおり`DATABASE_URL=...@localhost:5432/...`)を用意していれば、コンテナ内に入らずホスト側から直接実行できる。
  
  ```bash
  # 前提: docker compose up -d postgres redis が起動済み
  cd devex-api/backend
  uv run alembic revision --autogenerate -m "devex domain tables"
  ```

いずれの方法で生成した場合も、適用は`docker compose exec backend uv run alembic upgrade head`(ホスト環境なら`cd devex-api/backend && uv run alembic upgrade head`)で行う。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): テストはまとめて表の末尾に置いている。

| ファイル(`devex-api/backend/`基準)                                                                                                      | 新規/更新 | 写経レベル  | 責務                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------- | ----- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| [`app/core/database.py`](../samples/backend/app/core/database.py)                                                                 | 更新    | 定型     | `PortableJSON`(Postgresでは`JSONB`、SQLite単体テストでは汎用`JSON`として扱う型)を追加。**以下のモデル②⑤がこれに依存するため先頭に置く**                         |
| [`app/models/project.py`](../samples/backend/app/models/project.py)                                                               | 新規    | 定型     | `Project` ORMモデル(`docs/internal_design.md` 3.2節②)                                                                    |
| [`app/models/chat_history.py`](../samples/backend/app/models/chat_history.py)                                                     | 新規    | 定型     | `ChatHistory` ORMモデル(同③)                                                                                             |
| [`app/models/generated_document.py`](../samples/backend/app/models/generated_document.py)                                         | 新規    | 定型     | `GeneratedDocument` ORMモデル(同④)                                                                                       |
| [`app/models/prompt_template.py`](../samples/backend/app/models/prompt_template.py)                                               | 新規    | 定型     | `PromptTemplate` ORMモデル(同⑤、テーブルのみ。Should have機能のためリポジトリは今回作らない)                                                      |
| [`app/models/intake_file.py`](../samples/backend/app/models/intake_file.py)                                                       | 新規    | 定型     | `IntakeFile` ORMモデル(同⑥)                                                                                              |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py)                                                             | 更新    | 定型     | 新規5モデルのre-export追加(既存の3モデルは変更なし)                                                                                     |
| [`alembic/env.py`](../samples/backend/alembic/env.py)                                                                             | 更新    | 定型     | 新規モデルを`Base.metadata`に登録するimportの追加                                                                                  |
| [`alembic/versions/9c91eca2a657_devex_domain_tables.py`](../samples/backend/alembic/versions/9c91eca2a657_devex_domain_tables.py) | 新規    | 定型     | `2b97c8ec8533`を親とする新規マイグレーション(5テーブル+FK索引)<br/>**※マイグレーションファイルの作成は下部に表示**                                             |
| [`app/repositories/project.py`](../samples/backend/app/repositories/project.py)                                                   | 新規    | 定型     | `ProjectRepository`(既存`ConversationRepository`と同型のowner-scoped CRUD。**Phase 2-4で追記あり**)                              |
| [`app/repositories/chat_history.py`](../samples/backend/app/repositories/chat_history.py)                                         | 新規    | 定型     | `ChatHistoryRepository`(`add`/`list_for_project`)                                                                    |
| [`app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py)                             | 新規    | **コア** | `GeneratedDocumentRepository`。`create_version`がバージョニング方針(直近3件保持・4件目で最古削除)を実装する                                       |
| [`app/repositories/intake_file.py`](../samples/backend/app/repositories/intake_file.py)                                           | 新規    | 定型     | `IntakeFileRepository`(`create`/`list_for_project`)                                                                  |
| `pyproject.toml`                                                                                                                  | 更新    | 定型     | `[tool.pyright] ignore`に`app/repositories/project.py`を追加(既存`conversation.py`と同じowner-scoped `get_by_id`のoverrideのため) |
| ── ここからテスト(まとめて末尾) ──                                                                                                             |       |        |                                                                                                                      |
| `tests/unit/test_project_repository.py` 等4本                                                                                       | 新規    | 定型     | 各リポジトリの単体テスト(下記)                                                                                                     |

各ファイル先頭のコメントヘッダー(`# 作成：Phase-N-n` / `# 更新：Phase-N-n`)、および更新箇所の`# Phase-N-n:追記` / `# Phase-N-n：更新`(旧コードをコメントアウトし`↓↓`の下に新コード)タグで、実際の変更履歴を追跡できるようにしている。

## 主要な設計判断

### なぜ`Project.user`に`back_populates`を付けなかったか

既存の`Conversation.user`は`back_populates="conversations"`で`User`側と双方向にしているが、`Project`では`User`側に`projects`を追加していない。`ProjectRepository`は常に`user_id`で直接フィルタしており、`user.projects`という経路の現在の消費者が無いため(CLAUDE.md #17)、既存の`User`モデルには触れなかった。

> Project->Userの片方向のリレーションを定義している
> `user: Mapped["User"] = relationship()`
> ：Project->Userは参照できるけど、User->Projectは参照できない
> 
> 双方向のリレーションを定義する場合はrelationshipの引数`back_populates`を指定する。
> ※双方のモデル側でそれぞれ必要：SQLAlchemyの仕様上のチェックで2モデルの関連を両方からチェックして確実に動作することを保証している

### `PortableJSON`(`app/core/database.py`)

`docs/internal_design.md`は`intake`/`default_environment`をJSONB型と定めているが、単体テストが使うSQLite(`db_session`フィクスチャ)はPostgres専用の`JSONB`型を解釈できない。`sqlalchemy.JSON().with_variant(JSONB(), "postgresql")`という標準的なバリアント型で、Postgres上ではJSONB・それ以外(テスト)では汎用JSONとして振る舞うようにした。`Project`/`PromptTemplate`の両方で使うため`app/core/database.py`に集約した(重複を避ける)。

### `GeneratedDocumentRepository.create_version`のバージョニング/prune

`docs/internal_design.md` 3.2節の方針(「新バージョンを追加、直近3バージョンまで保管、4件目生成時に最古を削除」)をそのままコード化: 追加前に既存バージョンを新しい順に取得し、`(既存件数 - (上限-1))`件だけ末尾(=最古側)を削除する。`MAX_VERSIONS_PER_DOC_TYPE = 3`を定数化し、将来の仕様変更(バージョン数の見直し等)に対応しやすくした。

## テスト観点(納期モード: 「動くこと」の確認)

| ファイル                                    | 確認内容                                                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `test_project_repository.py`            | 所有者スコープの`get_by_id`(他ユーザーのプロジェクトはNone)、`intake`のJSONB往復、`list_for_user`の順序                                           |
| `test_chat_history_repository.py`       | `add`/`list_for_project`の基本動作・順序                                                                                     |
| `test_generated_document_repository.py` | バージョン採番(1から開始・増分)、上書きでなく追加、**4件目生成時に最古(v1)が削除され3件のみ残ること**、doc_type単位で独立、`list_latest_for_project`が各doc_typeの最新のみ返すこと |
| `test_intake_file_repository.py`        | 成功時(`extracted_text`あり)・失敗時(`status='failed'`, `extracted_text`はNone)の両方を永続化できること                                    |

いずれも既存の`db_session`フィクスチャ(SQLite)を使用。`uv run pytest tests/unit/test_project_repository.py tests/unit/test_chat_history_repository.py tests/unit/test_generated_document_repository.py tests/unit/test_intake_file_repository.py`で13件green、`uv run pytest tests/unit`で既存分含め51件green、`uvx pyright`で0エラーを確認済み(このセッション内で検証。写経後は各自の環境で再確認すること)。

マイグレーションは
`docker compose exec backend uv run alembic revision --autogenerate`
で生成し、
`docker compose exec backend uv run alembic upgrade head`
の適用と実テーブル作成(`\dt`で5テーブルの存在)を確認済み。

## 運用上の注意: `alembic stamp`と`upgrade`の取り違え

写経後の実機検証(Phase 3完了後、`POST /api/v1/auth/register`)で、以下の事故が発生した。

- **症状**: `docker compose exec backend uv run alembic current`は`3bacecabb584 (head)`を返す(=マイグレーション済みのはず)のに、`POST /api/v1/auth/register`が`asyncpg.exceptions.UndefinedTableError: relation "users" does not exist`で500エラーになる。
- **原因**: [上記「マイグレーションファイルの生成コマンド」](#マイグレーションファイルの生成コマンド)にある正しい手順は`alembic revision --autogenerate`(差分マイグレーション生成)→`alembic upgrade head`(DDLを実行してテーブルを作成しつつバージョンを進める)の順だが、`alembic upgrade head`の代わりに`alembic stamp head`(DDLは実行せず、バージョン記録だけをheadへ書き換える操作)を実行してしまうと、「マイグレーション済み」という記録だけが進み、実テーブルは1つも作られない。`alembic current`は記録を見るだけなので`head`と表示され、一見正常に見えてしまう。
- **診断方法**: `docker compose exec postgres psql -U devex-user -d devex-app-db -c "\dt"`で実テーブルの一覧を確認する。`alembic_version`だけが存在し`users`等が無ければ、上記の取り違えが起きている。
- **復旧コマンド**(DBにまだ重要なデータが無い前提。本事例はアカウント登録初回失敗直後だったため該当):
  ```bash
  docker compose exec backend uv run alembic stamp base
  docker compose exec backend uv run alembic upgrade head
  ```
  `stamp base`でバージョン記録を「未適用」にリセットしてから`upgrade head`を実行することで、全マイグレーションの`upgrade()`が実際に走り、テーブルが作成される。

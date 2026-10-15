# Phase-59-1: スキーマの単位を置かせる(段階4・段階7 の指示)

## この章の目的

詳細設計モードの実装手順書で、どの単位もテーブルを作らない(`NO_SCHEMA_UNIT`。最重要)が、新しい生成でも出続けている([58-3](../Phase-58/Phase-58-3.md))。Phase 58 の完了後に、ユーザーは「段階7 の計画の生成で、スキーマを作る単位を置かせる」と決めた。着手時の調査で、段階7 だけでは置けないことが分かった。段階7 は「一覧に無いパスは書かない」決まりで、段階4 のモジュール一覧にはモデルの行が無いためである。そこで段階4 と段階7 の両方の指示を直す(着手時の相談の決定)。

自動実装モード: on([introduction](./Phase-59-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/detailed_design/structure_drafting.py`](../samples/backend/app/detailed_design/structure_drafting.py) | 更新 | 構成図にモデルのパッケージ、モジュール一覧にモデルのファイルを置かせる |
| [`app/detailed_design/plan_drafting.py`](../samples/backend/app/detailed_design/plan_drafting.py) | 更新 | テーブルを作るタスクを最初のマイルストーンに置かせる |
| [`tests/unit/test_structure_drafting.py`](../samples/backend/tests/unit/test_structure_drafting.py) | 更新 | 規則の文言 |
| [`tests/unit/test_plan_drafting.py`](../samples/backend/tests/unit/test_plan_drafting.py) | 更新 | 規則の文言 |
| [`tests/unit/test_procedure_coverage.py`](../samples/backend/tests/unit/test_procedure_coverage.py) | 更新 | マイグレーションが `config_files` だけでもテーブルを作るとみなす |

## 1. 段階4 の指示(`app/detailed_design/structure_drafting.py`)

責務: 段階4(構成図とモジュール一覧)の下書きの入力と指示を組み立てる(純粋関数。Phase 19)。

```python
# app/detailed_design/structure_drafting.py(COMPONENT_SYSTEM_PROMPT の抜粋)
"- 設定・ログ・入出力の型のように、ほぼ全層から使う定型のパッケージは省く。ただし"
"【テーブル】があれば、テーブルを定義するモデル(ORM)のパッケージ"
"(例: モデル(models))はリポジトリと同じ層に置く\n"
# MODULE_SYSTEM_PROMPT の抜粋
"- リポジトリとは別に、【テーブル】のテーブルを定義するモデル(ORM)のファイルを、"
"モデルのパッケージの下に置く(例: app/models/user.py。…)。layer はリポジトリと同じにし、"
"責務にはテーブルの名前を書く\n"
```

- 非自明な判断: **構成図の指示にもモデルのパッケージを足した**。最初はモジュール一覧の指示だけに1行足したが、実際の生成([59-6](./Phase-59-6.md))ではモデルの行が入らず、リポジトリの責務にテーブル名が書かれただけだった。モジュール一覧の規則に「path は構成図のパッケージの下のファイル」があり、構成図は「定型のパッケージは省く」ので、モデルのパッケージがそもそも無かった。規則の間で食い違うときは、上流(構成図)から直す。
- 「リポジトリとは別に」を明記した。1回目は、リポジトリの責務に `users テーブル` と書くことで指示を満たしたと読まれた。
- 責務にテーブル名を書かせるのは、Phase 55 の `table_coverage` が、スキーマのファイルのパスと責務に出るテーブル名で網羅を見るため。

## 2. 段階7 の指示(`app/detailed_design/plan_drafting.py`)

責務: 段階7(横断事項と実装計画)の下書きの入力と指示を組み立てる(純粋関数。Phase 23)。

```python
# app/detailed_design/plan_drafting.py(PLAN_SYSTEM_PROMPT の抜粋)
"- 詳細設計書のテーブルを作るタスク(モデルとマイグレーション)を、最初のマイルストーンに"
"置く(kind=base にするか、そのテーブルを最初に使う機能のタスクに含める)。モデルのファイルは"
"【モジュールのパスの一覧】にあれば modules に、マイグレーションのファイル"
"(例: alembic/versions/)は config_files に書く\n"
```

- 非自明な判断: マイグレーションのファイルは `config_files`(環境・設定のファイルの例。検証しない)に書かせる。段階4 のモジュール一覧に無いパスは `modules` に書けないので、モデルの行が無い以前の段階4 でも、スキーマの単位を置けるようにするため。`unit_files` は `config_files` も単位が作るファイルに数え、`is_schema_path` は `alembic`・`migrations` を見るので、Phase 55 の判定は変えずに `NO_SCHEMA_UNIT` が消える。
- 「最初のマイルストーン」にしたのは、テーブルは後の機能の単位がみな使うため(後に置くと `DEPENDENCY_BUILT_LATER` の形になる)。

## テスト観点

用語(SUT / ドライバ / スタブ)は [Phase 52](../Phase-52/Phase-52-introduction.md) と同じ。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_module_prompt_places_table_models_with_repositories`(新規) | `MODULE_SYSTEM_PROMPT`・`COMPONENT_SYSTEM_PROMPT` | pytest | スタブ不要 ── 定数の中身を確かめるだけ。モデルのファイル(リポジトリとは別・責務にテーブル名)とモデルのパッケージの規則があること |
| `test_plan_prompt_places_schema_task_in_first_milestone`(新規) | `PLAN_SYSTEM_PROMPT` | pytest | スタブ不要 ── 定数の中身。テーブルを作るタスク・マイグレーションは `config_files` |
| `test_migration_only_in_plan_config_files_covers_every_table`(新規) | `unit_files`・`table_coverage` | pytest | スタブ不要 ── 純粋関数。段階7 の `config_files` に `alembic/versions/` だけがある単位で、テーブルが「作る単位なし」にならない(この章の指示が Phase 55 の判定と噛み合うことの番人) |

- 指示の文言のテストは、文言を消したときに気づくための番人。効果(モデルの行・スキーマの単位・`NO_SCHEMA_UNIT` 0件)は [59-6](./Phase-59-6.md) の実際の生成で確かめた。
- 更新した2つの本体のファイルは、それぞれのテストが import している(#15)。import 文は変えていない。

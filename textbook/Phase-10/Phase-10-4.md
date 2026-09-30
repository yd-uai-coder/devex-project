# Phase-10-4: 永続化と検証の改訂

## この章の目的

AI 生成のために3つの列を `uml_diagrams` に追加する。図を識別するキー(`subject`)、AI に渡した対象の選択(`scope`)、生成の状態(`generation_status`/`generation_error`)である。あわせて、生成リクエストの履歴テーブル `uml_generation_runs` を新設する。さらに、DFD をフラット構成(処理ごとに1枚)に確定したことを受けて、Phase 8 の DFD 検証を改訂する(#12)。境界フロー一致規則は撤回し、未参照データ項目の判定は全 DFD を横断するようにする。

学習モード([introduction](./Phase-10-introduction.md)参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/models/uml_generation_run.py`](../samples/backend/app/models/uml_generation_run.py) | 新規 | 定型 | `UmlGenerationRun`(`requested`・`status`・`results`・`started_at`/`finished_at`) |
| [`app/models/uml_diagram.py`](../samples/backend/app/models/uml_diagram.py) | 更新 | **コア** | `subject`・`scope`・`generation_status`・`generation_error` と `UNIQUE(project_id, notation, subject)` を追加する |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | 定型 | `uml_generation_runs` リレーション(cascade)を追加する |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | 定型 | `UmlGenerationRun` を re-export する(alembic 用) |
| [`alembic/versions/b7c8d9e0f1a2_add_uml_generation.py`](../samples/backend/alembic/versions/b7c8d9e0f1a2_add_uml_generation.py) | 新規 | 定型 | 列の追加、Phase 8〜9 の重複行の削除、一意制約、履歴テーブルの作成 |
| [`app/repositories/uml_diagram.py`](../samples/backend/app/repositories/uml_diagram.py) | 更新 | 定型 | `create` に subject/scope/generation_status を追加。`list_by_notation`・`get_by_subject`・`has_generating` を追加 |
| [`app/repositories/uml_generation_run.py`](../samples/backend/app/repositories/uml_generation_run.py) | 新規 | 定型 | `create`・`get_by_id`(project スコープ)・`list_recent` |
| [`app/uml/validation/dfd_rules.py`](../samples/backend/app/uml/validation/dfd_rules.py) | 更新 | **コア** | `referenced_elsewhere` 引数で未参照判定を横断化する。境界フロー規則は撤回の blockquote で記録する |
| [`app/uml/validation/__init__.py`](../samples/backend/app/uml/validation/__init__.py) | 更新 | 定型 | `validate_diagram` に `referenced_elsewhere` を通す |
| [`pyproject.toml`](../samples/backend/pyproject.toml) | 更新 | 定型 | pyright の ignore に `uml_generation_run.py` を追加する(project スコープの `get_by_id` override。既存リポジトリと同じ割り切り) |
| ── ここからテスト ── | | | |
| [`tests/fixtures/uml.py`](../samples/backend/tests/fixtures/uml.py) | 更新 | 定型 | 本章の担当分として、`create_project`・`create_project_with_internal_design`・`create_empty_diagram` を追加する |
| [`tests/unit/test_uml_diagram_repository.py`](../samples/backend/tests/unit/test_uml_diagram_repository.py) | 更新 | 定型 | `get_by_subject`・`has_generating`・`list_by_notation` |
| [`tests/unit/test_uml_generation_run_repository.py`](../samples/backend/tests/unit/test_uml_generation_run_repository.py) | 新規 | 定型 | 'running' での作成、project スコープ、件数の制限 |
| [`tests/unit/test_uml_validation.py`](../samples/backend/tests/unit/test_uml_validation.py) | 更新 | **コア** | 他の DFD が参照している項目は警告しないこと |

## 要点の抜粋

```python
# app/models/uml_diagram.py
__table_args__ = (UniqueConstraint("project_id", "notation", "subject",
                                   name="uq_uml_diagrams_project_notation_subject"),)
subject: Mapped[str]            # component: ''、ER: '' または部分図のグループ名、DFD: 処理名
scope: Mapped[dict | None]      # ER 部分図の {"tables": [...]}
generation_status: Mapped[str]  # 'generating'/'completed'/'failed'(既定 'completed')
generation_error: Mapped[str | None]
```

```python
# app/uml/validation/dfd_rules.py
def validate_dfd_rules(elements, flows, data_item_ids,
                       referenced_elsewhere: set[uuid.UUID] | frozenset[uuid.UUID] = frozenset()):
    ...
    referenced_item_ids = {flow.data_item_id for flow in flows} | set(referenced_elsewhere)
```

> **[Phase 10 で確定 ── 境界フロー一致規則は実装しない]** 当初、診断8の5点目「上位図と下位図の境界フローが一致する」を Phase 10 で実装する予定だった → 撤回。理由: DFD を処理ごとに1枚のフラットな構成に確定し、上位図・下位図の階層を持たないため、判定の対象が無い(samples の `dfd_rules.py` にも同じ blockquote を記録)。

## 設計判断

### なぜ生成の状態を `status` と別の列にしたか

`status`(draft → reviewing → approved → exported)は、人がレビューするライフサイクルを表す(M7)。生成中か、失敗したかは、それとは独立した軸になる。たとえば「approved の図を再生成して失敗した」場合、再生成は上書きなので、成功すれば draft に戻る。一方、失敗したときは前回の内容と状態を残したい。1つの列に混ぜると、この組み合わせを表せない。appendix の中程度の診断「状態が2軸になる」の考え方を、もう1軸に広げた形である。

### なぜ `subject` を NOT NULL DEFAULT '' にしたか

component と ER の全体図は、1プロジェクトに1枚になる。これを一意制約で保証したい。NULL を許すと、PostgreSQL の一意制約は NULL 同士を別物として扱うので、全体図が何枚でも作れてしまう。空文字列を「全体」の意味で使えば、PostgreSQL(本番)でも SQLite(ユニットテスト)でも同じ制約が効く。

### マイグレーションで重複行を消す理由

Phase 8〜9 のプレースホルダー(`POST /diagrams`)は、同じ記法の空の図を何枚でも作れた。一意制約を張る前に、`(project_id, notation)` ごとに最新の1枚だけを残す。開発用 DB で確認したところ `uml_diagrams` は0件で、実際に消える行は無かった(本 Phase の動作確認)。

### なぜ未参照データ項目の判定を全 DFD の横断にしたか(ユーザー確定事項3)

データ辞書はプロジェクト共通である。処理ごとに1枚の構成では、ある DFD が参照しない項目の大半は、他の DFD が参照している。図の単位で判定すると、ほぼすべての項目で警告が出てしまう。サービス層(10-5)が「他の DFD が参照している項目の集合」を集め、検証関数は引数で受け取る。こうすれば検証関数は純粋なまま保てる。

### なぜ履歴を別テーブルにしたか(ユーザー確定事項6)

図の `generation_error` が持てるのは「最新の状態」だけである。一括生成の途中でクォータ超過で止まったとき、どれが生成されたか、どれがどの理由で失敗したか、どれが未着手(skipped)のまま残ったかは、リクエスト単位でしか表せない。`results` は JSON に `{subject, diagram_id, outcome, reason_code, message}` の並びを持つ。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `UmlDiagramRepository` の追加メソッド・`UmlGenerationRunRepository` | pytest(インメモリ SQLite `db_session`) | スタブ不要。DB アクセスそのものが検証対象で、外部呼び出しが無いため | 共有フィクスチャ `create_project` を使う |
| `validate_dfd_rules`・`validate_diagram` | pytest | スタブ不要。純粋関数のため | 他の DFD が参照していれば警告しないこと |

マイグレーション自体はユニットテストの対象外とする(ユニットテストは `Base.metadata.create_all` でテーブルを作るため)。PostgreSQL での `upgrade`→`downgrade -1`→`upgrade` の往復を、動作確認で別途行った(10-6 の動作確認を参照)。

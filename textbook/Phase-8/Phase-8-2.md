# Phase-8-2: 永続化層(`data_items`・`uml_diagrams`)

## この章の目的

Phase-8-1の意味モデルを永続化するためのORMモデル・alembicマイグレーション・リポジトリを実装する。`data_items`(データ辞書、M2b)と`uml_diagrams`(UML図本体、M3)の2テーブルを新設し、既存の`CRUDRepository[ModelType]`・所有権スコープの`get_by_id`パターン(`ProjectRepository`と同じ考え方)を踏襲する。

学習モード([introduction](./Phase-8-introduction.md)参照)。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30)。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/models/data_item.py`](../samples/backend/app/models/data_item.py) | 新規 | **コア** | `DataItem`ORMモデル(`UniqueConstraint(project_id, name)`) |
| [`app/models/uml_diagram.py`](../samples/backend/app/models/uml_diagram.py) | 新規 | **コア** | `UmlDiagram`ORMモデル(`docs/internal_design.md` 3.2節⑦どおり。階層列は持たない) |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | 定型 | `data_items`/`uml_diagrams`の`relationship`(`cascade="all, delete-orphan"`)を追加 |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | 定型 | `DataItem`/`UmlDiagram`を`__all__`に追加(alembicのmetadata登録用) |
| [`alembic/versions/f1a2b3c4d5e6_add_uml_pipeline_tables.py`](../samples/backend/alembic/versions/f1a2b3c4d5e6_add_uml_pipeline_tables.py) | 新規 | 定型 | `data_items`・`uml_diagrams`の`op.create_table`(既存の`3bacecabb584_devex_domain_tables.py`と同じ「複数テーブルを1マイグレーションにまとめる」パターン) |
| [`alembic/env.py`](../samples/backend/alembic/env.py) | 更新 | 定型 | `DataItem`/`UmlDiagram`のimportを追加(このimportが無いとautogenerateがテーブルを見落とす) |
| [`app/repositories/data_item.py`](../samples/backend/app/repositories/data_item.py) | 新規 | **コア** | `DataItemRepository`(`get_by_id(item_id, *, project_id)`という所有権スコープのoverride) |
| [`app/repositories/uml_diagram.py`](../samples/backend/app/repositories/uml_diagram.py) | 新規 | **コア** | `UmlDiagramRepository`(同上のoverride、純粋な永続化操作のみ) |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | `UmlDiagramNotFoundError`/`DataItemNotFoundError`(404)・`UmlDiagramVersionConflictError`/`DataItemNameConflictError`(409)を追加 |
| ── ここからテスト ── | | | |
| [`tests/unit/test_data_item_repository.py`](../samples/backend/tests/unit/test_data_item_repository.py) | 新規 | **コア** | 永続化・所有権スコープの境界値(他プロジェクトの項目は取得不可) |
| [`tests/unit/test_uml_diagram_repository.py`](../samples/backend/tests/unit/test_uml_diagram_repository.py) | 新規 | **コア** | 永続化(status/versionの既定値)・所有権スコープ・一覧の並び順 |

## 設計判断

### なぜ`DataItem`を専用テーブルにしたか(このセッションでの確定事項)

`docs/internal_design.md`は「永続化の実体(専用テーブルかプロジェクト単位のJSONBか)はPhase 8で確定する」と明示していた。専用テーブルを選んだ理由: (1) 項目単位のCRUD・一意性制約(`UniqueConstraint(project_id, name)`)をDBレベルで素直に表現できる、(2) 診断8の「どこからも参照されないデータ項目がない」検証がプロジェクト全件を一覧できる必要があり、JSONB1行に全項目を詰め込むより個別行の方が扱いやすい、(3) 既存の`intake_files`/`prompt_templates`等、他のエンティティも専用テーブルであり、この方が既存パターンと一貫する。

### なぜ楽観ロックを`UmlDiagram.version`という新規パターンとして実装するか(既存パターンとの違い)

既存コードベースに`version`という名前のカラムは`generated_documents.version`が唯一の前例だが、これは「再生成のたびに増える追記型の版数」であり、書き込み競合の検知には使われていない(SQLAlchemyの`version_id_col`機構も未使用)。`uml_diagrams.version`はPUT時にクライアントが最後に取得した値を送り返し、DB上の現在値と一致しない場合は更新を拒否する、という別の意味を持つ。命名の衝突を避けるためモデル定義のコメントで明示的に区別を書いた(`app/models/uml_diagram.py`のdocstring参照)。実際の不一致検知ロジックはPhase-8-3の`UmlDiagramService.update`が担う(リポジトリ層は永続化のみで、競合判定はビジネスロジックとしてサービス層に置く、という`devex-api/CLAUDE.md`のレイヤー方針どおり)。

### なぜ`DataItem`/`UmlDiagram`の`project`リレーションに`back_populates`を付けたか

`ProjectRepository`が参照する`Project.user`は`back_populates`無しの片方向だが、`chat_histories`/`generated_documents`/`intake_files`のように`cascade="all, delete-orphan"`を伴う子エンティティは`back_populates`付きの双方向にする、という既存の使い分けがある(`Project`削除時に子を確実にカスケード削除するための対応)。`data_items`/`uml_diagrams`も同じくプロジェクト削除に追従して消えるべきエンティティのため、この双方向パターンに合わせた。

### 動作確認で見つかった落とし穴(2点)

実装後にsamples反映・`devex-api`本体での検証を行った際、以下2点のテスト設計上のバグが見つかり、その場で修正した(教材として記録する価値があるため残す)。

1. **`db_session`フィクスチャはテスト単位で独立**だが、**1つのテスト関数内で`_create_project`ヘルパーを2回呼ぶ**(「自分のプロジェクト」「他人のプロジェクト」の両方を用意するテストパターン)場合、両方が同じ固定メールアドレス(`owner@example.com`)でユーザーを作ろうとして`users.email`の一意制約に違反する。修正: `_create_project`のメールアドレスを`f"owner-{uuid.uuid4()}@example.com"`のように呼び出しごとに一意化した。
2. **SQLiteの`func.now()`は秒単位の解像度**のため、`test_list_for_project_orders_by_updated_at_desc`のように同一テスト内で連続して2件作成すると、両方の`updated_at`が同一値になり得て`ORDER BY updated_at DESC`の並び順が不定になる。修正: 2件目を作成した後、`first.updated_at`/`second.updated_at`を明示的にずらして`flush`し直すことで、テストの意図(降順ソート)を保証しつつ解像度の問題を回避した。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DataItemRepository.create`/`get_by_id`/`list_for_project`/`find_by_name` | pytest(直接呼び出し、インメモリSQLite `db_session`) | スタブ不要 ── DBアクセスのみで外部呼び出しを含まないため | `test_data_item_repository.py` |
| `UmlDiagramRepository.create`/`get_by_id`/`list_for_project` | pytest(直接呼び出し、インメモリSQLite `db_session`) | スタブ不要 ── 同上 | `test_uml_diagram_repository.py`。作成直後の`status`/`version`既定値、一覧の`updated_at`降順を確認 |

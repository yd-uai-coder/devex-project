# Phase-43-1: 承認時の写し

## この章の目的

「何が変わったか」を要素の単位で取るために、段階を承認したときの model の写しを残す。[41-2](../Phase-41/Phase-41-2.md) 決定2(承認時の写しと比べる)・決定9(写しは直前の承認の1件だけ)の土台。あわせて、印を残す列も足す(中身は 43-3)。

自動実装モード: on([introduction](./Phase-43-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`alembic/versions/e5f6a7b8c9d1_add_stage_snapshot.py`](../samples/backend/alembic/versions/e5f6a7b8c9d1_add_stage_snapshot.py) | 新規 | 列 `approved_model`・`impact` を足し、承認の後に変わっていない行に写しを入れる(`snapshot_of`) |
| [`app/models/design_stage.py`](../samples/backend/app/models/design_stage.py) | 更新 | `approved_model`・`impact` の列 |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `approve` で今の model を写しにする(43-3 で段階3に ER を添える形に更新) |
| ── ここからテスト ── | | |
| [`tests/unit/test_stage_snapshot_migration.py`](../samples/backend/tests/unit/test_stage_snapshot_migration.py) | 新規 | 移行の変換・承認で写しを撮り、編集では変えない |

## 要点の抜粋

### 1. 列

```python
# app/models/design_stage.py
approved_model: Mapped[dict | None] = mapped_column(PortableJSON, nullable=True)
impact: Mapped[dict | None] = mapped_column(PortableJSON, nullable=True)
```

- `approved_model` は直前に承認したときの `model` の写し(1件だけ)。次に承認するとき、写しと今の `model` を比べる。
- `impact` は、届いた見直しの印(`{"changes": [...], "marks": [...]}`。形は 43-3)。

### 2. 承認で写しを撮る

```python
# app/services/design_stage_service.py(approve。43-1 の形)
row.status = "approved"
row.approved_version = row.version
row.approved_model = row.model
```

編集(`save`)では写しを変えない。写しが「前に承認した内容」として残るので、次の承認で差分が取れる。

### 3. 既存データの移行

```python
# alembic/versions/e5f6a7b8c9d1_add_stage_snapshot.py
def snapshot_of(status, model, version, approved_version) -> dict | None:
    """行の写し。承認済みで、承認の後に変わっていない行だけが今の model を写しにする。"""
```

承認の後に編集した行(`reviewing` など)は、承認したときの内容が DB に残っていないので写しを持たない。その段階の次の承認では差分を取らず、今までどおり段階の「古い」だけで扱う。移行は app を import しない([42-1](../Phase-42/Phase-42-1.md) の移行と同じ考え方)。

## 設計判断

### 写しは列、別テーブルにしない

決定9で写しは1件だけなので、段階の行の列で足りる。履歴の一覧を作らないので、別テーブルにする理由が無い。

### 写しを撮るのは承認時だけ

生成時にも撮ると、AI の下書きと人の承認の境目がぼやける。比べたいのは「前に人が承認した内容」と「今承認しようとする内容」なので、承認時だけにした。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `snapshot_of`(移行) | pytest(`test_stage_snapshot_migration.py`。移行ファイルを importlib で読む) | スタブ不要 ── 変換は純粋関数で DB を呼ばないため | 承認済みで未編集の行だけ写す・編集済み・下書き・内容の無い行は写さない |
| `approve` の写し・列 | 同上 | インメモリ SQLite(`db_session`)を本物のリポジトリで使う。LLM は呼ばない | 承認で写しが入り、その後の編集では写しが変わらない・`impact` は空 |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_stage_snapshot_migration.py
```

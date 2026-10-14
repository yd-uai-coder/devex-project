# Phase-52-3: レビューの回と指摘の保存

## この章の目的

レビューの結果を、文書の版に結んで保存する。レビューの回(`review_runs`)と指摘(`review_findings`)の表と、ユーザーのレビューの設定(`users.review_enabled`)を足す。指摘の採否(`decision`)の列はここで用意し、画面から付けるのは [Phase 53](../Phase-51/Phase-51-5.md)。

自動実装モード: on([introduction](./Phase-52-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/models/user.py`](../samples/backend/app/models/user.py) | 更新 | `review_enabled`(初期値オフ)。テンプレート由来で、この Phase で初めて samples に載せた |
| [`app/models/review.py`](../samples/backend/app/models/review.py) | 新規 | `ReviewRun`・`ReviewFinding` |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | `review_runs` の関連(プロジェクトを消すと回と指摘も消える) |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | alembic に読ませるモデルに2つを足す |
| [`alembic/versions/f6a7b8c9d0e1_add_design_reviews.py`](../samples/backend/alembic/versions/f6a7b8c9d0e1_add_design_reviews.py) | 新規 | 2つの表・索引と、users の列 |
| [`app/repositories/review.py`](../samples/backend/app/repositories/review.py) | 新規 | `ReviewRunRepository`(回を作る・区切りの最新・実行中・終える) |
| ── ここからテスト ── | | |
| [`tests/unit/test_review_repository.py`](../samples/backend/tests/unit/test_review_repository.py) | 新規 | 上の永続化のテスト |

## 要点の抜粋

### 1. 回と指摘

```python
# app/models/review.py
class ReviewRun(Base):
    gate: str             # 'documents'(段階6・7 は後で足す)
    targets: dict         # {doc_type: version}
    trigger: str          # 'auto' / 'manual'
    model: str
    status: str           # 'running' / 'succeeded' / 'failed'
    error_code: str | None
    input_tokens / output_tokens / cache_read_tokens / cache_creation_tokens
    started_at / finished_at
    findings: list[ReviewFinding]   # position の順

class ReviewFinding(Base):
    position, level, cause, targets, point_key, problem, evidence, reason, suggestion
    decision: str         # 'pending'(既定) / 'adopted' / 'rejected' / 'held'
```

### 2. リポジトリ

```python
# app/repositories/review.py
class ReviewRunRepository(CRUDRepository[ReviewRun]):
    async def create_run(self, *, project_id, gate, targets, trigger, model, status="running") -> ReviewRun
    async def get_latest(self, *, project_id, gate) -> ReviewRun | None
    async def list_running(self, project_id) -> list[ReviewRun]
    async def finish(self, run, *, status, error_code=None, usage=None, findings=()) -> ReviewRun
```

- `finish` は指摘を重要度の順(`sort_findings`)に `position` を振って保存し、`usage_metadata` の `input_token_details` からキャッシュの読み書きのトークンも記録する(プロンプトキャッシュを入れるかの判断材料。着手時の決定)。
- `create_run` は始めた時刻をアプリで入れる。SQLite の `now()` は秒の単位で、同じ秒に作った回の新しい順が決まらないため。
- `_default_options` で指摘を `selectinload` する(非同期では関連を暗黙に読めない)。

## 設計判断

### 版は外部キーで結ばず、版の番号で持つ

文書は直近3版しか残らない(`generated_documents` の4版目で最古を消す)。文書の行に外部キーで結ぶと、古い版と一緒にレビューも消える。`targets` に `{doc_type: version}` を持ち、表示中の版と比べて「今の文書のレビューか」を判定する([52-5](./Phase-52-5.md) の `is_current`)。

### 設定は users の列

着手時の決定。設定は今のところ1つだけで、別の表にする理由が無い。実効値はこの列と `is_superuser` からサーバーで決める([52-1](./Phase-52-1.md) `review_effective`)。

### 失敗した回も残す

失敗の理由(`error_code`)と「もう一度レビュー」の目印になる。未レビューの判定([Phase 53](../Phase-51/Phase-51-5.md))は「成功した回が今の版に無い」で見る。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ReviewRunRepository`・モデル | pytest(`test_review_repository.py`、`db_session` fixture) | スタブ不要 ── インメモリの SQLite に書いて読み直す | ユーザーの設定の初期値がオフ・指摘が重要度の順で `position` が振られる・トークン数・最新の回と実行中・プロジェクトを消すと回と指摘も消える |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_review_repository.py
```

マイグレーションは dev の DB で `upgrade head` → `downgrade -1` → `upgrade head` と `alembic check`(差分なし)を確かめた。

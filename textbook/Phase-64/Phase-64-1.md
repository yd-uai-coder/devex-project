# Phase-64-1: 削除の API(削除の印・物理削除)

## この章の目的

`DELETE /projects/{id}` を作る。生成中でも削除できるようにするため、削除の要求は**削除の印(`projects.deleted_at`)を付けるだけ**ですぐに返す。そのうえで、印の付いた行を取得と一覧から外す。行と子の行の物理削除は、ほかの処理のロックが空いたときにバックグラウンドで行う。バックグラウンドの処理の側の備えは [64-2](./Phase-64-2.md) で作る。

自動実装モード: on([introduction](./Phase-64-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`alembic/versions/8d4f1a2b6c3e_add_deleted_at_to_projects.py`](../samples/backend/alembic/versions/8d4f1a2b6c3e_add_deleted_at_to_projects.py) | 新規 | `projects.deleted_at` を足す |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | `deleted_at: Mapped[datetime \| None]` |
| [`app/repositories/project.py`](../samples/backend/app/repositories/project.py) | 更新 | 取得・一覧から印の付いた行を外す・`mark_deleted`・`is_live`・`purge_deleted` |
| [`app/services/project_deletion.py`](../samples/backend/app/services/project_deletion.py) | 新規 | `VANISHED_ERRORS`・`project_vanished`・`purge_deleted`・`purge_deleted_projects` |
| [`app/services/project.py`](../samples/backend/app/services/project.py) | 更新 | `ProjectService.delete`(印を付けて commit、進み具合の鍵を消す) |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | `DELETE /{project_id}`(204、BackgroundTask で物理削除) |
| [`tests/unit/test_project_delete.py`](../samples/backend/tests/unit/test_project_delete.py) | 新規 | 印・取得から外す・ルート・物理削除(SQLite) |
| [`tests/integration/test_project_delete_flow.py`](../samples/backend/tests/integration/test_project_delete_flow.py) | 新規 | CASCADE とロック(PostgreSQL) |

## 1. なぜ印を付けるのか

物理的に `DELETE FROM projects` を流すと、生成中のジョブとロックがぶつかる。

- 文書の生成は、1つ目の文書の版を `create_version`(INSERT と flush)で書いた後も、同じトランザクションのまま2つ目以降の LLM を呼ぶ。段階2〜4の生成(DFD・ER・構成図を書いてから次の LLM)と「直ったか」の判定(1件ずつ記録してから次の LLM)も同じ形になる。
- Postgres は、子の行を INSERT したトランザクションに、親の行(`projects`)の **FOR KEY SHARE** のロックを持たせる(参照先が消えないことを保つため)。`DELETE` が要る FOR UPDATE のロックは、これとぶつかる。
- そのため、削除の要求はジョブが commit するまで(数分)待たされる。画面は「削除中...」のままになり、プロキシのタイムアウトに当たるおそれもある。

キーでない列の UPDATE が要るのは **FOR NO KEY UPDATE** のロックで、これは FOR KEY SHARE とぶつからない。そこで削除の要求では印の列だけを更新し、行を消すのは後に回す(着手時の相談で決定。ほかの案は、`lock_timeout` で待ちきれなければ 409 で断る案と、物理削除で待つ案だった)。

## 2. 印の列(マイグレーション・モデル)

```python
# app/models/project.py
deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

- マイグレーションは `op.add_column` 1つで、既存の行は null(削除していない)になる。downgrade では列を落とす。
- 印を付けると `onupdate` で `updated_at` も変わる。取得から外すので、問題は無い。

## 3. 取得から外す・印を付ける・物理削除(`ProjectRepository`)

責務(変更点): 印の付いた行を見えなくし、印と物理削除の SQL を持つ。

```python
# app/repositories/project.py
async def get_by_id(self, project_id, *, user_id) -> Project | None:
    return await self.find_one(id=project_id, user_id=user_id, deleted_at=None)

async def purge_deleted(self) -> int:
    stmt = select(Project.id).where(Project.deleted_at.is_not(None)).with_for_update(skip_locked=True)
    ids = list((await self._session.execute(stmt)).scalars())
    if ids:
        await self._session.execute(delete(Project).where(Project.id.in_(ids)))
    return len(ids)
```

- **`get_by_id` に条件を足すだけで、`/projects/{id}/...` のすべてが404になる**。依存関数 `get_current_project`(`CurrentProjectDep`)がこれを通るため。生成の進み具合のポーリング・生成の要求・段階の保存も、削除した後は404になる。`filter_by(deleted_at=None)` は `IS NULL` になる。
- `is_live` は、identity map に頼らずに `SELECT id ... WHERE deleted_at IS NULL` を投げる。`session.get(Project, id)` は、同じセッションで一度読んだ行を問い合わせずに返すので、別のリクエストで印が付いたことに気づけない。バックグラウンドの処理が消失を確かめるとき([64-2](./Phase-64-2.md))に使う。
- `purge_deleted` は、印の付いた行のうち、**ロックの取れる行だけ**(`SKIP LOCKED`)を消す。生成中のジョブが親の行に FOR KEY SHARE を持つ行は飛ばす。子・孫の行は DB の CASCADE で消える(core の `delete` を使う。ORM の `session.delete` は子の行を全部読み込んで1行ずつ消すので遅い)。
- repository の規則どおり、commit はしない(サービスで行う)。

## 4. 物理削除の部品(`project_deletion.py`)

責務: 物理削除を、ほかの処理を長く止めない形で行う。プロジェクトが消えたかを見分ける部品も置く([64-2](./Phase-64-2.md) で `commit_if_live` を足す)。

```python
# app/services/project_deletion.py
VANISHED_ERRORS = (IntegrityError, StaleDataError)

async def purge_deleted(session) -> int:
    try:
        if session.get_bind().dialect.name == "postgresql":
            await session.execute(text("SET LOCAL lock_timeout = '3s'"))
        count = await ProjectRepository(session).purge_deleted()
        await session.commit()
    except DBAPIError:
        await session.rollback()
        return 0  # 印は残り、次の機会に消える
    return count
```

- **`lock_timeout` が要る理由**: `SKIP LOCKED` で飛ばせるのは親の行のロックだけになる。段階2の生成は、既存の UML 図の行を UPDATE して持ったまま次の LLM を呼ぶ(子の行のロック。親の行はロックしない)。このとき CASCADE の削除は、子の行のロックで待つ。3秒で諦めて rollback し、次の機会に回す。
- `purge_deleted_projects()` は、自前でセッションを開く入口で、失敗してもログだけにする。呼ぶ時機は、DELETE の BackgroundTask と、バックグラウンドの4つの入口の終わり([64-2](./Phase-64-2.md))の2つ。ジョブが終われば、そのジョブのロックは空く。
- **消し残った行は害にならない**: 印があるので画面にも API にも出ない。次に何かのジョブが終わるか、誰かが削除したときに消える。
- `project_vanished(session, project_id, *, job)` は、`is_live` が偽のときにログ(`project_deleted_during_job`、info)を残して真を返す。
- `VANISHED_ERRORS` は、物理削除の後に書き込んだときの例外(子の行の外部キーの違反・行の無い UPDATE)。[64-2](./Phase-64-2.md) が使う。

## 5. サービスとルート(`ProjectService.delete`・`DELETE /{project_id}`)

```python
# app/services/project.py
async def delete(self, project: Project, *, redis: Redis | None = None) -> None:
    await self._projects.mark_deleted(project)
    await self._session.commit()
    await GenerationProgressStore(redis).clear(project.id)

# app/api/routes/projects.py
@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(session, redis, current_project, background_tasks) -> None:
    await ProjectService(session).delete(current_project, redis=redis)
    background_tasks.add_task(purge_deleted_projects)
```

- 他人のもの・無いものは、`CurrentProjectDep` が404(`RESOURCE_NOT_FOUND`)にする。新しいエラーコードは足さない。
- Redis で消すのは、生成の進み具合(`doc_generation:{id}`)だけにする。ほかの鍵は、利用者・IP・指摘の単位で、時間で切れる。
- 物理削除は応答の後(BackgroundTask)に行う。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_project_delete.py`(新規) | `ProjectRepository`(印・取得・一覧・`is_live`・`purge_deleted`)・`ProjectService.delete`・`project_deletion`・ルート `delete_project` と依存関数 `get_current_project` | 各テスト関数(ルートの関数を直接呼ぶ) | `FakeRedis`(進み具合の鍵が消えること)。`purge_deleted_projects` のテストだけ、`AsyncSessionLocal` をテストの DB の工場に差し替える |
| `test_project_delete_flow.py`(新規、integration) | `DELETE /api/v1/projects/{id}`(ルート → サービス → BackgroundTask の物理削除)と `purge_deleted_projects` | httpx の `AsyncClient`(ASGI。BackgroundTask は応答の処理の中で走る)と、ジョブの代わりにロックを持つ別のセッション | スタブ不要 ── 外部キーの CASCADE とロックの振る舞いそのものが検証対象のため、実際の PostgreSQL を使う |

- ユニット(SQLite): 印の付いた行は `get_by_id`・`list_for_user` に出ない。ルートは BackgroundTask に `purge_deleted_projects` を積み、削除した後は依存関数が404にする。他人のプロジェクトは依存関数で止まる。物理削除は印の付いた行だけを消す。SQLite は外部キーとロックが効かないので、子の行と待ちは integration で確かめる。
- integration(PostgreSQL):
  - 削除すると、プロジェクトとチャットの行が消える(CASCADE)。
  - 他人は404で、行は残る。
  - 別のセッションが子の行を書いてロックを持つ間も、DELETE は10秒以内に 204 を返す。一覧からは消え、行は残る(物理削除は飛ばす)。ロックが空いた後の物理削除で消える。
  - 子の行だけを UPDATE して持つと、物理削除は `lock_timeout` で諦め、行は残る。空いた後に消える。
- integration の利用者は、API で登録せず DB に直接作る。アクセストークンも `create_access_token` で直接発行する。API で登録すると、既存のテストと合わせてスイート全体で登録の IP ごとの上限(10回/時)を超え、ほかのテストが429で落ちた。ファイル名は、ユニットの `test_project_delete.py` とぶつかる(テストのフォルダに `__init__.py` が無い)ので `_flow` を付けた。
- 作成・更新したファイルは、この章のテストがすべて import する(マイグレーションは integration のテーブル作成の代わりに、手元の DB で往復させて確かめた)。前方 import は無い。

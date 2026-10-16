# Phase-65-1: 一覧の API(検索・絞込み・ページ)

## この章の目的

`GET /projects` を、タイトルの部分一致・モード・進行状態(複数)で絞り、10件ずつ返す形にする。応答は配列から `{items, total}` に変わる。画面がページの数を出せるように、条件に合う全件数も返す。画面の側は [65-2](./Phase-65-2.md)・[65-3](./Phase-65-3.md) で作る。

自動実装モード: on([introduction](./Phase-65-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/schemas/project.py`](../samples/backend/app/schemas/project.py) | 更新 | `PROJECT_PAGE_SIZE = 10`・`ProjectListPage` |
| [`app/repositories/project.py`](../samples/backend/app/repositories/project.py) | 更新 | `search_for_user`(`list_for_user` を置き換える)・`_escape_like` |
| [`app/services/project.py`](../samples/backend/app/services/project.py) | 更新 | `list_page`(`list_for_user` を置き換える) |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | `GET /projects` の引数と応答 |
| [`tests/unit/test_project_list.py`](../samples/backend/tests/unit/test_project_list.py) | 新規 | 検索・絞込み・ページ・ルートの引数 |
| [`tests/unit/test_project_repository.py`](../samples/backend/tests/unit/test_project_repository.py) | 更新 | 並びのテストを `search_for_user` に |
| [`tests/unit/test_project_service.py`](../samples/backend/tests/unit/test_project_service.py) | 更新 | 他人のプロジェクトを出さないテストを `list_page` に |
| [`tests/unit/test_project_delete.py`](../samples/backend/tests/unit/test_project_delete.py) | 更新 | 削除の印の付いた行が一覧に出ない(新しい形で) |
| [`tests/integration/test_project_list_flow.py`](../samples/backend/tests/integration/test_project_list_flow.py) | 新規 | Postgres の ILIKE・エスケープ・ページ |
| [`tests/integration/test_project_delete_flow.py`](../samples/backend/tests/integration/test_project_delete_flow.py) | 更新 | 空の一覧の形を `{items: [], total: 0}` に |

## 1. 応答の形(`ProjectListPage`)

```python
# app/schemas/project.py
PROJECT_PAGE_SIZE = 10

class ProjectListPage(BaseModel):
    items: list[ProjectRead]
    total: int
```

- `total` は**条件に合う全件数**(このページの件数ではない)。画面はこれでページの数(`ceil(total / 10)`)を出す。
- 1ページの件数は、画面から変えられないようにサーバーの定数にした(外部設計書の「10件ずつ」)。

## 2. 検索(`ProjectRepository.search_for_user`)

```python
# app/repositories/project.py(要点)
async def search_for_user(self, user_id, *, q=None, mode=None, statuses=(), offset=0, limit=None
                          ) -> tuple[list[Project], int]:
    conditions = [Project.user_id == user_id, Project.deleted_at.is_(None)]
    if q:
        conditions.append(Project.title.ilike(f"%{_escape_like(q)}%", escape="\\"))
    if mode is not None:
        conditions.append(Project.mode == mode)
    if statuses:
        conditions.append(Project.status.in_(statuses))
    total = ...  # select(func.count()).select_from(Project).where(*conditions)
    stmt = (select(Project).where(*conditions)
            .order_by(Project.updated_at.desc(), Project.id.desc()).offset(offset).limit(limit))
```

- **条件どうしは AND、進行状態は OR**(`IN`)。着手時の相談で、進行状態を複数選べることにした(推奨は1つ)。
- **`%`・`_` を文字として扱う**: `ILIKE` のワイルドカードなので、そのまま渡すと「100%」が「1000」にも当たる。`_escape_like` で `\` を先に、次に `%`・`_` を `\` で逃がし、`escape="\\"` を付ける。
- **並びに `id` を足す**: 更新日時が同じ行があると、`OFFSET` の境目で同じ行が2ページに出たり、どちらにも出なかったりする。`id` で順を決め切る。
- **件数は別の問い合わせ**: 窓関数(`count() over ()`)で1回にもできるが、範囲外のページでは行が無く件数も取れない。2回に分けると、範囲外でも本当の `total` を返せる(画面が最後のページへ戻すのに使う。[65-3](./Phase-65-3.md))。
- `list_for_user` は、消費者(サービスの一覧)が `search_for_user` に替わり、使う所が無くなったので消した。使っていたテストは `search_for_user` に寄せた。
- 索引は足さない。一覧は利用者ごとで、件数は多くて数百件の見込み。

## 3. サービス(`ProjectService.list_page`)

```python
# app/services/project.py(要点)
async def list_page(self, user_id, *, q=None, mode=None, statuses=(), page=1) -> ProjectListPage:
    keyword = q.strip() if q else ""
    items, total = await self._projects.search_for_user(
        user_id, q=keyword or None, mode=mode, statuses=statuses,
        offset=(page - 1) * PROJECT_PAGE_SIZE, limit=PROJECT_PAGE_SIZE)
    return ProjectListPage(items=[ProjectRead.model_validate(p) for p in items], total=total)
```

- 空白だけの検索語は、条件にしない(全件)。
- 最後より後のページは、エラーにせず空の `items` と本当の `total` を返す。削除で件数が減った直後や、古い URL を開いたときに起きる。直すのは画面の役目にした。

## 4. ルート(`GET /projects`)

```python
# app/api/routes/projects.py
@router.get("", response_model=ProjectListPage)
async def list_projects(
    session: SessionDep, current_user: CurrentUserDep,
    q: Annotated[str | None, Query(max_length=100)] = None,
    mode: ProjectMode | None = None,
    statuses: Annotated[list[ProjectStatus] | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
) -> ProjectListPage:
```

- **クエリの名前は `status`、引数の名前は `statuses`**: このファイルは `from fastapi import status` を使っている(`status.HTTP_201_CREATED` など)。引数を `status` にすると、関数の中でモジュールが隠れる。`alias` で外の名前だけを `status` にした。
- `list[...]` の型の引数は、FastAPI ではクエリとして `?status=a&status=b` を受ける(`Query` が要る)。
- 不正な値(`status=archived`・`page=0`・`mode=other`・101文字以上の `q`)は、FastAPI の 422。`Literal` の型で受けるので、自前の確かめは要らない。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_project_list.py`(新規)の検索・絞込み・ページ | `ProjectRepository.search_for_user`・`ProjectService.list_page` | このテスト(pytest) | スタブ不要 ── 対象は DB の問い合わせそのもので、外部の API を呼ばないため(DB はインメモリの SQLite) |
| `test_project_list.py` のルート | `GET /api/v1/projects`(引数の読み取りと 422) | httpx の `AsyncClient`(ルートだけを載せたアプリ) | `get_db`・`get_current_user` を差し替える(ログインと DB の接続を省くため) |
| `test_project_list_flow.py`(新規、integration) | 同じルートからリポジトリまで | httpx の `AsyncClient` | スタブ不要 ── SQLite は `ILIKE` を `lower() LIKE` に置き換えるので、Postgres の振る舞いを実際の DB で確かめる |
| 既存の3つと integration の削除のテスト(更新) | `search_for_user`・`list_page`・ルート | 既存のまま | 既存のまま |

- 部分一致は大小文字を区別しない / `%`・`_` を文字として扱う / mode と複数の status の AND・OR / 削除の印と他人のプロジェクトは出ない / 12件で 10件 + 2件・`total` は 12・3ページ目は空で `total` は 12 / 空白だけの検索語は絞らない / `?status=a&status=b` を読む / 不正な値は 422。
- ユニットテストの日時は明示する(SQLite の既定の時刻は秒の精度で、並びが揺れる)。
- 作成・更新したファイルは、この章のテストがすべて import する。前方 import は無い(新しく import したのは `fastapi.Query`・`sqlalchemy.func`・`collections.abc.Sequence` と、この章の `ProjectListPage`・`PROJECT_PAGE_SIZE`)。

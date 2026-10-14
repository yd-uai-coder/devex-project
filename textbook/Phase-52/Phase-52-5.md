# Phase-52-5: レビューの設定と結果の API

## この章の目的

superuser が自分のレビューをオン・オフする API と、区切りの最新のレビューを取る API・「もう一度レビュー」の API を作る。画面([Phase 53](../Phase-51/Phase-51-5.md))はこれを使う。devex-ui はこの Phase では変えない。

自動実装モード: on([introduction](./Phase-52-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/` から(#30 の依存順)。users の3ファイルはテンプレート由来で、この Phase で初めて samples に載せた。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/services/user.py`](../samples/backend/app/services/user.py) | 更新 | `update_review_setting`(superuser 以外は403) |
| [`app/schemas/user.py`](../samples/backend/app/schemas/user.py) | 更新 | `UserRead` に `review_enabled` と実効値 `review_effective`・`ReviewSettingsUpdate` |
| [`app/schemas/review.py`](../samples/backend/app/schemas/review.py) | 新規 | `ReviewRunRead`・`ReviewFindingRead`・区切り `ReviewGate` |
| [`app/api/routes/users.py`](../samples/backend/app/api/routes/users.py) | 更新 | `PUT /users/me/review-settings` |
| [`app/api/routes/reviews.py`](../samples/backend/app/api/routes/reviews.py) | 新規 | `GET`・`POST /projects/{project_id}/reviews/{gate}` と、バックグラウンドの実行 `execute_review` |
| [`app/api/routes/__init__.py`](../samples/backend/app/api/routes/__init__.py) | 更新 | レビューのルーターを足す |
| ── ここからテスト ── | | |
| [`tests/unit/test_review_routes.py`](../samples/backend/tests/unit/test_review_routes.py) | 新規 | 上の API のテスト |

## 要点の抜粋

### 1. API

| メソッド・パス | 応答 | エラー |
|---|---|---|
| `GET /users/me` | `UserRead`(`review_enabled`・`review_effective` を足した) | ― |
| `PUT /users/me/review-settings` `{review_enabled}` | `UserRead` | 403 `REVIEW_NOT_ALLOWED`(superuser 以外) |
| `GET /projects/{id}/reviews/documents` | 最新の回(指摘付き)か `null`。`is_current` = レビューした版が表示中の版と同じか | ― |
| `POST /projects/{id}/reviews/documents` | 202 と実行中の回。実行はバックグラウンド | 403 / 409 `DOC_GENERATION_IN_PROGRESS`・`REVIEW_IN_PROGRESS`・`REVIEW_DOCUMENTS_NOT_READY` / 429 `REVIEW_LIMIT_EXCEEDED` / 502 `REVIEW_UNAVAILABLE` |

`{gate}` は今は `documents` だけ(`Literal`。他の値は422)。段階6・7 の区切りは Phase 53 で足す。

### 2. 実効値は応答でも計算する

```python
# app/schemas/user.py
class UserRead(UserBase):
    review_enabled: bool = False

    @computed_field
    @property
    def review_effective(self) -> bool:
        return review_effective(is_superuser=self.is_superuser, review_enabled=self.review_enabled)
```

画面は `review_effective` で出し分ける。保存値をそのまま信じない(サーバーでも受け付けのたびに判定する。[52-4](./Phase-52-4.md))。

### 3. バックグラウンドの実行

```python
# app/api/routes/reviews.py
async def execute_review(run_id: uuid.UUID) -> None:
    async with AsyncSessionLocal() as session:
        await ReviewService(session).execute(run_id)
```

受け付けはリクエストのセッションで commit し、実行は回の ID だけを渡して自前のセッションで行う(生成の `generate_documents` と同じ理由)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `read_current_user`・`update_review_settings`・`UserRead.review_effective` | pytest(`test_review_routes.py`。ルートの関数を直接呼ぶ) | スタブ不要 ── インメモリの SQLite のユーザーを使う | 初期値はオフ・superuser はオンにでき実効値も真・superuser 以外は403で保存値が変わらない |
| `get_latest_review`・`request_review` | 同上 | `FakeRedis`(1日の回数)・`BackgroundTasks`(積むだけで流さない)。文書は偽の LLM で生成しておく | まだ無ければ null・受け付けは実行中の回を返し `execute_review` を積む・最新の回が今の版・版が変わると `is_current` が偽・使えない設定は403 |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_review_routes.py
```

dev のサーバーでも、seed の superuser でオン → オフに切り替えられること、一般ユーザーは403になることを `curl` で確かめた。

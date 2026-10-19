# Phase-86-3: レビューを結ぶ

## この章の目的

検証の前の任意の設計レビュー([Phase 52](../Phase-52/Phase-52-introduction.md) の `review_runs`)を CR に結ぶ。反映済みの間に、反映の後に流して成功した回から開発者が選ぶ(着手時の相談のユーザー決定)。結んだ回は CR の詳細・検証の行・たどる記録(86-4)に出る。

自動実装モード: on([introduction](./Phase-86-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/reviews.py`](../samples/backend/app/change_requests/reviews.py) | 新規 | `aware`・`first_applied_at`・`review_link_problem`・`LINKABLE_RUN_STATUS` |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | 上の re-export |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `ReviewRunNotFoundError`(404)・`ChangeRequestReviewNotLinkableError`(409 `CR_REVIEW_NOT_LINKABLE`) |
| [`app/repositories/review.py`](../samples/backend/app/repositories/review.py) | 更新 | `list_for_project` |
| [`app/repositories/change_request.py`](../samples/backend/app/repositories/change_request.py) | 更新 | 結んだレビュー(回と指摘)を CR と一緒に読む、`link_review`、作成で `reviews=[]` |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `ReviewRunBriefRead`・`LinkedReviewRead`・`ChangeRequestReviewLink`・`review_run_fields`、詳細の `reviews` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `review_candidates`・`link_review`・`_link_problem`、検証の行に `review_run_ids` |
| [`app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 更新 | `GET .../review-candidates`・`POST .../reviews` |
| [`tests/unit/test_change_request_reviews.py`](../samples/backend/tests/unit/test_change_request_reviews.py) | 新規 | 結べる条件(純粋)・候補と結ぶ・時系列・検証の行・409/404 |
| [`tests/unit/test_change_request_verify.py`](../samples/backend/tests/unit/test_change_request_verify.py) | 更新 | 検証の行の `review_run_ids` |
| [`tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 更新 | ルーターに2つのパス |

依存の向き: `reviews.py` → `states.CHECKABLE_STATUSES`(86-1)。リポジトリ → `ChangeRequestReview`(86-2)・`ReviewRun`(既存)。サービス → `reviews.py`・`ReviewRunRepository`。

## 1. 結べる条件

```python
# app/change_requests/reviews.py(抜粋)
def first_applied_at(events: Iterable[tuple[str, datetime]]) -> datetime | None
def review_link_problem(status, applied_at, run_status, run_started_at, *,
                        already_linked) -> str | None   # 結べない理由(結べれば None)
```

| 条件 | 違うとき |
|---|---|
| CR が反映済み(`CHECKABLE_STATUSES`)で、反映の行がある | 「反映済みの CR にだけ結べます」 |
| まだ結んでいない | 「もう結んであります」 |
| 回が成功している | 「成功したレビューだけを結べます」 |
| 回を始めたのが最初の反映の後 | 「反映の後に流したレビューだけを結べます」 |

- **反映の時刻は時系列から読む**: 最初の `apply` の行の日時。列を足さずに済み、やり直しの反映があっても「最初の反映の後」で判断する。
- **タイムゾーンをそろえる**(`aware`): SQLite はタイムゾーンの無い日時を返すので、比べる前に UTC にする。
- **純粋関数にした**: 条件の組み合わせを DB 無しで確かめるため(候補の一覧と結ぶ操作が同じ条件を使う)。

## 2. API

| API | 本文 | 応答・エラー |
|---|---|---|
| `GET .../{number}/review-candidates` | ── | 結べる回(新しい順。区切り・モデル・状態・指摘と採用の数)。反映済みでなければ空 |
| `POST .../{number}/reviews` | `{review_run_id}` | CR の詳細(`reviews` に結んだ回)。回が無ければ 404 `REVIEW_RUN_NOT_FOUND`、結べなければ 409 `CR_REVIEW_NOT_LINKABLE` |

- **時系列に1行**: `link_review`(状態は変えない)。`refs` は `{review_run_id, gate, model}`。
- **外す操作は作らない**: 結んだことも記録として残す(合意の記録・束と同じく、直さず消さない)。
- **回はプロジェクトで絞る**: `find_one(id=..., project_id=...)`。ほかのプロジェクトの回は「無い」(404)。
- **結んだ回は CR と一緒に読む**: 詳細の `reviews` と、たどる記録で指摘の数を出すため、回と指摘まで `selectinload` する。新しく作った CR は `reviews=[]` を入れておく(読み込んでいない集まりを非同期のセッションで触ると、遅延の読み込みで落ちるため)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_reviews.py`(新規) | `first_applied_at`・`review_link_problem`・`aware`、`ChangeRequestService.review_candidates`・`link_review`・`verify` の参照、`ChangeRequestRepository.link_review`、`ReviewRunRepository.list_for_project`、`ChangeRequestReview`、スキーマ、2つのエラー、2つのルート | pytest のテスト関数 | 純粋関数はスタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため。サービスとルートは SQLite と `tests/fixtures/change_requests.py`。レビューの回は LLM を呼ばずリポジトリで直接作る |
| `test_change_request_verify.py`(更新) | 検証の行の `refs` | pytest のテスト関数 | 86-2 と同じ |

- 条件: 結べる / 合意(反映の前)/ 検証済み / もう結んだ / 失敗した回 / 反映の前の回。
- 流れ: 候補は反映の後に成功した回だけ(指摘と採用の数)/ 結ぶと詳細と時系列に出る / 結んだ回は候補から外れ、2回目は 409 / 検証の行に結んだ回の id。
- 反映の前: 候補は空、結べば 409。無い回は 404。

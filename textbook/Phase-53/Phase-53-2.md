# Phase-53-2: 区切りの一覧と採否の API

## この章の目的

画面が1回の呼び出しで区切りの表と指摘の表を作れるよう、モードの区切りごとの状態と最新の回を返す API を作る。指摘の採否(採用・却下・保留・未判断)を記録する API も作る(差し戻しで使うのは Phase 54)。`{gate}` の API は段階6・7 も受ける。

自動実装モード: on([introduction](./Phase-53-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/schemas/review.py`](../samples/backend/app/schemas/review.py) | 更新 | `ReviewGateSummaryRead`・`FindingDecisionUpdate`・`FindingDecision`。`ReviewGate` は `app.review` から読む |
| [`app/api/routes/reviews.py`](../samples/backend/app/api/routes/reviews.py) | 更新 | `GET /reviews`・`PUT /reviews/findings/{finding_id}`。`{gate}` の2つは区切りで振り分ける |
| ── ここからテスト ── | | |
| [`tests/unit/test_review_routes.py`](../samples/backend/tests/unit/test_review_routes.py) | 更新 | 上の API のテスト |

## 要点の抜粋

### 1. API

| メソッド・パス | 応答 | エラー |
|---|---|---|
| `GET /projects/{id}/reviews` | `[{gate, ready, status, run}]`(簡易は documents だけ、詳細は documents・stage6・stage7。`run` は最新の回か null、`is_current` 付き) | ― |
| `GET /projects/{id}/reviews/{gate}` | 最新の回か null | 知らない区切りは422 |
| `POST /projects/{id}/reviews/{gate}` | 202 と実行中の回 | 403 / 409(生成中・実行中・区切りがそろっていない)/ 429 / 502 |
| `PUT /projects/{id}/reviews/findings/{finding_id}` `{decision}` | 指摘1件 | 404 `REVIEW_FINDING_NOT_FOUND` / 422(知らない採否) |

### 2. 区切りの一覧

```python
# app/api/routes/reviews.py
def _summary_read(summary: GateSummary) -> ReviewGateSummaryRead:
    run = None
    if summary.run is not None:
        run = ReviewRunRead.model_validate(summary.run)
        run.is_current = summary.is_current
    return ReviewGateSummaryRead(gate=summary.gate, ready=summary.ready, status=summary.status, run=run)
```

状態の判定はサービス(`gate_summaries`)と純粋関数(`gate_status`)が持ち、ルートは形を変えるだけ。

### 3. ルートの順

`PUT /findings/{finding_id}` は `{gate}` の2つとパスの深さが違うので、ぶつからない。`GET ""`(一覧)は `GET /{gate}` より前に置いた。

### 4. スキーマ

```python
# app/schemas/review.py
FindingDecision = Literal["pending", "adopted", "rejected", "held"]

class ReviewGateSummaryRead(BaseModel):
    gate: ReviewGate
    ready: bool
    status: GateStatus
    run: ReviewRunRead | None
```

`ReviewFindingRead.decision` も `FindingDecision` にした(画面の型と一致させる)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `list_review_gates`・`request_review` | pytest(`test_review_routes.py`。ルートの関数を直接呼ぶ) | `FakeRedis`・`BackgroundTasks`(積むだけで流さない)。文書は偽の LLM で生成しておく | 回が無い区切りは未レビュー・受け付けた後は実行中で `run.is_current`・詳細の段階6 を受け付け(`targets` に `stage:6`)、一覧は documents 未レビュー / stage6 実行中 / stage7 そろっていない |
| `decide_finding` | 同上 | `FakeLLM`(指摘を作る)・`ReviewService.execute` を直接流す | 保留にでき、最新の回の指摘にも反映・別のプロジェクトは404 |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_review_routes.py
```

dev のサーバーでも、本物の API で一覧・段階6・7・文書の受け付けと、採否(他のプロジェクトの指摘は404、知らない値は422)を確かめた([introduction](./Phase-53-introduction.md) の検証結果)。

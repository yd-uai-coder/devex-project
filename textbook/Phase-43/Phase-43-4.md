# Phase-43-4: 変更の影響の API

## この章の目的

43-3 で記録した印を、Phase 44 の画面(作業領域の「変更の影響」パネル・段階の表の印)が読めるように API で返し、印を確認済みにする操作を足す。まだ承認していない編集から届く印は、記録せずに `pending` として一緒に返す(着手時の決定2)。

自動実装モード: on([introduction](./Phase-43-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `ElementChangeRead`・`ImpactMarkRead`・`StageImpactRead`・`RegenerationTargetRead`・`DesignImpactRead`・`ImpactReview`、`DesignStageRead.impact_open`・`impact_reviewed` |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `impact`・`stage_impact`・`_pending_impact`・`_stage_impact_read`・`_regeneration_targets`・`_to_read` の件数 |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | `GET /design-stages/impact`・`POST /design-stages/{stage}/impact/review` |
| ── ここからテスト ── | | |
| [`tests/unit/test_design_stage_impact.py`](../samples/backend/tests/unit/test_design_stage_impact.py) | 更新 | API の応答(記録した印・件数・再生成の候補)・pending の印・簡易モード |

## 要点の抜粋

### 1. API

| メソッド・パス | 応答 | 中身 |
|---|---|---|
| `GET /projects/{id}/design-stages/impact` | `DesignImpactRead` | モードの全段階の `StageImpactRead`(変わったもの・印・未確認/確認済みの件数)と、再生成の候補 |
| `POST /projects/{id}/design-stages/{stage}/impact/review` | `StageImpactRead` | `{"keys": [...], "reviewed": true}` で印を確認済み(`false` で未確認)にする。まとめて渡せる |
| `POST /projects/{id}/design-stages/{stage}/approve`(既存) | `DesignStageRead` | 他から届いた未確認の印があれば 409 `DESIGN_STAGE_UNREVIEWED_IMPACT` |

`DesignStageRead` には `impact_open`・`impact_reviewed`(記録した印の件数)を足した。段階の一覧だけで状態の欄に印の数を出せる。

### 2. 応答の形

```python
# app/schemas/design_stage.py
class ImpactMarkRead(BaseModel):
    key: str
    label: str
    stage: int
    path: list[str]
    reason: str
    sources: list[str]
    reviewed: bool = False
    pending: bool = False   # まだ承認していない編集から届く印(記録していない)

class StageImpactRead(BaseModel):
    stage: int
    changes: list[ElementChangeRead]
    marks: list[ImpactMarkRead]
    open: int       # 記録した印のうち未確認(pending を除く)
    reviewed: int
```

### 3. pending の印

```python
# app/services/design_stage_service.py
async def _pending_impact(self, project, rows, documents) -> dict[int, list[StageImpact]]:
    """承認の後に編集した段階の、写しと今の内容の差分から求めた印(届く段階ごと。保存しない)。"""
```

承認の後に編集した段階(写しがあり、状態が承認済みでない)ごとに、写しと今の内容を比べる。記録はしないので、承認する前に「承認するとどこに届くか」を見られる。編集中の上流がある段階は開いていない(承認できない)ので、pending の印が承認を止めることは無い。

### 4. 再生成の候補

部分再生成できる段階(5 手順・6 処理ロジック・8 単位の手順書。`REGENERATION_STAGES`)の、未確認の印の要素(重複なし)。自動では再生成しない([41-2](../Phase-41/Phase-41-2.md) 決定6)。部分再生成を呼ぶ操作は Phase 44。

## 設計判断

### 確認済みの切り替えは版を見ない

印の確認済みは段階の内容を変えないので、段階の `version`(楽観ロック)を上げず、リクエストにも版を持たせない。同じ印を2人が同時に切り替えても、後の操作が残るだけで、内容は壊れない。

### 確認済みの応答は段階1つ分

画面は確認済みにした段階の表だけを描き直せばよいので、全段階でなく段階1つ分を返す(中身は `impact` と同じ組み立て)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `get_design_impact`・`review_impact_marks`・`list_design_stages`(ルート)、`impact`・`stage_impact`(サービス)、応答の形 | pytest(`test_design_stage_impact.py`。ルートの関数を直接呼ぶ。既存の `test_design_stage_service.py` と同じ形) | インメモリ SQLite(`db_session`)を本物のリポジトリで使う。LLM は呼ばない | 記録した印・道・出どころ・再生成の候補(段階5・6・8 だけ)・確認済みの件数(応答と段階の一覧)、承認前の編集の pending の印と、記録しないこと、簡易モードは段階8だけで印が無い |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_design_stage_impact.py
```

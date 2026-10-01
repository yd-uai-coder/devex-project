# Phase-15-2: 段階の土台 ── 状態の導出・陳腐化・承認(BE)

## この章の目的

詳細設計モードの段階1〜7について、全段階に共通する部分を作る。

- 状態(未着手 / 下書き / レビュー中 / 承認済み / 古い)
- 開いているかどうか(入力がそろったか)
- 保存と承認
- 陳腐化(承認した後に入力が変わった)

段階ごとの中身(AI の下書き・意味モデルの形・検証)は、Phase 16 以降で足す。

学習モード([introduction](./Phase-15-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/stages.py`](../samples/backend/app/detailed_design/stages.py) | 新規 | **コア** | `STAGE_INPUTS`、`StageRecord`、`StageView`、`current_inputs`、`derive_states`、`can_approve`(純粋) |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 新規 | 定型 | `stages.py` の公開名の re-export |
| [`app/models/design_stage.py`](../samples/backend/app/models/design_stage.py) | 新規 | 定型 | `design_stages` テーブル(CHECK 1〜7、UNIQUE(project_id, stage)) |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | 定型 | `design_stages` の relationship |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | 定型 | `DesignStage` の re-export(alembic 用) |
| [`alembic/versions/d2e3f4a5b6c7_add_design_stages.py`](../samples/backend/alembic/versions/d2e3f4a5b6c7_add_design_stages.py) | 新規 | 定型 | テーブルの作成 |
| [`app/repositories/design_stage.py`](../samples/backend/app/repositories/design_stage.py) | 新規 | 定型 | `create`、`get`、`list_for_project` |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 新規 | 定型 | `DesignStageRead`、`DesignStageSave`、`DesignStageApprove` |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | `DESIGN_STAGES_NOT_AVAILABLE`・`DESIGN_STAGE_LOCKED`・`DESIGN_STAGE_NOT_APPROVABLE`・`VERSION_CONFLICT`・`RESOURCE_NOT_FOUND` の5つ |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 新規 | **コア** | `list_stages`、`save`、`approve` |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 新規 | 定型 | `GET /projects/{id}/design-stages`、`PUT .../{stage}`、`POST .../{stage}/approve` |
| [`app/api/routes/__init__.py`](../samples/backend/app/api/routes/__init__.py) | 更新 | 定型 | ルーターの登録 |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 新規 | 定型 | 詳細設計モードのプロジェクト(要件定義・外部設計を1版ずつ) |
| [`tests/unit/test_detailed_design_stages.py`](../samples/backend/tests/unit/test_detailed_design_stages.py) | 新規 | **コア** | 状態の表、開く条件、「等しくない」、古さの伝わり方 |
| [`tests/unit/test_design_stage_service.py`](../samples/backend/tests/unit/test_design_stage_service.py) | 新規 | **コア** | ルートの統合スモーク、モード、開いていない段階、版の競合、承認のやり直し、陳腐化と承認し直し、ルーターの登録 |

## 要点の抜粋

```python
# app/detailed_design/stages.py
STAGE_INPUTS: dict[int, StageInputs] = {
    1: StageInputs(stages=(), documents=("external_design",)),
    2: StageInputs(stages=(1,), documents=("requirements",)),
    3: StageInputs(stages=(2,), documents=()),
    4: StageInputs(stages=(1, 2, 3), documents=("requirements",)),
    5: StageInputs(stages=(2, 4), documents=()),
    6: StageInputs(stages=(5,), documents=()),
    7: StageInputs(stages=(1, 2, 3, 4, 5, 6), documents=("requirements", "external_design")),
}

def derive_states(records, doc_versions) -> dict[int, StageView]:
    approved_versions: dict[int, int | None] = {}
    for stage in STAGES:                                   # 段階の順に決める
        current = current_inputs(stage, approved_stage_versions=approved_versions, doc_versions=doc_versions)
        state = _state_of(records.get(stage), current)
        views[stage] = StageView(stage, state, missing_inputs=(k for k, v in current.items() if v is None))
        # 承認済み(古くない)段階だけが、後ろの段階の「今の値」になる
        approved_versions[stage] = record.approved_version if state == "approved" else None

def _state_of(record, current) -> StageState:
    if record is None:
        return "not_started"
    if record.input_fingerprint is not None and dict(record.input_fingerprint) != current:
        return "outdated"                                  # 「等しくない」で比べる
    return record.status
```

```python
# app/services/design_stage_service.py(approve の中心)
row.status = "approved"
row.approved_version = row.version                        # version は増やさない
row.input_fingerprint = current_inputs(stage, approved_stage_versions=..., doc_versions=...)
```

`__init__.py` は、`stages.py` の公開名(`STAGES`・`STAGE_INPUTS`・`StageRecord`・`StageView`・`StageState`・`derive_states` など)を re-export する。依存の向きは「サービス → `app.detailed_design` → (何にも依存しない)」で、純粋関数は DB を知らない。

## 設計判断

### 保存する状態は3つ、画面の状態は5つ

画面(SCR-008)は5つの状態を出す。そのうち「未着手」は行が無いこと、「古い」は入力が承認時から変わったことで、どちらも他の値から決まる。保存すると、前の段階や文書が変わるたびに後ろの全段階を書き換える処理が要り、書き換え忘れで食い違う。Phase 13 で「反映した版」を DB の列にせずアンカーの `v=` に持たせたのと同じ考え方である([Phase-13-3](../Phase-13/Phase-13-3.md))。

### 古さは後ろへ順に伝わる

承認済みでない段階(レビュー中・古い など)の「今の値」は `None` にした。

- 段階1を編集してレビュー中に戻すと、段階1の今の値は `None` になり、段階2の記録(`stage:1 = 2`)と食い違う。段階2は「古い」になる。
- 段階2が古いので、段階2の今の値も `None` になる。段階3も古くなる。

「前の段階を承認し直すと、後ろの段階に古いを出す」([Phase-14-5](../Phase-14/Phase-14-5.md) 決定2)を、段階の順に1回なめるだけで決められる。後ろの段階は自動では作り直さず、人が「作り直す」か「このまま承認し直す」かを選ぶ。

### 「このまま承認し直す」は、内容を変えずに入力の版を記録し直すこと

古い段階は、承認済みでも `can_approve` が真になる。承認し直すと `input_fingerprint` だけが今の値で書き直され、`version`・`approved_version` は変わらない。そのため、その段階を入力にしている後ろの段階は、古くならない(内容は変わっていないから)。

### 開いていない段階は、保存もできない

入力がそろっていない段階(前の段階が未承認、文書が無い)は、保存も承認も 409(`DESIGN_STAGE_LOCKED`)にした。下書きは前の段階の承認済みの成果物を入力に作るので、入力が無いまま作った内容は根拠を持たない。

### 段階ごとの検証の仕組みは、まだ作らない

承認の条件は、全段階に共通の3つだけにした(開いている・版が一致する・承認できる状態で内容が空でない)。段階ごとの検証(機能一覧の処理IDの重複など)を差し込む登録の仕組みも考えられる。しかし、この Phase には、それを使う段階の実装が1つも無い(#17)。最初の段階の検証を作る Phase 16 で、実物に合わせて作る。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `derive_states`・`current_inputs`・`can_approve` | pytest | スタブ不要。記録と文書の版を受け取って状態を返す純粋関数のため | 開く条件、文書の再生成・復元(番号が下がる)、編集による古さの伝わり方 |
| `DesignStageService`(save / approve / list_stages) | pytest(インメモリ SQLite) | スタブ不要。外部呼び出しが無いため | 文書の再生成は `create_version` で再現する |
| ルート関数3つ | pytest(ルート関数を直接呼ぶ) | スタブ不要 | 第一テストの統合スモーク(保存 → 承認 → 一覧) |
| `api_router` | pytest(`FastAPI().include_router` の OpenAPI) | スタブ不要 | 段階のパスが登録されていること |

用語(初出は Phase 2): SUT はテストの対象、ドライバはそれを呼ぶ側、スタブは対象が呼ぶ外部の代わり。

**純粋関数とサービスを分けた理由**: 状態の規則の組み合わせ(5状態 × 開く条件 × 版の一致)は、DB 無しで表として網羅する。サービスのテストは、「保存」「文書の再生成」など実際の操作の後に、正しい記録と版が純粋関数へ渡ることだけを見る。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_detailed_design_stages.py tests/unit/test_design_stage_service.py
# 20 passed
```

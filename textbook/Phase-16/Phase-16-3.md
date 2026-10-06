# Phase-16-3: 段階の生成の状態・承認時の検証・指摘の読み取り(BE)

## この章の目的

16-2 の検証を段階のサービスにつなぐ。段階の承認は、検証にエラーがあれば止める。段階の読み取りには、検証の指摘(`issues`)と、AI の下書きの生成の状態を載せる。生成の状態の列はここで足し、生成中の段階は保存・承認を断る(生成そのものは 16-4)。

自動実装モード: on([introduction](./Phase-16-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/models/design_stage.py`](../samples/backend/app/models/design_stage.py) | 更新 | 定型 | `generation_status`・`generation_error`・`generation_started_at` |
| [`alembic/versions/f4a5b6c7d8e9_add_generation_to_design_stages.py`](../samples/backend/alembic/versions/f4a5b6c7d8e9_add_generation_to_design_stages.py) | 新規 | 定型 | 上の3列を足す |
| [`app/repositories/design_stage.py`](../samples/backend/app/repositories/design_stage.py) | 更新 | 定型 | `create` の `model` に `None` を許す(生成を受け付けたばかりの段階) |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | 定型 | `StageIssueRead`、`DesignStageRead` に `generation_status`・`generation_error`・`issues` |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | `DESIGN_STAGE_INVALID`・`DESIGN_STAGE_GENERATION_IN_PROGRESS` |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | **コア** | 承認時の検証、読み取りの `issues`、生成中の拒否、`stage_view`・`read`(16-4 が使う) |
| ── ここからテスト ── | | | |
| [`tests/unit/test_design_stage_service.py`](../samples/backend/tests/unit/test_design_stage_service.py) | 更新 | **コア** | 段階1の内容を検証を通る形に(`function_list_model()`)、検証のエラーで承認できない、生成中の保存・承認の拒否 |

## 要点の抜粋

```python
# app/services/design_stage_service.py(approve の追加分)
_ensure_not_generating(row)                                     # 生成中は 409
...
if not row.model:
    raise DesignStageNotApprovableError(...)
if has_errors(validate_stage(stage, row.model, _sources(documents))):
    raise DesignStageInvalidError(...)                         # 409 DESIGN_STAGE_INVALID
```

```python
# app/services/design_stage_service.py(読み取り)
def _to_read(view, row, sources) -> DesignStageRead:
    issues = validate_stage(view.stage, row.model, sources) if row is not None else []
    return DesignStageRead(..., generation_status=row.generation_status, issues=[...])
```

`_load` は、段階の行・状態に加えて、入力の文書(表示中の版)を返すようにした。文書の版は状態の判定に、本文は検証に使う(`_doc_versions`・`_sources`)。

## 設計判断

### 保存は通し、承認で止める

検証のエラーがあっても保存はできる。表の編集の途中(機能グループを足してから行を移す、など)は、一時的にエラーの状態を通る。保存まで止めると、途中の状態を残せない。承認は後ろの段階の入力になるので、ここで止める。UML 図の承認(検証のエラーが無いこと)と同じ考え方である。

### 指摘は保存せず、読み取りのたびに計算する

`issues` は DB の列にせず、読み取りのたびに検証して返す。検証は入力の文書(外部設計書の API 一覧)にも依存するので、保存すると文書を生成し直したときに古くなる。Phase 15 で「古い」を保存せずに導いたのと同じ考え方である([Phase-15-2](../Phase-15/Phase-15-2.md))。

### 生成の状態は、レビューの状態とは別の列にする

`status`(下書き・レビュー中・承認済み)は人のレビューの軸、`generation_status`(生成中・完了・失敗)は AI の生成の軸である。UML 図も同じ2軸を持つ(Phase 10)。1つの列にまとめると、「承認済みの段階を作り直している最中」のような状態を表せない。

- `generation_status` の `None` は「まだ生成していない」。人が最初から手で書いた段階は `None` のままである。
- `generation_started_at` は、止まった生成の回収(16-4)に使う。`updated_at` で代えないのは、生成中に行が別の理由で更新されると、回収の時刻がずれるからである。

### 生成中は保存も承認も断る

生成の結果は、`model` を丸ごと置き換える。生成中に人が保存しても、その編集は生成の完了で消える。承認しても、承認した内容と完了後の内容が違ってしまう。そこで生成中は、どちらも 409 `DESIGN_STAGE_GENERATION_IN_PROGRESS` にした。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DesignStageService`(approve の検証・読み取りの `issues`・生成中の拒否) | pytest(インメモリ SQLite) | スタブ不要。外部呼び出しが無いため | 生成中の状態は、行の `generation_status` を直接書き換えて作る(生成の実装は 16-4) |
| ルート関数(既存の統合スモーク) | pytest(ルート関数を直接呼ぶ) | スタブ不要 | 段階1の内容を検証を通る形にしたうえで、保存 → 承認 → 一覧が通る |

既存のテストの内容(`{"functions": [{"id": "F-01"}]}`)は、段階1の検証で形が不正になる。共通の承認の流れを見るテストなので、検証を通る最小の機能一覧(`function_list_model()`)に置き換えた。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_design_stage_service.py tests/unit/test_detailed_design_stages.py
# 22 passed
```

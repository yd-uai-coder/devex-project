# Phase-42-1: 作業単位の安定キー

## この章の目的

段階7の作業単位(タスク)に、並べ替えで変わらないキー(`U-001`…)を持たせ、段階8の手順書をそのキーで単位に付ける。今の単位の ID(`M-01-T02`)は並び順から導くので、段階7でタスクを並べ替えると、段階8の手順書が別の単位に付く([41-1](../Phase-41/Phase-41-1.md) 所見7)。変更の影響(42-3・42-4)も、作業単位と手順書をこのキーで指す。[41-2](../Phase-41/Phase-41-2.md) 決定4(作業単位だけ安定キー)の実装。

自動実装モード: on([introduction](./Phase-42-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/plan.py`](../samples/backend/app/detailed_design/plan.py) | 更新 | `PlanTask.key`・`PlanModel.next_unit_seq`・`unit_key`・`assign_unit_keys`・`carry_over_unit_keys`。`normalize_plan` がキーと番号を引き継ぐ |
| [`app/detailed_design/procedure_doc.py`](../samples/backend/app/detailed_design/procedure_doc.py) | 更新 | `UnitProcedure.unit_key`・`PlanUnit.key`・`relabel_units`。`documented_unit_ids`・`merge_unit_procedure` はキーで付け直してから突き合わせる |
| [`app/detailed_design/procedure_doc_drafting.py`](../samples/backend/app/detailed_design/procedure_doc_drafting.py) | 更新 | `to_unit_procedure` が単位のキーを写す |
| [`app/detailed_design/procedure_output/source.py`](../samples/backend/app/detailed_design/procedure_output/source.py) | 更新 | 手順書の出力の前にキーで付け直す |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | `_matched_procedures` がキーで付け直してから突き合わせる。`UNIT_MISMATCH` の文言から「並べ替えた」を外す |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | 新しい関数の re-export |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | 段階7の生成の後に `carry_over_unit_keys`。段階8の「下書きの内容がある」の判定もキーで付け直す |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | 段階7の保存でキーを振る(`_with_unit_keys`)。段階8の応答の model を付け直す(`_relabeled`) |
| [`alembic/versions/d4e5f6a7b8c0_add_unit_keys.py`](../samples/backend/alembic/versions/d4e5f6a7b8c0_add_unit_keys.py) | 新規 | 既存の段階7にキーを振り、段階8に `unit_key` を書く(データだけの移行) |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `PlanTask.key`・`req_ids`、`PlanModel.next_unit_seq`、`UnitProcedure.unit_key` |
| [`src/features/detailed-design/planOps.ts`](../samples/frontend/src/features/detailed-design/planOps.ts) | 更新 | `toPlan` がキー・要件ID・番号を保つ(保存で消さない)。`addTask` はキー空 |
| [`src/features/detailed-design/procedureDocOps.ts`](../samples/frontend/src/features/detailed-design/procedureDocOps.ts) | 更新 | `ProcedureUnit.key`、`reassignUnit` がキーも付け替える |
| ── ここからテスト ── | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | `plan_model()` のタスクに `U-001`・`U-002`、`procedure_doc_model(unit_key=)` |
| [`tests/unit/test_plan.py`](../samples/backend/tests/unit/test_plan.py) | 更新 | 振り方・重複・並べ替え・引き継ぎ・`normalize_plan` |
| [`tests/unit/test_procedure_doc.py`](../samples/backend/tests/unit/test_procedure_doc.py) | 更新 | `PlanUnit.key` の代わりの値・`relabel_units`・並べ替えの後の数え方と置き換え |
| [`tests/unit/test_procedure_doc_validation.py`](../samples/backend/tests/unit/test_procedure_doc_validation.py) | 更新 | 単位に無い手順書はキーを空にして作る |
| [`tests/unit/test_unit_key_migration.py`](../samples/backend/tests/unit/test_unit_key_migration.py) | 新規 | 移行の変換(純粋関数) |
| [`tests/unit/test_design_stage_plan_generation.py`](../samples/backend/tests/unit/test_design_stage_plan_generation.py) | 更新 | 生成でキーを振る・作り直しで引き継ぐ・保存でキーを振る |
| [`tests/unit/test_design_stage_procedure_doc.py`](../samples/backend/tests/unit/test_design_stage_procedure_doc.py) | 更新 | 生成した手順書のキー・段階7の並べ替えの後も同じ単位 |
| [`src/features/detailed-design/test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | `makePlan` のキー・番号、`makeProcedureDoc` の `unit_key` |
| [`src/features/detailed-design/__tests__/planOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/planOps.test.ts) | 更新 | キーを保つ・足したタスクはキー空・並べ替えてもキーはタスクに付く |
| [`src/features/detailed-design/__tests__/procedureDocOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/procedureDocOps.test.ts) | 更新 | `ProcedureUnit.key`・`reassignUnit` のキー |

`__init__.py` の re-export(#7): `from app.detailed_design.plan import (…, assign_unit_keys, carry_over_unit_keys, …, unit_key, …)`、`from app.detailed_design.procedure_doc import (…, relabel_units, …)`。依存の向きは `procedure_doc` → `plan`(変わらない)。

## 要点の抜粋

### 1. キーの振り方(`assign_unit_keys`)

```python
# app/detailed_design/plan.py
class PlanTask(BaseModel):
    # 並べ替えで変わらない単位のキー(`U-001`…)。空なら保存時・生成時に振る
    key: str = ""
    ...

class PlanModel(BaseModel):
    ...
    # 次に振る単位のキーの番号
    next_unit_seq: int = 1

def assign_unit_keys(model: PlanModel) -> PlanModel:
    tasks = [task for milestone in model.milestones for task in milestone.tasks]
    used = {task.key for task in tasks if task.key}
    seq = max([model.next_unit_seq, *(_key_seq(key) + 1 for key in used)])
    ...  # キーが空か、前のタスクと同じキーなら次の番号を振る
```

要件ID・画面ID の `next_seq` と同じく、消した番号は使い直さない。`next_unit_seq` が古くても(画面が古い model を送ってきても)、今あるキーより後ろから振る。

### 2. 作り直しでの引き継ぎ(`carry_over_unit_keys`)

段階7の作り直しは全体を置き換える。タスク名が同じ単位は前のキーを引き継ぎ、段階8の手順書を付けたままにする(前の計画で同じ名前が2つあるものは引き継がない)。今まで(位置とタスク名の両方で突き合わせ)より、同じ単位に手順書が残る場合が増える。

```python
# app/services/design_stage_generation_service.py(generate_plan)
model = normalize_plan(to_plan_model(crosscutting, plan_output), paths)
previous = PlanModel.model_validate(context.previous or {})
return carry_over_unit_keys(model, previous).model_dump(mode="json")
```

### 3. 手順書はキーで単位に付く(`relabel_units`)

```python
# app/detailed_design/procedure_doc.py
@dataclass(frozen=True)
class PlanUnit:
    unit_id: str
    milestone: str
    task: PlanTask

    @property
    def key(self) -> str:
        return self.task.key or self.unit_id

def relabel_units(model: ProcedureDocModel, plan: PlanModel) -> ProcedureDocModel:
    ids = {u.key: u.unit_id for u in plan_units(plan)}
    return ProcedureDocModel(
        units=[
            u.model_copy(update={"unit_id": ids[u.unit_key]}) if u.unit_key in ids else u
            for u in model.units
        ]
    )
```

手順書の突き合わせの入口(`documented_unit_ids`・`merge_unit_procedure`・検証の `_matched_procedures`・出力の `procedure_output_source`・段階8の応答)で付け直してから、今までどおり単位の ID とタスク名で比べる。保存されている `unit_id` は古くてもよい。

### 4. 保存時に振る

画面で足したタスクはキーが空で届く。段階7の保存で振る(形の正しくない内容はそのまま。検証が指摘する)。

```python
# app/services/design_stage_service.py(save)
_ensure_stage(project, stage)
if stage == PLAN_STAGE:
    model = _with_unit_keys(model)
```

### 5. 既存データの移行

```python
# alembic/versions/d4e5f6a7b8c0_add_unit_keys.py
def key_plan(model: dict) -> tuple[dict, dict[str, str]]:
    """段階7の model のタスクにキーを振る。戻り値は新しい model と、単位の ID → キーの対応。"""

def key_units(model: dict, ids: dict[str, str]) -> dict:
    """段階8の手順書に、単位の ID で引いたキーを書く(引けないもの・キーのあるものはそのまま)。"""
```

[Phase 26 の移行](../samples/backend/alembic/versions/b8c9d0e1f2a3_recut_plan_stage.py)と同じく、変換はファイルの中の純粋関数で、app を import しない。内容の意味は変わらないので、状態と版は変えない(承認済みのまま、陳腐化も起きない)。

## 設計判断

### キーは連番(`U-001`)

案は連番・ランダムな短い ID・タイトルから導く、の3つ(着手時の相談で連番に決めた)。連番は要件ID・画面ID と同じ作り方で、人が読める。タイトルから導くと、改名でキーが変わり、安定キーの意味が無い。

### 表示の ID は保存しない、付け直す

表示の `M-01-T02` は今までどおり並び順から導く([41-2](../Phase-41/Phase-41-2.md) 決定4)。手順書の `unit_id` を段階7の保存のたびに書き換える案は、段階8の版を上げてしまい、段階8の陳腐化の判定を乱す。読むときに付け直せば、段階8の行は変えずに済む。

### 改名は今までどおり作り直し

キーで付くようになっても、タスク名が違えば `UNIT_MISMATCH` のまま(手順書はそのタスクの中身を書いたものなので、名前が変われば見直しが要る)。並べ替えだけで作り直しを求めることは無くなった。

### 簡易モードは単位の ID をキーにする

簡易モードの作業単位は、実装計画書の WBS を毎回 md から解析して作るので、キーを保存する場所が無い。`PlanUnit.key` はタスクのキーが空なら単位の ID を返す。実装計画書を model にする [Phase 45](../Phase-41/Phase-41-5.md) で見直す。

### 単位の間の依存は表示の ID のまま

`depends_on` は表示の ID で書き、並べ替えの付け替えは画面の `relinkDependencies` が行う(Phase 26)。キーに変えると、生成のプロンプト・検証・画面の表示を全部変えることになり、変更の影響の役に立たない(#17 の判定)。範囲の外とした。

### 画面の型に `req_ids` を足した

画面の `toPlan` はタスクの `req_ids`(簡易モードの WBS の欄。Phase 38)を落としていた。詳細設計モードの段階7では空なので実害は無かったが、保存のたびに消える欄を残さないよう、キーと一緒に保つようにした。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `assign_unit_keys`・`carry_over_unit_keys`・`unit_key`・`normalize_plan` | pytest(`test_plan.py`) | スタブ不要 ── 対象が純粋(副作用なし)で、外部依存を呼ばないため | 振り方は並び順、重複は振り直す、古い `next_unit_seq` でも既存のキーと重ならない、並べ替えてもキーはタスクに付く、同じ名前が2つあるものは引き継がない |
| `PlanUnit.key`・`relabel_units`・`documented_unit_ids`・`generation_targets`・`merge_unit_procedure` | pytest(`test_procedure_doc.py`) | スタブ不要 ── 同上 | キーの無いタスクは単位の ID、並べ替えの後も同じ単位として数えて置き換える、キーの無い・段階7に無い手順書はそのまま |
| `key_plan`・`key_units`・`unkey_plan`・`unkey_units`(移行) | pytest(`test_unit_key_migration.py`。importlib で移行ファイルを読む) | スタブ不要 ── 変換は純粋関数で、DB を呼ばないため(行の読み書きは upgrade・downgrade の責務) | 何度流しても同じ、引けない手順書はキーを書かない、downgrade で元に戻る。結果を app の `relabel_units` で読む |
| `generate_plan`・`DesignStageService.save`(段階7) | pytest(`test_design_stage_plan_generation.py`) | FakeLLM(構造化出力の代わり)、DB はインメモリ SQLite | 生成でキーを振る、作り直しでタスク名の同じ単位は前のキー、保存でキーの空のタスクに振る |
| `generate_procedure_docs`・`DesignStageService.read`(段階8) | pytest(`test_design_stage_procedure_doc.py`) | FakeLLM、インメモリ SQLite | 生成した手順書がキーを持つ、段階7を並べ替えて承認し直しても手順書は同じ単位(表示の ID は今の並び順、`UNIT_MISMATCH` なし) |
| `toPlan`・`addTask`・`moveTask`・`procedureUnits`・`reassignUnit` | vitest(`planOps.test.ts`・`procedureDocOps.test.ts`) | スタブ不要 ── 純粋関数 | キー・要件ID・番号を保つ、足したタスクはキー空、`ProcedureUnit.key` の代わりの値 |

`procedure_output/source.py` は既存の `test_procedure_output_source.py` が直接 import する(この章の変更の後も通ることを確かめた)。`procedure_doc_drafting.py` は `test_design_stage_procedure_doc.py` が import する(#15)。

```sh
cd devex-api/backend && uv run pytest tests/unit/test_plan.py tests/unit/test_procedure_doc.py tests/unit/test_procedure_doc_validation.py tests/unit/test_unit_key_migration.py tests/unit/test_design_stage_plan_generation.py tests/unit/test_design_stage_procedure_doc.py tests/unit/test_procedure_output_source.py
cd devex-ui && npx vitest run src/features/detailed-design/__tests__/planOps.test.ts src/features/detailed-design/__tests__/procedureDocOps.test.ts
```

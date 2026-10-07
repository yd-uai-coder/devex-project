# Phase-27-1: 段階8の登録と手順書の model(BE)

## この章の目的

詳細設計モードの段階に、段階8(実装手順書)を足す。段階の一覧・入力(段階1〜7と要件定義)・DB の段階番号の制約・ルートの段階番号を 1〜8 に広げ、段階8の意味モデル(単位ごとの手順書)と、段階7から作業単位を並び順で取り出す `plan_units` を作る。承認・陳腐化・生成の状態は、段階1〜7の仕組みをそのまま使う。

自動実装モード: on([introduction](./Phase-27-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/stages.py`](../samples/backend/app/detailed_design/stages.py) | 更新 | `STAGES` に 8、`STAGE_INPUTS[8]`(段階1〜7と要件定義) |
| [`app/detailed_design/procedure_doc.py`](../samples/backend/app/detailed_design/procedure_doc.py) | 新規(前半) | `PROCEDURE_DOC_STAGE`・`FindingLevel`・`FINDING_LEVELS`・`UnitFileKind`、`UnitFile`・`TestPoint`・`AiFinding`・`UnitProcedure`・`ProcedureDocModel`、`PlanUnit`・`plan_units`(純粋) |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | `procedure_doc` の公開名の re-export |
| [`app/models/design_stage.py`](../samples/backend/app/models/design_stage.py) | 更新 | 段階番号の CHECK を `BETWEEN 1 AND 8` に |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | `mode` のコメント(段階1〜8) |
| [`alembic/versions/c9d0e1f2a3b4_add_procedure_doc_stage.py`](../samples/backend/alembic/versions/c9d0e1f2a3b4_add_procedure_doc_stage.py) | 新規 | CHECK の張り替え(downgrade は段階8の行を消してから 1〜7 に戻す) |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `DesignStageRead` の docstring(段階1〜8を返す) |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `list_stages` の docstring(段階1〜8) |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | `StageNumber` を `le=8` に |
| ── ここからテスト ── | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | `procedure_doc_model(unit_id?, title?, module?)`(`plan_model()` の M-01-T02 の手順書) |
| [`tests/unit/test_procedure_doc.py`](../samples/backend/tests/unit/test_procedure_doc.py) | 新規(前半) | model の既定値と `plan_units` の並び |
| [`tests/unit/test_design_stage_service.py`](../samples/backend/tests/unit/test_design_stage_service.py) | 更新 | 段階の一覧が 1〜8 になる |
| [`tests/unit/test_fake_llm_detailed_design.py`](../samples/backend/tests/unit/test_fake_llm_detailed_design.py) | 更新 | 段階1〜7を承認した後、段階8は「未着手」 |

`procedure_doc.py` と `test_procedure_doc.py` の後半(参照の導出)は 27-2 で書く。

## 要点の抜粋

```python
# app/detailed_design/stages.py
STAGES = (1, 2, 3, 4, 5, 6, 7, 8)
STAGE_INPUTS[8] = StageInputs(stages=(1, 2, 3, 4, 5, 6, 7), documents=("requirements",))
```

```python
# app/detailed_design/procedure_doc.py
PROCEDURE_DOC_STAGE = 8
FindingLevel = Literal["critical", "major", "minor"]   # 最重要 / 中程度 / 軽微
UnitFileKind = Literal["module", "test", "config"]     # module だけ段階4で検証する(27-2)

class UnitFile(BaseModel):    path; kind = "module"; responsibility = ""; basis = ""
class TestPoint(BaseModel):   viewpoint; sut; driver; stub
class AiFinding(BaseModel):   level = "major"; target; message; fix_stage(1〜8、既定 8)
class UnitProcedure(BaseModel):
    unit_id: str              # 作ったときの段階7の単位の ID
    title: str = ""           # 作ったときのタスク名(段階7と合わなければ 27-2 の検証でエラー)
    purpose; files: list[UnitFile]; notes; tests: list[TestPoint]; gwt; verify
    findings: list[AiFinding] # AI の指摘(設計に無いため決められないこと)
class ProcedureDocModel(BaseModel):  units: list[UnitProcedure]   # 手順書のある単位だけ

@dataclass(frozen=True)
class PlanUnit: unit_id: str; milestone: str; task: PlanTask
def plan_units(plan: PlanModel) -> list[PlanUnit]   # 計画の並び順 = 依存順
```

```python
# alembic/versions/c9d0e1f2a3b4_add_procedure_doc_stage.py(down_revision = b8c9d0e1f2a3)
def upgrade():   drop_constraint(ck_design_stages_stage_range) → create_check_constraint('stage BETWEEN 1 AND 8')
def downgrade(): DELETE FROM design_stages WHERE stage = 8 → 1〜7 の制約に戻す
```

`__init__.py` は `procedure_doc` の 27-1 の公開名(`FINDING_LEVELS`・`PROCEDURE_DOC_STAGE`・`AiFinding`・`FindingLevel`・`PlanUnit`・`ProcedureDocModel`・`TestPoint`・`UnitFile`・`UnitProcedure`・`plan_units`)を re-export する。依存の向きは `procedure_doc → plan`(27-2 で `data_model`・`logic`・`procedure`・`structure` も読む)。

## 設計判断

### 段階8の鍵は「単位の ID + 作ったときのタスク名」(着手時の決定2)

単位の ID(`M-01-T01`)は保存せず並び順から導く(Phase 26)。段階7を並べ替えると、同じ ID が別のタスクを指すようになる。

| 案 | 採否 | 理由 |
|---|---|---|
| ID とタスク名を保存し、合わなくなった手順書を検証のエラーにして作り直させる | **採用** | 段階7を承認し直せば段階8は既存の陳腐化で「古い」になるので、ずれに気づける。タスク名を見れば「別の単位の手順書を付けたまま」を防げる |
| マイルストーン名+タスク名を鍵にする | 不採用 | 並べ替えには強いが、改名で手順書が切れる |
| ID だけ | 不採用 | 並べ替えた後、別の単位の手順書がそのまま付いて見える |

自動で付け替えない理由: 並べ替えと改名が同時に起きると、どれがどれか決められない。手順書は AI が単位ごとに作り直せる(Phase 28)ので、作り直しを促す方が単純で安全である。

### 単位の一覧は段階7の並び順のまま

依存先は前の単位だけを指せる(Phase 26 の `FORWARD_DEPENDENCY`)ので、計画の並び順がそのまま依存順になる。デモの `sortUnitsByDependency`(依存順への並べ替えと循環の検出)は要らない。

### 入力に要件定義を入れる

段階8の手順書の概要(index)には「対象外(Should / Could / Won't)」を書く(見本の [`index.md`](../../appendix/implementation-procedure-sample/implementation_procedure/index.md))。その出力は Phase 30 だが、`STAGE_INPUTS` を後から変えると入力の指紋が変わり、承認済みの段階8が全部「古い」になる。そこで今入れる。

### 生成器は登録しない

`STAGE_GENERATORS` に段階8が無いので、生成を頼むと既存の 409 `DESIGN_STAGE_GENERATION_NOT_SUPPORTED` になる。生成は Phase 28。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ProcedureDocModel`(既定値)・`plan_units` | pytest(`test_procedure_doc.py`) | スタブ不要 ── 純粋(副作用なし)で、外部依存を呼ばないため | 第一テストの統合スモーク: fixture の `procedure_doc_model()` を読み、`PROCEDURE_DOC_STAGE == 8`。単位の並びは計画の並び順 |
| `DesignStageService.list_stages`・ルート | pytest(`test_design_stage_service.py`) | スタブ不要 ── DB はインメモリ SQLite(本物の永続化を通す) | 段階の一覧が 1〜8(`STAGES`・`STAGE_INPUTS`・`StageNumber` の変更をルート越しに確かめる) |
| 偽 LLM での段階1〜7の通し | pytest(`test_fake_llm_detailed_design.py`) | 偽 LLM(`E2eFakeLLM`。既存) | 段階1〜7を承認すると段階8は開くが「未着手」 |

`app/models/project.py` は fixture のプロジェクト作成で、`app/models/design_stage.py` はサービスのテストで import される。移行ファイルはテストから import しない(DDL だけで、純粋関数を持たないため。開発 DB で upgrade → downgrade → upgrade を確かめた。[introduction](./Phase-27-introduction.md)「検証結果」)。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_procedure_doc.py tests/unit/test_design_stage_service.py tests/unit/test_fake_llm_detailed_design.py
```

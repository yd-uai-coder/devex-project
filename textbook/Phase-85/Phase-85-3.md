# Phase-85-3: 段階への反映

## この章の目的

文書へ反映した CR(反映済み)を、詳細設計の段階の生成(`POST /projects/{id}/design-stages/{stage}/generate`)にも `cr_number` で渡せるようにする。指摘(`finding_ids`)と同じく、開発者が段階ごとに押す(着手時の相談のユーザー決定)。生成した下書きに CR とモデル名を残し、CR の時系列に段階の反映を1行足す。

自動実装モード: on([introduction](./Phase-85-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `DesignStageGenerate.cr_number`、`GenerationChangeRequestRead`、`DesignStageRead.generation_change_request`・`generated_model` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `record_stage_apply` |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | 一覧・1件の読み出しで、直近の生成の CR を引いて応答に入れる(`_generation_change_requests`・`_generation_change_request_read`) |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | 受け付け(`reflectable(stage=True)`)・生成(指示・モデル名・時系列) |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | `generate_design_stage` が `cr_number` を受けて background task に渡す |
| [`tests/unit/test_change_request_stage_reflection.py`](../samples/backend/tests/unit/test_change_request_stage_reflection.py) | 新規 | 指示・応答・時系列・反映済みでない CR・CR なしの作り直し・ルート |
| [`tests/unit/test_design_stage_generation.py`](../samples/backend/tests/unit/test_design_stage_generation.py) | 更新 | background task の位置引数に `cr_number`(None) |

依存の向き: `DesignStageGenerationService` → `ChangeRequestService`(新しい向き)。`DesignStageService` → `ChangeRequestRepository`・`change_request_label`(読み出しだけ。サービスは import しない)。`ChangeRequestService` は `BaselineService` を通して `DesignStageService` を使うので、`DesignStageService` から `ChangeRequestService` を import すると循環する ── 読み出しはリポジトリで済ませた。

## 1. 受け付けと生成

```python
# app/services/design_stage_generation_service.py(抜粋)
# request_generation: 指摘の確かめの後に
change_request = (
    await ChangeRequestService(self._session).reflectable(project, cr_number, stage=True)
    if cr_number is not None else None
)
row.generation_change_request_id = change_request.id if change_request is not None else None

# execute
reflection = await change_requests.reflection(project_id, cr_number, stage=True)
resolved = injected_llm(llm, Purpose.GENERATION) if llm is not None else await LlmResolver(...).resolve(...)
instruction = join_instructions([build_instruction(sendback), reflection.instruction if reflection else ""])
...
row.generated_model = resolved.model
row.generation_change_request_id = reflection.change_request.id if reflection is not None else None
if reflection is not None:
    await change_requests.record_stage_apply(
        reflection.change_request, stage=stage, version=row.version, model=resolved.model, ...
    )
```

- **段階は反映済みの CR だけ**(85-1): 合意だけの CR は 409 `CR_NOT_REFLECTABLE`。
- **CR の記録は受け付けと生成の後の2回**: 受け付けで `generation_change_request_id` を書くのは、指摘の `generation_finding_ids`(Phase 69)と同じく、生成中の画面に「この作り直しで渡したもの」を出せるようにするため。生成の後にもう一度書くのは、裏で CR が外れた(非 strict)ときに、渡していない CR を残さないため。CR なしで作り直すと NULL に戻る。
- **モデル名を段階にも残す**: 文書の版の `generated_model`(Phase 81)と対にした(仕様の「生成の版に CR と生成したモデルを残す」を段階にも当てた。Claude の判断)。解決の結果(`ResolvedLlm`)を持つため、`.llm` だけを取っていた所を `resolved` に変えた。テストが注入した LLM は `injected_llm` で既定のモデル名になる(文書と同じ)。
- **時系列**: `apply`(`applied → applied`)の行。`note` は「段階1の下書きを作り直した」、`refs` は `{"stage", "version", "model"}`(`version` は生成で増えた後の段階の版)。生成と同じ commit に入るので、生成が失敗すると行も残らない。
- **段階の承認で付く印**: 段階の生成は印を付けない(印は承認のときに付く。Phase 43)。CR を渡して作り直した段階を承認したときの印を CR に結ぶか(出どころに `cr:` を足すか、写しに重ねるか)は、検証の条件と一緒に Phase 86 で決める(申し送り)。

## 2. 応答

```python
# app/schemas/design_stage.py(抜粋)
class GenerationChangeRequestRead(BaseModel):
    number: int
    label: str          # CR-1…
    title: str

class DesignStageRead(BaseModel):
    ...
    generation_change_request: GenerationChangeRequestRead | None = None
    generated_model: str | None = None
```

- 読み出しは、直近の生成に CR を渡した段階があるときだけ、プロジェクトの CR をまとめて1回読む(指摘の `_generation_findings` と同じく、段階ごとに読まない)。CR が見つからなければ null。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_stage_reflection.py`(新規) | `DesignStageGenerationService.request_generation`・`execute` の `cr_number`、`ChangeRequestService.record_stage_apply`、`DesignStageService.read` の応答、`DesignStageGenerate`・`GenerationChangeRequestRead`、ルート `generate_design_stage` | pytest のテスト関数 | DB はインメモリ SQLite。設計は `create_impact_project`。CR は合意まで本物のサービスで進め、文書への反映は状態だけを「反映済み」にして済ませる(文書の反映は 85-2 のテストが確かめる)。段階の生成の LLM は FakeLLM(段階1の構造化出力。プロンプトを記録する) |
| `test_design_stage_generation.py`(更新) | ルートの background task の位置引数 | pytest のテスト関数 | 既存のまま |

- 指示: 段階1のプロンプトの `## 修正指示` に CR の頭の1文。
- 応答: `generation_change_request` が `CR-1` とタイトル、`generated_model` が入る。
- 時系列: 最後の行が `apply`(`applied → applied`)、`refs` が段階・版・モデル名、`note`。
- 受け付け: 合意だけの CR は 409、無い番号は 404(どちらも段階は生成中にならない)。
- CR なしの作り直し: `generation_change_request` が null に戻り、時系列の `apply` は増えない。

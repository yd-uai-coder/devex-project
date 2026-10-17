# Phase-69-2: 作り直しに渡した指摘を段階に記録する

## この章の目的

差し戻し(採用した指摘で段階を作り直す。[Phase 54](../Phase-54/Phase-54-introduction.md))で作り直した段階に検証のエラーが残ると、承認できない。そのとき利用者が「この内容は、どの指摘を受けて作り直したものか」を見られるように、生成の受け付けで渡した指摘の ID を段階に記録し、段階の読み出しで指摘の要約を返す。画面に並べるのは [69-4](./Phase-69-4.md)。

自動実装モード: on([introduction](./Phase-69-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/models/design_stage.py`](../samples/backend/app/models/design_stage.py) | 更新 | `generation_finding_ids`(JSON。NULL 可) |
| [`alembic/versions/b8e4d0f2a6c3_add_generation_finding_ids_to_design_stages.py`](../samples/backend/alembic/versions/b8e4d0f2a6c3_add_generation_finding_ids_to_design_stages.py) | 新規 | `design_stages.generation_finding_ids` を足す |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `GenerationFindingRead`・`DesignStageRead.generation_findings` |
| [`app/repositories/review.py`](../samples/backend/app/repositories/review.py) | 更新 | `list_findings`(プロジェクトの指摘を ID でまとめて読む) |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | 受け付けで `finding_ids` を記録する |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | 一覧と1段階の読み出しで、記録した指摘を引いて返す |
| [`tests/unit/test_stage_generation_findings.py`](../samples/backend/tests/unit/test_stage_generation_findings.py) | 新規 | 記録・消す・消えた指摘と別のプロジェクトの指摘 |

## 1. 記録する(`generation_finding_ids`)

```python
# app/services/design_stage_generation_service.py(request_generation の要点)
row.generation_status = "generating"
row.generation_error = None
row.generation_finding_ids = [str(i) for i in finding_ids] or None   # 指摘なしの生成は None
```

- 受け付けで書く(生成の成否によらない)。実行(`execute`)は今までどおり `finding_ids` を引数で受け、修正指示を組み立て直す。
- 今まで指示の本文はどこにも保存していなかった(実行のたびに `review_findings` から作る)。記録するのは ID だけにし、読み出しで指摘の今の行を引く(重要度・問題の文を写して二重に持たない)。
- 指摘を渡さない生成(普通の下書きの作り直し)では None に戻す。前の差し戻しの指摘が、関係の無い作り直しの後まで残らないように。

## 2. 読み出しで返す(`generation_findings`)

```python
# app/schemas/design_stage.py(要点)
class GenerationFindingRead(BaseModel):
    id: uuid.UUID
    level: str
    targets: list[str]
    problem: str

class DesignStageRead(BaseModel):
    ...
    generation_findings: list[GenerationFindingRead] = Field(default_factory=list)
```

```python
# app/repositories/review.py(要点)
async def list_findings(self, *, project_id, finding_ids) -> list[ReviewFinding]:
    # 回を join し、プロジェクトの回の指摘だけ(別のプロジェクトの ID は入らない)
```

```python
# app/services/design_stage_service.py(要点)
async def list_stages(self, project):
    rows, views, documents = await self._load(project)
    ...
    findings = await self._generation_findings(project.id, rows.values())   # 全段階の分を1回で
    return [_to_read(views[stage], rows.get(stage), sources, findings) for stage in views]
```

- 段階の一覧はポーリングで5秒ごとに読まれるので、段階ごとに引かず、記録のある段階の ID をまとめて1回の `IN` で読む。
- `_to_read` は純粋な組み立てのまま、引いた指摘の辞書を受け取る(引数の既定は None。ほかの呼び出しは変えない)。並びは渡した順。記録の後に消えた指摘(レビューの回ごと消えるなど)は飛ばす。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_stage_generation_findings.py` | `DesignStageGenerationService.request_generation`・`DesignStageService`(`list_stages`・`read`)・`ReviewRunRepository.list_findings` | pytest の関数 | スタブ不要 ── 受け付けと読み出しだけを通し、LLM を呼ぶ `execute` は呼ばないため。DB はテスト用の SQLite | 受け付けで記録し、渡した順に重要度・問題を返す(一覧と受け付けの戻り値で同じ・ほかの段階は空)/ 指摘なしの受け付けで消す / 消えた指摘と別のプロジェクトの指摘は返さない |

この章で作成・更新した本体のファイルは、すべてこのテストが import する(`models/design_stage.py` は `DesignStage`、`schemas/design_stage.py` は読み出しの戻り値を通して)。既存の段階の生成・差し戻しのテスト(`test_design_stage_generation.py`・`test_review_sendback.py`)は変えずに通る。

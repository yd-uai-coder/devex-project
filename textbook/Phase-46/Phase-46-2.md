# Phase-46-2: 印の記録

## この章の目的

文書の表示中の版が再生成・復元で切り替わったときに、簡易モードでも前の版の model と比べ、段階8の単位の手順書に印を記録する。Phase 43 の記録の仕組み(`record_document_change` → `_record_impact`)を、要素の組み立てだけモードで切り替えて使う。承認を止める 409・確認済み・影響の API は変えずにそのまま効く。

自動実装モード: on([introduction](./Phase-46-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/backend/` 配下(表は依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `IMPACT_DOCUMENTS` をモードごとに。`record_document_change` が簡易モードも扱う。`_impact_by_stage`・`_record_impact` は要素の列を受ける |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | `restore_version` の docstring だけ(記録が詳細設計モードに限らなくなった) |
| ── ここからテスト ── | | |
| [`tests/unit/test_design_stage_impact.py`](../samples/backend/tests/unit/test_design_stage_impact.py) | 更新 | 簡易モードの記録・承認を止める・API の5件。簡易モードを無視していたテストを、model の無い版・段階の入力でない文書を無視するテストにした |
| [`tests/unit/test_fake_llm_simple_procedure.py`](../samples/backend/tests/unit/test_fake_llm_simple_procedure.py) | 更新 | 偽 LLM の4文書で、同じ版の切り替えでは印が付かない |

## 要点の抜粋

### 1. 記録

```python
# app/services/design_stage_service.py
IMPACT_DOCUMENTS: dict[str, tuple[str, ...]] = {
    "detailed": ("requirements", "external_design"),
    "simple": ("requirements", "external_design", "internal_design", "implementation_plan"),
}

async def record_document_change(self, project, doc_type, before_model, after_model) -> None:
    if doc_type not in IMPACT_DOCUMENTS.get(project.mode, ()):
        return
    ...
    if project.mode == "simple":
        before = build_simple_elements(SimpleModels.from_dicts(stages.get(8), {**docs, doc_type: before_model}))
        after = build_simple_elements(SimpleModels.from_dicts(stages.get(8), {**docs, doc_type: after_model}))
    else:
        before = build_elements(DesignModels.from_dicts(stages, {**docs, doc_type: before_model}, er_tables))
        ...
    _record_impact(rows, doc_source(doc_type), before, after, stages=(DOCUMENT_STAGE,))
```

- 文書の文脈は `stage_inputs(project.mode)` の文書(簡易モードは4文書)の表示中の版。比べる1文書だけを前の版に差し替える(詳細設計モードと同じ)。
- 生成(`DocGeneratorService.generate`)は4文書を作り終えてから、1文書ずつ `record_document_change` を呼ぶ(Phase 43 のまま)。他の3文書は新しい版で固定し、1文書ずつ差分を取るので、印の出どころ(`doc:internal_design` など)が文書ごとに付く。
- 印を付けるのは、段階8を一度でも承認しているとき(`_records_impact`。Phase 43 と同じ)。承認していない段階8は、見直す前の内容が無い。
- どちらかの版に model が無ければ比べない。Phase 45 より前の版から再生成した最初の1回は印が付かない(申し送り)。

### 2. 要素の列を受ける形に

```python
# app/services/design_stage_service.py
def _impact_by_stage(source: str, before_elements: list[Element], after_elements: list[Element], *, stages) -> dict[int, StageImpact]: ...
def _record_impact(rows, source, before: list[Element], after: list[Element], *, stages) -> None: ...
```

組み立て(`build_elements` か `build_simple_elements`)は呼び出し側に出した。`_pending_impact`・`_record_stage_change`(段階の承認の差分)は詳細設計モードだけなので、`build_elements` を呼ぶ形に書き換えただけで挙動は変えていない。

### 3. そのまま効くもの

- 承認を止める: `approve` の `blocking_marks` は両モードで見ていた(簡易モードは印が空なので止まらなかった)。文書から届いた未確認の印があれば段階8の承認は 409 `DESIGN_STAGE_UNREVIEWED_IMPACT`。承認で印は消える。
- `GET /design-stages/impact` は簡易モードでは段階8だけを返す(Phase 43 のまま)。再生成の候補(段階8の単位)、`DesignStageRead.impact_open`・`impact_reviewed` も同じ。
- pending の印(承認前の編集の差分)は詳細設計モードだけ。簡易モードは段階8の下流が無い。

## 設計判断

- **記録の入口は1つのまま**(`record_document_change` の中でモードを分ける)。生成・復元の呼び出し側は変えずに済む。
- **要素の組み立てを辞書で選ぶ仕組み**(モード → 関数)は作らなかった。分岐は `record_document_change` の1か所だけで、駆動する消費者がほかに無い(#17)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
| --- | --- | --- | --- |
| `record_document_change`(簡易モード)・`restore_version` の記録の呼び出し | pytest(`test_design_stage_impact.py`)。見本は `create_simple_impact_project`(46-1) | スタブ: DB はインメモリ SQLite(`db_session`)を本物のリポジトリで使う。LLM は呼ばない(版を直接作って復元する) | DF のトリガーを変えた版への切り替えで U-002 だけに印・出どころ `doc:internal_design`、要件の変更がタスク経由で単位に届き基盤の単位に届かない、未承認の段階8には記録しない |
| `approve`・`review_marks`(段階8) | 同上 | 同上 | 未確認の印で 409、確認済みにすると止める印が無くなる |
| ルート `get_design_impact`・`list_design_stages` | 同上(ルート関数を素で呼ぶ) | 同上 | 段階8だけ・印のラベル・再生成の候補・未確認の件数 |
| 偽 LLM の4文書の経路 | `test_fake_llm_simple_procedure.py` | スタブなし ── 偽 LLM は検証される側 | 同じ版の切り替えで印0件(偽 LLM の model が雑音の差分を出さない) |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_design_stage_impact.py tests/unit/test_fake_llm_simple_procedure.py -q
```

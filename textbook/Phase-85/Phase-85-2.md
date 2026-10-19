# Phase-85-2: 文書への反映

## この章の目的

合意した CR を、文書の再生成(`POST /projects/{id}/generate`)に `cr_number` で渡せるようにする。設計レビューの指摘(`finding_ids`)と同じく、受け付けで確かめ(strict)、バックグラウンドの生成でもう一度読み(非 strict)、作り直す設計書のプロンプトに 85-1 の指示を入れる。生成が終わったら、同じトランザクションで、版に CR を残し、CR を反映済みにし、付いた印を CR に写す。

自動実装モード: on([introduction](./Phase-85-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`alembic/versions/f9c9614d5329_add_change_request_reflection.py`](../samples/backend/alembic/versions/f9c9614d5329_add_change_request_reflection.py) | 新規 | 4表の列(下の表)。どれも NULL 可 |
| [`app/models/generated_document.py`](../samples/backend/app/models/generated_document.py) | 更新 | `change_request_id`(FK SET NULL) |
| [`app/models/change_request.py`](../samples/backend/app/models/change_request.py) | 更新 | `ChangeRequest.applied_impact`・`ChangeRequestEvent.refs` |
| [`app/models/design_stage.py`](../samples/backend/app/models/design_stage.py) | 更新 | `generation_change_request_id`(FK SET NULL)・`generated_model`(使うのは 85-3) |
| [`app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py) | 更新 | `create_version(change_request_id=)` |
| [`app/repositories/change_request.py`](../samples/backend/app/repositories/change_request.py) | 更新 | `add_event(refs=)` |
| [`app/schemas/document.py`](../samples/backend/app/schemas/document.py) | 更新 | `GenerationRequest.cr_number`(1以上) |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `ChangeRequestEventRead.refs` |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `ChangeRequestNotReflectableError`(409 `CR_NOT_REFLECTABLE`) |
| [`app/detailed_design/impact/marks.py`](../samples/backend/app/detailed_design/impact/marks.py) | 更新 | `cr_source`、`record(extra_sources=)` |
| [`app/detailed_design/impact/__init__.py`](../samples/backend/app/detailed_design/impact/__init__.py) | 更新 | `cr_source` の re-export |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `record_document_change` が記録した印を返し、`extra_sources` を受ける(`_record_impact` も) |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `Reflection`・`reflectable`・`reflection`・`record_document_apply`・`merge_applied_marks` |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 受け付け・生成・記録に `cr_number` |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | `trigger_generation` が `cr_number` を受けて background task に渡す |
| [`tests/unit/test_change_request_reflection.py`](../samples/backend/tests/unit/test_change_request_reflection.py) | 新規 | 指示・版・反映済み・時系列・印・やり直し・受け付けの確かめ・非 strict・ルート |
| [`tests/unit/test_doc_generation_start.py`](../samples/backend/tests/unit/test_doc_generation_start.py) | 更新 | background task の引数に `cr_number`(None) |

依存の向き: ルート → `DocGeneratorService` → `ChangeRequestService`(新しい向き)・`DesignStageService`(既存)。`ChangeRequestService` は `doc_generator_service` を import しないので循環しない。純粋層は `instruction.py`(85-1)と `marks.cr_source`。

## 1. 列(マイグレーション `f9c9614d5329`)

| 表 | 列 | 使う章 |
|---|---|---|
| `generated_documents` | `change_request_id`(FK `change_requests.id` SET NULL) | 85-2 |
| `change_requests` | `applied_impact`(JSON。反映で付いた印の写し) | 85-2・85-4 |
| `change_request_events` | `refs`(JSON。行が指す版・モデル名) | 85-2・85-3 |
| `design_stages` | `generation_change_request_id`(FK SET NULL)・`generated_model` | 85-3 |

- 1本にまとめた(計画どおり)。4表とも列を足すだけで、既存の行は NULL(CR を渡していない・記録の前)。
- FK は SET NULL。CR はプロジェクトの削除でだけ消える(CASCADE)ので、ふだん NULL にはならないが、版と段階の行を CR の行に縛らないため。名前は PostgreSQL の既定の形(`<表>_<列>_fkey`)を明示し、downgrade で落とせるようにした。
- 使い捨ての DB で `upgrade head` → `alembic check`(差なし)→ `downgrade fee4fbc2a00c` → `upgrade head` を確かめた。

## 2. 受け付けとバックグラウンド

```python
# app/services/change_request_service.py(抜粋)
@dataclass(frozen=True)
class Reflection:
    change_request: ChangeRequest
    instruction: str                       # build_cr_instruction(facts_of(cr, 束の番号))

async def reflectable(project, number, *, stage=False) -> ChangeRequest
    # 無ければ 404、文書は agreed/applied、段階は applied でなければ 409 CR_NOT_REFLECTABLE
async def reflection(project_id, number, *, stage=False) -> Reflection | None
    # 非 strict: 番号が None・消えた・渡せない状態なら None(生成は CR なしで続ける)
```

```python
# app/services/doc_generator_service.py(抜粋)
# request_generation: 指摘の確かめの後に
if cr_number is not None:
    await ChangeRequestService(self._session).reflectable(project, cr_number)
    if not any(t in DOC_TYPES_BY_MODE[project.mode] for t in targets):
        raise ChangeRequestNotReflectableError(...)      # テスト仕様書だけの生成
```

- **strict と非 strict の2段**: 指摘(`sendback_findings(strict=True/False)`)と同じ。受け付けで誤りを返し、裏の生成までの間に状態が変わった CR(例: 検証済み)は黙って外す。裏で例外にすると、生成そのものが失敗になってしまうため。
- **テスト仕様書だけの生成には渡せない**: テスト仕様書の生成は【修正指示】を持たない(Phase 54 の指摘も渡していない)。渡しても何も反映されないのに「反映済み」になってしまうので 409 にした。
- **確かめの順**: 指摘の確かめの後、生成中の確かめ(`recover_if_stale` → 409)の前。どれで断っても `generating` にはならない。

## 3. 生成と記録

```python
# app/services/doc_generator_service.py(generate の抜粋)
reflection = await change_requests.reflection(project_id, cr_number)
cr_instruction = reflection.instruction if reflection is not None else ""
...
instruction = join_instructions(
    [build_instruction(findings_for([doc_type], sendback)), cr_instruction]
)
document = await self._documents.create_version(..., change_request_id=change_request_id)
versions.append((doc_type, document.version))
...
marks += await self._stages.record_document_change(
    project, doc_type, previous, new, extra_sources=(cr_source(n),) if reflection else ()
)
if reflection is not None and versions:
    await change_requests.record_document_apply(
        reflection.change_request, documents=versions, model=resolved.model, marks=marks,
        actor_id=user_id,
    )
```

- **同じトランザクション**: 版の追加・印の記録・CR の遷移と時系列・印の写しは、生成の commit で一度に入る。生成が失敗すると rollback で全部消え、CR は合意のまま残る(反映済みだけが残ることは無い)。
- **反映済みは自動**(ユーザー決定): 文書の再生成が成功したら `apply` の行を足す。合意からなら `agreed → applied`、やり直しなら `applied → applied`。`note` は「要件定義書 v2・外部設計書 v2 を作り直した」、`refs` は `{"documents": [{doc_type, version}], "model"}`。
- **印の出どころに `cr:<番号>`**: `record(..., extra_sources=)` が出どころにだけ足す(変わったもの `changes` の出どころは `doc:<種類>` のまま)。Phase 86 で「CR の反映が出どころの印」を見分けるため。同じ要素にあとから CR なしの変更が届いても、出どころは重ねるだけなので `cr:` は消えない(未確認には戻る)。
- **印の写し(`applied_impact`)**: 段階の印は、その段階を承認すると消える(Phase 43)。反映の後に人が印を確かめて段階を承認すると、比べる相手が無くなるので、`record_document_change` が返した印を CR に写して残す(`merge_applied_marks`。同じキーは新しい印にする)。比較(85-4)はこの写しを使う。
- `record_document_change` は、印を記録しない段階(一度も承認していない段階)に届いた印は返さない。比較では、その段階の予測は「承認していない段階」として分けて示す(85-4)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_reflection.py`(新規) | `DocGeneratorService.request_generation`・`generate` の `cr_number`、`ChangeRequestService.reflectable`・`reflection`・`record_document_apply`・`merge_applied_marks`、`record_document_change` の `extra_sources`、リポジトリ・モデルの列、`GenerationRequest`、ルート `trigger_generation` | pytest のテスト関数 | DB はインメモリ SQLite を本物のリポジトリで使う。設計は段階1〜8 承認済みの fixture(`create_impact_project`)から合意済みの版を作る。文書の生成の LLM は FakeLLM(構造化出力の見本を返し、プロンプトを記録する) |
| `test_doc_generation_start.py`(更新) | ルート `trigger_generation` の background task の引数 | pytest のテスト関数 | 既存のまま(FakeLLM・FakeRedis) |

- 指示: 作り直した要件定義書・外部設計書のプロンプトのどちらにも CR の頭の1文、要件定義書に案の行。
- 記録: 版の `change_request_id` とモデル名 / CR が反映済み / 時系列の `apply`(`agreed → applied`)の `refs` と `note` / 段階1の `fn:F-01` の印の出どころに `doc:requirements` と `cr:1` / CR の写しに `fn:F-01`。
- やり直し: 2回目は `applied → applied` の行が足される。
- 受け付け: 無い番号は 404 / 下書きは 409(`generating` にならない)/ テスト仕様書だけは 409 / 段階は反映済みでなければ 409(`reflectable(stage=True)`)。
- 非 strict: 受け付けの後に検証済みになった CR は、指示にも版にも時系列にも入らない。
- 純粋: `merge_applied_marks` は同じキーを新しい印にし、置き場とキーの順に並べる。

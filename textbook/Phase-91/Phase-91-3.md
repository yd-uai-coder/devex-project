# Phase-91-3: 束の作成・「採用にする」での記録と、版の巡回

## この章の目的

合意の記録を、2つの出どころから作る。合意済みの版(束)を作ると、入った文書の要素をまとめて合意にし、前の合意にあって束に無い要素を「外れた」と記録する。「採用にする」(推測の要件を確かめる操作)は、その行の合意になり、誰が・いつ確かめたかが初めて残る。あわせて、版の巡回(直近3件)で束が写した版も消さないようにする([90-1](../Phase-90/Phase-90-1.md) 決定6)。

自動実装モード: on([introduction](./Phase-91-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py) | 更新 | 巡回で、束が写した版を消さず数にも入れない(`_baseline_versions`) |
| [`app/services/agreement_service.py`](../samples/backend/app/services/agreement_service.py) | 新規 | `AgreementService.record_baseline`・`record_adopt`(一覧は [91-4](./Phase-91-4.md)) |
| [`app/services/baseline_service.py`](../samples/backend/app/services/baseline_service.py) | 更新 | 束の作成で `record_baseline` を呼ぶ |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | `adopt_requirement` が `recorded_by` を受け、`record_adopt` を呼ぶ |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | 採用のルートに `CurrentUserDep` |
| [`tests/unit/test_agreement_recording.py`](../samples/backend/tests/unit/test_agreement_recording.py) | 新規 | 束・外れた・採用・簡易モード・巡回 |
| [`tests/unit/test_document_versions.py`](../samples/backend/tests/unit/test_document_versions.py) | 更新 | 採用のルートを利用者つきで呼ぶ |

## 1. 記録のサービス

```python
# app/services/agreement_service.py(抜粋。91-3 の分)
class AgreementService:
    async def record_baseline(self, baseline: Baseline, models: Mapping[str, Mapping | None], *,
                              recorded_by) -> list[AgreementRecord]
    async def record_adopt(self, project: Project, row: RequirementRow, *,
                           recorded_by) -> list[AgreementRecord]
```

- **`record_baseline`**: 束が写した要件定義書・外部設計書の model から `agreement_items`([91-1](./Phase-91-1.md))で要素を作り、今の合意(`current`)と `removed_keys` で比べて、外れた要素の記録も足す。model の形が正しくなければ(`parse_model` が `None`)要素は無い。
- **`record_adopt`**: 採用にした行(出どころは `adopted`)を1件記録する。**簡易ドキュメントモードでは記録しない**(Claude の判断): 合意は詳細設計モードの機能で、簡易モードでは束も CR も無い。採用そのものは今までどおり両モードでできる。
- **commit は呼ぶ側**: 束の作成・採用と同じトランザクションで書く。記録だけが残る・記録だけが欠ける、が起きない。
- **束のサービスと記録のサービスを分けた**: 記録は Phase 93(CR の反映)・95(履歴)も使う。束のサービスの中に置くと、CR のサービスから使うときに循環しやすい(CR のサービスは束のサービスを使う)。

## 2. 呼ぶ側

```python
# app/services/baseline_service.py(抜粋)
baseline = await self._baselines.create(...)
await AgreementService(self._session).record_baseline(
    baseline, {doc_type: doc.model if doc else None for doc_type, doc in documents.items()},
    recorded_by=recorded_by,
)

# app/services/doc_generator_service.py(抜粋)
async def adopt_requirement(self, project, req_id, *, recorded_by: uuid.UUID | None = None):
    ...
    row = next(row for row in adopted.rows if row.id == req_id)
    await AgreementService(self._session).record_adopt(project, row, recorded_by=recorded_by)
```

- 束の記録は、束に写した版の model から作る(束と記録が同じ中身になる)。テスト仕様書は合意の対象ではないので渡しても使わない。
- 採用のルートは `CurrentUserDep` を受け、記録した人を残す。応答(`GeneratedDocumentRead`)は変えないので、画面(devex-ui)は変えていない。

## 3. 版の巡回

```python
# app/repositories/generated_document.py(抜粋)
kept = await self._baseline_versions(project_id=project_id, doc_type=doc_type)
plain = [row for row in existing if row.change_request_id is None and row.version not in kept]
```

- `baseline_items` の `key`(文書の種類)と `source_version` を、束のプロジェクトで引く。CR で反映した版(ステージ11)と同じく、消さず数にも入れない。
- 束は写しを持っているので、元の版が消えても合意の中身は失われない。それでも残すのは、束の写しと元の版を版の履歴で並べて見られるようにするため(決定6)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_agreement_recording.py`(新規) | `AgreementService.record_baseline`・`record_adopt`(`BaselineService.create`・`DocGeneratorService.adopt_requirement` の経路で)と、`create_version` の巡回 | pytest のテスト関数 | スタブ不要 ── LLM を呼ばない経路だけで、DB はインメモリの SQLite |
| `test_document_versions.py`(更新) | 採用のルート `adopt_requirement` | pytest のテスト関数(ルートの関数を直接呼ぶ) | スタブ不要(同上) |

- 束を作ると文書の6要素が出どころ「束」・記録した人つきで今の合意になる / 次の束で外した要件は「外れた」になり、今の合意から消える / 詳細設計モードの採用は、採用にした行(出どころ `adopted`)を記録する / 簡易モードの採用は記録しない / 束が写した v1 は、上限より多く版を作っても消えない。
- 題材は `tests/fixtures/change_impact.py` の `create_impact_project`(段階1〜8 承認済みの予約の設計)。

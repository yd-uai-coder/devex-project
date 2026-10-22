# Phase-101-3: 規模の API と、反映の後の比較

## この章の目的

101-1 の規模と 101-2 の説明書を API で使えるようにする。サービスが束に入っている段階の状態を説明書に渡し(古い段階の注記)、反映の後の比較に、規模の予測の数と実際の数を並べる(決定1の「反映の後は実際の数を比較に並べる」)。要約の応答には、確認済みのまま古くなったこと(`needs_reconfirm`)を足す。画面は Phase 107。

自動実装モード: on([introduction](./Phase-101-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | `ScaleComparisonRead`・`ChangeRequestComparisonRead.scale`・`ExplanationSummaryRead.needs_reconfirm` |
| [`backend/app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 束の段階の状態を説明書へ。比較の規模(`_actual_scale`)。`ExplanationView.summary_needs_reconfirm` |
| [`backend/app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 比較の応答に規模を渡す |
| [`backend/tests/unit/test_change_request_comparison.py`](../samples/backend/tests/unit/test_change_request_comparison.py) | 比較の応答の規模 |
| [`backend/tests/unit/test_change_request_service.py`](../samples/backend/tests/unit/test_change_request_service.py) | 確認済みのまま古い要約 |
| [`backend/tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 要約の応答の `needs_reconfirm` |
| [`backend/tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | 説明書と比較の応答の規模・`needs_reconfirm`(実 PostgreSQL) |

## 1. 束の段階の状態を説明書へ

```python
# app/services/change_request_service.py(抜粋)
return baseline, ImpactView(
    ...,
    excluded=[ExcludedItem(key=item.key, state=item.state) for item in baseline.items if not item.included],
    stage_states={
        int(item.key.removeprefix(STAGE_PREFIX)): item.state
        for item in baseline.items
        if item.included and item.key.startswith(STAGE_PREFIX)
    },
)
```

- 束の行(`BaselineItem`)は、入っている段階にも束を作った時点の状態(`approved`・`outdated` など)を持つ。今までは入っていないものの状態だけを説明書に渡していた。B-4 は段階1〜8 がすべて `outdated` のまま入っていた。
- `_explanation` は `build_explanation(..., view.stage_states)` で渡す。

## 2. 比較の実際の数

```python
# app/services/change_request_service.py(抜粋)
scale = compare_scale(
    (await self._explanation(change_request)).scale,          # 予測の数(説明書の3節と同じもの)
    await self._actual_scale(project, change_request, applied),
    [item.key for item in view.prediction.items],
    change_request.document_checks or [],
)

async def _actual_scale(self, project, change_request, applied) -> Scale:
    rows = await DesignStageRepository(self._session).list_for_project(project.id)
    models = {row.stage: row.model for row in rows if row.model}
    test_spec = await GeneratedDocumentRepository(self._session).get_current(project_id=project.id, doc_type="test_spec")
    sources = ScaleSources(
        plan=parse_model(PlanModel, models.get(7)),
        procedure_docs=parse_model(ProcedureDocModel, models.get(8)),
        test_spec=test_spec.model if test_spec is not None else None,
        has_external_design=True,
        missing_stages=frozenset(s for s in (1, 7) if s not in models),
    )
    return count_scale([(m.key, m.label) for m in applied], sources,
                       requirement_ids=target_ids(targets_from_json(change_request.targets)))
```

- 実際は、反映で付いた印(`applied_impact`。文書の反映と、CR で作り直した段階の承認で重ねたもの)の要素を、同じ `count_scale` で数える(相談の決定6)。作業単位のファイルは、今の段階7・8 の内容(承認前の下書きも)から引く。印は今の設計の要素に付くからである。
- 予測の数は、説明書の3節と同じもの(`_explanation` の `scale`)を使う。比較のタブと説明書で数がずれない。
- 画面・API の実際は、`compare_scale` が予測の画面・API のうち文書の側の確認済み(`document_checks`)を数える(`basis="document_checks"`)。
- 応答は `ChangeRequestComparisonRead.scale`(`kind`・`label`・`predicted`・`actual`・`basis`)。ルートは `view.scale` を渡すだけ。

## 3. 確認済みのまま古い要約

- `ExplanationView.summary_needs_reconfirm` と `ExplanationSummaryRead.needs_reconfirm` は、101-2 の `needs_reconfirm` を呼ぶ。状態の札(`state`)は今までどおり「古い」で、この値は「確認済みだったのに載らなくなった」を区別する。画面で共有の前に知らせる(Phase 107。共有リンクは Phase 103)。

## テスト観点

**SUT / ドライバ / スタブ**(#14):

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_comparison.py` の反映の後の比較 | `ChangeRequestService.comparison`(規模も)・`ChangeRequestComparisonRead`・`ScaleComparisonRead`・ルート `get_change_request_comparison` | テスト関数 | インメモリ SQLite と段階1〜8 承認済みの fixture。文書の反映は `FakeLLM`(構造化出力の見本) |
| `test_change_request_service.py` の要約 | `ChangeRequestService` の `explanation`・`confirm_summary`・`update` と `ExplanationView.summary_needs_reconfirm` | テスト関数 | インメモリ SQLite。要約の LLM は `FakeLLM` を注入 |
| `test_change_requests_api.py` の要約 | ルートと `ExplanationSummaryRead.needs_reconfirm` | テスト関数 | インメモリ SQLite。`stub_llm_resolver` |
| `test_change_requests_flow.py`(統合) | HTTP の説明書・要約・比較 | httpx の `AsyncClient`(ASGITransport) | 実 PostgreSQL・Redis(専用のテスト DB)。要約と文書の生成の LLM だけ、解決を固定の文・構造化出力の見本を返すフェイクに差し替える(`stub_llm_resolver`) |

- 比較: 規模の種類の順と出どころ(作業単位・ファイル・テストは `marks`、画面・API は `document_checks`)。予測の作業単位1・ファイル3。実際の作業単位は1以上、ファイルは3(3層のファイルを共有するので、印の単位が増えても3件)。画面は予測1・確認0。束にテスト仕様書が無いので、テストの予測は null。
- 要約: 確認した後に CR を直すと `summary_needs_reconfirm` が真、確かめ直すと偽。作ったばかり(未確認)は偽。
- 統合: 説明書の応答の `scale` の種類の順と、数えられないときは理由があること。比較の `scale` の出どころの並び。要約の応答の `needs_reconfirm`。

各ファイルは、この章のテストが少なくとも1度 import する(#15)。スキーマ・サービス・ルートは `test_change_request_comparison.py` が通る。

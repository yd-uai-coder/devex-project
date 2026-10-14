# Phase-54-3: 再生成の指示(段階)

## この章の目的

詳細設計モードの段階6・7 の区切りで採用した設計・不整合の指摘を、段階の作り直しの修正指示にして渡す。作り直す段階は指摘の対象から推定した段階を初期値にし、利用者が選び直せる。作り直した後は今の流れ(確かめて承認し直す → 段階の区切りは未レビュー → ボタンでレビュー)のまま。

自動実装モード: on([introduction](./Phase-54-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/`・`devex-ui/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `DesignStageGenerate.finding_ids` |
| [`app/services/review_service.py`](../samples/backend/app/services/review_service.py) | 更新 | `sendback_findings`(文書の生成から移した。受け付けの確かめと読み出し) |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | `StageGenerationContext.instruction`・`_invoke`(最後の人のメッセージに `## 修正指示`) |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | 生成の `finding_ids` を渡す |
| [`src/features/detailed-design/api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | `generateDesignStage(..., findingIds)` |
| [`src/features/detailed-design/detailed-design-store.ts`](../samples/frontend/src/features/detailed-design/detailed-design-store.ts) | 更新 | `generate(..., findingIds)` |
| [`src/features/detailed-design/sendbackOps.ts`](../samples/frontend/src/features/detailed-design/sendbackOps.ts) | 新規 | `sendbackStage`・`sendbackArgs` |
| [`src/features/detailed-design/components/StageSendbackPanel.tsx`](../samples/frontend/src/features/detailed-design/components/StageSendbackPanel.tsx) | 新規 | 「採用した指摘で段階を作り直す」のボタンとダイアログ |
| [`src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | パネルの下に置く(詳細設計モードだけ) |
| ── ここからテスト ── | | |
| [`tests/unit/test_review_sendback.py`](../samples/backend/tests/unit/test_review_sendback.py) | 更新 | 段階1の生成に指示が入る・404 |
| [`tests/unit/test_design_stage_generation.py`](../samples/backend/tests/unit/test_design_stage_generation.py) | 更新 | バックグラウンドの引数 |
| [`src/features/detailed-design/__tests__/sendbackOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/sendbackOps.test.ts)・[`components/__tests__/StageSendbackPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageSendbackPanel.test.tsx)・`detailed-design-store.test.ts` | 新規・更新 | 段階の推定・引数・ダイアログ・本文 |

## 要点の抜粋

### 1. 段階の生成に指示を足す1か所

```python
# app/services/design_stage_generation_service.py
async def _invoke[M: BaseModel](context, schema: type[M], messages: list[BaseMessage]) -> M:
    if context.instruction:
        *head, last = messages
        content = f"{last.content}\n\n## 修正指示\n{context.instruction}"
        messages = [*head, last.model_copy(update={"content": content})]
    return await invoke_structured(context.llm, schema, messages)
```

段階の生成は段階ごとに1〜数回 LLM を呼ぶ(段階2 は処理概要表 → グループの DFD、段階3 は ER → CRUD …、計13か所)。プロンプトの組み立てを段階ごとに直す代わりに、呼び出しを `_invoke` に通して、最後の人のメッセージの末尾に指示を足す。指示は段階の区切りの指摘なので、文書のように関連文書で絞らない(利用者が段階を選んで指摘を選ぶ)。

### 2. 作り直す段階と行(画面)

- `sendbackStage`: 指摘の対象を `locateTargetStage`(Phase 53)で段階に結び、最も多くの指摘が当たる段階(同数なら上流)。どれにも当たらなければ、実装計画書(詳細)の指摘は段階7、それ以外は選ばない。
- `sendbackArgs`: 段階5・6(と8)は部分再生成なので、対象を `resolveFixTarget` で要素のキーにし、`regenerationArgs`(Phase 44)で処理 ID・関数にする。1つも決まらなければ作り直せないと知らせる。ほかの段階は段階全体。
- ボタンはレビューがオンで、段階6・7 の区切りに採用した設計・不整合の指摘があるときだけ。初めは未対応の指摘を選ぶ。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DesignStageGenerationService.request_generation`・`execute` | pytest(`test_review_sendback.py`) | `FakeLLM`(段階1の出力。プロンプトを記録) | 知らない指摘は404・最後のメッセージが指示で終わる |
| `generate_design_stage` | pytest(`test_design_stage_generation.py`) | `BackgroundTasks` | 引数に `finding_ids` |
| `sendbackStage`・`sendbackArgs` | vitest | スタブ不要 ── 対象が純粋で外部依存を呼ばないため | 多数決と上流・段階7・部分再生成の行・決まらないとき |
| `StageSendbackPanel`・ストアの `generate` | vitest | 詳細設計のストアの `generate`・`selectStage`(`vi.fn`)・偽の fetch | 出す条件・文書の区切りの指摘は出さない・初期値と呼び出し・行が決まらない知らせ・本文 |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_review_sendback.py tests/unit/test_design_stage_generation.py
cd devex-ui && npx vitest run src/features/detailed-design
```

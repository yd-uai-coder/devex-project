# Phase-54-2: 再生成の指示(文書)

## この章の目的

採用した設計・不整合の指摘を、文書の再生成の「修正指示」にして生成のモデル(Gemini)に渡す。指示の文はサーバーが指摘から組み立て、文書ごとに関連する指摘だけを入れる。直すのは生成のモデルで、レビューは設計を書き換えない(2.11節の方針どおり)。

自動実装モード: on([introduction](./Phase-54-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/`・`devex-ui/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/review/sendback.py`](../samples/backend/app/review/sendback.py) | 新規 | `SendbackFinding`・`can_regenerate`・`findings_for`・`build_instruction` |
| [`app/review/__init__.py`](../samples/backend/app/review/__init__.py) | 更新 | 上の re-export |
| [`app/documents/revision.py`](../samples/backend/app/documents/revision.py) | 更新 | `instruction_text`・`REVISION_RULE` に【修正指示】 |
| [`app/documents/requirements/drafting.py`](../samples/backend/app/documents/requirements/drafting.py) ほか `external_design`・`internal_design`・`implementation_plan` の `drafting.py` | 更新 | 人のメッセージに `## 修正指示` の節 |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `SendbackFindingInvalidError`(409) |
| [`app/schemas/document.py`](../samples/backend/app/schemas/document.py) | 更新 | `GenerationRequest.finding_ids` |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 受け付けで指摘を確かめ、文書ごとに指示を作って渡す |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | `finding_ids` をバックグラウンドへ渡す |
| [`src/features/hearing/api/hearingApi.ts`](../samples/frontend/src/features/hearing/api/hearingApi.ts) | 更新 | `triggerGeneration(projectId, startFrom, findingIds)` |
| [`src/features/documents/documents-store.ts`](../samples/frontend/src/features/documents/documents-store.ts) | 更新 | `regenerate(..., findingIds)` |
| [`src/features/design-review/model.ts`](../samples/frontend/src/features/design-review/model.ts) | 更新 | `regenerableFindings` |
| [`src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | 再生成のダイアログに指摘のチェック一覧・起点の初期値 |
| ── ここからテスト ── | | |
| [`tests/unit/test_review_sendback.py`](../samples/backend/tests/unit/test_review_sendback.py) | 新規 | 指示・プロンプトの節・受け付け・生成へ渡す |
| [`tests/unit/test_doc_generation_start.py`](../samples/backend/tests/unit/test_doc_generation_start.py) | 更新 | バックグラウンドの引数 |
| `documents-store.test.ts`・`DocumentsPageContent.test.tsx`・`model.test.ts` | 更新 | 本文の `finding_ids`・ダイアログ |

## 要点の抜粋

### 1. 指示の文

```python
# app/review/sendback.py
INSTRUCTION_HEAD = (
    "次の設計レビューの指摘を反映して書き直す。指摘の対象と、それに合わせて変える必要のある行だけを"
    "書き直し、指摘に関係しない行は変えない(unchanged にする)。"
)
# 1行1件: 「1. [最重要] 対象: POST /api/v1/projects ── 問題: … → 改善案: …」
```

- 指示に入れられるのは**採用した、ヒアリングが原因でない**指摘(`can_regenerate`)。ヒアリングの指摘は利用者に聞かないと決められないので、聞き直し(54-4)へ回す。
- 文書ごとに**関連する指摘だけ**を入れる(`findings_for([doc_type], ...)`。関連文書の無い古い指摘はどれにも入れる)。例: 関連文書が外部設計書だけの指摘は、要件定義書・内部設計書・実装計画書には入らない。
- 前の版の差分にとどめる仕組み(Phase 49)は、変更のきっかけを【会話】【上流の変わった行】に限っていた。`REVISION_RULE` に【修正指示】を足し、指示に関係しない行は `unchanged` にさせる。
- `SendbackFinding` は保存した指摘の写し(`of(finding)`)。純粋関数に ORM のモデルを渡さない(pyright が `Mapped[str]` を `str` と見なさないため、Protocol でなく dataclass にした)。

### 2. 受け付けと生成

`POST /projects/{id}/generate {start_from, finding_ids}`。受け付け(`request_generation`)で指摘を確かめる: プロジェクトに無い指摘は404、採用していない・ヒアリングの指摘は409 `SENDBACK_FINDING_INVALID`。生成の中では読み直し、受け付けの後に採否が変わった指摘は黙って外す。指摘の読み出しは `ReviewService.sendback_findings`(54-3 で段階の生成と共有するために移した)。

### 3. ダイアログ

レビューがオンで、文書の区切りに採用した設計・不整合の指摘(前の回の分も)があれば、再生成のダイアログに「AI 設計レビューの採用した指摘を、再生成の指示に入れる」のチェック一覧を出す。初めは**未対応の指摘を選び**、起点は未対応の指摘の関連文書のうち最も上流(54-1 の `regenerationStartFor`)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `can_regenerate`・`findings_for`・`build_instruction`・各 `build_*_messages`・`instruction_text` | pytest(`test_review_sendback.py`) | スタブ不要 ── 対象が純粋で外部依存を呼ばないため | ヒアリング・未判断は外す・関連文書で絞る・1行1件・4文書とも `## 修正指示` |
| `DocGeneratorService.request_generation`・`generate` | 同上 | `FakeLLM`(4文書の構造化出力。プロンプトを記録)・`FakeLLM`(レビュー) | 404・409 と受け付け・外部設計書にだけ指示が入る |
| `trigger_generation` | pytest(`test_doc_generation_start.py`) | `BackgroundTasks` | `finding_ids` を渡す |
| ストア・ダイアログ | vitest | 偽の fetch・ストアの `regenerate`(`vi.fn`) | 本文の `finding_ids`・未対応を選ぶ・ヒアリングは出さない・起点の初期値 |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_review_sendback.py tests/unit/test_doc_generation_start.py
cd devex-ui && npx vitest run src/features/documents src/features/design-review
```

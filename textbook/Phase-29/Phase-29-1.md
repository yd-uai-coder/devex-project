# Phase-29-1: 段階5の行の種別(BE + FE)

## この章の目的

シーケンス図の矢印には種類(同期の呼び出し・非同期の呼び出し・戻り)がある。段階5の手順の表には区別する欄が無く、[25-5](../Phase-25/Phase-25-5.md) の見本では「戻りを呼び出しとして書いた行」で入れ子が崩れた。この章では、段階5の行に種別 `kind` を足し、AI の下書きに書かせ、人が表で直せるようにする。あわせて、戻りの行が関数を呼ばないことを、06 の紐づけ・段階6の候補・段階8の参照・関与表の4か所で同じ判定(`calls_function`)にそろえる。

自動実装モード: on([introduction](./Phase-29-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/procedure.py`](../samples/backend/app/detailed_design/procedure.py) | 更新 | `StepKind`・`ProcedureStep.kind`(既定 `call`)・`calls_function`。`_normalize_steps` は分岐の行の種別を `call` に戻す |
| [`app/detailed_design/procedure_drafting.py`](../samples/backend/app/detailed_design/procedure_drafting.py) | 更新 | `GeneratedStep.kind` とプロンプトの規則 |
| [`app/detailed_design/logic.py`](../samples/backend/app/detailed_design/logic.py) | 更新 | `logic_candidates` を `calls_function` で判定 |
| [`app/detailed_design/procedure_doc.py`](../samples/backend/app/detailed_design/procedure_doc.py) | 更新 | `unit_refs` を `calls_function` で判定 |
| [`app/detailed_design/document/views.py`](../samples/backend/app/detailed_design/document/views.py) | 更新 | `STEP_KIND_LABELS`・`step_kind_label`。`procedure_steps`(06 の L-ID)と `involvement`(関与表)から戻りの行を除く |
| [`app/detailed_design/document/markdown.py`](../samples/backend/app/detailed_design/document/markdown.py) | 更新 | 05 の表(`procedure_table`)に「種別」の列 |
| [`app/detailed_design/document/html.py`](../samples/backend/app/detailed_design/document/html.py) | 更新 | 05 の表に「種別」の列 |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | `EMPTY_CALL` の警告を戻りの行に出さない |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | `StepKind`・`calls_function` の re-export |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `StepKind`・`ProcedureStep.kind` |
| [`src/features/detailed-design/labels.ts`](../samples/frontend/src/features/detailed-design/labels.ts) | 更新 | `STEP_KIND_LABELS`(同期・非同期・戻り) |
| [`src/features/detailed-design/procedureOps.ts`](../samples/frontend/src/features/detailed-design/procedureOps.ts) | 更新 | `toProcedures` が種別の無い行を `call` に、`callsFunction`、関与表から戻りの行を除く |
| [`src/features/detailed-design/logicOps.ts`](../samples/frontend/src/features/detailed-design/logicOps.ts) | 更新 | `logicCandidates` を `callsFunction` で判定 |
| [`src/features/detailed-design/components/ProcedureStepTable.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureStepTable.tsx) | 更新 | 「種別」の select 列(分岐の行は出さない)。戻りの行には詳細のバッジを出さない |
| ── ここからテスト ── | | |
| [`src/features/detailed-design/test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | `makeStep` に `kind: "call"` |
| [`tests/unit/test_procedure.py`](../samples/backend/tests/unit/test_procedure.py) | 更新 | 既存の行は `call`・`calls_function`・merge の種別・戻りの行に `EMPTY_CALL` を出さない |
| [`tests/unit/test_procedure_drafting.py`](../samples/backend/tests/unit/test_procedure_drafting.py) | 更新 | 種別が下書きへ渡る・既定は `call`・プロンプトの規則 |
| [`tests/unit/test_logic.py`](../samples/backend/tests/unit/test_logic.py) | 更新 | 段階6の候補から戻りの行を除く |
| [`tests/unit/test_detailed_design_document_views.py`](../samples/backend/tests/unit/test_detailed_design_document_views.py) | 更新 | `step_kind_label`・関与表から戻りの行を除く |
| [`tests/unit/test_detailed_design_document_markdown.py`](../samples/backend/tests/unit/test_detailed_design_document_markdown.py) | 更新 | 05 の表の種別の列 |
| [`tests/unit/test_detailed_design_document_html.py`](../samples/backend/tests/unit/test_detailed_design_document_html.py) | 更新 | 05 の表の種別の列 |
| [`src/features/detailed-design/__tests__/procedureOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/procedureOps.test.ts) | 更新 | 種別の読み込み・`callsFunction`・関与表 |
| [`src/features/detailed-design/__tests__/logicOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/logicOps.test.ts) | 更新 | 段階6の候補から戻りの行を除く |
| [`src/features/detailed-design/components/__tests__/ProcedureStepTable.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ProcedureStepTable.test.tsx) | 更新 | 種別の選択・分岐の行に出さない・戻りの行に詳細のバッジを出さない |

BE のパスは `devex-api/backend/`、FE のパスは `devex-ui/` 基準。`views.py` の `step_kind_label` を `markdown.py`・`html.py` が読むので、`views.py` を先に写す。

## 要点の抜粋

```python
# app/detailed_design/procedure.py
StepKind = Literal["call", "async", "return"]   # 同期の呼び出し / 非同期の呼び出し / 戻り

class ProcedureStep(BaseModel):
    ...
    is_branch: bool = False
    kind: StepKind = "call"                     # 種別の無い既存の行は call として読む

def calls_function(step: ProcedureStep) -> bool:
    """分岐でも戻りでもなく、呼び出し先がモジュールで、関数が空でない行"""
```

```python
# app/detailed_design/document/views.py
STEP_KIND_LABELS = {"call": "同期", "async": "非同期", "return": "戻り"}
def step_kind_label(step) -> str: ...           # 分岐の行は ""
```

```ts
// src/features/detailed-design/procedureOps.ts
export function callsFunction(step: ProcedureStep): boolean { ... }   // バックエンドと同じ規則
```

## 設計判断

### 種別は AI の下書き + 人が直す(着手時の決定)

戻りを呼び出しとして書く誤りは、AI が書く段階5の下書きで起きた([25-5](../Phase-25/Phase-25-5.md) の F-07#4)。人だけが付けると、下書きのたびに直す手間が残る。プロンプトで「値を返す行は return、呼び出し先にはその受け取り手」と書かせ、表の select で人が直せるようにした。戻りは「明示したいときだけ書けばよい(書かなければ図で補う)」とし、すべての戻りを書かせない(表が長くなる)。

### 既存のデータはマイグレーションしない

段階5の model は JSON で、`kind` の既定値を `call` にすれば、種別の無い既存の行はそのまま同期の呼び出しとして読める。FE も `toProcedures` で同じに読む。承認済みの段階5の内容は変わらない(保存し直すまで `kind` は書かれない)ので、段階5を差し戻さない。

### 戻りの行は関数を呼ばない ── 判定を1か所に(#17)

戻りの行の `call` が空でないと、段階6の候補や段階8の参照に「戻りの関数」が紛れ込む。「関数を呼ぶ行」の判定は、段階6の候補(`logic_candidates`)・段階8の参照(`unit_refs`)・05 の L-ID(`procedure_steps`)にそれぞれ書かれていた。この Phase で条件が1つ増えたので、`calls_function` にまとめた(FE も `callsFunction`)。関与表は「呼び出し先として現れるモジュール」なので外部の役者を数えない別の規則のまま、戻りの行だけを除いた。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ProcedureStep`・`calls_function`・`merge_procedure`・`validate_procedures` | pytest(`test_procedure.py`) | スタブ不要 ── 純粋で外部依存を呼ばないため | 種別の無い行は `call`。`calls_function` は同期・非同期だけ真。merge で分岐の行の種別は `call` に戻る。戻りの行に `EMPTY_CALL` を出さない |
| `GeneratedStep`・`to_procedure_draft`・`PROCEDURE_SYSTEM_PROMPT` | pytest(`test_procedure_drafting.py`) | スタブ不要 ── LLM を呼ばず、構造化出力の変換だけを見るため | 種別が下書きへ渡り、既定は `call` |
| `logic_candidates` | pytest(`test_logic.py`) | スタブ不要(同上) | 関数の欄が書かれた戻りの行も候補にしない |
| `step_kind_label`・`involvement`・`to_markdown`・`to_html` | pytest(views・markdown・html のテスト) | スタブ不要(同上) | 05 の表に「種別」列。関与表は戻りの行を数えない |
| `toProcedures`・`callsFunction`・`buildInvolvement`・`logicCandidates` | vitest | スタブ不要 ── 純粋関数のため | BE と同じ規則 |
| `ProcedureStepTable` | vitest + Testing Library | スタブ: `onChange`(呼び出し元への通知を受け取る) | 種別の select で `onChange` に `kind` が渡る。分岐の行に種別を出さない。戻りの行には詳細のバッジを出さない |

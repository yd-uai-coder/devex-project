# Phase-45-2: 実装計画書の model(段階7の型の流用・キー・検証)

## この章の目的

簡易モードの実装計画書を model にする部品を作る。マイルストーン・タスク・リスクは段階7(詳細設計モードの実装計画)と同じ型で持ち、段階8がそのまま `PlanModel` として読めるようにする。タスクには安定キー(`U-001`。[Phase 42](../Phase-42/Phase-42-introduction.md))を振り、再生成ではタスク名で引き継ぐ。検証は、ベースラインで見つかった「処理(DF)の無い機能の単位」などの書き落としを、段階8を開く前に文書のプレビューで出す。

自動実装モード: on([introduction](./Phase-45-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/backend/` 配下(表は依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/plan.py`](../samples/backend/app/detailed_design/plan.py) | 更新 | `renamed_task_ids`(書かれた単位の ID → 並び順の ID)を足す |
| [`app/detailed_design/simple_procedure/wbs.py`](../samples/backend/app/detailed_design/simple_procedure/wbs.py) | 更新 | 依存先の読み替えを `renamed_task_ids` に寄せる(公開挙動は変えない) |
| [`app/documents/implementation_plan/model.py`](../samples/backend/app/documents/implementation_plan/model.py) | 新規 | 実装計画書1版の中身(`ImplementationPlanModel`)、`to_plan()` |
| [`app/documents/implementation_plan/assemble.py`](../samples/backend/app/documents/implementation_plan/assemble.py) | 新規 | 下書きから model を組み立てる。依存先・処理・要件の正規化、キーの引き継ぎ |
| [`app/documents/implementation_plan/markdown.py`](../samples/backend/app/documents/implementation_plan/markdown.py) | 新規 | model から今までと同じ WBS の書式の md を組み立てる |
| [`app/documents/implementation_plan/validation.py`](../samples/backend/app/documents/implementation_plan/validation.py) | 新規 | 行数と検証(`validate_implementation_plan`) |
| [`app/documents/implementation_plan/drafting.py`](../samples/backend/app/documents/implementation_plan/drafting.py) | 新規 | 構造化出力のスキーマ・プロンプト・メッセージ・下書きへの変換 |
| [`app/documents/implementation_plan/__init__.py`](../samples/backend/app/documents/implementation_plan/__init__.py) | 新規 | re-export(`drafting` は出さない) |
| ── ここからテスト ── | | |
| [`tests/unit/test_implementation_plan_doc.py`](../samples/backend/tests/unit/test_implementation_plan_doc.py) | 新規 | 読み替え・組み立て・キー・md を古い版の解析で読めること・検証・下書きの変換 |

依存の向き: `implementation_plan` → `app.detailed_design.plan`(型・キー・読み替え)・`procedure_doc.plan_units`・`requirement_trace`(`normalize_req_id`・`unit_req_ids`)・`internal_design.model`(DF の ID の形。45-1)・`requirements.model`。`wbs.py` → `plan.renamed_task_ids`。

```python
# app/documents/implementation_plan/__init__.py
from app.documents.implementation_plan.assemble import (ImplementationPlanDraft, MilestoneDraft,
                                                        RiskDraft, TaskDraft, build_model)
from app.documents.implementation_plan.markdown import render_implementation_plan
from app.documents.implementation_plan.model import ImplementationPlanModel
from app.documents.implementation_plan.validation import row_counts, validate_implementation_plan
```

## 要点の抜粋

### 1. 段階7の型の流用

```python
# app/documents/implementation_plan/model.py
class ImplementationPlanModel(BaseModel):
    phases: str                     # 4.1(本文)
    milestones: list[Milestone]     # 4.2(段階7の Milestone・PlanTask)
    environment: str                # 4.3(本文)
    risks: list[Risk]               # 4.4(段階7の Risk)
    next_unit_seq: int = 1
    known_dataflow_ids: list[str]; known_req_ids: list[str]; must_fr_ids: list[str]  # 照合の写し

    def to_plan(self) -> PlanModel: ...   # 段階8が読む形
```

タスクの `function_ids` に内部設計書の DF の ID を入れる(今までの WBS の解析と同じ)。単位の ID(`M-01-T02`)は保存せず、並び順から導く(段階7と同じ)。同じ事実(作業単位の形)を2つの型で持たない(#17)。

### 2. 依存先の読み替え(共有)

```python
# app/detailed_design/plan.py
def renamed_task_ids(written: Sequence[Sequence[str]]) -> dict[str, str]:
    """マイルストーンごとのタスクの書かれた ID → 並び順から導いた ID。"""
```

AI は並べ替えや書き損じで、並び順と違う ID を書くことがある。WBS の解析(`wbs._to_plan`)にあった読み替えを切り出し、組み立て(`assemble._milestones`)と共有した。WBS の解析は今までどおり、違いを `WBS_ID_MISMATCH` で指摘する(構造化出力の組み立ては指摘しない)。

### 3. キーの引き継ぎ

```python
# app/documents/implementation_plan/assemble.py
plan = (carry_over_unit_keys(plan, previous.to_plan()) if previous is not None
        else assign_unit_keys(plan))
```

段階7の作り直しと同じ規則(タスク名が同じなら前のキー、残りは次の番号)。前の版に model が無ければ全部新しく振る。Phase 42 で「簡易モードの単位のキーは単位の ID のまま、Phase 45 で見直す」とした申し送りを、ここで解いた。既存の段階8の手順書(キー = 単位の ID)は、`relabel_units` がキーで引けないときにそのまま残し、単位の ID とタスク名で今までどおり合う。

### 4. 検証

| コード | 重要度 | 内容 |
| --- | --- | --- |
| `NO_TASKS` | 最重要 | タスクが無い |
| `FEATURE_WITHOUT_DATAFLOW` | 中程度 | 処理(DF)の無い機能のタスク(ベースラインの5件) |
| `UNKNOWN_DATAFLOW` | 中程度 | 内部設計書(写し)に無い処理 |
| `UNKNOWN_DEPENDENCY`・`FORWARD_DEPENDENCY` | 中程度 | 依存先が無い・自分か後ろ |
| `MUST_REQUIREMENT_UNPLANNED` | 中程度 | 担うタスクの無い Must の機能要件 |
| `UNPLANNED_DATAFLOW` | 軽微 | どのタスクにも入っていない処理 |
| `UNLINKED_UNIT`・`UNKNOWN_REQUIREMENT_ID` | 軽微 | 要件の無い機能のタスク・要件定義書に無い要件ID |

写しが空(要件定義書に model が無い、など)なら、その照合はしない。

## 設計判断

- **段階8の検証と判定を共有しなかった(計画から変えた点)**: 計画では「段階8の `_simple_procedure_issues` と重なる判定は共有の純粋関数に寄せる」とした。実装してみると、段階8の指摘は単位ごとに直す先(`fix_document`)と単位(`unit`)を持つ `StageIssue`、文書の指摘は同じ種類を1件にまとめた `DocumentIssue` で、共有できるのは「機能なのに処理が無い」のような1行の述語だけだった。共有の効果より、2つの関数をまたぐ読みにくさが勝つと判断し、要件の集計(`unit_req_ids`)と単位の列(`plan_units`)だけを共有した。
- **書かれた ID が並び順と違っても指摘しない**: 構造化出力では ID は依存先を指すためだけに書かせているので、違っても文書の誤りではない(md の解析のときは、文書に見える ID が違うので指摘する)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
| --- | --- | --- | --- |
| `renamed_task_ids` | pytest(`test_implementation_plan_doc.py`) | スタブ不要 ── 純粋関数(副作用なし)で、LLM・DB を呼ばないため | 小文字・2つ目の同じ ID |
| `build_model`・`to_plan` | 同上 | スタブ不要 ── 同上 | 名前の無い行を捨てる、`df-01`→`DF-1`・`fr-1`→`FR-001`・形の違う要件を捨てる、書かれた ID の依存先を読み替える、キーの採番とタスク名での引き継ぎ、写し |
| `render_implementation_plan` | 同上(md を `parse_wbs` で素で読む) | スタブ不要 ── 同上 | 古い版の解析が指摘0件で同じ計画(キーを除く)を読む |
| `validate_implementation_plan`・`row_counts` | 同上 | スタブ不要 ── 同上 | 9種の指摘、書き落としの無い計画は0件、タスクが無ければ `NO_TASKS` だけ |
| `to_draft`・`build_implementation_plan_messages` | 同上 | スタブ不要 ── 同上 | 構造化出力 → 下書き、入力に内部設計書の md |
| `wbs.parse_wbs`(リファクタの番人。#12) | pytest(既存の `test_simple_wbs.py`) | スタブ不要 ── 同上 | 読み替えを寄せた後も既存の7件が通る |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_implementation_plan_doc.py tests/unit/test_simple_wbs.py -q
```

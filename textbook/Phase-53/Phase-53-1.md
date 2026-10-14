# Phase-53-1: 区切りとレビューの入力

## この章の目的

レビューの区切りを、文書の生成の後(`documents`)だけから、段階6・7 の承認の後(`stage6`・`stage7`)まで広げる。区切りがそろっているか・レビュー済みかを版で決める純粋関数を `app/review/gates.py` に置き、`ReviewService` を区切りで一般化する(受け付け・実行・区切りの状態・採否)。チャットに出すものは指摘の md から件数の一行に縮める(パネルで見るため。Phase 52 の申し送り)。

自動実装モード: on([introduction](./Phase-53-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `ReviewFindingNotFoundError`(404)。`ReviewDocumentsNotReadyError` の説明を区切りに広げた |
| [`app/review/gates.py`](../samples/backend/app/review/gates.py) | 新規 | 区切りの定義・状態・段階の版・段階の検証の読み替え(純粋関数) |
| [`app/review/prompt.py`](../samples/backend/app/review/prompt.py) | 更新 | 詳細設計書・実装計画書(詳細設計)・段階N のラベル、指示の「入力」 |
| [`app/review/render.py`](../samples/backend/app/review/render.py) | 更新 | `render_notice`(チャットの一行) |
| [`app/review/__init__.py`](../samples/backend/app/review/__init__.py) | 更新 | `gates` と `render_notice` の re-export |
| [`app/repositories/review.py`](../samples/backend/app/repositories/review.py) | 更新 | `get_finding`(プロジェクトの回の指摘だけ) |
| [`app/services/review_service.py`](../samples/backend/app/services/review_service.py) | 更新 | `start_review(gate=…)`・`latest`・`targets_for`・`gate_summaries`・`decide`、段階の区切りの入力 |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 自動のレビューを `start_review(gate=DOCUMENTS_GATE)` で受け付ける |
| [`app/api/routes/reviews.py`](../samples/backend/app/api/routes/reviews.py) | 更新 | 名前の変わったサービスのメソッドを呼ぶ(53-1 のタグの分。新しい API は [53-2](./Phase-53-2.md)) |
| ── ここからテスト ── | | |
| [`tests/unit/test_review_gates.py`](../samples/backend/tests/unit/test_review_gates.py) | 新規 | 区切りの純粋関数・知らせ・ラベル |
| [`tests/unit/test_review_service.py`](../samples/backend/tests/unit/test_review_service.py) | 更新 | 段階の区切り・区切りの状態・採否 |

## 要点の抜粋

### 1. 区切りと状態(`app/review/gates.py`)

```python
# app/review/gates.py
ReviewGate = Literal["documents", "stage6", "stage7"]
GateStatus = Literal["not_ready", "unreviewed", "running", "reviewed", "failed"]

GATE_STAGES: dict[ReviewGate, tuple[int, ...]] = {
    "documents": (),
    "stage6": (1, 2, 3, 4, 5, 6),
    "stage7": (1, 2, 3, 4, 5, 6, 7),
}

def gate_status(*, ready: bool, run_status: str | None, is_current: bool) -> GateStatus:
    if run_status == "running":
        return "running"
    if not ready:
        return "not_ready"
    if run_status is None or not is_current:
        return "unreviewed"
    return "failed" if run_status == "failed" else "reviewed"
```

- 実行中を先に見る(区切りがそろわなくなっても、流れている回は「レビュー中」と出す)。
- 失敗の回でも、版が今と違えば「未レビュー」(古い版の失敗は今の文書のことを言っていない)。
- 簡易モードの区切りは `documents` だけ(`gates_for_mode`)。

### 2. 段階の区切りの版

```python
# app/review/gates.py
def stage_targets(doc_versions, approved_versions, stages) -> dict[str, int] | None:
    targets = dict(doc_versions)
    for stage in stages:
        version = approved_versions.get(stage)
        if version is None:
            return None
        targets[stage_key(stage)] = version   # "stage:N"
    return targets
```

回の `targets` は `{"requirements": 2, "external_design": 2, "stage:1": 2, …}`。段階の承認した版(`approved_version`)は、段階を直して承認し直すと上がるので、最新の回と比べて違えば未レビューになる。承認した版は「承認済みで古くない」段階のものだけを数える(`ReviewService._approved_versions`。段階の画面の状態と同じ規則)。文書を作り直すと段階は「古い」になり、段階の区切りは承認し直すまで「そろっていない」。

### 3. 段階の区切りの入力

```python
# app/services/review_service.py(ReviewService._add_stage_documents)
_, sources = await DesignStageService(self._session).overview(project)
collected = await DetailedDesignExportService(self._session).collect(project, render=False)
chapters = [chapter for chapter in CHAPTERS if chapter.stage in stages]
documents[DETAILED_DESIGN_DOC] = to_markdown(collected.source, chapters)
if PLAN_STAGE in stages:
    documents[DETAILED_PLAN_DOC] = to_plan_markdown(collected.source)
return stage_known_issues(
    {stage: validate_stage(stage, sources.stages.get(stage), sources) for stage in stages}
)
```

- 要件・外部は回の `targets` の版を読む(文書の区切りと同じ)。詳細設計書は詳細設計書の出力と同じ組み立てで、段階6 は 01〜06章(07 横断事項は段階7 が作る)、段階7 は 01〜07章と実装計画書。
- 段階の検証の指摘(`StageIssue`)は、文書の検証と同じ既知の指摘の形(`DocumentIssue`)に読み替えて渡す(error → 中程度、warning → 軽微。ラベルは「段階N」)。

### 4. 受け付け・実行・状態・採否(`ReviewService`)

- `start_review(project, user, *, gate, trigger)`: 検査の順は Phase 52 のまま(実効値 → 生成中 → 実行中 → **区切りがそろっているか** → キー → 上限)。モードに無い区切り・承認されていない段階も 409 `REVIEW_DOCUMENTS_NOT_READY`(文で区別する)。
- `execute`: 区切りで入力を組み立て分け、チャットには `render_notice(findings, GATE_LABEL[gate])` を出す。
- `gate_summaries(project)`: 区切りごとの `GateSummary(gate, ready, status, run, is_current)`。段階の承認した版は1回だけ読む。
- `decide(project, finding_id, decision)`: 採否を記録する。プロジェクトに無い指摘は 404(`get_finding` が回のプロジェクトで絞る)。古い回の指摘にも付けられる。

### 5. チャットは一行(`render_notice`)

```
設計レビュー(段階6の承認の後)をしました。指摘 14件(最重要 4・中程度 9・軽微 1)。レビューのパネルで確かめてください。
```

`render_findings`(指摘の md)は消さずに残した(ログ・測定で読むため)。

### 6. `app/review/__init__.py` の re-export

```python
# app/review/__init__.py
from app.review.gates import (
    DETAILED_DESIGN_DOC, DETAILED_PLAN_DOC, DOCUMENTS_GATE, GATE_LABEL, GATE_STAGES,
    GateStatus, ReviewGate, gate_status, gates_for_mode, stage_known_issues, stage_targets,
)
from app.review.render import render_findings, render_notice, sort_findings
```

依存の向きは `gates` ← `prompt`(ラベル)・`review_service`。`gates` は `prompt`・`render` を読まない。`DOCUMENTS_GATE` はサービスから `app/review/gates.py` へ移した(スキーマも同じ `ReviewGate` を使うため)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `gates_for_mode`・`gate_status`・`stage_targets`・`stage_known_issues`・`render_notice`・`build_review_messages` のラベル | pytest(`test_review_gates.py`) | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため | 状態の真理値表(実行中が先・そろっていない・版の違い・失敗)・1段階でも未承認なら None・呼び出し側の dict を変えない・重要度の読み替えと段階の順・件数の文・詳細設計書・実装計画書・段階N のラベル |
| `ReviewService.start_review`・`execute`(段階の区切り) | pytest(`test_review_service.py`。段階の fixture `create_stage7_project`・`create_document_project`) | `FakeLLM`(レビューの応答・渡したメッセージを記録)。DB はインメモリの SQLite | 簡易・段階7 が未承認は409・段階6 は 01〜06章で 07 と実装計画書を含まない・段階7 は両方を含む・`targets` の `stage:N`・チャットの一行 |
| `ReviewService.gate_summaries` | 同上 | 同上 | 実行中 → レビュー済み(`is_current`)・段階6 を直して承認し直すと未レビュー(段階7 はそろわなくなる)・簡易は文書だけ・文書だけある詳細 |
| `ReviewService.decide` | 同上 | 同上 | 未判断 → 採用・別のプロジェクトと無い ID は404 |

Phase 52 のテストは、`start_documents_review` → `start_review(gate=DOCUMENTS_GATE)`、チャットの md → 一行の文に合わせて直した。

```sh
cd devex-api/backend && uv run pytest tests/unit/test_review_gates.py tests/unit/test_review_service.py
```

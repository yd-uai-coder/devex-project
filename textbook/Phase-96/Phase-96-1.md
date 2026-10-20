# Phase-96-1: CR で作り直した段階の承認の印を CR に結ぶ

## この章の目的

決定8-2([90-1](../Phase-90/Phase-90-1.md))を実装する。CR を渡して段階の下書きを作り直し、その段階を承認すると、承認で付く印(作り直しで変わった要素から下流へ届く印)は、これまで CR に結ばれなかった(Phase 86 の決定)。そのため、作り直しで新しく生まれた要素から先の見直しが、CR の検証から漏れていた。この章で、作り直した後の最初の承認の印を CR に結び、検証の対象にする。あわせて、作り直した段階がまだ承認されていない間は、CR を検証済みにできないようにする(着手時の相談 (2))。

自動実装モード: on([introduction](./Phase-96-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/states.py`](../samples/backend/app/change_requests/states.py) | 更新 | 操作に `approve_stage`(記録だけの行)を足した |
| [`app/change_requests/comparison.py`](../samples/backend/app/change_requests/comparison.py) | 更新 | `merge_applied_marks` をサービスから移した(文書の反映と段階の承認で共有) |
| [`app/change_requests/stage_approvals.py`](../samples/backend/app/change_requests/stage_approvals.py) | 新規 | `stage_apply_versions`・`pending_stages`・`StageFacts`・`APPROVE_STAGE_ACTION` |
| [`app/change_requests/verification.py`](../samples/backend/app/change_requests/verification.py) | 更新 | `Verification.pending_stages` と `complete` の条件 |
| [`app/change_requests/trace.py`](../samples/backend/app/change_requests/trace.py) | 更新 | `approve_stage` の名前と、段階・版を読む行(`STAGE_ACTIONS`) |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | 上の名前の re-export |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `ChangeRequestVerificationRead.pending_stages` |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `approve` が印を CR に結ぶ(`_approving_change_request`)。`_record_stage_change` が印を返す |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | 検証の確かめに `pending_stages`。`verify` の理由の文 |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | 承認に操作した人(`actor_id`)を渡す |
| [`tests/unit/test_change_request_stage_approvals.py`](../samples/backend/tests/unit/test_change_request_stage_approvals.py) | 新規 | 純粋関数と、承認・検証の流れ |
| [`tests/unit/test_change_request_reflection.py`](../samples/backend/tests/unit/test_change_request_reflection.py) | 更新 | `merge_applied_marks` の import 元だけ |

## 1. どの承認を結ぶか

```python
# app/change_requests/stage_approvals.py(抜粋)
def stage_apply_versions(events) -> dict[int, int]   # (操作, refs) → 段階ごとの最新の反映の版
def pending_stages(change_request_id, applied_versions, stages: Iterable[StageFacts]) -> list[int]
```

- CR を渡して段階を作り直すと、CR の時系列に段階の反映の行(`apply`。`refs` に段階と版。Phase 85)が残り、段階の行に `generation_change_request_id` が残る。この2つから「その CR で作り直した後に、まだ承認していない段階」を決める。
- 条件は、段階の行が今もその CR で作り直したもので(後で CR なしで、または別の CR で作り直したら外れる)、承認した版が無いか、反映の行の版より前であること。承認は版を増やさないので、作り直した版を承認すると承認した版がその版になって外れる。2回目以降の承認(承認の後に手で直して承認し直した)は結ばない。
- 結ぶのは CR が反映済み(`CHECKABLE_STATUSES`)のときだけ。下の (3) で、未承認の段階があると検証済みにできないので、検証済みの後に結ぶべき承認は残らない。
- 状態を変える表には持たず、`link_review`・`baseline` と同じ記録だけの操作にした。

## 2. 承認で結ぶ

```python
# app/services/design_stage_service.py(抜粋。approve の中)
change_request = await self._approving_change_request(project, row)
extra_sources = (cr_source(change_request.number),) if change_request else ()
marks = _record_stage_change(rows, documents, stage, row.approved_model, er, extra_sources=extra_sources)
if change_request is not None:
    change_request.applied_impact = merge_applied_marks(change_request.applied_impact, marks)
    await ChangeRequestRepository(self._session).add_event(change_request, action=APPROVE_STAGE_ACTION, ...)
```

- 印の出どころに `cr:<番号>` を足すのは、文書の反映(Phase 85)と同じ `extra_sources` の経路である。`_record_stage_change` は記録した印を返すようにした。
- 返った印を CR の印の写し(`applied_impact`)に重ねる。検証(`mark_states`)と比較(`compare`)は写しを見るので、これで結んだ印が「確かめるもの」「実際」に入る。段階を作り直しで新しく生まれた要素から先の印は、比較の「実際だけ」に出る(P89 の申し送りの「漏れ」を数える材料)。
- 時系列に `approve_stage` の1行(`refs`: 段階・版・結んだ印の数)を足す。印が0件でも足す(承認したことが、未承認の段階の確かめの答えになるため)。
- **循環の回避**: `ChangeRequestService` は `BaselineService` → `DesignStageService` を使う。`DesignStageService` から `ChangeRequestService` を呼ぶと循環するので、Phase 86 と同じく `ChangeRequestRepository` で読み書きした。重ねる処理 `merge_applied_marks` は純粋関数なので、サービスから `app/change_requests/comparison.py` へ移して両方から使う(#17。消費者は段階の承認)。
- ルートは承認した人(`actor_id`)を渡す。時系列の行の操作した人になる。

## 3. 未承認の間は検証を止める

```python
# app/change_requests/verification.py(抜粋)
@dataclass(frozen=True)
class Verification:
    marks: tuple[MarkState, ...]
    documents: tuple[DocumentItem, ...]
    pending_stages: tuple[int, ...] = ()

    @property
    def complete(self) -> bool:
        return self.open_marks == 0 and self.open_documents == 0 and not self.pending_stages
```

- 印を結ぶのは承認のときなので、承認の前に検証が済むと、その段階の印は結ばれずに終わる。着手時の相談 (2) で、作り直した段階が未承認の間は検証済みにできないことにした。
- `ChangeRequestService._verification` が CR の時系列と段階の行から `pending_stages` を求めて渡す。`verify` の 409 の理由に「段階N の承認」を足す。応答の `pending_stages` は Phase 98 の画面で使う。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_stage_approvals.py`(新規)の純粋関数の4本 | `stage_apply_versions`・`pending_stages`・`StageFacts`・`verification_of` の `pending`・`Verification.complete`・`trace_entries` の `approve_stage`(パッケージ `app.change_requests` から) | pytest のテスト関数 | スタブ不要 ── 渡した値だけから決まり、DB にも LLM にも触れないため |
| 同じファイルのサービスの3本 | `DesignStageService.approve`・ルート `approve_design_stage`・`ChangeRequestService.verification`・`verify`・`ChangeRequestVerificationRead` | 各テスト関数 | DB はインメモリ SQLite。反映までは `tests/fixtures/change_requests.py`、段階1の作り直しの LLM は FakeLLM |
| `test_change_request_reflection.py`(更新) | `merge_applied_marks`(import 元の移動だけ) | 既存のまま | 既存のまま |

- 統合スモーク: 反映済みの CR で、印と文書の側を確かめ終えた状態から、段階1を CR で作り直すと、検証の確かめに `pending_stages == (1,)` が出て、検証は「段階1の承認」を理由に止まる。
- ルートで承認すると、時系列に `approve_stage`(操作した人・段階・版・印の数)が足され、出どころに `cr:1` と `stage:1` を持つ印が CR の写しに入る。`pending_stages` は空になり、結んだ印が未確認として残る。
- CR なしで作り直した段階の承認は、何も結ばない(`approve_stage` の行が無く、`pending_stages` も空)。
- 反映の行の読み方(文書の反映・形の悪い行は読まない)、未承認の判定(作り直した版より前の承認・別の CR・CR なしの作り直し・反映の行が無い段階)。

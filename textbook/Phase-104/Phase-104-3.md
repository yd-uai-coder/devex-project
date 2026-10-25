# Phase-104-3: 共有リンクからの合意・却下

## この章の目的

クライアントが共有リンクから合意・却下し、それがそのまま CR の判断になるようにする(決定3)。開発者の合意と同じ規則(案の選び方・予測の保存・選んだ案の対象)を通し、相手 = 書いた名前・出どころ = 共有リンク・見た説明書の指紋を残す。開発者の判断にも出どころと指紋を残し、記録の形をそろえる。

自動実装モード: on([introduction](./Phase-104-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/alembic/versions/e8f2a4b6c913_add_change_request_decision_source.py`](../samples/backend/alembic/versions/e8f2a4b6c913_add_change_request_decision_source.py) | 新規。⑯に `decision_source`・`decision_fingerprint` |
| [`backend/app/models/change_request.py`](../samples/backend/app/models/change_request.py) | 2列を足した |
| [`backend/app/change_requests/sharing.py`](../samples/backend/app/change_requests/sharing.py) | `decision_source_label` |
| [`backend/app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | `decision_source_label` を re-export |
| [`backend/app/change_requests/trace.py`](../samples/backend/app/change_requests/trace.py) | `DecisionFacts.source`、合意・却下の行のメモに出どころ(共有リンクのときだけ) |
| [`backend/app/services/errors.py`](../samples/backend/app/services/errors.py) | `ShareDecisionReasonRequiredError`(422) |
| [`backend/app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | `ChangeRequestDecisionRead` に `source`・`source_label`・`fingerprint` |
| [`backend/app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | `decide` の中身を `record_decision` に切り出し、出どころと指紋を残す |
| [`backend/app/schemas/share_link.py`](../samples/backend/app/schemas/share_link.py) | `SharedDecisionCreate`、`SharedDecisionRead` に出どころ |
| [`backend/app/services/share_link_service.py`](../samples/backend/app/services/share_link_service.py) | `ShareLinkService.decide` |
| [`backend/app/api/routes/share.py`](../samples/backend/app/api/routes/share.py) | `POST /share/{token}/decision`(ログイン不要) |
| [`backend/tests/unit/test_share_link_service.py`](../samples/backend/tests/unit/test_share_link_service.py) | 共有リンクの判断のサービスのテストを足した |
| [`backend/tests/unit/test_share_api.py`](../samples/backend/tests/unit/test_share_api.py) | 判断のルートのテストと、ルートの登録を足した |
| [`backend/tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | コメント → 返信 → リンクで合意 → 開発者の判断は409 の流れ |

## 1. `record_decision` の切り出し

```python
# app/services/change_request_service.py(抜粋)
async def decide(self, project, number, payload, *, actor_id) -> ChangeRequestView:
    change_request = await self._load(project, number)
    await self.record_decision(change_request, payload, actor_id=actor_id, source="developer")
    await self._session.commit()
    ...

async def record_decision(
    self, change_request, payload: ChangeRequestDecision, *,
    actor_id, source: DecisionSource, fingerprint: str | None = None, refs: dict | None = None,
) -> None:
    to_status = self._next(change_request, DECISION_ACTIONS[payload.decision])   # 説明済みでなければ 409
    if fingerprint is None:
        fingerprint = (await self._explanation(change_request)).fingerprint      # 開発者: 判断したときの今の説明書
    # 案の選び方(chosen_option)・選んだ案の対象・予測の保存・記録の列は今までどおり
    change_request.decision_source = source
    change_request.decision_fingerprint = fingerprint
    # 時系列の行の refs = 渡した refs + (案があれば option・targets)
```

- `record_explain`(Phase 103)と同じく commit しない形にし、開発者の API と共有リンクの判断が同じ規則を通す(#17 の消費者 = 共有リンクの判断)。案のある CR で案を選ばない・案の無い CR で選ぶ、といった誤りは、どちらの入口でも同じ 422 `CR_OPTION_INVALID` になる。
- 開発者の判断にも出どころ `developer` と指紋を残す(Claude の判断)。指紋は状態を変える前の説明書(頭が「CR の状態: 説明済み」)で、クライアントが共有リンクで見る版と同じ形である。
- 既存の判断済みの行は、出どころ・指紋とも NULL のまま(この記録を足す前の判断)。

## 2. 共有リンクの判断 `ShareLinkService.decide`

```python
# app/services/share_link_service.py(抜粋)
async def decide(self, token, payload: SharedDecisionCreate) -> SharedView:
    link, change_request, state = await self._resolve(token)                  # 404 / 410
    await self._require_writable(change_request, state, payload.fingerprint)   # 409 ×2
    reason = share_decision_reason(payload.decision, payload.reason)
    if reason is None:
        raise ShareDecisionReasonRequiredError("却下の理由を書いてください。")   # 422
    decision = ChangeRequestDecision(decision=..., decided_at=datetime.now(UTC),
                                     option=payload.option, counterpart=payload.name, reason=reason)
    await self._service.record_decision(change_request, decision, actor_id=None, source="share_link",
        fingerprint=payload.fingerprint,
        refs={"source": "share_link", "fingerprint": payload.fingerprint, "link_id": str(link.id)})
    await self._session.commit()
    return await self.view(token)        # 判断の後の閲覧の形(decided)
```

- 先に押した方で決まる(相談の決定3)。開発者が先に判断すると CR は合意・却下になり、リンクは `decided` で書き込めない(409)。リンクが先なら、開発者の判断は状態の表で 409 `CR_INVALID_TRANSITION`。新しい仕組みは足さず、今の状態の表と `write_problem` の組み合わせで決まる。
- 判断の日時はサーバーの今、記録した人は NULL(ログインしていない)。クライアントが見た版は `decision_fingerprint` と時系列の行の両方に残す。
- 応答は判断の後の閲覧の形(`SharedChangeRequestRead`)。クライアントの画面(Phase 108)は、送った結果をそのまま「判断済み」として出せる。

## 3. 記録の出し方

```python
# app/change_requests/trace.py(抜粋)
def decision_note(note: str, decision: DecisionFacts) -> str:
    source = decision_source_label(decision.source) if decision.source == "share_link" else None
    # 出どころ → 選んだ案 → 相手 → メモ → 理由 の順に、あるものだけ
```

- たどる記録の合意・却下の行には、共有リンクのときだけ「出どころ: 共有リンク」を出す。開発者が記録するのがふつうの形で、毎回「開発者が記録」と出すと読みにくい(実装中の Claude の判断。最初は両方に出し、既存のたどる記録のテストが落ちて気づいた)。
- 開発者の CR の詳細(`ChangeRequestDecisionRead`)とクライアントの判断の結果(`SharedDecisionRead`)には、出どころと表示名をどちらでも出す。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
| --- | --- | --- | --- |
| `test_share_link_service.py`(追記分) | `ShareLinkService.decide`・`ChangeRequestService.record_decision`(と `decide` の出どころ・指紋)・`trace` の合意の行のメモ、`SharedDecisionCreate`、`ShareDecisionReasonRequiredError`、⑯の2列 | pytest のテスト関数 | 永続化と遷移が検証対象のため、テスト用の SQLite のセッションと合意済みの版の fixture |
| `test_share_api.py`(追記分) | `decide_shared_change_request`・`get_change_request`、`SharedDecisionRead`・`ChangeRequestDecisionRead` の出どころ | pytest のテスト関数(ルートは関数を直接呼ぶ) | 同上(案のある CR の fixture) |
| `test_change_requests_flow.py`(統合) | コメント・返信・判断の API と、コメントの CASCADE | httpx の AsyncClient | 実際の PostgreSQL(専用のテスト DB) |

- 共有リンクの合意: CR は合意、相手は前後の空白を除いた名前、理由は決まった文、出どころ・指紋・記録した人 NULL・予測の保存、時系列の行の `refs`、たどる記録のメモ。
- 却下は理由が空白だけなら 422、理由があれば却下になる。
- 古い指紋は 409。開発者が先に合意すると、出どころ `developer` と今の版を残し、リンクの判断は 409。
- 案のある CR: 案を選ばずに合意すると 422、案2で合意すると判断の結果に「案2 …」と出どころ、開発者の CR の詳細に出どころ・案の番号・見た版。
- 統合: コメント(201)→ 返信(201)→ 古い版の判断(409)→ 合意(200。コメント欄つき)→ 開発者の判断(409)→ 判断の後のコメント(409)。プロジェクトの削除でコメントも消える(自分の表への FK を含む CASCADE)。

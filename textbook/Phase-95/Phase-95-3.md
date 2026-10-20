# Phase-95-3: CR の下書きの直しを時系列に残す

## この章の目的

P89 の申し送り「下書きの中の直しは時系列に残さない」を解消する。これまで CR の中身を直したときに時系列(⑰)へ行を足すのは、説明済みから下書きに戻る直しだけだった。下書きのままの直しも「直した」の1行として残し、直した項目の名前をたどる記録に出す。

自動実装モード: on([introduction](./Phase-95-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/trace.py`](../samples/backend/app/change_requests/trace.py) | 更新 | `EDITED_FIELD_LABEL`・`TraceEntry.edited_fields`・`_edited_fields` |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | `EDITED_FIELD_LABEL` の re-export |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `update` が値の変わった項目を集めて `edit` の行を足す |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `TraceEntryRead.edited_fields` |
| [`tests/unit/test_change_request_trace.py`](../samples/backend/tests/unit/test_change_request_trace.py) | 更新 | 直した項目の読み解き |
| [`tests/unit/test_change_request_service.py`](../samples/backend/tests/unit/test_change_request_service.py) | 更新 | 下書きの直しで行が足される・同じ値なら足さない |
| [`tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 更新 | 流れの時系列に「直した」が入る |
| [`tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | 更新 | 写しの CR の直しが、たどる記録に項目の名前で出る |

## 1. 何を残すか

```python
# app/services/change_request_service.py(抜粋)
edited: list[str] = []
for field, value in changes.items():
    if value is None and field != "background_date":
        continue
    if getattr(change_request, field) != value:
        edited.append(field)
    setattr(change_request, field, value)
if edited or to_status != change_request.status:
    await self._change_requests.add_event(
        change_request, action="edit", to_status=to_status, actor_id=actor_id,
        refs={"fields": edited},
    )
```

- **直した項目の名前だけ**を `refs.fields` に残す(着手時の相談 (4))。前後の値は持たない。CR の中身の変化を細かく比べる要求は無く、「いつ・誰が・どこを直したか」が分かれば、説明済みのまま説明した中身と違っていないかを追える。
- 値の変わらない保存(同じ値を送った)は行を足さない。画面の保存のたびに行が増えないようにするためである。
- 説明済みから下書きに戻る直しは、値が変わらなくても今までどおり1行足す(状態が変わるため)。
- 項目の並びはスキーマ(`ChangeRequestUpdate`)の項目の順。対象は、基準の束で確かめて整えた後の値で比べる。

## 2. たどる記録での見せ方

- `trace_entries` が、`edit` の行の `refs.fields` を `EDITED_FIELD_LABEL`(タイトル・内容・背景の出どころ・背景の日付・背景のメモ・対象・新しい要件を足す)で名前にし、`TraceEntry.edited_fields` に入れる。並びは `EDITED_FIELD_LABEL` の順。
- 知らない項目・形の正しくない値・この Phase の前の行(`refs` なし)は空にする(記録で詳細を壊さない。`trace.py` の今までの方針)。
- 応答は `TraceEntryRead.edited_fields`(ほかの行は空の一覧)。画面での見せ方は Phase 98(今の画面は操作の名前「直した」だけを出す)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_trace.py`(更新) | `trace_entries` の `edited_fields`・`EDITED_FIELD_LABEL`・`TraceEntryRead.from_entry` | pytest のテスト関数 | スタブ不要 ── 対象が純粋で外部依存を呼ばないため |
| `test_change_request_service.py`・`test_change_requests_api.py`(更新) | `ChangeRequestService.update`(ルート経由を含む) | pytest のテスト関数 | DB はインメモリ SQLite(`db_session`)。LLM を呼ばない |
| `test_change_requests_flow.py`(更新、統合) | `PATCH .../change-requests/{number}` と `GET .../trace` | httpx の AsyncClient | スタブ不要 ── 実 PostgreSQL(専用のテスト DB)。要約の生成は既存のとおり偽の LLM |

- 下書きのままの直しで `edit` の行(`refs = {"fields": ["title"]}`)が足される。同じ値の保存では足されない。
- 説明済みからの直しの `refs.fields` は、送った項目のうち値の変わったもの(背景の日付・対象)。
- `EDITED_FIELD_LABEL` のキーは `ChangeRequestUpdate` の項目と一致する(項目を足したら名前も足す)。
- 統合: 写した CR-2 を下書きのまま直すと、たどる記録の2行目が「直した」(背景の日付・対象)になり、時系列の行の数も1つ増える。

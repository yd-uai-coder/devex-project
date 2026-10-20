# Phase-96-3: 起点の保存と API

## この章の目的

96-2 の起点を CR に持たせる。新しい要件を足す CR の作成・直しで起点(要素のキー)を受け取り、基準の束で確かめて、表示名と一緒に保存する。予測・説明書・反映の指示は保存した起点を使う。あわせて、起点に選べる要素を束から返す API を作る(選ぶ欄は Phase 98 の画面)。

自動実装モード: on([introduction](./Phase-96-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/models/change_request.py`](../samples/backend/app/models/change_request.py) | 更新 | 列 `origins`(`[{key, label}]`、NULL 可) |
| [`alembic/versions/ee299cd210b8_add_change_request_origins.py`](../samples/backend/alembic/versions/ee299cd210b8_add_change_request_origins.py) | 新規 | 列を足すマイグレーション |
| [`app/repositories/change_request.py`](../samples/backend/app/repositories/change_request.py) | 更新 | `create` の `origins` |
| [`app/change_requests/trace.py`](../samples/backend/app/change_requests/trace.py) | 更新 | `EDITED_FIELD_LABEL` に「予測の起点」 |
| [`app/schemas/baseline.py`](../samples/backend/app/schemas/baseline.py) | 更新 | `BaselineOriginRead` |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | 作成・直しの `origins`(`ORIGINS_MAX`)、`ChangeRequestOriginRead`、詳細・一覧と影響の応答の起点 |
| [`app/services/baseline_service.py`](../samples/backend/app/services/baseline_service.py) | 更新 | `origins`(候補)と `baseline_snapshots` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `checked_origins`・`origin_keys_of`。作成・直し・写し・`predict_for`・`facts_of` |
| [`app/api/routes/baselines.py`](../samples/backend/app/api/routes/baselines.py) | 更新 | `GET .../baselines/{number}/origins` |
| [`tests/unit/test_change_request_origins.py`](../samples/backend/tests/unit/test_change_request_origins.py) | 新規 | 保存・確かめ・直し・写し・反映の指示・履歴・候補の API |
| [`tests/unit/test_change_request_service.py`](../samples/backend/tests/unit/test_change_request_service.py) | 更新 | `facts_of` が起点の表示名を読む |
| [`tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | 更新 | 実際の PostgreSQL で、候補・作成・保存した予測の起点 |

## 1. 保存の形

- `change_requests.origins` は `[{key, label}]`(選んだ順)。NULL は起点なし(既存の CR も NULL)。
- 表示名も写して持つ。反映の指示(`reflection`)は予測を作らずに組み立てるので、キーだけだと表示名のために束の要素を組み直すことになる。束は凍結されているので、写した表示名が古くなることは無い。
- マイグレーション `ee299cd210b8`(head `382a5efa3508` の次)。

## 2. 確かめ

```python
# app/services/change_request_service.py(抜粋)
def checked_origins(keys, adds_requirement: bool, baseline: Baseline) -> list[dict[str, str]] | None
```

- 新しい要件を足す CR だけが起点を持てる。基準の束の候補(`origin_candidates_from_snapshots`。96-2)に無いキー(画面の打ち間違い・機能など選べない種類)は 422 `CR_TARGET_UNKNOWN`。空白を除き、重なりは1つにまとめる。起点が無ければ None。
- 作成で確かめる。直しでは、`origins` を送ったときと、新しい要件を足す印を変えたときに確かめ直す。`origins: null` は変えない、空の一覧で外す。新しい要件を足す印を外すときは、起点も外す(外さなければ 422)。
- 起点を直すと、下書きの直しの記録(Phase 95)に「予測の起点」が出る(`EDITED_FIELD_LABEL`)。
- 却下した CR の写しは起点も写す。

## 3. 使うところ

- `predict_for`(予測。判断の時点で保存する)と `facts_of`(説明書・反映の指示の `origin_labels`)が保存した起点を読む。
- 要素の履歴(Phase 95)の関わる CR は、保存した予測の文書の側の要素(`predicted_document_keys`)で拾うので、起点の画面・API の履歴にもその CR が出る(変更なし。テストで確かめた)。
- 応答: 詳細・一覧に `origins`(`[{key, label}]`)、影響の予測に `origins` と要素ごとの `origin_keys`。
- 束の要素を写しから取り出す処理は `baseline_snapshots` にまとめ、`predict_for` と `checked_origins`・候補の API で共有した(#17)。

## 4. 候補の API

`GET /projects/{id}/baselines/{number}/origins` → `[{key, kind, label}]`(要件・画面・API。文書の並び)。CR の作成・編集の画面(Phase 98)で起点を選ぶ欄に使う。束が無ければ 404。対象を選ぶ `GET .../requirements`(Phase 87)と同じく、束の詳細より軽い。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_origins.py`(新規) | `ChangeRequestService.create`・`update`・`copy_rejected`・`impact`・`explanation`・`reflection`、`checked_origins`・`origin_keys_of`・`predict_for`・`facts_of`、`BaselineService.origins`・`baseline_snapshots`、リポジトリ `create` とモデルの列、スキーマ(`ChangeRequestCreate`・`ChangeRequestUpdate`・`ChangeRequestRead.origins`・`ChangeRequestImpactRead`・`ChangeRequestOriginRead`・`BaselineOriginRead`・`ORIGINS_MAX`)、`EDITED_FIELD_LABEL`、ルート `list_baseline_origins`、`AgreementService.history` | 各テスト関数 | DB はインメモリ SQLite を本物のリポジトリで使う。設計は `create_impact_project` から合意済みの版 B-1 を作る |
| `test_change_request_service.py`(更新) | `facts_of` の `origin_labels` | pytest のテスト関数 | スタブ不要 ── 行の値(SimpleNamespace)から写すだけ |
| `test_change_requests_flow.py`(統合、更新) | 候補の API・作成・保存した予測の起点(ルート → サービス → リポジトリ → JSONB) | httpx の AsyncClient | 既存のまま(LLM は呼ばない) |

- 統合スモーク: 起点つきで作ると、表示名つきで保存され、詳細・予測(起点の画面が「新しい要件の起点」)・説明書の2節に出る。
- 新しい要件を足さない CR の起点・束に無いキー・選べない種類は 422。上限を超える起点はスキーマで 422。
- 直し: 起点を足すと「予測の起点」の直しの行。null は変えない。印を外すなら起点も外す。
- 却下 → 保存した予測に起点が残り、写しも起点を持つ。要素の履歴に、起点の画面の関わる CR として出る。
- 反映の指示に起点の行が入る。

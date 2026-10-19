# Phase-86-2: 文書の側の確認と検証の API

## この章の目的

86-1 の純粋関数を使って、反映した CR の検証の確かめ(印の今の状態と文書の側の確認の項目)を返す API、文書の側の項目を確認済みにする API、CR を「検証済み」にする API を作る。比較の API([85-4](../Phase-85/Phase-85-4.md))も今の確認の状態を出すようにする。この Phase の列と表は、この章のマイグレーション1本でまとめて足す(86-3・86-4 で使う分も)。

自動実装モード: on([introduction](./Phase-86-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`alembic/versions/483d9e531ba0_add_change_request_verification.py`](../samples/backend/alembic/versions/483d9e531ba0_add_change_request_verification.py) | 新規 | `change_requests.document_checks`・`included_baseline_id`、表 `change_request_reviews` |
| [`app/models/change_request.py`](../samples/backend/app/models/change_request.py) | 更新 | 2列、`baseline`・`included_baseline` の外部キーの指定、`reviews`、`ChangeRequestReview` |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | `ChangeRequestReview` の re-export |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `ChangeRequestNotVerifiableError`(409 `CR_NOT_VERIFIABLE`) |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `MarkStateRead`・`DocumentItemRead`・`ChangeRequestVerificationRead`・`DocumentChecksUpdate`・`ChangeRequestVerify` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `VerificationView`・`verification`・`check_documents`・`verify`・`_require_applied`・`_verification`、`comparison` を今の状態に |
| [`app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 更新 | `GET .../verification`・`PUT .../document-checks`・`POST .../verify` |
| [`tests/fixtures/change_requests.py`](../samples/backend/tests/fixtures/change_requests.py) | 新規 | 合意した CR-1 のプロジェクト・CR を渡した反映 |
| [`tests/unit/test_change_request_verify.py`](../samples/backend/tests/unit/test_change_request_verify.py) | 新規 | 検証の確かめ・文書の側の確認・検証済み・承認で済んだ印・やり直し・反映の前 |
| [`tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 更新 | ルーターに3つのパス |

依存の向き: モデル → 既存の `Base`・`PortableJSON`(`ReviewRun` は型チェックのときだけ)。サービス → 86-1 の関数・`DesignStageRepository`(既存)・`StageImpact`(既存)。ルート → スキーマ・サービス(この章)。

## 1. マイグレーションとモデル

- `change_requests.document_checks`(JSON。確認済みにしたキーの一覧。NULL は未確認だけ)。
- `change_requests.included_baseline_id`(FK → `baselines`、SET NULL。86-4 で使う)。束は消さないので SET NULL は保険。
- 表 `change_request_reviews`(主キーは (CR, 回)。86-3 で使う)。CR・回のどちらが消えても行は消える(CASCADE)。
- `ChangeRequest` から `baselines` への外部キーが2つになるので、`relationship(foreign_keys=[...])` でどちらの束かを示す(`baseline` = 基準、`included_baseline` = 入れた束)。

## 2. API

```python
# app/services/change_request_service.py(抜粋)
async def verification(project, number) -> VerificationView     # 反映の前は 409 CR_NOT_APPLIED
async def check_documents(project, number, payload) -> VerificationView   # 反映済みだけ
async def verify(project, number, payload, *, actor_id) -> ChangeRequestView
    # 遷移の表(applied → verified)→ 未確認が残れば 409 CR_NOT_VERIFIABLE → 時系列に verify
```

| API | 本文 | 応答・エラー |
|---|---|---|
| `GET .../{number}/verification` | ── | `can_verify`・`open_marks`・`open_documents`・`marks`(`confirmation`・`confirmation_label`)・`documents`(`reviewed`)。反映の前は 409 `CR_NOT_APPLIED` |
| `PUT .../{number}/document-checks` | `{keys, reviewed}` | 確かめの応答。反映済みでなければ 409 `CR_INVALID_TRANSITION` |
| `POST .../{number}/verify` | `{note}`(任意) | CR の詳細。反映済みでなければ 409 `CR_INVALID_TRANSITION`、未確認が残れば 409 `CR_NOT_VERIFIABLE` |

- **今の段階の印は全段階を読む**(`_verification`): 写しの印は複数の段階にまたがるので、段階の行をまとめて読み、`StageImpact.from_dict` で記録にする。比較も同じ所から読み、「印を付ける段階」(一度でも承認した段階)も一緒に返す。
- **`can_verify` は表と条件の両方**: `VerificationView.can_verify` = 遷移の表で `verify` ができる(反映済み)かつ `complete`。画面(Phase 87)はこの値でボタンを出す。
- **検証の行の `refs`**: `{mark_count, document_count, review_run_ids}`(確かめた数と、結んだレビュー。結んだレビューは 86-3 で足した)。作業中に、件数の項目名を `marks`・`documents` から変えた ── 反映の行の `documents`(作った版の一覧)と同じ名前で、86-4 のたどる記録で読み違えたため。
- **文書の側の確認は時系列に残さない**: 確認の操作は検証までの途中の作業で、結果(確かめた数)は検証の行に残る。段階の印の確認も時系列に残していない。

## 3. テスト用の部品

`tests/fixtures/change_requests.py` に、段階1〜8 承認済みの設計に合意済みの版 B-1 と合意した CR-1 を作る `agreed_change_request_project`、CR-1 を渡して要件定義書から作り直す `reflect_change_request`、その2つを続ける `applied_change_request_project` を置いた。86-2〜86-4 の3つのテストが、反映の後の CR から始めるために使う(#17。85-2〜85-4 のテストの中の同じ手順は、触るときに寄せる)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_verify.py`(新規) | `ChangeRequestService.verification`・`check_documents`・`verify`・`comparison`、スキーマ、`ChangeRequestNotVerifiableError`、3つのルート、列 `document_checks` | pytest のテスト関数 | DB はインメモリ SQLite(`db_session`)を本物のリポジトリで使う。反映までは `tests/fixtures/change_requests.py`(FakeLLM の再生成) |
| `test_change_requests_api.py`(更新) | ルーターの登録 | pytest のテスト関数 | スタブ不要 ── OpenAPI のパスを読むだけ |

- 反映の直後: 印はすべて未確認、文書の側の項目は予測の画面・API、`can_verify` は偽。
- 検証の流れ: 未確認があると 409 / 印をすべて確かめ、文書の側を確かめると `can_verify` / 知らないキーは残らない / 比較も今の状態 / 検証済みと時系列の行(`refs`)/ 検証済みからは確認を変えられない。
- 承認で済んだ印: 段階を開き直して承認すると、その段階の印は「承認で済んだ」。
- やり直し: 文書の側を外す・印を未確認に戻すと、もう一度確かめるまで検証できない。
- 反映の前: 確かめは 409 `CR_NOT_APPLIED`、確認と検証は 409 `CR_INVALID_TRANSITION`。

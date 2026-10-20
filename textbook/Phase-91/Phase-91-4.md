# Phase-91-4: 今の合意の一覧 API

## この章の目的

今の合意(要素ごとの最新の記録)を返す API(`GET /api/v1/projects/{id}/agreements`)を作る。Phase 97 の画面(要件定義書・外部設計書のプレビューの合意の印)と、Phase 92・93 の保護の確かめが読む。詳細設計モードの機能なので、簡易ドキュメントモードでは断る([90-1](../Phase-90/Phase-90-1.md) 決定9)。

自動実装モード: on([introduction](./Phase-91-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/services/detailed_mode.py`](../samples/backend/app/services/detailed_mode.py) | 新規 | `require_detailed`(束のサービスから移した) |
| [`app/services/baseline_service.py`](../samples/backend/app/services/baseline_service.py) | 更新 | `require_detailed` を末端のモジュールから読む |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | 同上 |
| [`app/schemas/agreement.py`](../samples/backend/app/schemas/agreement.py) | 更新 | `AgreementRead`・`agreement_read` |
| [`app/services/agreement_service.py`](../samples/backend/app/services/agreement_service.py) | 更新 | `AgreementService.current`(種類の順 → 記録の順) |
| [`app/api/routes/agreements.py`](../samples/backend/app/api/routes/agreements.py) | 新規 | `GET /projects/{id}/agreements` |
| [`app/api/routes/__init__.py`](../samples/backend/app/api/routes/__init__.py) | 更新 | ルーターをつなぐ |
| [`tests/integration/test_agreements_flow.py`](../samples/backend/tests/integration/test_agreements_flow.py) | 新規 | 束 → 採用 → 一覧・JSONB・CASCADE・モード・持ち主・未認証 |

## 1. `require_detailed` を末端へ

```python
# app/services/detailed_mode.py
def require_detailed(project: Project, what: str) -> None   # 簡易モードは DesignStagesNotAvailableError(409)
```

- 今の合意の一覧も、束・CR と同じ判定で断る。判定は束のサービスにあったが、合意のサービスは束のサービスから呼ばれる([91-3](./Phase-91-3.md))ので、合意のサービスが束のサービスを import すると循環する。判定を末端のモジュールに移し、束・CR・合意の3つのサービスが共有する(#17。消費者 = `AgreementService.current`)。

## 2. 一覧のサービスと応答

```python
# app/services/agreement_service.py(抜粋。91-4 の分)
async def current(self, project: Project) -> list[AgreementRecord]
    # require_detailed → 今の合意を、要素の種類の順(AGREED_KINDS)→ 記録の順に

# app/schemas/agreement.py(抜粋)
class AgreementRead(BaseModel):
    key: str; kind: AgreedKind; label: str; content: dict[str, Any]
    origin: AgreementOrigin; origin_label: str            # "B-1" / "採用にする" / "CR-1"
    baseline_number: int | None; change_request_number: int | None
    recorded_by: uuid.UUID | None; created_at: datetime

def agreement_read(record: AgreementRecord) -> AgreementRead
```

- **並びは文書の順**: 記録の順のままだと、採用にした要件が一覧の後ろに回る。要素の種類の順(要件 → 利用者 → 画面 → API → 外部連携)に並べ、同じ種類の中は記録の順にする。
- **応答は今の合意だけ**: 外れた記録・前の記録(履歴)は Phase 95 の履歴の API で返す。
- **スキーマは `app/schemas/agreement.py` に足した**: 合意の記録の項目(`AgreementNotes`)と同じ「合意」の置き場。

## 3. ルート

```python
# app/api/routes/agreements.py
router = APIRouter(prefix="/projects/{project_id}/agreements", tags=["agreements"])

@router.get("", response_model=list[AgreementRead])
async def list_agreements(session: SessionDep, current_project: CurrentProjectDep) -> list[AgreementRead]
```

- 束・CR と同じく、プロジェクト配下のサブツリー。持ち主でなければ `CurrentProjectDep` が404 を返す。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_agreements_flow.py`(新規・統合) | `GET .../agreements`(ルート → `AgreementService` → `AgreementRepository`)と、束の作成・採用のルートでの記録、プロジェクトの削除での CASCADE | httpx の AsyncClient | スタブ不要 ── LLM を呼ばない。利用者・プロジェクト・文書はセッションで直接作る |

- 束 → 採用の後の一覧が文書の順で、出どころの名前(`B-1`・`採用にする`)・記録した人・JSONB の中身を返す / 記録は束の6要素 + 採用1 / プロジェクトの削除で記録が消える / 簡易モードは409 `DESIGN_STAGES_NOT_AVAILABLE`、まだ合意が無ければ空 / 他人のプロジェクトは404、未認証は401 / 簡易モードの採用は200 で、記録は作らない。
- `require_detailed` の移動は公開の挙動を変えないリファクタ。束・CR の既存のテスト(`test_baseline_service.py`・`test_change_request_service.py`・`test_change_requests_api.py`)が番人(#12-4)。

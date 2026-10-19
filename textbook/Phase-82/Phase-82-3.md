# Phase-82-3: CR の API

## この章の目的

[82-2](./Phase-82-2.md) のサービスを `/projects/{id}/change-requests` の API にする。作成・一覧・詳細・更新と、状態の遷移(説明済み・合意 / 却下・取り下げ)・却下した CR の写しの8つのルート。反映済み・検証済みへの遷移、予測、説明書は Phase 83〜86 で足す。画面は Phase 87。

自動実装モード: on([introduction](./Phase-82-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 新規 | 8つのルート(作成・写しは 201) |
| [`app/api/routes/__init__.py`](../samples/backend/app/api/routes/__init__.py) | 更新 | ルーターの登録 |
| [`tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 新規 | ルートで一巡(作成 → 直し → 説明 → 却下 → 写し → 取り下げ)・無い番号と不正な遷移・登録 |
| [`tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | 新規 | 実際の PostgreSQL で 却下 → 写し → 合意、時系列・プロジェクトの削除で消える、エラーの応答・重なり・他人のプロジェクト |

## 1. ルート

```python
# app/api/routes/change_requests.py(抜粋)
router = APIRouter(prefix="/projects/{project_id}/change-requests", tags=["change-requests"])

POST   ""                    → ChangeRequestRead(201)   # 作成
GET    ""                    → list[ChangeRequestSummaryRead]  # 新しい順
GET    "/{number}"           → ChangeRequestRead
PATCH  "/{number}"           → ChangeRequestRead         # 中身の更新
POST   "/{number}/explain"   → ChangeRequestRead
POST   "/{number}/decision"  → ChangeRequestRead         # 本文 {decision, decided_at, counterpart, memo, reason}
POST   "/{number}/withdraw"  → ChangeRequestRead         # 本文 {reason}(任意)
POST   "/{number}/copy"      → ChangeRequestRead(201)   # 却下した CR の写し(新しい番号)
```

- **遷移ごとにルートを分けた**: `PATCH` に `status` を送る形にすると、合意の記録が要る遷移(判断)と要らない遷移が1つの本文に混ざる。本文の形が違う操作は API を分ける(Phase 66・75 と同じ考え方)。
- **判断は1つのルート**(`/decision`): 合意と却下は同じ記録を付けるので、`decision` の値で分ける。
- **写しは 201**: 新しい CR を作る操作なので、作成と同じにした。応答は新しい CR。
- **他人のプロジェクト**: `CurrentProjectDep` が 404 にする(束と同じ)。
- エラーの応答は既存の仕組み(`AppError` → `{detail, code}`)のまま。ルートは例外を捕まえない。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_requests_api.py`(新規) | 8つのルート関数(→ `ChangeRequestService`)と `api_router` への登録 | pytest のテスト関数(ルートは関数を直接呼ぶ) | スタブ不要 ── LLM を呼ばず、サービスの結果を応答の形に詰めることが検証対象のため、インメモリの SQLite と既存の fixture を使う |
| `test_change_requests_flow.py`(新規・integration) | 8つのうち7つの API(ルート → サービス → リポジトリ)と、プロジェクトの削除での CASCADE | httpx の `AsyncClient`(ASGITransport) | スタブ不要 ── LLM を呼ばない。利用者・プロジェクト・文書はセッションで直接作る(登録の上限に当たらないため) |

- ルート: 一巡の各段の応答(ラベル・作った人・出どころのラベル・判断の記録・却下の `allowed_actions` が `copy` だけ・写しの元・取り下げのラベル・一覧の順・写しの先・元の時系列)/ 無い番号は 404・却下でない CR の写しは 409 / OpenAPI に3つのパスが出る。
- integration: 束が無いと 409 `CR_BASELINE_MISSING` → 束を作ると CR-1(B-1)/ 却下の記録(相手)が詳細に戻る / 写しは 201 で CR-2 / `PATCH` で対象を2つにし、日付を null で消す / 合意の時系列 / 元の CR の時系列と写しの先 / 2つの CR で時系列 7 行 → プロジェクトの削除で 0 行。無い要件・対象が空・出どころの値違いは 422、説明の前の判断は 409 `CR_INVALID_TRANSITION`、無い番号と他人のプロジェクトは 404、2つ目の CR の応答に重なり(CR-1・FR-001)。
- 取り下げの API は integration では流していない(ユニットのルートのテストで呼んだ)。

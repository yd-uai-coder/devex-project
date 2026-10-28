# Phase-115-2: 違いと CR の結び・サービス・API

## この章の目的

115-1 の組み立てを使い、選んだ違いから CR の下書きを作る API を足す。違いの表に CR への結びの列を足し、違いの一覧に「対象の候補の要件」と「CR にしたときの番号」を出す。CR の作成と違いの「CR にした」への切り替えを1つのトランザクションにする。

自動実装モード: on([introduction](./Phase-115-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/models/material_difference.py`](../samples/backend/app/models/material_difference.py) | 更新 | `change_request_id`(FK、SET NULL) |
| [マイグレーション `d5a1c7e3f926`](../samples/backend/alembic/versions/d5a1c7e3f926_add_material_difference_change_request.py) | 新規 | 列と外部キー |
| [`app/repositories/material_difference.py`](../samples/backend/app/repositories/material_difference.py) | 更新 | 選んだ違いの読み出し・CR の番号 |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `MaterialDifferenceOutdatedError`・`MaterialDraftInvalidError` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `create` を `add_draft`(commit しない)に分ける |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `ChangeRequestRead.from_view` |
| [`app/schemas/material_difference.py`](../samples/backend/app/schemas/material_difference.py) | 更新 | 候補・CR の番号・作成の本文 |
| [`app/services/material_difference_service.py`](../samples/backend/app/services/material_difference_service.py) | 更新 | `create_change_request`・`DifferenceView` |
| [`app/api/routes/materials.py`](../samples/backend/app/api/routes/materials.py) | 更新 | `POST /{material_id}/change-requests`・応答の組み立て |
| [`app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 更新 | `_read` を `from_view` に寄せる |
| [`tests/unit/test_material_change_requests.py`](../samples/backend/tests/unit/test_material_change_requests.py) | 新規 | サービス・ルートのテスト |
| [`tests/unit/test_material_difference_service.py`](../samples/backend/tests/unit/test_material_difference_service.py) | 更新 | `DifferenceView` の形と候補 |
| [`tests/integration/test_material_change_requests_flow.py`](../samples/backend/tests/integration/test_material_change_requests_flow.py) | 新規 | 実際の PostgreSQL での流れ |

依存の向き: `routes/materials.py → MaterialDifferenceService → ChangeRequestService.add_draft / app.materials(drafting)/ MaterialDifferenceRepository`。資料の側のサービスが CR のサービスを呼ぶ(逆は無い)。

## 1. 表の列とマイグレーション

```python
# app/models/material_difference.py(抜粋)
change_request_id: Mapped[uuid.UUID | None] = mapped_column(
    Uuid(as_uuid=True), ForeignKey("change_requests.id", ondelete="SET NULL"), nullable=True
)
```

- 結びは CR の id で持ち、応答は番号(`change_request_number`)で返す。番号は一覧のたびに CR の表から引く(`MaterialDifferenceRepository.change_request_numbers`)。
- CR は消えない(プロジェクトの削除でだけ一緒に消える)が、消えても違いは残すため SET NULL。資料を消すと違いは消え、CR は残る(Phase 113 の決定。背景の出どころは CR の文)。
- マイグレーション `d5a1c7e3f926`(`b8f3d6a2e915` の次)。開発 DB を上げ、`alembic check` で差分なしを確かめた。往復は Phase 117。

## 2. CR の作成を2つに分ける

```python
# app/services/change_request_service.py(抜粋)
async def create(self, project, payload, *, created_by) -> ChangeRequestView:
    change_request = await self.add_draft(project, payload, created_by=created_by)
    await self._session.commit()
    ...
async def add_draft(self, project, payload, *, created_by) -> ChangeRequest:
    """確かめは create と同じ。commit はしない。"""
```

- 違いを CR に結ぶ(`converted` + `change_request_id`)のは CR の id が要るので CR の後。`create` が commit すると、間で失敗したときに「CR はあるが違いは未確認」が残る。確かめと作成を `add_draft` に分け、資料の側が同じトランザクションで commit する。
- `ChangeRequestRead.from_view` は、CR の詳細の応答を資料のルートからも同じ形で返すため(今までは CR のルートの `_read` が組み立てていた)。

## 3. サービスの規則(Claude の判断)

```python
# app/services/material_difference_service.py(抜粋)
@dataclass(frozen=True)
class DifferenceView:              # 違い1件・候補の要件・CR の番号
async def create_change_request(self, project, material_id, difference_ids, *, requirement_ids, created_by) -> ChangeRequestView
```

| 確かめ | 誤り |
|---|---|
| 違いがその資料にある(ほかの資料の違いを混ぜない) | 404 |
| 未確認の追加・変更・削除だけ(確かめる点・弾いた・捨てた・CR にしたは不可) | 409 `MATERIAL_DIFFERENCE_STATE` |
| 違いの束が今の最新の束(取り出した後に束を作り直していない) | 409 `MATERIAL_DIFFERENCE_OUTDATED` |
| 組み立てられる(選んだ要件が候補にある・内容の変更と削除が重ならない・CR の上限に収まる) | 422 `MATERIAL_DRAFT_INVALID` |
| CR の入口の確かめ(束にある要件・起点) | 今までどおり(422 `CR_TARGET_UNKNOWN`) |

- **1つの CR は1つの資料から**: 背景(出どころ・日付)を1つに決めるため。
- **基準の束は最新の束**: 違いの対象のキーは取り出したときの束のもの。束を作り直した後は、キーが今の束にあるとは限らないので、取り出し直してもらう。最新の束が古くても止めない(鮮度は 115-3 で CR の応答に出る)。
- 違いの一覧の候補は、違いを取り出したときの束(`baseline_number`)から求める。捨てる / 戻すの応答も同じ形(`DifferenceView`)にした。

## 4. API

`POST /api/v1/projects/{id}/materials/{material_id}/change-requests`

```json
{ "difference_ids": ["…", "…"], "requirement_ids": ["FR-002"] }
```

- `difference_ids` は1〜50件(1回の取り出しの上限と同じ)。`requirement_ids` は省略可(省けば候補すべて)。
- 応答は CR の詳細(201。CR のルートと同じ `ChangeRequestRead`)。
- 違いの一覧(`GET .../differences`)の各行に `requirement_candidates`・`change_request_number` が足される。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_material_change_requests.py`(新規)の5本 | `MaterialDifferenceService.create_change_request`・一覧の候補と CR の番号、`ChangeRequestService.add_draft`、`MaterialDifferenceRepository`(`get_many_in_material`・`change_request_numbers`)、ルート `create_change_request_from_differences` と `ChangeRequestRead.from_view`、`MaterialChangeRequestCreate`、モデルの `change_request_id` | pytest のテスト関数(ルートは関数を直接呼ぶ) | 取り出しの LLM を、決まった構造化出力を返す FakeLLM に差し替える。束・CR は fixture、DB は SQLite |
| `test_material_difference_service.py`(更新) | 一覧・捨てる / 戻すの `DifferenceView`、候補 | 同上 | 同上 |
| `test_material_change_requests_flow.py`(新規・統合) | `POST .../change-requests` と一覧の応答、外部キー(資料を消しても CR が残る) | httpx の AsyncClient | 取り出しの LLM の解決を、資料の印から違いを返す偽の LLM(E2eFakeLLM)に差し替える |

- 作成: 変更 + 追加の2件 → CR-2(下書き・B-1・題・内容・背景・対象・起点)、同じ要件の CR-1 と重なる(止めない)、違いが `converted` + 番号 + 判断した人、やり直しで残る。
- 候補: 画面の違いの候補は FR-001・FR-002、選んだ FR-002 だけが対象、候補に無い要件は 422。
- 確かめ: 確かめる点・ほかの資料の違い・束の番号の食い違い・2回目の作成を断る。
- 統合: JSON の形、422・409・404(ほかのプロジェクト)、資料を消しても CR は残る。
- `routes/change_requests.py` の `_read` の変更は、統合テストの `GET .../change-requests/1` と、115-3 のテストが通る。

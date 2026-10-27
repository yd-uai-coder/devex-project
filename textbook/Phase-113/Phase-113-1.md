# Phase-113-1: 資料(API)

## この章の目的

ステージ14 は、議事録・メール・資料を途中から足し、合意済みの内容と違う点を拾って CR の下書きにする。この章で、その入口になる「資料」を作る。プロジェクトごとの資料の表(種類・題・日付・本文)と、本文の貼り付けか txt / md / pdf のファイルで足す・一覧・読む・消す API。作成時の添付資料(`intake_files`)とは別の表で、ヒアリングの根拠には入れない。本文は、違いの根拠の引用を確かめる相手なので切り詰めず、長すぎるものは断る。

自動実装モード: on([introduction](./Phase-113-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/services/intake_file_processor.py`](../samples/backend/app/services/intake_file_processor.py) | 更新 | `extract_text` に `max_chars`(None で切り詰めない)、拡張子の解決 `file_type_of` |
| [`app/services/project.py`](../samples/backend/app/services/project.py) | 更新 | `_resolve_file_type` を `file_type_of` に寄せた(#17) |
| [`app/models/material.py`](../samples/backend/app/models/material.py) | 新規 | `Material`(㉖ `materials`) |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | `Project.materials`(CASCADE) |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | `Material` の re-export(alembic に読ませる) |
| [`alembic/versions/e7d2b9a4c103_add_materials.py`](../samples/backend/alembic/versions/e7d2b9a4c103_add_materials.py) | 新規 | 表を足すマイグレーション |
| [`app/repositories/material.py`](../samples/backend/app/repositories/material.py) | 新規 | `MaterialRepository`(`create`・`list_with_length`・`get_in_project`) |
| [`app/schemas/material.py`](../samples/backend/app/schemas/material.py) | 新規 | `MaterialMeta`・`MaterialCreate`・`MaterialSummaryRead`・`MaterialRead` |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `MaterialNotFoundError`・`TooManyMaterialsError`・`MaterialTooLongError`・`MaterialUnreadableError` |
| [`app/services/material_service.py`](../samples/backend/app/services/material_service.py) | 新規 | `MaterialService`(貼り付け・ファイル・一覧・取得・削除と上限) |
| [`app/api/routes/materials.py`](../samples/backend/app/api/routes/materials.py) | 新規 | `POST`・`POST /upload`・`GET`・`GET /{id}`・`DELETE /{id}` |
| [`app/api/routes/__init__.py`](../samples/backend/app/api/routes/__init__.py) | 更新 | ルーターの登録 |
| [`tests/unit/test_intake_file_processor.py`](../samples/backend/tests/unit/test_intake_file_processor.py) | 更新 | `max_chars=None` |
| [`tests/unit/test_material_service.py`](../samples/backend/tests/unit/test_material_service.py) | 新規 | サービス・ルート・上限・モード |
| [`tests/integration/test_materials_flow.py`](../samples/backend/tests/integration/test_materials_flow.py) | 新規 | 実 PostgreSQL で multipart・CASCADE・誤りの応答 |

## 1. 表と本文の取り出し

```python
# app/models/material.py(抜粋)
class Material(Base):
    __tablename__ = "materials"
    kind: Mapped[str]            # minutes / email / document
    title: Mapped[str]           # 200文字まで
    material_date: Mapped[date]  # 資料の日付(足した日時 created_at とは別)
    body: Mapped[str]            # 切り詰めない
    source: Mapped[str]          # paste / txt / md / pdf
    filename: Mapped[str | None]
    created_by: Mapped[uuid.UUID | None]   # users.id、SET NULL
```

```python
# app/services/intake_file_processor.py(抜粋)
def file_type_of(filename: str) -> str
async def extract_text(*, file_type, data, llm=None,
                       max_chars: int | None = MAX_EXTRACTED_TEXT_CHARS) -> tuple[str | None, str | None]
```

- **作成時の添付資料と別の表**(Phase 111 の決定4): 添付資料は本文をチャットの履歴(`sender='attachment'`)にも入れ、ヒアリングと生成の根拠になる。資料は合意の後の変化の材料で、根拠に混ぜない。
- **本文の取り出しは共有**(#17): `extract_text` は作成時の添付資料と同じ関数。違いは切り詰めだけで、資料は `max_chars=None` で受けて、サービスが長さで断る。拡張子の解決(`file_type_of`)も `ProjectService` と同じものを使う(駆動する消費者 = 資料のサービス)。
- **状態の列は置かない**(Claude の判断): 取り出せなかったファイルは行を作らず 422 で断る。作成時の添付資料は「ヒアリングを止めない」ために失敗の行を残したが、資料にはその事情が無い。違いを取り出したかの状態は Phase 114 で足す。

## 2. 上限とサービス

```python
# app/services/material_service.py(抜粋)
MAX_MATERIALS_PER_PROJECT = 50
MAX_MATERIAL_CHARS = 20_000
MAX_MATERIAL_FILE_BYTES = 2 * 1024 * 1024

class MaterialService:
    async def create_from_text(self, project, payload: MaterialCreate, *, created_by) -> MaterialView
    async def create_from_file(self, project, meta: MaterialMeta, *, filename, data, created_by) -> MaterialView
    async def list_for_project(self, project) -> list[MaterialView]   # 本文は読まない
    async def get(self, project, material_id) -> MaterialView
    async def delete(self, project, material_id) -> None
```

- **本文は20,000文字を超えたら断る**(着手時の決定1): 切り詰めると、違いの根拠の引用が「資料に文字どおりある」か確かめられず、後ろの方の変化を拾い漏らす。貼り付けもファイルも同じ `MATERIAL_TOO_LONG`(422)。
- **ファイルは2MB まで**: API 全体のリクエストの上限(`MAX_REQUEST_BODY_BYTES` = 2,000,000)に合わせた。作成時の添付資料の5MB は、この上限のため実際には届かない。
- **確かめる順**: 形式 → 大きさ → 数 → 本文の取り出し → 長さ。PDF を読む AI(持ち主の Gemini。`resolve_pdf_reader`)を、断る資料のために呼ばない。
- **詳細設計モードだけ**(`require_detailed`): 資料と比べる相手は束で、束は詳細設計モードだけのため。
- **消すと違いも消える・CR は残る**(着手時の決定2): 違いの表(Phase 114)は資料に CASCADE で結ぶ。CR の背景の出どころは CR の側の文なので切れない。
- `MaterialView`(資料と本文の文字数の組): 一覧は本文を読まず(`defer`)、文字数は DB で数える(`func.length`)。

## 3. API

| メソッド | パス | 応答 |
|---|---|---|
| POST | `/projects/{id}/materials` | 201・本文つき(JSON の貼り付け) |
| POST | `/projects/{id}/materials/upload` | 201・本文つき(multipart: `file`・`kind`・`title`・`material_date`) |
| GET | `/projects/{id}/materials` | 新しい順・本文なし・`length` |
| GET / DELETE | `/projects/{id}/materials/{material_id}` | 本文つき / 204。ほかのプロジェクトの資料は404 |

- multipart の題は `MaterialTitle`(前後の空白を除いて1〜200文字)を `Form()` で受けるので、空白だけの題は 422 になる。

## テスト観点

用語: SUT = テストの対象、ドライバ = SUT を呼ぶもの、スタブ = SUT が呼ぶ相手の差し替え。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_intake_file_processor.py` に1本 | `extract_text(max_chars=None)` | pytest のテスト関数 | スタブ不要 ── txt は LLM を呼ばない純粋な読み取りのため |
| `test_material_service.py`(新規) | `MaterialService`・`MaterialRepository`・ルート5本・`MaterialCreate`・`Material`/`Project.materials`・`file_type_of` | pytest のテスト関数(ルートは直接呼ぶ) | PDF を読む AI だけ差し替える(`LlmResolver.resolve_pdf_reader` → FakeLLM / キーが無い)。それ以外はスタブ不要 ── 永続化と上限が検証対象で、テスト用の SQLite を使う |
| `test_materials_flow.py`(統合) | 資料の API 5本とプロジェクトの削除の CASCADE | httpx の AsyncClient | スタブ不要 ── txt / md だけで LLM を呼ばない。実 PostgreSQL |

- 統合スモーク: 作成時の添付資料のテスト(`test_project_service.py`・`test_llm_call_sites.py`)が、`file_type_of` に寄せた後も通る。
- 貼り付けは前後の空白を除いて保存し、チャットの履歴に入らない。一覧は新しい順で本文を持たない。txt は上限ちょうどの20,000文字を切り詰めずに持つ。PDF は持ち主で読む。
- 断る(行を作らない): 形式・大きさ・UTF-8 でない・空・長すぎ・PDF を読む AI が無い。数の上限はファイルを読む前に止める。
- ほかのプロジェクトの資料は読めず消せない。簡易ドキュメントモードは 409。

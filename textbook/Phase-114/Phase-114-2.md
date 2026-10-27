# Phase-114-2: 違いの表・サービス・API・偽の LLM

## この章の目的

114-1 の純粋関数を使い、資料1件と最新の束から違いを取り出して残す API を作る。取り出しは生成の用途の LLM を1回呼び、検査を通らないものも「弾いた」として理由とともに残す。比べた束が古くても止めず、その時点の鮮度を回の記録に残して返す(Phase 113 の `freshness`)。開発者が違いを捨てる(確かめる点を閉じる)・戻す操作もここで持つ。CR の下書きへのつなぎは Phase 115、画面は 116。

自動実装モード: on([introduction](./Phase-114-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/models/material_difference.py`](../samples/backend/app/models/material_difference.py) | 新規 | `MaterialExtraction`(取り出しの直近の回)・`MaterialDifference`(違い1件) |
| [`app/models/material.py`](../samples/backend/app/models/material.py) | 更新 | `Material.extraction`・`Material.differences`(CASCADE) |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | 2つのモデルの登録 |
| [マイグレーション `b8f3d6a2e915`](../samples/backend/alembic/versions/b8f3d6a2e915_add_material_differences.py) | 新規 | ㉗ `material_extractions`・㉘ `material_differences` |
| [`app/repositories/material_difference.py`](../samples/backend/app/repositories/material_difference.py) | 新規 | 違いの一覧・1件・状態での削除・次の並び・足す、取り出しの回の読み書き |
| [`app/schemas/material_difference.py`](../samples/backend/app/schemas/material_difference.py) | 新規 | 違い・取り出しの回・一覧の応答、捨てる / 戻すの入力 |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `MaterialBaselineMissingError`・`MaterialDifferenceNotFoundError`・`MaterialDifferenceStateError` |
| [`app/services/material_difference_service.py`](../samples/backend/app/services/material_difference_service.py) | 新規 | 取り出し・一覧・捨てる・戻す |
| [`app/api/routes/materials.py`](../samples/backend/app/api/routes/materials.py) | 更新 | `POST`・`GET .../materials/{id}/differences`・`PATCH .../differences/{id}` |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 資料の印 `[違い:<種類>:<キー>]` から違いを返す偽物 |
| [`tests/unit/test_material_difference_service.py`](../samples/backend/tests/unit/test_material_difference_service.py) | 新規 | サービス・ルート・偽の LLM・CASCADE |
| [`tests/integration/test_material_differences_flow.py`](../samples/backend/tests/integration/test_material_differences_flow.py) | 新規 | 実 PostgreSQL での API の流れ |

依存の向き: `routes/materials.py` → `material_difference_service.py` → `repositories/material_difference.py` → `models/material_difference.py`。サービスは `app.materials`(114-1)・`BaselineService`(鮮度・写し)・`MaterialService`(資料の読み出しとモード)・`LlmResolver` を使う。偽の LLM は `app.materials.differences` の出力の型だけを使う。

## 1. 表

```python
# app/models/material_difference.py(抜粋)
class MaterialExtraction(Base):          # 資料ごとに1行(UNIQUE)。やり直すと上書き
    material_id; baseline_number; freshness: dict   # その時点の鮮度(応答の形の JSON)
    generated_model; generated_by; generated_at

class MaterialDifference(Base):          # 違い1件
    material_id; position; kind; target_key; origin_key; content; quote
    status; reasons: list; dismiss_reason; baseline_number; decided_by; decided_at; created_at
```

- **取り出しの回を別の表に**: 違いが0件の回でも「取り出した(比べた束・鮮度)」を残すため(Phase 113 の Claude の判断「状態は違いの表の側に持つ」を、0件でも持てる形にした)。着手時の決定4 のとおり、資料ごとに1行で上書き。
- **鮮度は写して残す**: 束の鮮度は後で変わる(新しい束・後の CR)。取り出しの時点で古い束と比べたことを残すため、`BaselineFreshnessRead` の JSON を写す。今の最新の束は一覧の応答の `latest_baseline_number` で別に返す(取り出した後に束を作り直したかが分かる)。
- **違いに比べた束の番号**: やり直しで残した違いは、前の回の束と比べたもの。行ごとに持つ。
- どちらも `materials` に CASCADE(Phase 113 の決定2: 資料を消すと違いも消える)。CR の番号の列は、CR にする Phase 115 で足す(駆動する消費者が無いので、この Phase では足さない。#17)。

## 2. サービス

```python
# app/services/material_difference_service.py(抜粋)
@dataclass(frozen=True)
class DifferencesView:
    material; extraction: MaterialExtraction | None
    latest_baseline_number: int | None
    differences: list[MaterialDifference]

class MaterialDifferenceService:
    def __init__(self, session, *, llm=None)              # llm: テストが差し替える
    async def extract(self, project, material_id, *, user_id) -> DifferencesView
    async def list_for(self, project, material_id) -> DifferencesView
    async def dismiss(self, project, material_id, difference_id, *, reason, actor_id) -> MaterialDifference
    async def restore(self, project, material_id, difference_id) -> MaterialDifference
```

`extract` の順:

1. 資料を読む(`MaterialService.get`。詳細設計モード・ほかのプロジェクトは404)。
2. 最新の束(`BaselineRepository.latest`)。無ければ 409 `MATERIAL_BASELINE_MISSING`(CR の `CR_BASELINE_MISSING` に名前をそろえた)。
3. 鮮度(`BaselineService.freshness_of`)。古くても止めない(111-1 の決定2・5)。
4. 一覧(`agreed_listing(baseline_snapshots(baseline))`)と資料で LLM を1回(`invoke_structured`。生成の用途。要約・案の下書きと同じ解決)。
5. 検査(`check_differences`)。
6. ここで初めて DB を変える: 未確認・弾いたを消し、残った違い(CR にした・捨てた)と重ならないものを、残りの後ろの並びで足す。取り出しの回を上書きしてコミット。LLM が失敗したら前の一覧はそのまま。

- `dismiss` は未確認だけ(弾いたものは捨てる対象でなく、検査の結果として残す)、`restore` は捨てたものだけ。違う状態は 409 `MATERIAL_DIFFERENCE_STATE`。確かめる点を閉じるのも `dismiss`(理由が要る)。
- 資料の種類のラベル(`MATERIAL_KIND_LABEL`。議事録・メール・資料)は LLM に渡す見出しのためにサービスで持つ。

## 3. API

| メソッド・パス | 内容 |
|---|---|
| `POST /projects/{id}/materials/{mid}/differences` | 取り出す(やり直しも同じ)。応答は一覧と同じ形 |
| `GET /projects/{id}/materials/{mid}/differences` | `{material_id, extraction, latest_baseline_number, differences}` |
| `PATCH /projects/{id}/materials/{mid}/differences/{did}` | `{action: "dismiss", reason}` / `{action: "restore"}` |

```python
# app/schemas/material_difference.py(抜粋)
class MaterialExtractionRead(BaseModel):
    baseline_number: int
    freshness: BaselineFreshnessRead      # 写した JSON を読み直す
    generated_model; generated_by; generated_at
    baseline_label -> str                 # B-n

class MaterialDifferenceUpdate(BaseModel):
    action: Literal["dismiss", "restore"]
    reason: str | None = None             # 1〜500文字。dismiss のときは要る(なければ422)
```

## 4. 偽の LLM

```python
# app/ai/llm/fake.py(抜粋)
_DIFFERENCE_MARK = re.compile(r"\[違い:(add|change|delete|question):([^\]]*)\]")
def _differences(messages) -> DifferenceListOut
```

- 資料の本文に `- 予約の画面に空き状況の表を足してほしい。[違い:add:screen:SCR-001]` のように印を書くと、その行から違いを1件返す(キーは変更・削除・確かめる点の対象、追加の起点。`-` は無し。引用は印と行頭の md の記号を除いた行の文)。Phase 117 の E2E が決まった違いを作るため(111-1 の決定10)。束に無いキーを書けば「弾いた」も作れる。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_material_difference_service.py`(新規)のサービスの4本 | `MaterialDifferenceService`(extract / list_for / dismiss / restore)・`MaterialDifferenceRepository`・モデル | pytest のテスト関数 | 取り出しの LLM は、決まった `DifferenceListOut` を順に返す FakeLLM をサービスに注入。束と反映した CR は `tests/fixtures/change_requests.py`(偽の LLM で反映)。DB はテスト用の SQLite |
| 同ファイルのルートの1本 | ルート3つ・`MaterialDifferencesRead`・`MaterialDifferenceUpdate`・偽の LLM の `_differences`・`Material.differences`/`extraction` と CASCADE | pytest のテスト関数(ルートは直接呼ぶ) | LLM の解決(`LlmResolver.resolve`)を、資料の印から違いを返す `E2eFakeLLM` に差し替える(`stub_llm_resolver`) |
| 同ファイルのスキーマの1本 | `MaterialDifferenceUpdate` | pytest のテスト関数 | スタブ不要 ── 入力の検査だけで、外部に触らないため |
| `test_material_differences_flow.py`(統合)の1本 | API の流れ(ルート → サービス → リポジトリ・`BaselineService`)・JSONB・CASCADE | httpx の AsyncClient | LLM の解決を `E2eFakeLLM` に差し替える。実 PostgreSQL |

- 取り出し: 通ったもの(接頭辞の補い)・弾いたもの(理由2つ)が並びの順に残る。束の後に CR-1 を反映したプロジェクトでは、回の記録の鮮度が古い(CR-1 の要素)。
- やり直し: 捨てた違いは残り、同じ違いは足し直さず、未確認と弾いたは置き換わる。足したものは残りの後ろの並び。
- 捨てる / 戻す: 未確認だけ捨てられ、弾いた・捨てたものは捨てられない。捨てたものだけ戻せる。戻すと理由と判断者が消える。無い違いは404。
- 束が無い・資料が無い: 409・404。まだ取り出していない一覧は空。
- ルート: 生成の用途で解決する。偽の LLM の印から3種類の違い。捨てた理由は前後の空白を除く。資料を消すと違いと回の記録も消える。
- 統合: 束が無い409 → 束を作って取り出す → 理由の無い捨てるは422 → 確かめる点を閉じる → 弾いたものは戻せない409 → 無い違いは404 → やり直し → ほかの利用者のプロジェクトからは404 → 資料の削除で0行。

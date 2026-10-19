# Phase-81-3: 合意済みの版の作成・一覧・取得の API

## この章の目的

開発者が、今の文書と段階を写して合意済みの版(束)を作り、一覧と中身を読めるようにする(`/projects/{id}/baselines`)。作れる条件・何を写すかはサービスが決める。着手時のユーザー決定は「要件定義書・外部設計書がそろえば作れる(未承認・古い段階はその状態を残す)」「作った束は直せず消せない」の2つ。CR(Phase 82)は、ここで作る束を基準(「B-1 からの変更」)にする。

自動実装モード: on([introduction](./Phase-81-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `BaselineDocumentsMissingError`(409)・`BaselineNotFoundError`(404) |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `stage_rows(project)`(段階の行と状態。今の `_load` を包む) |
| [`app/schemas/baseline.py`](../samples/backend/app/schemas/baseline.py) | 新規 | `BaselineCreate`・写しの要約 / 中身・束の要約 / 中身(`label`) |
| [`app/services/baseline_service.py`](../samples/backend/app/services/baseline_service.py) | 新規 | `BaselineService`(作成・一覧・取得)・`document_snapshots`・`stage_snapshots` |
| [`app/api/routes/baselines.py`](../samples/backend/app/api/routes/baselines.py) | 新規 | `POST`(201)・`GET`・`GET /{number}` |
| [`app/api/routes/__init__.py`](../samples/backend/app/api/routes/__init__.py) | 更新 | ルーターの登録 |
| [`tests/unit/test_baseline_service.py`](../samples/backend/tests/unit/test_baseline_service.py) | 新規 | 写す中身・凍結・未承認 / 古い段階・テスト仕様書・一覧と取得・3つの条件・本文の検証 |
| [`tests/integration/test_baselines_flow.py`](../samples/backend/tests/integration/test_baselines_flow.py) | 新規 | 実際の PostgreSQL で作成 → 一覧 → 取得 → プロジェクトの削除で消える、条件と他人のプロジェクト |

## 1. 作れる条件

```python
# app/services/baseline_service.py(BaselineService.create の抜粋)
if project.mode != "detailed":
    raise DesignStagesNotAvailableError(...)          # 409 DESIGN_STAGES_NOT_AVAILABLE
if project.status == "generating":
    raise DocGenerationInProgressError(...)           # 409
rows, views = await DesignStageService(self._session).stage_rows(project)
if any(row.generation_status == "generating" for row in rows.values()):
    raise DesignStageGenerationInProgressError(...)   # 409
documents = {doc_type: await self._documents.get_current(...) for doc_type in BASELINE_DOCUMENTS}
if missing := [d for d in REQUIRED_DOCUMENTS if documents[d] is None]:
    raise BaselineDocumentsMissingError(...)          # 409 BASELINE_DOCUMENTS_MISSING
```

- **文書がそろえば作れる**(ユーザー決定): 合意は設計の途中(要件と外部設計を固めた時点)でもしたいので、段階の承認を条件にしない。代わりに、段階の状態を写しに残す。
- **生成中は作れない**: 生成の途中の版や、下書きを書き換えている段階を写すと、「合意した中身」が後から変わったように見えるため。止まった生成の回収(15分超)は段階の一覧の GET が行うので、ここでは状態を読むだけにした。
- **簡易ドキュメントモードは 409**: ステージ11 は詳細設計モードだけ([80-1](../Phase-80/Phase-80-1.md) 決定3)。モードが違うときの既存の例外(`DesignStagesNotAvailableError`)を使った。
- `REQUIRED_DOCUMENTS` は `DOC_TYPES_BY_MODE["detailed"]`(要件定義書・外部設計書)。`BASELINE_DOCUMENTS` はそれにテスト仕様書(`TEST_SPEC`)を足したもの。

## 2. 何を写すか

```python
# app/services/baseline_service.py(抜粋)
def document_snapshots(documents) -> list[ItemSnapshot]:
    # 版があれば present(版・md・model・生成したモデル名)、無ければ absent
def stage_snapshots(rows, views) -> list[ItemSnapshot]:
    # 承認の写し(approved_model)があれば included=True、state は今の状態(approved・reviewing・outdated…)
    # 写しが無ければ included=False、state は not_started・draft など
```

- **段階は「最後に承認した中身」を写す**: 承認の後に編集した段階(`reviewing`)や、入力が変わって「古い」(`outdated`)段階も、`approved_model` は最後に承認した中身のままである。それを写し、今の状態を `state` に残す。今の編集中の `model` は写さない(人が確定していない中身を合意の基準にしない)。
- **純粋関数に分けた**: 写しの作り方は DB に触らないので、`document_snapshots`・`stage_snapshots` として外に出した。サービスは読み出しと条件の判定だけを持つ。
- **`stage_rows` を足した**: 段階の行と状態(`derive_states` の結果)は `DesignStageService._load` が作る。束のサービスがプライベートのメソッドを呼ばないよう、行と状態だけを返す公開のメソッドを1つ足した(段階の一覧 `list_stages` は文書・図の要約まで組み立てるので、使わない)。

## 3. 本文と応答

```python
# app/schemas/baseline.py(抜粋)
class BaselineCreate(BaseModel):
    counterpart: str | None = Field(default=None, max_length=200)   # 空白だけは None にそろえる
    agreed_at: AwareDatetime                                          # タイムゾーン付きだけ
    memo: str = Field(default="", max_length=10000)
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]

class _BaselineRecordRead(BaseModel):        # 番号と合意の記録、label(B-n)
class BaselineSummaryRead(_BaselineRecordRead): items: list[BaselineItemSummaryRead]  # 一覧
class BaselineRead(_BaselineRecordRead):        items: list[BaselineItemRead]         # 作成・取得
```

- **合意の日時は必須・タイムゾーン付き**: 打ち合わせの日時を後から記録することがあるので、記録した日時(`created_at`)とは別に受け取る。タイムゾーンの無い日時は、どの時刻か決まらないので 422。
- **理由は必須、メモと相手は空でもよい**([80-1](../Phase-80/Phase-80-1.md) 決定8)。
- **一覧は要約だけ**: 写しの md と model は大きいので、一覧(`BaselineSummaryRead`)には入れない。中身は `GET .../baselines/{number}` で読む。
- **記録の項目を基底のクラスにまとめた**: 要約と中身で `items` の型だけが違う。継承で `items` を上書きすると型の検査が通らない(リストは不変なので)ため、記録の項目を `_BaselineRecordRead` に置き、2つのスキーマがそれぞれ `items` を持つ形にした。
- ルートは「サービスを呼ぶ → スキーマに詰める」だけ。直す・消す API は作らない。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_baseline_service.py`(新規) | `BaselineService`・`document_snapshots`・`stage_snapshots`・3つのルートの関数・`BaselineCreate`・`DesignStageService.stage_rows` | pytest のテスト関数(ルートは関数を直接呼ぶ) | スタブ不要 ── LLM を呼ばず、永続化と状態の判定が検証対象のため、インメモリの SQLite と、段階1〜8 を承認済みにした fixture(`create_impact_project`)を使う |
| `test_baselines_flow.py`(新規、integration) | `POST`・`GET /baselines`・`GET /baselines/{number}` と、プロジェクトの削除での CASCADE | httpx の `AsyncClient`(ASGITransport) | スタブ不要 ── JSONB の写し・一意制約・外部キーの CASCADE を実際の PostgreSQL で確かめる。利用者・文書はセッションで直接作る |

- **写す中身**: 文書3つ → 段階8つの順 / 要件定義書は版・md・model / 無いテスト仕様書は `absent` / 段階1は承認の写しと同じ model。
- **凍結**: 束を作った後に、要件定義書の新しい版を作り、段階1の承認の写しを書き換えても、束の写しは元の版・中身のまま。
- **状態の記録**: 承認したことの無い段階は `included=false`(状態は `draft`)/ 古い段階は `included=true`・`outdated`。
- **テスト仕様書**: あれば md と生成したモデル名が写る。
- **一覧と取得**: 一覧は新しい順(`B-2`, `B-1`)で中身を持たない / 無い番号は `BaselineNotFoundError`(統合テストでは 404)。
- **条件**: 簡易モード・文書の生成中・段階の生成中・外部設計書が無い、のそれぞれで例外(統合テストでは 409 とコード)。
- **本文**: 空白だけの相手は `None`、理由の前後の空白は落とす、空の理由とタイムゾーンの無い日時は検証の失敗(統合テストでは 422)。
- **他人のプロジェクト**: 404(`CurrentProjectDep` の所有者の確かめ)。
- **CASCADE**: 2つの束(写し 22 行)が、プロジェクトの削除で 0 行になる。

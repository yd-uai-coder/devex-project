# Phase-82-2: CR の状態の遷移とサービス

## この章の目的

CR の6つの状態(と取り下げ)の遷移を純粋な表にし、サービスで作成・更新・説明済み・合意 / 却下・取り下げ・却下した CR の写しを行う。着手時のユーザー決定は3つ ── 却下した CR は「写して新しい下書きを作る」形で出し直す / ID の無い新しい要件は「新しい要件を足す」の印で持つ / 同じ要件を対象にする進行中の CR は止めずに重なりを示す。合意の記録の項目は、束(Phase 81)と共有のスキーマに抜き出した。

自動実装モード: on([introduction](./Phase-82-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/states.py`](../samples/backend/app/change_requests/states.py) | 新規 | 状態・操作・出どころの型とラベル、`TRANSITIONS`・`next_status`・`allowed_actions`・`overlaps`・`normalize_targets` |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 新規 | `states` の re-export |
| [`app/schemas/agreement.py`](../samples/backend/app/schemas/agreement.py) | 新規 | `AgreementNotes`(相手・メモ・理由と空白の検証)と文の上限 |
| [`app/schemas/baseline.py`](../samples/backend/app/schemas/baseline.py) | 更新 | `BaselineCreate` を `AgreementNotes` の継承にした(公開の形は同じ) |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 新規 | 作成・更新・判断・取り下げの本文と、時系列・判断・重なり・一覧・詳細の応答 |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | CR の4つの例外(404・409 `CR_BASELINE_MISSING`・422 `CR_TARGET_UNKNOWN`・409 `CR_INVALID_TRANSITION`) |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 新規 | `ChangeRequestService`・`ChangeRequestView`・`baseline_requirement_ids`・`checked_targets` |
| [`tests/unit/test_change_request_states.py`](../samples/backend/tests/unit/test_change_request_states.py) | 新規 | 許す遷移・許さない遷移・できる操作・表の網羅・重なり・対象の整え |
| [`tests/unit/test_change_request_service.py`](../samples/backend/tests/unit/test_change_request_service.py) | 新規 | 作成の項目と条件・基準の束・説明と判断・説明済みの直し・取り下げ・写し・重なり・一覧・本文の検証 |

依存の向き: `states.py`(純粋)← `schemas/change_request.py` ← `services/change_request_service.py`。`schemas/agreement.py` ← `schemas/baseline.py`・`schemas/change_request.py`。ドメインのパッケージは例外を import しない(不正な遷移は `None` を返し、サービスが `ChangeRequestInvalidTransitionError` にする)。

```python
# app/change_requests/__init__.py(re-export の形)
from app.change_requests.states import (
    ACTIVE_STATUSES, BACKGROUND_SOURCE_LABEL, BACKGROUND_SOURCES, COPYABLE_STATUSES,
    DECISION_ACTIONS, INITIAL_STATUS, STATUS_LABEL, STATUSES, TRANSITIONS,
    BackgroundSource, ChangeRequestAction, ChangeRequestStatus, Overlap,
    allowed_actions, next_status, normalize_targets, overlaps,
)
```

## 1. 遷移の表

```python
# app/change_requests/states.py(抜粋)
TRANSITIONS = {
    "edit":     {"draft": "draft", "explained": "draft"},   # 説明済みで直すと下書きに戻る
    "explain":  {"draft": "explained"},
    "agree":    {"explained": "agreed"},
    "reject":   {"explained": "rejected"},
    "withdraw": {"draft": "withdrawn", "explained": "withdrawn"},  # 合意の前だけ
    "apply":    {"agreed": "applied"},     # API は Phase 85
    "verify":   {"applied": "verified"},   # API は Phase 86
}
COPYABLE_STATUSES = frozenset({"rejected"})
ACTIVE_STATUSES = frozenset({"draft", "explained", "agreed", "applied"})

def next_status(current, action) -> ChangeRequestStatus | None
def allowed_actions(current) -> list[ChangeRequestAction]   # 画面のボタンの出し分け用
def overlaps(targets, others: Iterable[tuple[int, Sequence[str]]]) -> list[Overlap]
```

- **表にした理由**: 遷移の可否を if の連なりにすると、サービスのメソッドごとに条件が散る。表なら「何がどこから行けるか」を1か所で読め、純粋なのでテストが素で書ける。反映・検証の行も先に置き、Phase 85・86 は API だけを足す。
- **説明済みで直すと下書きに戻る**(Claude の判断): クライアントに説明した中身と変わるため。下書きの中の直しは時系列に残さない(残すと、打ち合わせの前の書き直しで時系列が埋まる)。
- **却下は終わりの状態**(ユーザー決定の読み方): 「下書きに戻せるが、却下の前の状態と却下の理由は残したい。却下した CR のコピーを下書きにして変更を加えるイメージ」。却下 → 下書き の遷移を足すと、同じ CR の合意の記録(却下の理由)を上書きすることになる。写しにすれば、元の CR は却下のまま残り、新しい CR に新しい判断が付く。写しは遷移ではないので、表の外(`COPYABLE_STATUSES`)に置いた。
- **重なりは止めない**(ユーザー決定): 同じ要件に2つの CR があっても、片方が却下されるかもしれない。止めずに、詳細に「CR-1 と FR-001 が重なる」を出す。終わった CR(却下・検証済み・取り下げ)は数えない。

## 2. スキーマ ── 合意の記録の共有

```python
# app/schemas/agreement.py(抜粋)
class AgreementNotes(BaseModel):
    counterpart: str | None = Field(default=None, max_length=COUNTERPART_MAX)  # 空白は null に
    memo: str = Field(default="", max_length=MEMO_MAX)
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, ...)]

# app/schemas/baseline.py(Phase 82-2 で更新)
class BaselineCreate(AgreementNotes):
    agreed_at: AwareDatetime

# app/schemas/change_request.py(抜粋)
class ChangeRequestDecision(AgreementNotes):
    decision: Literal["agreed", "rejected"]
    decided_at: AwareDatetime
```

- **共通化した理由**(#17): 判断の記録は束と同じ項目(2.14節)。CR の判断という今の消費者があるので、コピーせずに抜き出した。日時の名前は使う側で違う(束は合意した日時、CR は判断した日時。却下にも使うので `agreed_at` にしない)ので、基底に入れていない。束の API の本文と検証は変わらない([81-3](../Phase-81/Phase-81-3.md) のテストがそのまま通る)。
- **作成の本文**: `title`・`content`(空白だけは 422)・`background_source`(`meeting`/`email`/`document`/`other`)・`background_date`(日の単位。任意)・`background_memo`・`target_requirement_ids`(100件まで)・`adds_requirement`・`baseline_number`(省けば最新の束)。
- **更新の本文**: 送った項目だけ変える(`exclude_unset`)。`background_date` は null で消せ、ほかの項目の null は「変えない」。基準の束は変えられない(対象の確かめの前提が変わるため)。
- **応答**: 一覧は `ChangeRequestSummaryRead`(状態・出どころのラベル、`CR-1`・`B-1` のラベル付き)、詳細は `ChangeRequestRead`(中身・`decision`・`events`・`overlapping`・`derived_from_number`・`derived_numbers`・`allowed_actions`)。詳細は ORM の行だけでは作れない(重なりや写しの先は別に読む)ので、`build` のクラスメソッドで組み立てる。

## 3. サービス

```python
# app/services/change_request_service.py(抜粋)
class ChangeRequestService:
    async def create(self, project, payload, *, created_by) -> ChangeRequestView
        # 詳細設計モード → 基準の束(番号 / 最新。無ければ 409・番号違いは 404)→ checked_targets
    async def list_for_project(self, project) -> list[ChangeRequest]
    async def get(self, project, number) -> ChangeRequestView
    async def update(self, project, number, payload, *, actor_id) -> ChangeRequestView
    async def explain(self, project, number, *, actor_id) -> ChangeRequestView
    async def decide(self, project, number, payload, *, actor_id) -> ChangeRequestView
    async def withdraw(self, project, number, payload, *, actor_id) -> ChangeRequestView
    async def copy_rejected(self, project, number, *, created_by) -> ChangeRequestView

def baseline_requirement_ids(baseline) -> list[str]   # 束の要件定義書の写しの rows の ID
def checked_targets(requirement_ids, adds_requirement, baseline) -> list[str]
```

- **対象は基準の束で確かめる**: 「B-1 からの変更」なので、今の要件定義書ではなく、束の写し(`key="requirements"` の model の `rows`)にある ID だけを受け付ける。無い ID は 422 `CR_TARGET_UNKNOWN` に並べて返す。対象が空で新規の印も無いときも同じ 422(何を変える CR か分からないため)。
- **対象を直すときは写し付きで読み直す**(`_baseline_with_items`): CR と一緒に読む束は写しを持たない([82-1](./Phase-82-1.md))。
- **写し**(`copy_rejected`): 中身・背景・対象・基準の束を写し、`derived_from_id` で元を指す。新しい CR の最初の時系列は `copy`(「CR-1(却下)から写した」)、元の CR には `copied`(「CR-2 に写した」。状態は却下のまま)を足す。合意の記録は写さない。
- **`ChangeRequestView`**: 詳細に要るもの(重なり・写しの元の番号・写しの先・できる操作)をサービスがまとめて返す。ルートはスキーマに詰めるだけになる。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_states.py`(新規) | `next_status`・`allowed_actions`・`overlaps`・`normalize_targets` と状態・ラベルの表 | pytest のテスト関数(パラメータ化) | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |
| `test_change_request_service.py`(新規) | `ChangeRequestService` の8つのメソッド・`baseline_requirement_ids`・`checked_targets`・CR のスキーマ・`AgreementNotes` | pytest のテスト関数 | スタブ不要 ── LLM を呼ばず、永続化と遷移の判定が検証対象のため、インメモリの SQLite と既存の fixture(`create_impact_project`)から作った束を使う |

- 遷移: 許す9組・許さない8組(説明の前の合意・合意の後の取り下げと直し・却下の後の説明と直し・写しは表に無い)/ できる操作は状態ごと(却下は `copy` だけ)/ 表のキーがすべて状態の中。
- 作成: 項目・ラベル・最初の時系列 / 束が無い 409・番号の束が無い 404・無い要件 422(ID が文に出る)・対象が空 422・新規の印だけなら作れる・簡易モード 409 / 基準の束は省けば最新。
- 遷移: 説明 → 合意で記録(相手・理由・記録した人・日時)と時系列 / 合意の後の取り下げ・直しは 409 / 下書きからの判断は 409・無い番号は 404 / 説明済みで直すと下書きに戻り時系列に `edit` / 下書きの直しは時系列に残らない / 直した対象も確かめる / 取り下げの理由が残る。
- 写し: 却下の前は 409 / 新しい番号の下書きに中身が写り、判断は写らない / 元は却下と理由のまま、写しの先と `copied` を持つ。
- 重なり: 同じ要件の進行中の CR だけが出る・取り下げると消える・終わった CR は重なりを見ない。
- 本文: 出どころ・空白の内容・判断の値・タイムゾーンの無い日時は 422 相当(`ValidationError`)/ 相手の空白は null / `BaselineCreate` と `ChangeRequestDecision` は `AgreementNotes` を継ぐ。

# Phase-82-1: CR と時系列のテーブルとリポジトリ

## この章の目的

変更要求(CR)を持つ2つの表を作る。CR(`change_requests`)はタイトル・内容・背景・対象・基準の束・状態・合意の記録を、時系列(`change_request_events`)は作成・状態の遷移・写しを1行ずつ持つ([内部設計書](../../docs/internal_design.md) 3.2節⑯⑰)。どの遷移を許すかは [82-2](./Phase-82-2.md) の表とサービスが決め、この章は永続化だけを作る。

自動実装モード: on([introduction](./Phase-82-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/models/change_request.py`](../samples/backend/app/models/change_request.py) | 新規 | `ChangeRequest`(CR)・`ChangeRequestEvent`(時系列の1行) |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | `Project.change_requests`(番号の順) |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | `ChangeRequest`・`ChangeRequestEvent` を alembic に見せる |
| [`alembic/versions/e1cfb47f1d13_add_change_requests.py`](../samples/backend/alembic/versions/e1cfb47f1d13_add_change_requests.py) | 新規 | 2つの表(一意制約・外部キーの CASCADE / SET NULL・自己参照)。往復できる |
| [`app/repositories/change_request.py`](../samples/backend/app/repositories/change_request.py) | 新規 | `ChangeRequestRepository`(次の番号・作成・時系列の追記・一覧・番号で取得・状態で絞る・写しの先) |
| [`tests/unit/test_change_request_repository.py`](../samples/backend/tests/unit/test_change_request_repository.py) | 新規 | 番号がプロジェクトごと・項目と最初の時系列・時系列の並びと状態・絞り込み・番号の重複は DB が止める |

## 1. 2つの表

```python
# app/models/change_request.py(抜粋)
class ChangeRequest(Base):
    __tablename__ = "change_requests"
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_change_requests_project_number"),)
    project_id                       # FK projects.id, ondelete CASCADE
    number: int                      # プロジェクトの中の連番(CR-1…)
    title: str; content: str
    background_source: str           # meeting / email / document / other
    background_date: date | None     # 日の単位
    background_memo: str
    target_requirement_ids: list[str]  # JSON
    adds_requirement: bool           # 新しい要件を足す CR か
    baseline_id                      # FK baselines.id, ondelete CASCADE(基準の束)
    status: str
    derived_from_id                  # FK change_requests.id, ondelete SET NULL(写しの元)
    decision_counterpart / decided_at / decision_memo / decision_reason / decision_recorded_by
    created_by / created_at / updated_at
    events: list["ChangeRequestEvent"]  # cascade, order_by position

class ChangeRequestEvent(Base):
    __tablename__ = "change_request_events"
    position: int; action: str       # create / copy / copied / edit / explain / agree / reject / withdraw …
    from_status: str | None; to_status: str
    occurred_at: datetime; actor_id; note: str
```

- **時系列を別の表にした**: 遷移ごとの日時を CR の列(`explained_at` など)に持つと、説明済み → 下書き → 説明済み のように同じ状態を2回通ったとき、前の日時が消える。行にすれば、通った順にすべて残る(完了の判断基準の「後からたどれる」)。Phase 85・86 で「どの版に反映したか」「どのレビューか」を足すときも、行に参照の列を足せばよい。
- **合意の記録は CR の列にした**: 判断は CR に1回だけ(却下の後は写して別の CR にする。[82-2](./Phase-82-2.md))なので、束(⑭)と同じ項目を `decision_` の列で持つ。判断の前は NULL。
- **対象は JSON の一覧 + 新規の印**(ユーザー決定): ID の無い新しい要件は ID に入れられないので、`adds_requirement` で持つ。仮の ID を振る案は、反映の後に本当の ID と結び直す処理が要るので取らなかった。
- **基準の束は CASCADE**: 束は消えない(プロジェクトの削除でだけ消える)ので、効くのはプロジェクトの削除のときだけ。
- **写しの元は SET NULL の自己参照**: 元の CR が消えるのはプロジェクトごとなので今は効かないが、行どうしの削除の順を問わずに消せる。
- **一意制約**: 番号は束と同じく、すり抜けた並行は DB で止める。時系列も `(change_request_id, position)` を一意にした。

## 2. リポジトリ

```python
# app/repositories/change_request.py(抜粋)
class ChangeRequestRepository(CRUDRepository[ChangeRequest]):
    def _default_options(self):
        return (selectinload(ChangeRequest.events), selectinload(ChangeRequest.baseline))
    async def next_number(self, project_id) -> int
    async def create(self, *, project_id, number, baseline_id, title, content, background_source,
                     status, action, ..., created_by=None, note="") -> ChangeRequest
        # 時系列の最初の行(from_status=None → status)も一緒に作る
    async def add_event(self, change_request, *, action, to_status, actor_id=None, note="")
        # 時系列に1行足し、CR の status と updated_at をそろえる
    async def list_for_project(self, project_id) -> list[ChangeRequest]          # 新しい順
    async def get_by_number(self, *, project_id, number) -> ChangeRequest | None
    async def list_by_statuses(self, project_id, statuses) -> list[ChangeRequest]  # 重なりの候補
    async def find_derived(self, change_request_id) -> list[ChangeRequest]         # 写しの先
```

- **時系列と状態を1つのメソッドでそろえる**(`add_event`): 状態だけ変えて時系列を足し忘れる、を作らない。遷移してよいかは見ない(サービスが表で確かめてから呼ぶ)。
- **基準の束は一緒に読むが、写しは読まない**: 一覧と詳細に `B-1` を出すために束の行は要るが、写しの中身(md・model)は大きい。対象を確かめ直すときだけ、サービスが写し付きで読み直す([82-2](./Phase-82-2.md))。
- **日時はアプリで入れる**: 束の `create` と同じ(作った CR をそのまま応答にするため)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_repository.py`(新規) | `ChangeRequestRepository`(7つのメソッド)と `ChangeRequest`・`ChangeRequestEvent` の定義 | pytest のテスト関数 | スタブ不要 ── 永続化そのものが検証対象のため、インメモリの SQLite を使う |

- 番号はプロジェクトごとに 1 から / 項目(背景の日付・メモ・対象・新規の印)と基準の束が読み直しても同じ・判断の前は `decided_at` が `None` / 最初の時系列は `create`(`None` → `draft`)と作った人 / `add_event` で状態が進み、時系列が前の状態つきで順に並ぶ・補足が残る / 一覧は新しい順・状態で絞る・写しの先 / 同じ番号の2つ目は `IntegrityError`。
- プロジェクトの削除で CR と時系列が消えること(外部キーの CASCADE)は、[82-3](./Phase-82-3.md) の統合テスト(PostgreSQL)で確かめた。
- マイグレーションは dev の DB で往復を流し、`alembic check` でモデルとの差が無いことを確かめた。

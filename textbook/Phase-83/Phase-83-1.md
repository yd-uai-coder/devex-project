# Phase-83-1: CR の対象に変更の種類を持たせる

## この章の目的

CR の対象を「要件 ID の一覧」から「要件 ID と変更の種類(内容の変更 / 削除)の組の一覧」に変える。着手時の相談で、ユーザーが推奨(種類の欄を持たない)と違う「対象ごとに種類を持つ」を選んだため、[Phase 82](../Phase-82/Phase-82-introduction.md) の CR の列・スキーマ・リポジトリ・サービス・テストを直す。仕様の変更なので、#40 に従い先に [`q_a.md`](../q_a.md) に CR の形(「Phase 83 開始時」の CR)で残してから docs に反映した。

自動実装モード: on([introduction](./Phase-83-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/targets.py`](../samples/backend/app/change_requests/targets.py) | 新規 | `TargetKind`・`TARGET_KINDS`・`TARGET_KIND_LABEL`・`Target`・`normalize_targets`(states.py から移した)・`target_ids`・`targets_to_json`・`targets_from_json` |
| [`app/change_requests/states.py`](../samples/backend/app/change_requests/states.py) | 更新 | 文字列版の `normalize_targets` を削除(targets.py へ移した) |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | `targets` の re-export(`normalize_targets` の import 元も targets へ) |
| [`app/models/change_request.py`](../samples/backend/app/models/change_request.py) | 更新 | 列 `target_requirement_ids` → `targets`(`[{requirement_id, kind}]`) |
| [`alembic/versions/9f3e279a0210_change_request_target_kinds.py`](../samples/backend/alembic/versions/9f3e279a0210_change_request_target_kinds.py) | 新規 | 列を足し、既存の行を「内容の変更」に写してから旧列を落とす(downgrade は ID だけ戻す) |
| [`app/repositories/change_request.py`](../samples/backend/app/repositories/change_request.py) | 更新 | `create(..., targets=...)` |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `ChangeRequestTargetIn`・`TargetsIn`・`ChangeRequestTargetRead`、作成・更新の `targets` と検証、一覧・詳細の `targets` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | 作成・更新・写し・重なりを `targets` で。`checked_targets` は `Target` の列を受ける |
| [`tests/unit/test_change_request_targets.py`](../samples/backend/tests/unit/test_change_request_targets.py) | 新規 | 整え(空白・重複・違う種類の重複)・ID の列・保存の形の往復 |
| [`tests/unit/test_change_request_states.py`](../samples/backend/tests/unit/test_change_request_states.py) | 更新 | `normalize_targets` のテストを targets のテストへ移した |
| [`tests/unit/test_change_request_repository.py`](../samples/backend/tests/unit/test_change_request_repository.py) | 更新 | `targets` の保存と読み出し |
| [`tests/unit/test_change_request_service.py`](../samples/backend/tests/unit/test_change_request_service.py) | 更新 | 本文の `targets`(ヘルパー `_t`)・種類のラベル・更新で種類を変える・写しで種類が写る・違う種類の重複は検証の誤り |
| [`tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 更新 | 作成の本文を `targets` に |
| [`tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | 更新 | 本文・応答の `targets`(PostgreSQL の JSONB で種類が往復する) |

依存の向き: `targets.py`(純粋。標準ライブラリだけ)← `schemas/change_request.py`・`services/change_request_service.py`。`states.py` の `overlaps` は ID の列を受けるまま(種類は重なりに関係しない)。

```python
# app/change_requests/__init__.py(re-export の形。この章で足した分)
from app.change_requests.targets import (
    TARGET_KIND_LABEL, TARGET_KINDS, Target, TargetKind,
    normalize_targets, target_ids, targets_from_json, targets_to_json,
)
```

## 1. 種類の型と整え方

```python
# app/change_requests/targets.py(抜粋)
TargetKind = Literal["content", "delete"]
TARGET_KIND_LABEL = {"content": "内容の変更", "delete": "削除"}

@dataclass(frozen=True)
class Target:
    requirement_id: str
    kind: TargetKind = "content"

def normalize_targets(targets: Iterable[Target]) -> list[Target]   # 違う種類の重複は ValueError
def target_ids(targets) -> list[str]
def targets_to_json(targets) -> list[dict[str, str]]
def targets_from_json(value) -> list[Target]                       # 知らない種類は content
```

- **種類は2つ**(Claude の判断): 内容の変更と削除。改名は入れなかった(要件の ID を変える CR は想定しにくく、今のたどり方では改名は1段で止まり、範囲が狭すぎるおそれがあるため)。
- **たどり方は種類で変えない**: 予測([83-2](./Phase-83-2.md))は、削除も内容の変更として求める。今の本体の `to_trace_changes`(`app/detailed_design/impact/diff.py`)が、反映の後の差分でも「消えた要素」を内容の変更として渡すので、予測と Phase 85 の実際の印が同じ規則になる。種類は、対象の表示・説明書(Phase 84)・予測の保存に載る。
- **重複**: 同じ組は1つにまとめる(Phase 82 の「空白・重複を除く」を保つ)。同じ要件を違う種類で指定したときは、どちらの変更か決められないので ValueError。スキーマの `field_validator` がこれを呼ぶので、API では 422(検証の誤り)になる。
- **states.py から移した理由**: 対象の扱いは状態の遷移と別の関心で、型(`Target`)と保存の形が増えたため。`overlaps` は ID の列を受けるまま states.py に残した。

## 2. 列とマイグレーション

```python
# app/models/change_request.py(抜粋)
targets: Mapped[list[dict]] = mapped_column(PortableJSON, nullable=False, default=list)
```

- **列の名前を変えた**: 中身が ID の一覧でなくなるので、`target_requirement_ids` のまま形だけ変えると読み違える。
- **マイグレーション** `9f3e279a0210`: `targets` を NULL 可で足す → 既存の行を `{"requirement_id": id, "kind": "content"}` に写す → NOT NULL にして旧列を落とす。downgrade は ID だけ戻す(種類は消える)。行の写しは Python で1行ずつ(JSONB の関数に頼らず、SQLite と同じ書き方で読めるように)。本番には Phase 82 の表もまだ無い(ステージ11 の分は Phase 89 で反映)。

## 3. スキーマとサービス

```python
# app/schemas/change_request.py(抜粋)
class ChangeRequestTargetIn(BaseModel):
    requirement_id: str
    kind: TargetKind = "content"

TargetsIn = Annotated[list[ChangeRequestTargetIn], Field(max_length=TARGETS_MAX)]

class ChangeRequestCreate(BaseModel):
    targets: TargetsIn = Field(default_factory=list)
    @field_validator("targets")   # normalize_targets で整え、違う種類の重複は 422
    ...

class ChangeRequestTargetRead(BaseModel):   # 一覧・詳細の targets
    requirement_id: str; kind: TargetKind; kind_label: str

# app/services/change_request_service.py(抜粋)
def checked_targets(targets: Sequence[Target], adds_requirement, baseline) -> list[Target]
```

- **整えるのはスキーマ、確かめるのはサービス**: 空白・重複・違う種類はスキーマ(本文だけで決まる)、束の要件定義書にあるかはサービス(束を読む)。Phase 82 ではサービスが整えていたが、種類の衝突は本文の誤りなので、検証の誤りとして返す形にそろえた。
- **重なり**: `target_ids(targets_from_json(...))` で ID だけにして `overlaps` に渡す。削除の CR と内容の変更の CR が同じ要件を対象にしても、重なりとして示す。
- **更新**: `targets` を送ったときはそれを、`adds_requirement` だけを送ったときは今の対象を読み直して、束で確かめ直す(Phase 82 と同じ)。
- **API の形の変更**: 本文と応答の `target_requirement_ids` が `targets` になった。画面はまだ無い(Phase 87)ので、利用側の直しは無い。

## テスト観点

用語(SUT = テストの対象、ドライバ = 対象を呼ぶもの、スタブ = 対象の依存の代わり)は、以前の Phase と同じ。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_targets.py`(新規) | `normalize_targets`・`target_ids`・`targets_to_json`・`targets_from_json`・種類の表 | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |
| `test_change_request_states.py`(更新) | `next_status`・`allowed_actions`・`overlaps` と表 | pytest のテスト関数 | スタブ不要 ── 同上 |
| `test_change_request_repository.py`(更新) | `ChangeRequestRepository.create`(`targets` の保存)・`get_by_number` | pytest のテスト関数 | スタブ不要 ── 永続化が検証対象のため、インメモリの SQLite を使う |
| `test_change_request_service.py`(更新) | `ChangeRequestService` の作成・更新・写し・重なりと、`ChangeRequestCreate`・`ChangeRequestUpdate` の検証 | pytest のテスト関数 | スタブ不要 ── インメモリの SQLite と既存の fixture(`create_impact_project`)から作った束を使う |
| `test_change_requests_api.py`(更新) | ルート(作成の本文) | pytest のテスト関数(ルートを直接呼ぶ) | スタブ不要 ── 同上 |
| `test_change_requests_flow.py`(integration・更新) | ルート → サービス → リポジトリ(JSONB の `targets`) | httpx の AsyncClient | スタブ不要 ── 実際の PostgreSQL |

- 整え: 空白を除く・空を捨てる・同じ組は1つ・違う種類の重複は ValueError(ID が文に出る)。
- 保存の形: `to_json` → `from_json` で元に戻る・None は空・知らない種類は内容の変更。
- スキーマ: 違う種類の重複・知らない種類は `ValidationError` / 更新で `targets` を送らなければ None。
- サービス: 作成の応答の種類とラベル / 更新で種類を変えると保存の形に残る / 写しに種類が写る / 重なりは種類によらず ID で出る。
- integration: 更新の応答に「内容の変更」「削除」のラベルが出る / 重なりの要件 ID。

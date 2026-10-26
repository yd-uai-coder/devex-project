# Phase-112-3: 重なる CR の競合のガード(API)

## この章の目的

同じ要件を対象にする CR は作れ、重なりは詳細に示すだけだった([Phase 82](../Phase-82/Phase-82-introduction.md) の決定)。CR の案は基準の束の文をもとに書くので、CR-A を反映した後に同じ要件の CR-B を反映すると、CR-B の案で CR-A の変更が上書きされうる([111-3](../Phase-111/Phase-111-3.md) の指摘 #3)。この章で、対象の要件が基準の束の後にほかの CR の反映で変わったか(競合)を合意の記録から判定し、CR の詳細に載せ、「今の文と見比べて確かめた」の印が無ければ反映を 409 で断り、反映の指示に今の文を添える。作成・説明済み・合意は止めない。

自動実装モード: on([introduction](./Phase-112-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/conflicts.py`](../samples/backend/app/change_requests/conflicts.py) | 新規 | 競合の純粋関数(`RecordFact`・`Conflict`・`base_seq`・`changed_after`・`conflicts`・`is_checked`・`unchecked`・`checks_for`) |
| [`app/change_requests/instruction.py`](../samples/backend/app/change_requests/instruction.py) | 更新 | `build_cr_instruction(facts, conflicts)` が今の文の1行を添える |
| [`app/change_requests/states.py`](../samples/backend/app/change_requests/states.py) | 更新 | 記録だけの操作 `check_conflict` |
| [`app/change_requests/trace.py`](../samples/backend/app/change_requests/trace.py) | 更新 | `check_conflict` の表示名「競合を確かめた」 |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | `conflicts` の re-export |
| [`app/models/change_request.py`](../samples/backend/app/models/change_request.py) | 更新 | 列 `conflict_checks` |
| [`alembic/versions/c4e8a1f7b2d6_add_change_request_conflict_checks.py`](../samples/backend/alembic/versions/c4e8a1f7b2d6_add_change_request_conflict_checks.py) | 新規 | 列を足すマイグレーション |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `ChangeRequestConflictUncheckedError`(409 `CR_CONFLICT_UNCHECKED`) |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `ChangeRequestConflictRead`・CR の詳細の `conflicts` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `_conflicts`・`check_conflicts`・`require_conflicts_checked`・詳細の `conflicts`・指示 |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 反映の受け付けで `require_conflicts_checked` |
| [`app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 更新 | `POST .../conflict-checks`・詳細に `conflicts` |
| [`tests/unit/test_change_request_conflicts.py`](../samples/backend/tests/unit/test_change_request_conflicts.py) | 新規 | 純粋関数 |
| [`tests/unit/test_change_request_instruction.py`](../samples/backend/tests/unit/test_change_request_instruction.py) | 更新 | 今の文の1行 |
| [`tests/unit/test_change_request_conflict_guard.py`](../samples/backend/tests/unit/test_change_request_conflict_guard.py) | 新規 | 詳細・409・印の失効・指示 |
| [`tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 更新 | ルートの登録 |
| [`tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | 更新 | 2つの CR の流れ(409 → 確かめ → 202) |

## 1. 判定(純粋関数)

```python
# app/change_requests/conflicts.py(抜粋)
@dataclass(frozen=True)
class RecordFact:          # 合意の記録1行の材料(ORM を持ち込まない)
    seq: int; key: str; origin: str; baseline_id: Any
    change_request_number: int | None; content: Mapping[str, Any] | None

@dataclass(frozen=True)
class Conflict:
    key: str; requirement_id: str; by_numbers: tuple[int, ...]
    base_text: str; current_text: str | None; latest_seq: int

def base_seq(records, baseline_id) -> int | None
def changed_after(records, after_seq, *, exclude_number=None) -> dict[str, list[RecordFact]]
def conflicts(requirement_ids, records, baseline_id, own_number) -> list[Conflict]
def unchecked(found, checks) -> list[Conflict]          # checks = [{key, seq}]
def checks_for(found) -> list[dict[str, Any]]
```

- **材料は合意の記録だけ**: 記録(⑳ `agreement_records`)は追記だけで、束(`origin=baseline`)と CR の反映(`origin=change_request`)の行が順(`seq`)つきで残る。版は巡回で消えるが記録は消えない。基準の束の記録の最後の `seq` より後に、ほかの CR が対象の要件のキーを書き換えた行があれば競合。束の文はその束までの最後の記録、今の文は最後の記録(消えていれば None)。
- **自分の反映は競合でない**(`exclude_number`)。束の後に CR-A を入れた新しい束を基準にした CR は、CR-A と競合しない(基準の束の記録が CR-A の後に来るため)。
- **文を変えなかった反映は数えない**(画面確認の後の直し。[`q_a.md`](../q_a.md) の「Phase 112 開始時」の CR): 反映は書き換えてよい要素を、文が同じでも記録に1行足す。中身が前の記録と同じ行は変更として数えず(`_changing`)、印と照らす `latest_seq` も中身が最後に変わった記録にする。
- **確かめの印**(着手時の決定4): `[{key, seq}]` を CR の列に持ち、`seq` が今の `latest_seq` と同じときだけ効く。確かめた後にほかの CR がさらに変えたら外れる。
- `changed_after` は、Phase 113 の束の鮮度(束の後に反映した CR)でも使う前提で分けた。

## 2. サービスと API

```python
# app/services/change_request_service.py(抜粋)
async def _conflicts(self, change_request) -> list[Conflict]           # 進行中の CR だけ
async def check_conflicts(self, project, number, *, actor_id) -> ChangeRequestView
async def require_conflicts_checked(self, project, number) -> None      # 未確認なら 409
```

- **詳細**: 進行中(下書き〜反映済み)の CR の詳細に `conflicts`(要件・先に変えた CR〈`by_numbers`・`by`〉・束の文・今の文・`checked`)を載せる。説明済み・合意(共有リンクの判断も)は止めず、画面が知らせる。
- **確かめ**: `POST .../conflict-checks` が今の競合をすべて確かめたことにし(`checks_for`)、時系列に記録だけの行 `check_conflict`(`refs.checks`)を足す。競合が無い・進行中でない CR は 409 `CR_INVALID_TRANSITION`。
- **反映の受け付け**: `DocGeneratorService.request_generation` が `reflectable` の後に `require_conflicts_checked` を呼ぶ(409 `CR_CONFLICT_UNCHECKED`。文は「FR-001(CR-1 が先に変えた)」の形)。受け付けの後のバックグラウンドの生成は確かめない(受け付けと生成の間に変わることは、生成中は 409 で止まる)。
- **反映の指示**: 競合のある対象の行の下に1行添える。

```
- FR-005(内容の変更): 変更後の案「参照ファイルは5つまで添付できる」
  - 今の文は CR-1・CR-2 の反映の後のもの「参照は4つまで」。CR-1・CR-2 の変更を消さず、この文を土台に書き直す
- FR-009(削除): この要件を消す
  - この要件は CR-2 の反映で消えている。消したままにするかは上の内容に従う
```

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_conflicts.py`(新規) | `conflicts`・`base_seq`・`changed_after`・`is_checked`・`unchecked`・`checks_for` | pytest のテスト関数 | スタブ不要 ── 純粋関数で、合意の記録は `RecordFact` で組むため |
| `test_change_request_instruction.py` に1本 | `build_cr_instruction` | pytest のテスト関数 | スタブ不要 ── 純粋関数 |
| `test_change_request_conflict_guard.py`(新規) | `ChangeRequestService`(詳細・`check_conflicts`・`require_conflicts_checked`・指示)・`DocGeneratorService.request_generation`・`ChangeRequestRead.conflicts` | pytest のテスト関数 | DB はインメモリ SQLite、生成の LLM は FakeLLM(CR-1 の反映で FR-001 の文を変える) |
| `test_change_requests_flow.py`(統合) | `POST .../conflict-checks`・`POST /generate` の409・詳細の `conflicts` | httpx の AsyncClient | 実 PostgreSQL・Redis。生成の LLM は FakeLLM |

- 統合スモーク: 既存の CR の流れのテスト(競合の無い CR は今までどおり反映できる)。
- 純粋関数: ほかの CR の束の後の変更は競合(束の文・今の文・`latest_seq`)・消えたら今の文は None・自分の反映と触っていない対象は競合でない・新しい束を基準にすれば競合でない・束の記録が無ければ競合なし・印は後の変更で外れる・文を変えなかった反映は競合でなく、同じ文のやり直しで印は外れない。
- サービス: 先に反映した CR には競合が無い・未確認は 409・確かめると印と時系列の行・先の CR のやり直しで印が外れて再び 409・指示に今の文・競合の無い CR の確かめは断る。

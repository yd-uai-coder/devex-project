# Phase-20-1: 段階5の意味モデル・手順番号・呼び出し先の正規化・検証(BE)

## この章の目的

段階5(主要処理の手順)の正本の形を決め、AI の下書きを1処理ずつ取り込む純粋関数と、段階5の検証を作る。手順番号は保存せず並び順から導く。呼び出し先は段階4のモジュール一覧のパスにそろえ、そろわないものを検証のエラーにする。

- 段階5の `model` は、選んだ処理ごとの手順の表だけを持つ。06(段階6)との紐づけは持たない。
- 手順番号(`1, 1a, 2…`)と手順ID(`F-01#1a`)は導くもので、保存しない。
- 検証は、段階1の機能一覧と段階4のモジュール一覧を `StageSources.stages` から読む。`STAGE_VALIDATORS[5]` に登録する。

学習モード([introduction](./Phase-20-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/procedure.py`](../samples/backend/app/detailed_design/procedure.py) | 新規 | **コア** | `ProcedureStep`・`Procedure`・`ProcedureModel`・`ProcedureDraft`、`PROCEDURE_STAGE`・`MAX_PROCEDURE_TARGETS`、`number_steps`・`step_id`・`is_external_actor`・`resolve_callee`・`merge_procedure`・`pending_function_ids`(純粋) |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | **コア** | `validate_procedures` を `STAGE_VALIDATORS[5]` に登録 |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | 定型 | 上の公開名の re-export |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `procedure_model(callee?, reason?)`(F-01 の手順1つと分岐1つ) |
| [`tests/unit/test_procedure.py`](../samples/backend/tests/unit/test_procedure.py) | 新規 | **コア** | 手順番号、呼び出し先の正規化、1処理の置き換え、検証のエラーと警告 |
| [`tests/unit/test_function_list.py`](../samples/backend/tests/unit/test_function_list.py) | 更新 | 定型 | 「登録の無い段階」の例を段階6にした |

## 要点の抜粋

```python
# app/detailed_design/procedure.py
PROCEDURE_STAGE = 5
MAX_PROCEDURE_TARGETS = 5                     # 1回の生成で下書きを作る処理の数の上限(20-3 で使う)

class ProcedureStep(BaseModel):               # 手順の表の1行
    caller: str = ""                          # 呼び出し元(パスか外部の役者)
    callee: str = ""                          # 呼び出し先。モジュール一覧のパス(関与表の列の鍵)か外部の役者
    call: str = ""                            # 呼ぶ関数。段階6は (callee, call) で手順を引く
    data: str = ""; action: str = ""; result: str = ""; db: str = ""; branch: str = ""
    is_branch: bool = False                   # 分岐の行(action に条件、branch に結果)

class Procedure(BaseModel):
    function_id: str                          # 段階1の処理ID
    reason: str = ""                          # 選定理由
    note: str = ""                            # トランザクションの範囲などの注記
    steps: list[ProcedureStep] = Field(default_factory=list)   # 空 = まだ下書きを作っていない

class ProcedureModel(BaseModel):
    procedures: list[Procedure] = Field(default_factory=list)  # 選んだ処理

def number_steps(steps) -> list[str]: ...     # ["1", "1a", "1b", "2"]。先頭の分岐は "0a"
def step_id(function_id, number) -> str: ...  # "F-01#1a"
def is_external_actor(callee) -> bool: ...    # 「/」を含まない名前
def resolve_callee(callee, module_paths) -> str: ...
    # 完全一致 → そのまま。module_ref_matches で1行だけに当たる → その行のパス。それ以外はそのまま
def merge_procedure(model, function_id, draft, module_paths) -> ProcedureModel: ...
    # その処理の手順だけを置き換える。人の選定理由は残し、空なら下書きの値。注記は置き換え
def pending_function_ids(model) -> list[str]: ...   # 手順の無い処理(20-3 の既定の生成対象)
```

```python
# app/detailed_design/validation.py
STAGE_VALIDATORS = {1: ..., 2: ..., 3: ..., 4: ..., 5: validate_procedures}
```

`__init__.py` は `procedure` の公開名を足して re-export する。依存の向きは `validation → procedure → structure(module_ref_matches)` で、どれも DB と LLM を知らない。

## 設計判断

### 手順番号は保存しない

| 案 | 行を足す・消す・分岐を挟むとき | 判断 |
|---|---|---|
| `no` を保存する(デモの `Step.no`) | 後ろの行の番号を人か AI が振り直す。振り直し忘れで重複・欠番が起きる | 採らない |
| 並び順と `is_branch` から導く(`number_steps`) | 何もしなくても番号がそろう | **採用** |

導く規則は1つだけである。分岐でない行は 1 から順に数え、分岐の行は直前の手順の番号に `a, b, …, z, aa` を付ける。分岐の行を「元の手順の直後に置く」という Phase 14 の約束を、データの並びそのものにした。先頭の分岐の行(元の手順が無い)は `0a` と番号を付け、検証のエラー(`LEADING_BRANCH`)で人に直させる。

番号が編集で変わっても困らないのは、06(段階6)との紐づけを番号で持たないからである(着手時の決定3)。06 の項目は (モジュール, 関数) を持ち、手順の (`callee`, `call`) と突き合わせる。手順を1行挟んで番号がずれても、紐づけは切れない。

### 呼び出し先はモジュール一覧のパスにそろえる

関与表(処理 × モジュール)の列は、段階4のモジュール一覧のパスである(Phase 19 の申し送り)。呼び出し先がパスと1字でも違うと、その手順は表から漏れる。そこで2段にした。

1. **取り込みでそろえる**(`resolve_callee`): AI が `services/reservation` のように短く書いても、`module_ref_matches`(Phase 19 の区切り単位の部分一致)で1行だけに当たれば、その行のパスに置き換える。`app/repositories/equipment.py` は `app/repositories/{reservation,equipment}.py` の行に当たる。
2. **そろわないものは検証のエラー**(`UNKNOWN_CALLEE`): 複数の行に当たる書き方(`app/x` のようなディレクトリ)や、どの行にも当たらないパスは、決めずに残して人に直させる。

検証は「パスと完全一致」で判定する。部分一致で通すと、関与表の列(完全一致で引く)と食い違うためである。外部の役者(利用者・スケジューラ)は「/」を含まない名前なので、関与表にも検証にも入れない。

### 1つの処理だけを置き換える

`merge_procedure` は、対象の処理の手順だけを下書きで置き換え、他の処理には触れない(着手時の決定4)。

- 選定理由は人が選んだ理由なので、人が書いていればそれを残す。空のときだけ AI の値を使う。
- 注記(トランザクションの範囲など)は手順と対になるので、手順と一緒に置き換える。
- 下書きは整えてから入れる。前後の空白を除き、全部の欄が空の行と、先頭の分岐の行は捨てる。分岐の行の呼び出し元・呼び出し先・関数は空にする(関与表に入れないため)。

### エラーと警告

| 区分 | 内容 | 理由 |
|---|---|---|
| エラー | 形が不正、処理が0件、処理IDが機能一覧に無い・重複、手順が0件、先頭の行が分岐、呼び出し先が空、パスの形の呼び出し先がモジュール一覧のパスと完全一致しない | 05 章を組み立てられない、または関与表・手順IDが決まらない |
| 警告 | 選定理由が空、モジュールを呼ぶ手順の関数が空 | 文書としては成り立つ。関数が空だと、段階6でその手順の関数を選べないだけ |

指摘の `target` は、処理の指摘なら処理ID、手順の指摘なら手順ID(`F-01#1`)にした。画面と文書で同じ ID で指せる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `number_steps`・`step_id`・`is_external_actor`・`resolve_callee` | pytest | スタブ不要。純粋関数(副作用なし)で、外部依存を呼ばないため | 分岐の添え字(`z` の次は `aa`)、先頭の分岐、完全一致・短い書き方・`{a,b}`・外部の役者・当たらないパス・複数に当たる書き方 |
| `merge_procedure`・`pending_function_ids` | pytest | スタブ不要。同上 | 対象の処理だけの置き換え、選定理由の残し方、先頭の分岐・空の行の除外、分岐の行の呼び出しの欄を空にする |
| `validate_procedures`・`STAGE_VALIDATORS` | pytest | スタブ不要。同上。段階1・4の内容は `StageSources` に dict で渡す | 第一テストの統合スモーク(`validate_stage(5, procedure_model(), …)` がエラーなしで通る)。各エラー・警告と `target` の手順ID、外部の役者は通ること |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_procedure.py tests/unit/test_function_list.py
# 36 passed
```

# Phase-21-1: 段階6の意味モデル・05↔06 の紐づけ・検証(BE)

## この章の目的

段階6(処理ロジックの詳細)の正本の形を決め、05(段階5の手順)との紐づけを導く純粋関数と、段階6の検証を作る。段階6は任意の段階で、人が選んだ関数ごとにシグネチャ〜事後条件と擬似フローを持つ。

- 段階6の `model` は、選んだ関数ごとの詳細だけを持つ。05 との紐づけも L-ID も保存しない。
- 関数の候補と「呼ばれる手順」は、承認済みの段階5の手順の (`callee`, `call`) から導く。
- 0件の段階6は検証のエラーにしない。0件で承認することが「段階6を飛ばす」操作になる(着手時の決定1)。

自動実装モード: on([introduction](./Phase-21-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/logic.py`](../samples/backend/app/detailed_design/logic.py) | 新規 | **コア** | `PseudoStep`・`LogicRow`・`LogicModel`・`LogicDraft`・`LogicCandidate`、`LOGIC_STAGE`・`MAX_LOGIC_TARGETS`、`logic_id`・`logic_key`・`is_drafted`・`logic_candidates`・`calling_steps`・`merge_logic`・`pending_logic_keys`・`generation_targets`(純粋) |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | **コア** | `validate_logics` を `STAGE_VALIDATORS[6]` に登録 |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | 定型 | 上の公開名の re-export(`generation_targets` は段階5と名前が重なるので出さない) |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `logic_model(module?, function?, pre?)`(`procedure_model()` の手順 F-01#1 が呼ぶ関数1つの詳細) |
| [`tests/unit/test_logic.py`](../samples/backend/tests/unit/test_logic.py) | 新規 | **コア** | L-ID・鍵、候補と呼ばれる手順、1関数の置き換え、未生成の判定と生成の対象、検証のエラーと警告(0件は通る) |
| [`tests/unit/test_function_list.py`](../samples/backend/tests/unit/test_function_list.py) | 更新 | 定型 | 「登録の無い段階」の例を段階7にした |

## 要点の抜粋

```python
# app/detailed_design/logic.py
LOGIC_STAGE = 6
MAX_LOGIC_TARGETS = 5                         # 1回の生成で下書きを作る関数の数の上限(21-3 で使う)

class PseudoStep(BaseModel):                  # 擬似フローの1段
    text: str = ""
    sub: list[str] = Field(default_factory=list)   # 条件の分かれ目・細かい手順の箇条

class LogicRow(BaseModel):                    # 06 の1項目(関数1つ)
    module: str                               # 段階4のモジュール一覧のパス(= 手順の callee)
    function: str                             # 手順の call
    signature: str = ""; args: str = ""; returns: str = ""; raises: str = ""
    pre: str = ""; post: str = ""             # 事前条件・事後条件
    pseudo: list[PseudoStep] = Field(default_factory=list)

class LogicModel(BaseModel):
    logics: list[LogicRow] = Field(default_factory=list)       # 選んだ関数。0件 = 段階6を飛ばした

def logic_id(index) -> str: ...               # 0 → "L-01"。並び順から導く
def logic_key(module, function) -> str: ...   # "app/services/x.py::Service.create"(受け渡し・重複判定の鍵)
def is_drafted(row) -> bool: ...              # シグネチャか擬似フローがあれば「下書きあり」
def logic_candidates(procedures) -> list[LogicCandidate]: ...
    # 段階5の手順のうち、分岐でなく、callee がパス(「/」を含む)で call が空でない行を
    # (callee, call) ごとにまとめ、呼ぶ手順の手順ID(F-01#4)を集める
def calling_steps(procedures, module, function) -> list[str]: ...   # 06 の「呼ばれる手順」
def merge_logic(model, key, draft) -> LogicModel: ...   # 鍵の一致する1項目の詳細だけを置き換える
def pending_logic_keys(model) -> list[str]: ...         # 下書きの無い関数(21-3 の既定の生成対象)
def generation_targets(model, requested) -> list[str]: ...
```

```python
# app/detailed_design/validation.py
STAGE_VALIDATORS = {1: ..., 2: ..., 3: ..., 4: ..., 5: ..., 6: validate_logics}
```

`logic.py` は `procedure.py`(Phase 20 の `ProcedureModel`・`number_steps`・`step_id`・`is_external_actor`)だけに依存し、DB と LLM を知らない。依存の向きは `validation → logic → procedure`。

## 設計判断

### 05↔06 の紐づけは保存せず、(モジュール, 関数) の一致から導く

Phase 20 の着手時の決定3をそのまま実装した。段階6の項目は (`module`, `function`) を持ち、段階5の手順は (`callee`, `call`) を持つ。両者が一致すれば「その手順はその関数を呼ぶ」とみなす。

| 導くもの | 使う関数 | 使う場所 |
|---|---|---|
| 段階6で選べる関数(候補) | `logic_candidates` | 段階6の画面の選択(21-7) |
| 06 の「呼ばれる手順」・逆引き | `calling_steps`・`logic_candidates` | 段階6の画面(21-6・21-7)、生成の入力(21-2) |
| 05 の「詳細 L-02」バッジ | (FE の `logicIdsByKey`) | 段階5の手順の表(21-8) |

保存する紐づけが無いので、段階6で関数を選んでも承認済みの段階5は書き換わらない。段階5が差し戻されて段階6が「古い」になる循環が起きない。

### L-ID も保存しない

段階5の手順番号(`number_steps`)と同じ考え方で、L-ID は並び順から `logic_id` で導く。紐づけは (モジュール, 関数) なので、関数を足したり外したりして L-ID が振り直されても、05 との紐づけは切れない。L-ID は「文書と画面で項目を指す呼び名」で、鍵ではない。

### 候補の条件

`logic_candidates` が候補にするのは、次の全部を満たす手順の行である。

| 条件 | 外すもの | 理由 |
|---|---|---|
| 分岐でない | 分岐の行(`is_branch`) | 分岐の行は呼び出しの欄を持たない(Phase 20) |
| `callee` がパス(「/」を含む) | 利用者・スケジューラなどの外部の役者 | 外部の役者の中身は設計の対象ではない |
| `call` が空でない | 関数の書かれていない呼び出し | 何の詳細を書くかが決まらない(段階5の警告 `EMPTY_CALL` と対) |

同じ (callee, call) を呼ぶ手順は1つの候補にまとめる(`F-01#2`・`F-02#2` のように、呼ぶ手順を並べて持つ)。06 の見本(デモの `L-02`)で、1つの関数が複数の処理から呼ばれることを一目で見せる形に合わせた。

### エラーと警告

| 区分 | 内容 | 理由 |
|---|---|---|
| エラー | 形が不正、モジュール・関数が空、(モジュール, 関数) の重複、段階5のどの手順からも呼ばれない(`UNCALLED_LOGIC`)、下書きが無い(シグネチャと擬似フローが空) | 06 を組み立てられない、または「呼ばれる手順」が空の項目ができる |
| 警告 | 事前条件・事後条件が空 | 文書としては成り立つ |
| (指摘なし) | 0件 | 段階6を飛ばす操作(着手時の決定1) |

`UNCALLED_LOGIC` は、段階5を直して呼ばれなくなった関数を拾う。段階5を承認し直すと段階6は「古い」になるので、人がそこで直す。指摘の `target` は L-ID(`L-01`)にした。

### 置き換えは鍵の一致する1項目だけ

`merge_logic` は、生成の対象の関数(鍵が一致する行)の詳細だけを下書きで置き換え、他の関数の手直しには触れない(段階5の `merge_procedure` と同じ)。モジュールと関数の名前は人が選んだ鍵なので、下書きでは変えない。擬似フローは前後の空白を除き、空の箇条と、本文も箇条も空の段を捨てる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `logic_id`・`logic_key`・`is_drafted` | pytest | スタブ不要。純粋関数(副作用なし)で、外部依存を呼ばないため | 3桁の L-ID、鍵の空白の除去、シグネチャか擬似フローの片方で「下書きあり」 |
| `logic_candidates`・`calling_steps` | pytest | スタブ不要。同上 | 2つの処理から呼ばれる関数が1つにまとまる。分岐・外部の役者・空の関数は候補にならない |
| `merge_logic`・`pending_logic_keys`・`generation_targets` | pytest | スタブ不要。同上 | 対象だけの置き換えと擬似フローの整え方、無い鍵は何もしない、指定の重複・空の除去 |
| `validate_logics`・`STAGE_VALIDATORS` | pytest | スタブ不要。同上。段階5の内容は `StageSources` に dict で渡す | 第一テストの統合スモーク(`validate_stage(6, logic_model(), …)` がエラーなしで通る)。0件は指摘なし、各エラー・警告と `target` の L-ID |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_logic.py tests/unit/test_function_list.py
# 25 passed
```

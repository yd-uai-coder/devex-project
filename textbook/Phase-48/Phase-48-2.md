# Phase-48-2: 段階5 ── 分岐を手順の入れ子にして、参照を並びから振る

## この章の目的

段階5の手順の下書きで、分岐の欄の「1a へ」の行が見つからない(`MISSING_BRANCH_TARGET`)指摘を無くす。ステージ6の測定の記録を見ると、分岐の行は抜けておらず、AI が参照の番号を振り違えていた(「2a へ」「F-02a へ」)。手順番号はシステムが振るのに、参照だけを AI に書かせていたためである。AI には分岐を元の手順の中に条件と結果で書かせ、分岐の行と参照はシステムが作る。

自動実装モード: on([introduction](./Phase-48-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/backend/` 配下(表は依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/procedure.py`](../samples/backend/app/detailed_design/procedure.py) | 更新 | `link_branch_refs`(参照を並びから振る)。`merge_procedure` が呼ぶ |
| [`app/detailed_design/procedure_drafting.py`](../samples/backend/app/detailed_design/procedure_drafting.py) | 更新 | `GeneratedBranch`・`GeneratedStep.branches`、プロンプト、`to_procedure_draft` が平らにする |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 偽 LLM の手順の出力を入れ子の形に(平らにした結果は今までと同じ) |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | `link_branch_refs` の re-export |
| ── ここからテスト ── | | |
| [`tests/unit/test_procedure.py`](../samples/backend/tests/unit/test_procedure.py) | 更新 | 参照の付け直し・他の文字を残す・空の行を捨てた後の番号 |
| [`tests/unit/test_procedure_drafting.py`](../samples/backend/tests/unit/test_procedure_drafting.py) | 更新 | 入れ子 → 平らな行、取り込み後にシーケンス図の指摘が出ない |
| [`tests/unit/test_design_stage_generation.py`](../samples/backend/tests/unit/test_design_stage_generation.py) | 更新 | 段階5の生成のテストの出力を新しいスキーマに |

依存の向き: `procedure_drafting` → `procedure`、`fake` → `procedure_drafting`(どちらも既存のまま)。`procedure.py` は標準の `re` を足した。

## 要点の抜粋

### 1. 入れ子の分岐(procedure_drafting.py)

```python
# app/detailed_design/procedure_drafting.py
class GeneratedBranch(BaseModel):
    condition: str   # 分岐する条件(例: 予約が見つからない)
    result: str      # その結果(例: NotFoundError → 404)

class GeneratedStep(BaseModel):
    caller: str; callee: str; call: str; data: str; action: str; result: str; db: str
    kind: StepKind = "call"
    branches: list[GeneratedBranch] = []     # is_branch・branch は外した

def to_procedure_draft(output) -> ProcedureDraft:
    for step in output.steps:
        steps.append(ProcedureStep(**step.model_dump(exclude={"branches"})))
        steps.extend(
            ProcedureStep(action=b.condition, branch=b.result, is_branch=True) for b in step.branches
        )
```

- プロンプトは「分岐・例外は、それが起きる手順の branches に、条件と結果の組で書く。分岐を独立した手順として書かず、『1a へ』のような参照も書かない」。
- **保存の model(`ProcedureStep`)は変えない**。平らな行のまま保存するので、画面・06・シーケンス図・既存のデータはそのまま使える。変わるのは生成の境目(スキーマと変換)だけ。

### 2. 参照を並びから振る(procedure.py)

```python
# app/detailed_design/procedure.py
def link_branch_refs(steps: Sequence[ProcedureStep]) -> list[ProcedureStep]:
    """どの行からも書かれた参照(「…Na へ」)を消し、直後に分岐の行がある手順に、
    その番号の参照(「2a へ」、複数は「2a へ、2b へ」)を付ける。参照の他に書いてあることは前に残す。"""

def merge_procedure(model, function_id, draft, module_paths):
    steps = link_branch_refs(_normalize_steps(draft.steps, module_paths))
```

- **空の行を捨てた後に振る**。`_normalize_steps` が先頭の分岐の行や空の行を捨てると番号がずれるため。番号の数え方は `number_steps` と同じ。
- **AI の書いた参照は消す**。消す形は「2a へ」「F-02a へ」「1a・1b へ」。並べた参照の前の方は添え字の文字を求める(「ValidationError → 400、1a へ」の 400 を参照とみなさない)。
- **人の編集には当てない**。`merge_procedure` は AI の下書きの取り込みだけで呼ぶ。人が行を足し引きして参照がずれたときは、今までどおりシーケンス図の警告で知らせる。

### 3. 既存のデータでの確認(LLM を使わない)

ステージ6の測定の段階5(`appendix/stage6-baseline/detailed/stages/stage5.json`・`appendix/stage6-effect/detailed/stages/stage5.json`)の手順に `link_branch_refs` を当て、シーケンス図の `MISSING_BRANCH_TARGET` を数えた(一時スクリプト。リポジトリには置いていない)。

| 記録 | 前 | 後 |
| --- | --- | --- |
| ベースライン(14処理・分岐の行23) | 15 | 0 |
| 効果測定1回目(4処理・分岐の行6) | 4 | 0 |

参照19のうち17は直後に分岐の行があり、番号だけが違っていた。残る2件(と効果測定の1件)は、分岐の行が次の手順の後ろに置かれていた。入れ子にすると「どの手順の分岐か」を AI が直接示すので、この置き場所のずれも防げる見込みだが、実 LLM でしか確かめられない(Phase 49)。

## 設計判断

- **構造を変える + 付け直し**(着手時の相談。ユーザーは「下書きで補う」案と「構造を変える」案の比較を求めた)。構造を変える案も、空の行を捨てた後の番号で参照を振る処理が要るので、補う案を含む。そのうえで分岐の行の置き場所のずれと、先頭の分岐の行も防げる。保存の model と画面は変わらない。
- **心配**: 入れ子の形が深くなるので、AI が分岐を書かなくなるかもしれない。Phase 49 で分岐の行の数を前と比べる。
- **検証で止める案は採らない**。測定の記録では行は在り、人に直させる作業が増えるだけだった。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
| --- | --- | --- | --- |
| `link_branch_refs`・`merge_procedure` | pytest(`test_procedure.py`) | スタブ不要 ── 純粋関数(副作用なし)で、外部依存を呼ばないため | 振り違えた参照の付け直し、`F-02b へ` と分岐の行の参照を消す、直後に分岐の行の無い手順は空、複数は「、」で並べる、他の文字は前に残す、空の行を捨てた後の番号 |
| `to_procedure_draft`・`merge_procedure`・`to_sequence`・偽 LLM の出力 | pytest(`test_procedure_drafting.py`) | スタブ不要 ── LLM を呼ばず、構造化出力を直接作って渡す(偽 LLM は SUT 側の固定の出力) | 分岐の行が元の手順の直後に並ぶ、取り込み後の分岐の欄、シーケンス図に `MISSING_BRANCH_TARGET` が出ない、偽 LLM の出力が段階5の検証を通る |
| 段階5の生成サービス | pytest(`test_design_stage_generation.py`) | スタブ: 偽 LLM(構造化出力を返す) | テストの出力を新しいスキーマに直しただけ(期待は変えない) |

偽 LLM の契約テスト(`test_fake_llm_e2e.py`)は変えずに通る。偽 LLM の手順を平らにした結果は今までと同じ(分岐の欄だけ「—」が空になった)なので、E2E の流れは変わらない。

```sh
cd devex-api/backend && uv run pytest tests/unit/test_procedure.py tests/unit/test_procedure_drafting.py tests/unit/test_sequence.py tests/unit/test_design_stage_generation.py tests/unit/test_logic_drafting.py tests/unit/test_fake_llm_e2e.py -q
```

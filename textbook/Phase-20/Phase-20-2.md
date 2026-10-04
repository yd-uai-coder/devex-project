# Phase-20-2: 段階5の下書きのプロンプトと出力スキーマ(BE)

## この章の目的

1つの処理の手順を AI に書かせる入力(プロンプト)と、構造化出力のスキーマ、出力を 20-1 の `merge_procedure` に渡す形への変換を作る。E2E 用の固定の出力にも段階5の手順を足す。

学習モード([introduction](./Phase-20-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/procedure_drafting.py`](../samples/backend/app/detailed_design/procedure_drafting.py) | 新規 | **コア** | `GeneratedStep`・`ProcedureGenerationOutput`、`PROCEDURE_SYSTEM_PROMPT`、`build_procedure_messages`・`to_procedure_draft`(純粋) |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 定型 | E2E 用の固定の出力に `ProcedureGenerationOutput`(段階4の固定のモジュール一覧のパスにそろえた手順) |
| ── ここからテスト ── | | | |
| [`tests/unit/test_procedure_drafting.py`](../samples/backend/tests/unit/test_procedure_drafting.py) | 新規 | 定型 | プロンプトの規則、その処理の分だけを渡すこと、出力の変換、E2E の固定の出力が検証を通ること |

## 要点の抜粋

```python
# app/detailed_design/procedure_drafting.py
class GeneratedStep(BaseModel):          # 20-1 の ProcedureStep と同じ欄。description で書き方を指示する
    caller: str; callee: str; call: str; data: str; action: str
    result: str; db: str; branch: str; is_branch: bool

class ProcedureGenerationOutput(BaseModel):
    reason: str                          # 選定理由(人が書いていればそちらを残す。20-1)
    note: str                            # トランザクションの範囲など
    steps: list[GeneratedStep]

PROCEDURE_SYSTEM_PROMPT = (... + NAMING_RULES)   # 段階1〜4と同じ表記の規則(Phase 19 の申し送り)

def build_procedure_messages(function, summary, accesses, cells, tables, modules) -> list[BaseMessage]: ...
    # 【対象の処理】【処理概要表】【DFDの読み書き】【CRUD図】はその処理の分だけ。【テーブル】【モジュール一覧】は全部
def to_procedure_draft(output) -> ProcedureDraft: ...
```

依存の向きは `procedure_drafting → procedure・structure・data_flow・data_model・function_list・prompt_rules` で、LLM は呼ばない(呼ぶのは 20-3 のサービス層)。

## 設計判断

### AI に書かせないもの

| 書かせないもの | 誰が決めるか | 理由 |
|---|---|---|
| 手順番号 | `number_steps`(20-1) | 並び順から決まる。AI に書かせると、分岐の番号の振り方が揺れる |
| 06 の L-ID(デモの `logic`) | 段階6が (呼び出し先, 関数) から導く | 段階6はまだ無い。紐づけを段階5に持たせない(着手時の決定3) |
| 呼び出し先の最終的な形 | `resolve_callee`(20-1) | AI が少し違う書き方をしても、1行に決まればそろえる |

段階1で「処理IDは AI に書かせずコードで振る」とした(Phase 16)のと同じ考え方である。後の段階が鍵にする値は、コードが決める。

### 入力をその処理の分に絞る

DFD の読み書きと CRUD 図は、対象の処理の分だけを渡す。全処理の分を渡すと、他の処理のテーブル操作を手順に混ぜやすい。一方、テーブル名とモジュール一覧は全部渡す。呼び出し先はモジュール一覧から選ばせ、DB 操作はテーブル名を変えずに書かせるためである。

モジュール一覧は、パス・層・責務・依存先・関わる処理を1行ずつ渡す。`all_functions` の行は「関わる処理: 全処理」と書く。AI はこれを手がかりに、その処理が通るモジュールを選ぶ。

### プロンプトの規則

- 呼び出し先は【モジュール一覧】のパスを一字一句そのまま書く。一覧に無いモジュールを創作しない。
- 分岐・例外は、元の手順の直後に `is_branch=true` の行として置く。元の手順の「分岐・例外」の欄には「1a へ」と書く(デモと同じ書き方)。
- DB 操作は「テーブル名 C/R/U/D」の形で書き、CRUD 図・DFD の読み書きと食い違わないようにする。
- 分岐を除いて 3〜12 行に収める。定型の手順は省く(「重要な部分だけ書く」原則)。
- 末尾に `NAMING_RULES`(名称・説明は日本語、パス・識別子は英語、入力の名前は変えない)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `build_procedure_messages`・`PROCEDURE_SYSTEM_PROMPT`・`to_procedure_draft` | pytest | スタブ不要。純粋関数(副作用なし)で、LLM を呼ばないため(メッセージを組み立て、構造化出力を受け取って変換するだけ) | 第一テストの統合スモーク(出力を変換し、メッセージに対象の処理が入る)。その処理の分だけの DFD・CRUD、全部のテーブル、全処理の印、処理概要表が無いときの文言、規則の末尾が `NAMING_RULES` |
| E2E 用の固定の出力(`fake.py`) | pytest | スタブ不要。固定の値を取り出すだけ | 固定のモジュール一覧(段階4)のパスで `merge_procedure` → `validate_stage(5, …)` がエラーなしで通る |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_procedure_drafting.py
# 6 passed
```

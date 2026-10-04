# Phase-21-2: 段階6の下書きのプロンプトと出力スキーマ(BE)

## この章の目的

1つの関数の詳細(シグネチャ〜事後条件と擬似フロー)を AI に下書きさせる入力を組み立て、構造化出力を 21-1 の `LogicDraft` に変える。入力の中心は「その関数を呼ぶ段階5の手順」で、呼ばれ方(渡すデータ・結果・分岐)をすべて満たす仕様を書かせる。

学習モード([introduction](./Phase-21-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/logic_drafting.py`](../samples/backend/app/detailed_design/logic_drafting.py) | 新規 | **コア** | `GeneratedPseudoStep`・`LogicGenerationOutput`(出力スキーマ)、`CallingStep`・`calling_step_rows`(呼ばれる手順を直後の分岐と一緒に集める)、`LOGIC_SYSTEM_PROMPT`・`build_logic_messages`、`to_logic_draft` |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 定型 | E2E 用の偽 LLM に `LogicGenerationOutput` の固定の出力を足す |
| ── ここからテスト ── | | | |
| [`tests/unit/test_logic_drafting.py`](../samples/backend/tests/unit/test_logic_drafting.py) | 新規 | 定型 | 呼ばれる手順と分岐の集め方、プロンプトに載る内容、`NAMING_RULES`、固定の出力が段階6の検証を通ること |

## 要点の抜粋

```python
# app/detailed_design/logic_drafting.py
class LogicGenerationOutput(BaseModel):       # 関数1つ分(モジュール・関数の名前と L-ID は書かせない)
    signature: str; args: str; returns: str; raises: str; pre: str; post: str
    pseudo: list[GeneratedPseudoStep]         # {text, sub[]} を 3〜10 段

@dataclass(frozen=True)
class CallingStep:                            # 関数を呼ぶ段階5の手順1つ
    step_id: str                              # F-01#4
    function_id: str
    step: ProcedureStep
    branches: tuple[ProcedureStep, ...]       # 直後の分岐の行(条件と結果)

def calling_step_rows(procedures, module, function) -> list[CallingStep]: ...
def build_logic_messages(module, function, module_row, rows, functions, tables) -> list[BaseMessage]: ...
    # ## 対象の関数 / ## モジュール(層・責務・依存先) / ## 呼ばれる手順(分岐つき) / ## テーブル
def to_logic_draft(output) -> LogicDraft: ...
```

`logic_drafting.py` は `logic.py`(21-1)・`procedure.py`・`structure.py`・`function_list.py`・`prompt_rules.py` に依存する。LLM は呼ばない(呼ぶのは 21-3 の生成サービス)。

## 設計判断

### 入力の中心は「呼ばれる手順」

06 の項目は、05 のどの手順から呼ばれるかで意味が決まる(06 の見本の「呼ばれる手順」バッジ)。そこで、その関数を呼ぶ手順を全部、処理の名前・手順ID・渡すデータ・処理内容・結果・DB 操作と一緒に渡す。手順の直後の分岐の行(`InvalidPeriodError → 400` など)も渡し、「手順の分岐・例外は、例外の欄と擬似フローの分かれ目に必ず現れるようにする」とプロンプトで求める。05 と 06 で例外の書き漏れが食い違わないようにするためである。

| 入力 | 出どころ | 渡す理由 |
|---|---|---|
| 対象のモジュールと関数 | 段階6の項目(人が選んだ鍵) | シグネチャの関数名をそろえる |
| モジュールの層・責務・依存先 | 段階4のモジュール一覧 | 事前条件(ロック・トランザクション・認証)の手がかり |
| 呼ばれる手順と分岐 | 段階5の手順(`calling_step_rows`) | 呼ばれ方を全部満たす仕様にする |
| テーブル名 | 段階3の ER | 擬似フローで名前を創作させない |

### 名前と L-ID は書かせない

モジュールと関数は 05 との紐づけの鍵なので、AI の出力に含めない(書き換えられると紐づけが切れる)。L-ID は並び順から導く(21-1)。段階5の「手順番号は書かせない」と同じ考え方である。

### 言語はパスから

段階6の入力は段階5だけ(`STAGE_INPUTS[6] = (5,)`)で、要件定義(技術スタック)を入力に持たない。シグネチャの言語は「モジュールのパスから分かる言語(.py なら Python、.ts なら TypeScript)」とした。段階6の入力を増やすと、要件定義を直すたびに段階6が「古い」になるためである。

### 表記の規則

Phase 19 の申し送りどおり、system プロンプトの末尾に `NAMING_RULES` を足した(説明は日本語、識別子は英語、入力の名前は変えない)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `calling_step_rows` | pytest | スタブ不要。純粋関数で、外部依存を呼ばないため | 直後の分岐の行が付くこと、無い関数は空 |
| `build_logic_messages`・`LOGIC_SYSTEM_PROMPT` | pytest | スタブ不要。メッセージを組み立てるだけで LLM を呼ばないため | 第一テストの統合スモーク(組み立て → `to_logic_draft`)。モジュール・手順ID・分岐・テーブルが載る、モジュール一覧に無いときの表示、末尾の `NAMING_RULES` |
| `to_logic_draft`・E2E 用の固定の出力 | pytest | スタブ不要。同上 | 固定の出力を `merge_logic` で取り込むと、段階6の検証を指摘なしで通る |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_logic_drafting.py
# 7 passed
```

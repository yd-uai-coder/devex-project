# Phase-38-1: 要件の追跡の純粋関数(BE)

## この章の目的

Phase 36・37 で要件定義書と外部設計書に付いた要件ID(`FR-001`)を、下流の「処理(段階1)」と「作業単位(段階7・簡易モードの WBS)」につなぐ。処理に `req_ids` を持たせ、WBS のタスクの「要件」欄を読み、要件ごとの処理と単位を導く関数と、処理・単位の無い Must の機能要件を指摘する検証を、LLM も DB も呼ばない純粋関数で決める。

自動実装モード: on([introduction](./Phase-38-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/function_list.py`](../samples/backend/app/detailed_design/function_list.py) | 更新 | `FunctionRow.req_ids`・`FunctionDraft.req_ids`。`merge_draft` が API の処理の要件ID を外部設計書の 2.6 から写す(`api_req_ids`) |
| [`app/detailed_design/plan.py`](../samples/backend/app/detailed_design/plan.py) | 更新 | `PlanTask.req_ids`(簡易モードの WBS だけが埋める)。`normalize_plan` も引き継ぐ |
| [`app/detailed_design/requirement_trace.py`](../samples/backend/app/detailed_design/requirement_trace.py) | 新規 | 要件の索引(要件定義書の model / 外部設計書の写し)・単位の要件・要件ごとの処理と単位・NFR と CON の行 |
| [`app/detailed_design/simple_procedure/wbs.py`](../samples/backend/app/detailed_design/simple_procedure/wbs.py) | 更新 | WBS の「要件」(「要件ID」)欄を読み、要件ID の形にそろえる |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | `StageSources.document_models`。段階1と簡易モードの段階8に要件の追跡の指摘 |
| ── ここからテスト ── | | |
| [`tests/fixtures/simple_procedure.py`](../samples/backend/tests/fixtures/simple_procedure.py) | 更新 | `PLAN_MD` に「要件」欄、`REQUIREMENTS_MODEL`・`simple_document_models` |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | `function_list_model()` の処理に `req_ids` |
| [`tests/unit/test_requirement_trace.py`](../samples/backend/tests/unit/test_requirement_trace.py) | 新規 | `requirement_trace.py` の純粋関数 |
| [`tests/unit/test_function_list.py`](../samples/backend/tests/unit/test_function_list.py) | 更新 | 要件ID の写しと段階1の要件の追跡 |
| [`tests/unit/test_simple_wbs.py`](../samples/backend/tests/unit/test_simple_wbs.py) | 更新 | 「要件」欄の解析と正規化 |
| [`tests/unit/test_simple_procedure_validation.py`](../samples/backend/tests/unit/test_simple_procedure_validation.py) | 更新 | 簡易モードの段階8の要件の追跡 |

BE のパスは `devex-api/backend/` 基準。並びは import の依存順(#30): `requirement_trace.py` は `function_list.py`(`FunctionRow`)と、`plan.py` を読む `procedure_doc.py`(`PlanUnit`)を読み、`wbs.py`・`validation.py` が `requirement_trace.py` を読む。

## 要点の抜粋

```python
# app/detailed_design/function_list.py
class FunctionRow(BaseModel):
    ...
    req_ids: list[str] = Field(default_factory=list)   # 要件ID(FR-001…)

def merge_draft(drafts, previous=None, api_req_ids: Mapping[str, Sequence[str]] | None = None):
    """要件ID: api_req_ids(外部設計書の 2.6 の endpoint_key → 要件ID)に在る API はその値、
    それ以外は下書きの値。再生成で前の版の req_ids は引き継がない。"""
```

```python
# app/detailed_design/requirement_trace.py
@dataclass(frozen=True)
class RequirementIndex:
    known_ids: tuple[str, ...]; must_fr_ids: tuple[str, ...]
    rows: tuple[RequirementRow, ...] = ()          # 要件定義書の model から作ったときだけ
    @property
    def available(self) -> bool: ...                 # 要件ID が在る(照合できる)か

def index_from_requirements(model) -> RequirementIndex: ...     # 段階8・手順書
def index_from_external_design(model) -> RequirementIndex: ...  # 段階1(生成時の写し)
def api_req_ids(external_design) -> dict[str, list[str]]: ...    # endpoint_key → 要件ID
def normalize_req_id(value: str) -> str | None: ...               # fr-1 → FR-001
def unit_req_ids(units, functions=None) -> dict[str, list[str]]:
    """functions(段階1)を渡せば単位の処理から導き、渡さなければ単位自身の req_ids(WBS)。"""
def requirement_trace(index, units, unit_reqs, functions=None) -> list[TraceRow]: ...
def constraint_rows(index) -> list[RequirementRow]: ...           # NFR と CON
```

```python
# app/detailed_design/simple_procedure/wbs.py
_ATTRIBUTE = re.compile(r"^[-*]\s*\**(処理|要件(?:ID)?|依存|モジュール|環境・設定)\**\s*[:：]\s*(.*)$")
def _set_attribute(task, name, value) -> list[WbsIssue]: ...   # 要件の形の違いだけ指摘を返す
```

```python
# app/detailed_design/validation.py
@dataclass(frozen=True)
class StageSources:
    ...
    document_models: Mapping[str, Mapping[str, Any]] = field(default_factory=dict)

def _requirement_issues(parsed, sources) -> list[StageIssue]: ...          # 段階1(警告)
def _simple_requirement_issues(units, sources) -> list[StageIssue]: ...    # 簡易モードの段階8
```

依存の向き: `requirement_trace.py` は `function_list.py`・`procedure_doc.py`・`api_list.py`(`endpoint_key`、Phase 16)・`app.documents.requirements.model`(Phase 36)を読む。`wbs.py` と `validation.py` が `requirement_trace.py` を読む。`requirement_trace.py` は `procedure_basis.py` を読まない(`procedure_basis.py` → `simple_procedure` → `wbs.py` → `requirement_trace.py` の向きがあるため)。

## 設計判断

### 追跡の関数は `app/detailed_design` に置く

要件ID の正本は要件定義書(`app/documents/requirements`)だが、追跡は段階1の処理(`FunctionRow`)と作業単位(`PlanUnit`)を読む。`app/documents` に置くと、文書の側が詳細設計の段階を読む向きになる。そこで「要件の行を読む側」の `app/detailed_design/requirement_trace.py` に置き、要件定義書の model は `RequirementsModel` として読むだけにした(計画では `app/documents/requirements/trace.py` としていたが、依存の向きを見て置き場を変えた)。

### 要件の照合は2つの入り口を持つ

段階1の入力は外部設計書だけ(`STAGE_INPUTS`)。要件定義書の model を直接読むと、要件定義書を再生成しても段階1が「古い」にならない(入力の版に入っていないため)。外部設計書の model は生成時に要件定義書の要件ID を写している(Phase 37 の `known_req_ids`・`must_fr_ids`)ので、段階1はその写しと照らす(`index_from_external_design`)。外部設計書の版が変われば段階1は既に古くなるので、入力を増やさずに済む。

段階8(両モード)は要件定義書を入力に持ち、手順書は要件の本文・優先度・NFR と CON も要るので、要件定義書の model を読む(`index_from_requirements`)。どちらも model が無い・要件ID が無い版(Phase 36・37 より前)では `available` が偽で、照合しない。

### API の処理の要件ID はコードが写す(ユーザーの選択)

外部設計書の 2.6 は API ごとに要件ID を持つ。段階1の API の処理はその API と1対1(トリガー = メソッド + パス)なので、`merge_draft` が `endpoint_key` で引いて写す。AI に書かせると、外部設計書で決まった対応を書き直したり、書き落としたりしうる。API でない処理(画面・バッチ)と、2.6 に無い API は AI の下書きの値を使う。再生成では前の版の `req_ids` を引き継がない(機能グループは人の確定値なので引き継ぐが、要件の対応は外部設計書が変わると変わるため)。人が直したいときは段階1の画面で直す。

### 単位の要件は、詳細設計モードでは処理から導く

段階7の単位に要件を持たせると、処理を付け替えたときに要件の欄も直す必要があり、ずれる。単位の要件は「単位の処理が持つ要件の和」として導く(`unit_req_ids(units, functions)`)。簡易モードには段階1が無いので、WBS のタスクに「要件」欄を書かせ、`PlanTask.req_ids` に読む(`unit_req_ids(units)`)。`PlanTask.req_ids` は簡易モードだけが埋める。

### 検証は警告だけ、詳細設計モードの段階8には足さない

段階1: 処理の無い Must の機能要件(`MUST_REQUIREMENT_UNPROCESSED`)・要件の無い処理(`UNLINKED_FUNCTION`)・要件定義書に無い要件ID(`UNKNOWN_REQUIREMENT_ID`)。外部設計書の本文はあるが要件ID が無ければ `REQUIREMENT_IDS_MISSING` の1件だけ(再生成の案内)。段階1の指摘には重要度の列が無いので、どれも警告。

簡易モードの段階8(直す先は実装計画書): 単位の無い Must の機能要件(`MUST_REQUIREMENT_UNPLANNED`、中程度)・要件の無い機能の単位(`UNLINKED_UNIT`)・要件定義書に無い要件ID(どちらも軽微)。要件定義書に要件ID が無ければ軽微な1件。

詳細設計モードの段階8には足さない。要件 → 処理は段階1の検証が、処理 → 単位は段階7の計画の漏れ(`UNPLANNED_FUNCTION`)が見ているので、2つで「要件 → 単位」が追える。

### WBS の書式の揺れ

「要件」と「要件ID」の両方を読む。値は `normalize_req_id` で `FR-001` の形にそろえ(`fr-1` も読む)、形の違う値(「予約」など)は捨てて `WBS_FORMAT` の軽微な指摘にする。要件定義書に在るかは、ここでは見ない(段階8の検証が見る。処理の DF と同じ分担)。

## テスト観点

用語: SUT = テスト対象、ドライバ = SUT を呼ぶもの、スタブ = SUT が呼ぶ相手の代わり。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `requirement_trace.py` | pytest(`test_requirement_trace.py`) | スタブ不要 ── 対象が純粋(副作用なし)で、DB・LLM を呼ばないため。要件定義書の model は fixture の dict、処理と単位は直接作る | 第一テスト(統合スモーク): 詳細設計モードで、単位の要件を処理から導き、FR ごとの処理と単位を並べる(Won't は載せない)。続けて、簡易モードの単位の要件と処理(DF)の列、2つの索引と `available`・壊れた model、NFR・CON の行、`api_req_ids`(同じ API の2行目を捨てる)と `normalize_req_id` |
| `merge_draft`・`validate_function_list` | pytest(`test_function_list.py`) | スタブ不要(同上) | API の要件ID の写し(パスの揺れも `endpoint_key` で引く)と下書きの値、段階1の3つの警告、外部設計書に model が無いときの `REQUIREMENT_IDS_MISSING` |
| `parse_wbs` | pytest(`test_simple_wbs.py`) | スタブ不要 ── 入力は Markdown の文字列だけのため | 「要件」欄が `PlanTask.req_ids` に入る、「要件ID」・全角コロン・小文字・重複・形の違う値(軽微) |
| `validate_procedure_doc`(簡易モード) | pytest(`test_simple_procedure_validation.py`) | スタブ不要 ── 入力は `StageSources`(4文書と要件定義書の model)だけのため | 単位の無い Must(中程度)・要件の無い機能の単位・要件定義書に無い要件ID(軽微)、要件ID の無い要件定義書(軽微1件)、旧形式の WBS では Must の要件も計画に無い |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_requirement_trace.py tests/unit/test_function_list.py tests/unit/test_simple_wbs.py tests/unit/test_simple_procedure_validation.py
```

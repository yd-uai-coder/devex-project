# Phase-31-2: 内部設計書の解析・参照・段階8の土台・段階の入力(BE・純粋関数)

## この章の目的

簡易モードの手順書が参照する設計を、内部設計書(と外部設計書の API 一覧)から読む。読むのは、処理別データフロー(`DF-<n>`)・モジュール一覧・API・テーブル・3.1・3.4節である。あわせて2つのものを作る。

- **段階8の土台 `ProcedureBasis`**: 段階8の部品(検証・生成・出力・画面)が、モードによらず同じ形で作業単位と参照を受け取るための型。
- **簡易モードの段階の入力**: 段階8だけを持ち、入力は4文書。

自動実装モード: on([introduction](./Phase-31-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/api_list.py`](../samples/backend/app/detailed_design/api_list.py) | 更新 | `extract_api_endpoints` に節の番号の引数(内部設計書 3.3 も読める)。表の部品 `table_cells`・`is_separator_row` を公開 |
| [`app/detailed_design/stages.py`](../samples/backend/app/detailed_design/stages.py) | 更新 | `ProjectMode`・`SIMPLE_DOCUMENTS`・`SIMPLE_STAGE_INPUTS`・`stage_inputs(mode)`。`current_inputs`・`derive_states` はモードの入力を引数で受ける |
| [`app/detailed_design/procedure_doc.py`](../samples/backend/app/detailed_design/procedure_doc.py) | 更新 | `DesignRefKind` に `dataflow` |
| [`app/detailed_design/simple_procedure/internal_design.py`](../samples/backend/app/detailed_design/simple_procedure/internal_design.py) | 新規 | `parse_internal_design`・`SimpleDesignBook`・`DataFlow` |
| [`app/detailed_design/simple_procedure/refs.py`](../samples/backend/app/detailed_design/simple_procedure/refs.py) | 新規 | `simple_unit_refs`・`simple_ref_label`・`expand_simple_ref`・`simple_unit_context`(共通の節 `crosscutting_section`・`environment_section`) |
| [`app/detailed_design/simple_procedure/__init__.py`](../samples/backend/app/detailed_design/simple_procedure/__init__.py) | 更新 | `internal_design`・`refs` の名前を re-export |
| [`app/detailed_design/procedure_basis.py`](../samples/backend/app/detailed_design/procedure_basis.py) | 新規 | `ProcedureBasis`・`procedure_basis(mode, stages, documents)`・`ProcedureLabels`(`DETAILED_LABELS`・`SIMPLE_LABELS`)・`MODULE_RULE`・`SIMPLE_MODULE_RULE` |
| ── ここからテスト ── | | |
| [`tests/fixtures/simple_procedure.py`](../samples/backend/tests/fixtures/simple_procedure.py) | 更新 | `INTERNAL_DESIGN_MD`・`EXTERNAL_DESIGN_MD`・`REQUIREMENTS_MD`・`simple_documents(**overrides)`(4文書) |
| [`tests/unit/test_simple_internal_design.py`](../samples/backend/tests/unit/test_simple_internal_design.py) | 新規 | モジュール・DF・API・テーブル・3.1・3.4 を読む。モジュール一覧の無い内部設計書。別の節の API 一覧 |
| [`tests/unit/test_simple_procedure_refs.py`](../samples/backend/tests/unit/test_simple_procedure_refs.py) | 新規 | DF → モジュールの順の展開と共通の節、DF に添える API の行とテーブル、解決できない参照 |
| [`tests/unit/test_procedure_basis.py`](../samples/backend/tests/unit/test_procedure_basis.py) | 新規 | 詳細設計モードは今までの `unit_context` と同じ、簡易モードは WBS と内部設計書、モジュールのパスをそろえる |
| [`tests/unit/test_detailed_design_stages.py`](../samples/backend/tests/unit/test_detailed_design_stages.py) | 更新 | 簡易モードは段階8だけで4文書がそろうと開く・文書を再生成すると「古い」 |

## 要点の抜粋

```python
# app/detailed_design/stages.py
ProjectMode = Literal["simple", "detailed"]
SIMPLE_STAGE_INPUTS: dict[int, StageInputs] = {8: StageInputs(stages=(), documents=SIMPLE_DOCUMENTS)}
def stage_inputs(mode: str) -> Mapping[int, StageInputs]
def derive_states(records, doc_versions, inputs=STAGE_INPUTS) -> dict[int, StageView]  # inputs に無い段階の行は読まない
```

```python
# app/detailed_design/simple_procedure/internal_design.py
@dataclass(frozen=True)
class SimpleDesignBook:
    modules: Mapping[str, ModuleRow]          # 3.3「モジュール一覧」(段階4の代わり)
    has_module_list: bool                     # 一覧の節があるか
    dataflows: Mapping[str, DataFlow]         # 3.3「処理別データフロー」の DF-<n>(段階5の代わり)
    apis: Mapping[str, ApiEndpoint]           # 3.3 の API エンドポイント一覧
    external_apis: Mapping[str, ApiEndpoint]  # 外部設計書 2.6
    tables: Mapping[str, str]                 # 3.2 のテーブル名 → 表の md
    architecture: str                         # 3.1
    error_policy: str                         # 3.4(07章の代わり)

def parse_internal_design(internal_design: str, external_design: str = "") -> SimpleDesignBook
```

```python
# app/detailed_design/procedure_basis.py
@dataclass(frozen=True)
class ProcedureBasis:
    mode: ProjectMode
    plan: PlanModel                 # 作業単位(段階7、または WBS を読んだもの)
    labels: ProcedureLabels         # モードで変わる文言(作業単位の出どころ・直す先の列など)
    environment: str = ""           # 実装前提の本文
    rules: tuple[str, ...] = ()     # 実装ルール
    stages / index / book / wbs_issues
    @property units -> list[PlanUnit]
    def refs(task) -> list[DesignRef]
    def context(unit) -> UnitContext

def procedure_basis(mode, stages, documents) -> ProcedureBasis
```

```python
# app/detailed_design/simple_procedure/__init__.py(この章の時点)
from app.detailed_design.simple_procedure.internal_design import DataFlow, SimpleDesignBook, parse_internal_design
from app.detailed_design.simple_procedure.refs import (
    expand_simple_ref, simple_ref_label, simple_unit_context, simple_unit_refs,
)
from app.detailed_design.simple_procedure.wbs import ...   # 31-1
```

依存の向き: `internal_design` → `api_list`・`structure.ModuleRow`・`sections`。`refs` → `api_list`・`plan`・`procedure_doc`・`procedure_doc_refs`(`ExpandedRef`・`UnitContext`)・`internal_design`。`procedure_basis` → `plan`・`procedure_doc`・`procedure_doc_refs`・`simple_procedure`・`stages`。`procedure_basis` は `validation` を import しない(31-3 で `validation` が `procedure_basis` を使うため)。

## 設計判断

### 継ぎ目を1つの型に集める(#17)

段階8は、7か所で段階7の model を直接読んでいた(検証・出力の入力・参照の展開・生成・生成の対象と受け付けの確認・サービスの単位の詳細と AI 向けの版・画面)。簡易モードの分岐をそれぞれに書くと、同じ「どこから作業単位と参照を取るか」が7か所に散る。`ProcedureBasis` にまとめ、モードの違いはここだけで扱う。詳細設計モードの `refs`・`context` は今までの `unit_refs`・`unit_context` をそのまま呼ぶので、挙動は変わらない(`test_procedure_basis.py` の第一テストで同じことを確かめる)。

### 作業単位は段階7と同じ `PlanModel` にそろえる

WBS を `PlanModel` に読めば、手順書の model の照合(`UNIT_MISMATCH`)・生成の対象・merge・出力の単位の一覧が、そのまま使える。処理の欄には処理ID の代わりに DF の ID が入る。

### 参照の種類に `dataflow` を足す

簡易モードの「処理の流れ」は段階5の手順ではなく、内部設計書の処理別データフローである(作成方針 10章)。段階5の手順(`procedure`)と同じ種類にすると、画面のラベルやシーケンス図の扱いが混ざる。種類を分けた。関数の契約(段階6)とシーケンス図は簡易モードに無いので、参照は DF とモジュールの2種類だけになる。

### DF の展開に API とテーブルを添える

DF の流れの表だけでは、API の契約とデータが分からない。同じメソッド・パスの内部設計書 3.3 と外部設計書 2.6 の行(関連画面つき)と、流れの元・先に出てくる 3.2 のテーブルを添える。API の突き合わせは `endpoint_key`(段階1と同じ。パスの引数名の揺れを吸収する)で行う。

### WBS のモジュールをモジュール一覧のパスにそろえる

LLM は WBS のモジュールを `services/reservation` のように略すことがある。段階7の下書きと同じ `normalize_plan`(`resolve_callee`。1行だけに当たるときだけ置き換える)で、モジュール一覧のパスにそろえる。

### 文書の再生成で段階8を「古い」にする

段階の入力の仕組み(`input_fingerprint`)をそのまま使い、入力を4文書の表示中の版にした。どれかを再生成・復元すると、承認済みの段階8は「古い」になる。マイグレーションは要らない(`design_stages` の CHECK は 1〜8 のまま)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `parse_internal_design`・`extract_api_endpoints`(節の引数)・`table_cells`・`is_separator_row` | pytest(`test_simple_internal_design.py`) | スタブ不要 ── 文書の Markdown だけから決まり、DB や LLM を呼ばないため | 第一テスト(統合スモーク): モジュール一覧(`` ` `` のパス・依存先の「—」)・DF(トリガー・元/先・データ項目)・API(3.3 と 2.6)・テーブル・3.1・3.4。モジュール一覧の無い内部設計書。メソッドの列が無い表(モジュール一覧)は API として読まない |
| `simple_unit_context`・`expand_simple_ref`・`simple_unit_refs`・`simple_ref_label` | pytest(`test_simple_procedure_refs.py`) | スタブ不要 ── 文書から読んだ設計と単位だけから決まるため | 第一テスト: DF → モジュールの順、ラベル、図は無い、共通の節(3.4・4.3・3.1)。DF に API の行とテーブル。設計に無い参照は展開しない |
| `procedure_basis` | pytest(`test_procedure_basis.py`) | スタブ不要 ── 段階の内容(辞書)と文書の本文だけから決まるため | 第一テスト: 詳細設計モードの `context()` が `unit_context` と同じ・実装ルールと開発環境。簡易モードの単位・参照の種類・実装ルール(3.4 の行)・開発環境(4.3 と 3.1)。モジュールのパスをそろえる |
| `derive_states`・`current_inputs`・`stage_inputs` | pytest(`test_detailed_design_stages.py`) | スタブ不要 ── 純粋関数 | 簡易モードは段階8だけ・4文書で開く・ほかの段階の行は読まない。文書を再生成すると「古い」 |

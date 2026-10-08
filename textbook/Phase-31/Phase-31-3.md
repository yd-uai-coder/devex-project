# Phase-31-3: 検証・下書き・出力の組み立て(BE・純粋関数)

## この章の目的

31-2 の土台 `ProcedureBasis` を、段階8の純粋関数の部品(検証・AI の下書きの入出力・出力の組み立て)に通す。簡易モードの実装可能性チェックは、詳細設計モードのチェックと3つの点で違う。

- 見る対象: 段階3〜6 ではなく、実装計画書と内部設計書を突き合わせる。
- 指摘の直す先: 段階ではなく文書(`fix_document`)で持つ。
- 出力の文言: 作業単位の出どころ・実装前提・直す先の列を、モードで切り替える。

自動実装モード: on([introduction](./Phase-31-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/procedure_doc.py`](../samples/backend/app/detailed_design/procedure_doc.py) | 更新 | `AiFinding.fix_document` |
| [`app/detailed_design/simple_procedure/wbs.py`](../samples/backend/app/detailed_design/simple_procedure/wbs.py) | 更新 | 単位が0件なら `WBS_MISSING` だけを返す |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | `StageSources.mode`・`StageIssue.fix_document`。`validate_procedure_doc` を土台から作業単位を取る形にし、両モード共通の `_matched_procedures`(エラー)と簡易モードの `_simple_procedure_issues`(警告)に分けた |
| [`app/detailed_design/procedure_doc_drafting.py`](../samples/backend/app/detailed_design/procedure_doc_drafting.py) | 更新 | `GeneratedSimpleFinding`・`SimpleProcedureDocGenerationOutput`・`SIMPLE_PROCEDURE_DOC_SYSTEM_PROMPT`・`build_simple_procedure_doc_messages`。プロンプトを共通部分と、モードごとの部分に分けた |
| [`app/detailed_design/procedure_output/source.py`](../samples/backend/app/detailed_design/procedure_output/source.py) | 更新 | `procedure_output_source(title, state, basis, ...)`。`ProcedureOutputSource` に `labels`・`environment`・`rules`、`UnitFinding.fix_document`、`fix_target_text` |
| [`app/detailed_design/procedure_output/markdown.py`](../samples/backend/app/detailed_design/procedure_output/markdown.py) | 更新 | 作業単位の出どころ・実装前提・直す先の列を `labels` から書く(`MODULE_RULE` は `procedure_basis` へ移した) |
| [`app/detailed_design/procedure_output/html.py`](../samples/backend/app/detailed_design/procedure_output/html.py) | 更新 | 同上(HTML) |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `procedure_output_source` の呼び出し元。この章では詳細設計モードの土台を渡す(31-4 でモード対応に書き換える) |
| [`app/services/detailed_design_export_service.py`](../samples/backend/app/services/detailed_design_export_service.py) | 更新 | 同上 |
| ── ここからテスト ── | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | `sample_procedure_source` が詳細設計モードの土台を渡す |
| [`tests/fixtures/simple_procedure.py`](../samples/backend/tests/fixtures/simple_procedure.py) | 更新 | `simple_procedure_doc_model`・`sample_simple_procedure_source` |
| [`tests/unit/test_simple_procedure_validation.py`](../samples/backend/tests/unit/test_simple_procedure_validation.py) | 新規 | 指摘0件・`UNIT_MISMATCH` の文言・旧形式・計画と設計の不足と直す先・ディレクトリのモジュール |
| [`tests/unit/test_procedure_doc_drafting.py`](../samples/backend/tests/unit/test_procedure_doc_drafting.py) | 更新 | 簡易モードのメッセージ・指摘の直す先の文書 |
| [`tests/unit/test_procedure_output_source.py`](../samples/backend/tests/unit/test_procedure_output_source.py) | 更新 | `fix_target_text` |
| [`tests/unit/test_procedure_markdown.py`](../samples/backend/tests/unit/test_procedure_markdown.py) | 更新 | 簡易モードの index・AI 向けの版(`MODULE_RULE` の import 先を変えた) |
| [`tests/unit/test_procedure_html.py`](../samples/backend/tests/unit/test_procedure_html.py) | 更新 | 簡易モードの HTML |

## 要点の抜粋

```python
# app/detailed_design/validation.py
def validate_procedure_doc(model, sources: StageSources) -> list[StageIssue]:
    parsed = ProcedureDocModel.model_validate(model)               # 形が不正 → INVALID_MODEL
    basis = procedure_basis(sources.mode, sources.stages, sources.documents)
    issues, matched = _matched_procedures(parsed, basis)            # DUPLICATE_UNIT・UNIT_MISMATCH(両モード)
    if basis.mode == "simple":
        return issues + _simple_procedure_issues(basis, matched)    # 警告(直す先は文書)
    ...                                                             # 詳細設計モードの警告(今までどおり)
```

簡易モードの警告(すべて `fix_stage=8` と `fix_document` を持つ):

| コード | レベル | 直す先 | 内容 |
|---|---|---|---|
| `WBS_MISSING` / `WBS_FORMAT` / `WBS_ID_MISMATCH` | 最重要 / 中程度 / 軽微 | 実装計画書 | 31-1 の解析の指摘 |
| `UNKNOWN_DEPENDENCY` / `FORWARD_DEPENDENCY` | 中程度 | 実装計画書 | 段階7の検証(`_dependency_issues`)を、エラーでなく警告として使う |
| `FEATURE_WITHOUT_DATAFLOW` / `UNKNOWN_DATAFLOW` | 中程度 | 実装計画書 | 機能の単位に DF が無い / DF が内部設計書に無い |
| `UNPLANNED_DATAFLOW` | 軽微 | 実装計画書 | どの単位にも入っていない DF |
| `NO_MODULE_LIST` | 最重要 | 内部設計書 | モジュール一覧が無い(モジュールの指摘はしない) |
| `UNKNOWN_MODULE` / `MODULE_NOT_FILE` / `UNKNOWN_FILE` | 中程度 | 内部設計書 | 単位のモジュールが一覧に無い・ディレクトリ / 手順書のファイルが一覧に無い |

```python
# app/detailed_design/procedure_doc_drafting.py
class GeneratedSimpleFinding(BaseModel):            # fix_stage の代わりに fix_document
    level: FindingLevel; target: str; message: str; fix_document: DesignDocument
class _ProcedureDocDraft(BaseModel): ...            # purpose・files・notes・tests・gwt・verify
class ProcedureDocGenerationOutput(_ProcedureDocDraft):       findings: list[GeneratedFinding]
class SimpleProcedureDocGenerationOutput(_ProcedureDocDraft): findings: list[GeneratedSimpleFinding]
def build_simple_procedure_doc_messages(context: UnitContext) -> list[BaseMessage]
def to_unit_procedure(unit, output: ProcedureDocGenerationOutput | SimpleProcedureDocGenerationOutput) -> UnitProcedure
```

```python
# app/detailed_design/procedure_output/source.py
def procedure_output_source(title, state, basis: ProcedureBasis, model, issues, requirements="") -> ProcedureOutputSource
def fix_target_text(finding: UnitFinding) -> str     # 文書があれば「内部設計書」、無ければ「段階N」/「—」
```

## 設計判断

### エラーは両モード共通、警告だけを分ける

承認を止めるのは、手順書そのものの不正(形・同じ単位が2つ・単位と合わない)だけ、という Phase 27 の決定は簡易モードでも同じにした。文書の不足(WBS の崩れ・モジュール一覧が無い)は警告で、承認は止めない(簡易モードは「未定義が多く出ることをそのまま示す」が方針。作成方針 3章)。`UNIT_MISMATCH` の文言の「段階7」は、`labels.plan`(「実装計画書」)に替える。

### 依存の不備は警告にする

詳細設計モードでは、依存の不備は段階7の検証のエラーで止まる。簡易モードには段階7の承認が無いので、段階8の警告(直す先は実装計画書)として出す。判定は段階7の `_dependency_issues` を共有する(#17)。

### 直す先を文書で持つ(`fix_document`)

簡易モードには段階1〜7が無いので、「段階Nで直す」が成り立たない。`StageIssue`・`AiFinding`・`UnitFinding` に `fix_document` を足し、`fix_stage` は「直す先の段階が無い」を示す 8 にした。`fix_stage` の意味を変えないので、詳細設計モードの画面・出力はそのまま動く。表示は `fix_target_text` が文書を優先する。

### 下書きのプロンプトを共通部分とモードの部分に分ける

簡易モードのプロンプトは、詳細設計モードと3点だけが違う。

- 指摘の直す先: 段階ではなく文書で書かせる。
- 参照の説明: 内部設計書の DF・モジュール一覧・テーブルと、外部設計書の API 一覧だけ。関数の契約と処理の手順は無いと明記する。
- 基盤の単位の根拠: 07章の代わりに内部設計書 3.4。

それ以外の規則(書き写さない・files の順・notes・tests・verify)は `_COMMON_RULES` として共有し、詳細設計モードの文言は変えていない。流れの表だけで手順が決まらない単位は、findings で「詳細設計モードで詰めることを勧める」と書かせる(作成方針 3章の例)。構造化出力の型も、共通の欄 `_ProcedureDocDraft` と、findings の型だけが違う2つにした。

### 出力の文言は土台の `labels` から書く

index の「段階7のマイルストーン」「技術スタック・開発環境(段階7)」「実装ルール(段階4・07章より)」「直す段階」と HTML の「段階1〜7から組み立てた」が、簡易モードでは嘘になる。`ProcedureLabels` に集め、`ProcedureOutputSource` に `labels`・`environment`・`rules` を持たせた。詳細設計モードの文言は今までと同じなので、既存の出力のテストはそのまま通る。

### 呼び出し元はこの章で詳細設計モードの土台を渡す

`procedure_output_source` のシグネチャを変えたので、呼び出し元2つ(`DesignStageService.unit_ai_markdown`・`DetailedDesignExportService.collect`)も同じ章で直した(前方 import の禁止。#15)。この章では `procedure_basis("detailed", ...)` を渡し、31-4 でモード対応に書き換える。samples は最終の形で、31-4 のタグを付けている。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `validate_procedure_doc`(簡易モード) | pytest(`test_simple_procedure_validation.py`) | スタブ不要 ── 入力は `StageSources`(モードと4文書の本文)で、DB や LLM を呼ばないため | 第一テスト(統合スモーク): そろった4文書と手順書は指摘0件。WBS の改名で `UNIT_MISMATCH`(エラー。「実装計画書の M-01-T02」)。旧形式とモジュール一覧の無い内部設計書は最重要2件と `UNPLANNED_DATAFLOW` だけ。計画と設計の不足8件の、コード・直す先・単位。ディレクトリのモジュール |
| `build_simple_procedure_doc_messages`・`to_unit_procedure`(簡易モードの出力) | pytest(`test_procedure_doc_drafting.py`) | スタブ不要 ── 純粋関数で LLM を呼ばないため(メッセージを組み立て、構造化出力を受け取って変換するだけ) | システムプロンプトが簡易モードのもの・`NAMING_RULES` で終わる。人の側の入力に DF とモジュールの出どころ・展開した DF・共通の方針の見出し。指摘は `fix_stage=8` と文書 |
| `fix_target_text` | pytest(`test_procedure_output_source.py`) | スタブ不要 ── 純粋関数 | 文書があれば文書の名前、無ければ段階 |
| `to_index_markdown`・`to_ai_markdown`(簡易モード) | pytest(`test_procedure_markdown.py`) | スタブ不要 ── 入力の値だけから決まるため | 5節の形は同じ。「実装計画書のマイルストーン」・実装前提の小見出し・実装ルール(3.4 の行)・直す先の列・対象外。AI 向けの版の実装ルールと展開した DF・3.4 |
| `to_procedure_html`(簡易モード) | pytest(`test_procedure_html.py`) | スタブ不要 ── 同上 | 「4文書から組み立てた」・実装ルールの小見出し・直す先の文書 |

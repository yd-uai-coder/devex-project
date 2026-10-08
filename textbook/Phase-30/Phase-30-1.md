# Phase-30-1: 出力の入力と未定義の集約(BE・純粋関数)

## この章の目的

実装手順書の出力(zip の `implementation_procedure/` と、画面の「AI 向けにコピー」)は、段階8の手順書と承認済みの段階1〜7から決定的に組み立てる表示で、文書としては保存しない。この章では、組み立てに使う値を1つの `ProcedureOutputSource` にまとめる純粋関数を作る。未定義・要決定(段階8の検証の指摘と AI の指摘)を、画面と同じ並びと数え方で1つの一覧にするのもここで行う。

自動実装モード: on([introduction](./Phase-30-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/procedure_output/source.py`](../samples/backend/app/detailed_design/procedure_output/source.py) | 新規 | `ProcedureOutputSource`・`procedure_output_source`・`UnitFinding`・`collect_findings`・`unit_findings`・`count_by_level`・`count_text`・`fix_stage_text`・`out_of_scope_lines`・`unit_filename` |
| [`app/detailed_design/procedure_output/__init__.py`](../samples/backend/app/detailed_design/procedure_output/__init__.py) | 新規 | パッケージ。この章では `source` の名前だけを re-export する(30-2・30-3 で足す) |
| ── ここからテスト ── | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | `REQUIREMENTS_WITH_SCOPE`(1.4節を持つ要件定義)・`sample_procedure_source`(出力の入力。30-2・30-3 のテストも使う) |
| [`tests/unit/test_procedure_output_source.py`](../samples/backend/tests/unit/test_procedure_output_source.py) | 新規 | 単位の並び・手順書のある単位だけ・未定義の集約と並び・件数・対象外・ファイル名 |

BE のパスは `devex-api/backend/` 基準。

## 要点の抜粋

```python
# app/detailed_design/procedure_output/__init__.py(この章の時点)
from app.detailed_design.procedure_output.source import (
    ProcedureOutputSource, UnitFinding, collect_findings, count_by_level,
    out_of_scope_lines, procedure_output_source, unit_filename, unit_findings,
)
```

```python
# app/detailed_design/procedure_output/source.py
@dataclass(frozen=True)
class ProcedureOutputSource:
    title: str
    state: StageState                         # 段階8の状態。zip は approved のときだけ組み立てる
    plan: PlanModel
    units: tuple[PlanUnit, ...] = ()          # 段階7の作業単位(並び順 = 依存順)
    procedures: Mapping[str, UnitProcedure]   # 手順書のある単位だけ(documented_unit_ids)
    contexts: Mapping[str, UnitContext]       # 同じ単位の参照の展開(unit_context)
    findings: tuple[UnitFinding, ...] = ()    # 未定義・要決定(重要度の順)
    out_of_scope: tuple[str, ...] = ()        # 要件定義 1.4 の Should / Could / Won't

def procedure_output_source(title, state, stages, model, issues, requirements="") -> ProcedureOutputSource
def collect_findings(issues, procedures) -> list[UnitFinding]   # 検証(重要度のあるもの)+ AI。重要度の順
def unit_filename(unit) -> str                                  # "M-01-T02_予約を登録する.md"
```

依存の向き: `source` → `plan`・`procedure_doc`・`procedure_doc_refs`・`stages`・`validation`・`uml.generation.sections`。`document` パッケージは読まない(30-2 から)。

## 設計判断

### 置き場を `document/` でなく別パッケージにした(計画から変えたこと)

計画では `document/` の中に置く予定だった。だが参照の展開(`procedure_doc_refs`)は `document.markdown` の表(`procedure_table` など)を使う。出力の組み立ては `procedure_doc_refs` を使うので、`document/__init__` から re-export すると「`procedure_doc_refs` → `document` → 出力 → `procedure_doc_refs`」の循環になる。`app/detailed_design/procedure_output/` を別に作り、`document` の部品を使う側に置いた。

### `model` を引数で受け取る

zip は「承認済みの段階8」、画面のコピーは「保存済みの段階8」を使う(着手時の決定4)。手順書の中身を引数で受け取ることで、同じ組み立てを両方が使える。段階8の状態(`state`)も渡し、AI 向けの版の警告に使う(30-2)。

### 手順書のある単位 = ID とタスク名の両方が合うもの

`documented_unit_ids`(Phase 27)をそのまま使う。段階7を並べ替え・改名して合わなくなった手順書は、検証のエラー(`UNIT_MISMATCH`)で作り直しの対象なので、出力に使わない。

### 未定義の並びと数え方を画面にそろえる

画面の `procedureDocOps.collectFindings`(Phase 27)と同じ規則にした: 重要度のある検証の指摘 → AI の指摘の順に並べてから、重要度の順に安定ソートする。重要度の無い検証の指摘(手順書そのもののエラー)は含めない。直す先の段階が無い検証の指摘は 8 として扱い、表では「—」と書く。画面と zip で件数が食い違わないようにするため。

### 対象外は要件定義の 1.4節から決定的に読む

段階8の入力に要件定義を入れたのは、手順書の対象外を書くため(Phase 27 の決定)。既存の `extract_section`(ステージ3)で `## 1.4` の節を取り出し、Should / Could / Won't で始まる行のうち中身のあるものだけを残す(簡易モードの要件定義のテンプレートは `- **Could have(…)**: ` のように空の行を持つため)。

## テスト観点

用語: SUT = テスト対象、ドライバ = テストを呼び出す側、スタブ = SUT の依存を差し替える偽物。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `procedure_output_source`・`collect_findings`・`unit_findings`・`count_by_level`・`count_text`・`fix_stage_text`・`out_of_scope_lines`・`unit_filename` | pytest(`test_procedure_output_source.py`) | スタブ不要 ── 入力の段階の内容(辞書)・検証の指摘・要件定義の本文だけから決まり、DB や LLM を呼ばないため | 第一テスト(統合スモーク): 単位が段階7の順で、手順書と展開は手順書のある単位だけ。タスク名の合わない手順書は使わない。未定義は重要度の順(同じ重要度は検証 → AI)、重要度の無い指摘は除く。1.4節の空の行は除く。ファイル名のパスに使えない文字と空白は `_` |

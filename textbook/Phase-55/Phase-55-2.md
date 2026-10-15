# Phase-55-2: 実装可能性チェックへの組み込み

## この章の目的

[55-1](./Phase-55-1.md) の判定を、段階8の検証 `validate_procedure_doc`(実装可能性チェック)に両モードで足し、重要度と直す先を決める。あわせて、手順書の生成の指示にテストのファイルを入れる1行を足し、偽 LLM とテストのフィクスチャを新しい検証で警告が出ない形にそろえる。画面と md は指摘を汎用に出しているので変えない。

自動実装モード: on([introduction](./Phase-55-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | `_coverage_issues`・`_coverage_sources`・`_plan_finding`。`validate_procedure_doc` の両モードの最後に足す |
| [`app/detailed_design/procedure_doc_drafting.py`](../samples/backend/app/detailed_design/procedure_doc_drafting.py) | 更新 | 共通の規則に「tests を書いたら、その観点を確かめるテストのファイルを files に kind=test で入れる」 |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | E2E の偽物: 基盤の単位の設定にマイグレーション、手順書にテストのファイル |
| ── ここからテスト ── | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | `plan_model()` の基盤の単位にマイグレーション |
| [`tests/fixtures/simple_procedure.py`](../samples/backend/tests/fixtures/simple_procedure.py) | 更新 | `PLAN_MD` の基盤の単位にマイグレーション、手順書と構造化出力にテストのファイル |
| [`tests/unit/test_procedure_doc_validation.py`](../samples/backend/tests/unit/test_procedure_doc_validation.py) | 更新 | 詳細設計モードの4つの指摘 |
| [`tests/unit/test_simple_procedure_validation.py`](../samples/backend/tests/unit/test_simple_procedure_validation.py) | 更新 | 簡易モードの指摘と直す先の文書 |
| [`tests/unit/test_procedure_doc_drafting.py`](../samples/backend/tests/unit/test_procedure_doc_drafting.py) | 更新 | 両モードの指示に1行がある |
| [`tests/unit/test_simple_wbs.py`](../samples/backend/tests/unit/test_simple_wbs.py)・[`tests/unit/test_detailed_design_plan_document.py`](../samples/backend/tests/unit/test_detailed_design_plan_document.py) | 更新 | フィクスチャの設定のファイルが増えた分の期待 |

## 要点の抜粋

### 1. 4つの指摘

| コード | 重要度 | 直す先(詳細 / 簡易) | `target`・`unit` |
|---|---|---|---|
| `DEPENDENCY_BUILT_LATER` | 中程度 | 段階7 / 実装計画書 | 依存先・依存する単位 |
| `NO_TEST_FILE`(手順書のある単位で、テスト観点があるのにテストのファイルが無い) | 軽微 | 段階8(両モード。`fix_document` 無し) | 単位の ID |
| `NO_SCHEMA_UNIT`(全体1件。文にテーブルを並べる) | 最重要 | モジュール一覧にスキーマの行が無ければ段階4 / 内部設計書、あれば段階7 / 実装計画書 | なし |
| `TABLE_WITHOUT_UNIT`(テーブルごと。上が出たときは出さない) | 軽微 | 段階7 / 実装計画書 | テーブル名 |

重要度は正解表 [`truth-e.md`](../../appendix/stage8-baseline/truth-e.md) の PR-1(最重要)・PR-5(中程度)・PR-3(軽微)どおり(着手時の相談 3)。

### 2. 組み込み

```python
# app/detailed_design/validation.py
def validate_procedure_doc(model, sources):
    ...
    if basis.mode == "simple":
        return issues + _simple_procedure_issues(basis, sources) + _coverage_issues(basis, matched)
    ...
    return issues + _coverage_issues(basis, matched)

def _coverage_sources(basis) -> tuple[list[ModuleRow], RowOf, list[str]]:
    # 詳細: 段階4の行・パスの完全一致・段階3の CRUD 図のテーブル
    # 簡易: 内部設計書のモジュール一覧の行・module_layer(層の行)・3.2節のテーブル
```

- 単位が無い(WBS が無いなど)ときは何も足さない(計画そのものの指摘で足りる)。
- 依存の判定では、段階7(WBS)の種別が「基盤」の単位を `exempt` に渡す。
- `_plan_finding` は、直す先が作業単位の計画の警告をモードで作り分ける(詳細は `fix_stage=7`、簡易は `fix_document="implementation_plan"`)。

### 3. 生成の指示・偽 LLM・フィクスチャ

- dev の DB の手順書は、テスト観点があってもテストのファイルを持たないものがほとんどだった(78件。[55-3](./Phase-55-3.md))。指示に1行足した。効果は Phase 58 で測る(この Phase では実 LLM を呼ばない)。
- 「指摘0件」を確かめていた既存のテスト(段階8の統合スモーク・偽 LLM の契約テストなど)が、新しい検証で落ちた。どれも「整った入力」のつもりのフィクスチャが、マイグレーションもテストのファイルも持たなかったため。テストの期待を変えずに、フィクスチャと偽物の側を整った形にした。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `validate_procedure_doc`(詳細設計モード) | pytest(`test_procedure_doc_validation.py`) | スタブ不要 ── 入力は `StageSources` の段階の内容だけの純粋関数のため | 依存(段階7)・テストのファイル(段階8。観点が無ければ出ない)・スキーマ(段階4 / 7)・テーブル(段階7) |
| `validate_procedure_doc`(簡易モード) | pytest(`test_simple_procedure_validation.py`) | スタブ不要 ── 4文書の本文と model だけから決まるため | 直す先の文書・層の一覧ではスキーマの行があるので実装計画書 |
| 生成の指示 | pytest(`test_procedure_doc_drafting.py`) | スタブ不要 ── 定数の文字列 | 両モードに同じ1行 |
| 偽 LLM・既存の統合スモーク | pytest(`test_fake_llm_simple_procedure.py`・`test_simple_procedure_stage.py`・`test_design_stage_procedure_doc.py`) | 無し ── 偽 LLM は検証される側。DB はインメモリ SQLite | 新しい検証でも指摘0件のまま |

```sh
cd devex-api/backend && uv run pytest tests/unit -k "procedure or wbs or plan_document"
```

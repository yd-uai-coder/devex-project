# Phase-45-4: 段階8が model を読む

## この章の目的

簡易モードの段階8(実装手順書)は、今まで内部設計書・実装計画書の md を毎回解析して作業単位と参照する設計を作っていた([Phase 31](../Phase-31/Phase-31-introduction.md))。文書が model を持つ版では md を解析せず model から読むようにする。作業単位は 45-2 の安定キーを持つようになり、Phase 46(簡易モードの変更の影響)が単位を指せる。model の無い以前の版は今までどおり md を解析する。

自動実装モード: on([introduction](./Phase-45-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/backend/` 配下(表は依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/simple_procedure/internal_design.py`](../samples/backend/app/detailed_design/simple_procedure/internal_design.py) | 更新 | `book_from_model`(内部設計書の model → `SimpleDesignBook`。md の解析と同じ形) |
| [`app/detailed_design/simple_procedure/__init__.py`](../samples/backend/app/detailed_design/simple_procedure/__init__.py) | 更新 | `book_from_model` を re-export |
| [`app/detailed_design/procedure_basis.py`](../samples/backend/app/detailed_design/procedure_basis.py) | 更新 | `procedure_basis(..., document_models)`、`_simple_basis` は model を優先、`_wbs_from_model` |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | 段階8の検証が `document_models` を渡す |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | 同上(単位の詳細・応答) |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | 同上(段階8の生成) |
| [`app/services/detailed_design_export_service.py`](../samples/backend/app/services/detailed_design_export_service.py) | 更新 | 同上(実装手順書の出力) |
| ── ここからテスト ── | | |
| [`tests/unit/test_simple_procedure_model.py`](../samples/backend/tests/unit/test_simple_procedure_model.py) | 新規 | model から読んだ土台と md から読んだ土台が同じ、壊れた model は md に戻る、タスクの無い model |

`StageSources.document_models`([Phase 38](../Phase-38/Phase-38-introduction.md))は、簡易モードでも表示中の4文書の model を既に詰めているので、サービスは渡すだけ。

## 要点の抜粋

### 1. model から読む

```python
# app/detailed_design/procedure_basis.py
def _simple_basis(documents, models) -> ProcedureBasis:
    internal = _parse(InternalDesignModel, models.get("internal_design"))
    book = (book_from_model(internal, external) if internal is not None
            else parse_internal_design(documents.get("internal_design", ""), external))
    plan_model = _parse(ImplementationPlanModel, models.get("implementation_plan"))
    wbs = (_wbs_from_model(plan_model) if plan_model is not None
           else parse_wbs(documents.get("implementation_plan", "")))
    plan = normalize_plan(wbs.plan, list(book.modules))   # 今までどおり
```

- 2つの文書は別々に判定する(片方だけ model を持つ版の組み合わせもありうる。どちらも再生成は4文書いっしょなので、普通は両方そろう)。
- `_wbs_from_model`: 構造化出力なので書式の指摘は無い。タスクが1つも無ければ、md の解析と同じく `WBS_MISSING`(最重要)を返す。
- 外部設計書の 2.6 は今までどおり md から読む(段階8が読むのは API の表だけで、Phase 37 から列は変わっていない)。

### 2. `book_from_model`

```python
# app/detailed_design/simple_procedure/internal_design.py
def book_from_model(model: InternalDesignModel, external_design: str = "") -> SimpleDesignBook:
```

DF の本文・テーブルの本文・3.2 の本文は、45-1 の md と同じ関数(`dataflow_body`・`table_body`・`data_model_body`)で組み立てる。DF に出てくるテーブルは今までと同じ `_mentioned` で拾う。同じ model の md を解析した結果と一致することをテストで確かめた。

### 3. 循環 import の回避

`app.documents.internal_design` の `__init__` は `assemble` 経由で `app.detailed_design`(の `__init__`)を読み、`app.detailed_design` の `__init__` は検証 → `procedure_basis` → `simple_procedure` を読む。`simple_procedure` が `app.documents.internal_design` の `__init__` を読むと、文書のパッケージを先に読んだときに循環する。そこで段階8の側は `app.documents.internal_design.model`・`.markdown` のモジュールを直接読む(`procedure_basis` も `implementation_plan.model` を直接読む)。理由は `simple_procedure/internal_design.py` の docstring に書いた。

## 設計判断

- **単位のキーが変わる**: model から読んだ単位は `U-001` のようなキーを持ち、以前の版(md)の単位は単位の ID をキーにする(`PlanUnit.key`)。以前の版で作った段階8の手順書は `unit_key` が単位の ID なので、再生成した実装計画書(model あり)ではキーで引けない。`relabel_units` は引けない手順書をそのまま残し、検証と一覧は単位の ID とタスク名で突き合わせる(今までと同じ)ので、並びとタスク名が変わらなければ手順書は付いたまま。次に作り直した手順書から新しいキーになる。
- **`procedure_basis` の引数を足す形にした**: `StageSources` は検証のモジュールにあり、`procedure_basis` から読むと循環するので、`document_models` を省略可の引数で受ける。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
| --- | --- | --- | --- |
| `book_from_model` | pytest(`test_simple_procedure_model.py`。同じ model の md を `parse_internal_design` で素で読んで比べる) | スタブ不要 ── 純粋関数(副作用なし)で、LLM・DB を呼ばないため。model は見本の構造化出力から生成と同じく組み立てる | DF のテーブル、本文の見出しは太字 |
| `procedure_basis`(簡易モード) | 同上 | スタブ不要 ── 同上 | model と md で単位(キーを除く)・参照する設計・環境・ルールが同じ、model の版だけ `U-001`、壊れた model は md に戻る、タスクの無い model は `WBS_MISSING` |
| 段階8の生成・検証・出力の経路(統合スモーク。#12) | pytest(既存の `test_fake_llm_simple_procedure.py`。45-3 で model を持たせた) | なし ── 偽 LLM は検証される側 | model を読む経路で、段階8の一覧・生成・承認・zip が今までどおり通る |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_simple_procedure_model.py tests/unit/test_fake_llm_simple_procedure.py -q
```

# Phase-56-1: model・必要なテストの一覧・md・検証

## この章の目的

テスト仕様書の中身を、LLM を呼ばない純粋関数だけで組み立てられるようにする。要件定義書・外部設計書の model から「必要なテストの一覧」を決め(`obligations`)、AI の下書きから model を組み(`assemble`)、API → 処理 → 単位の列を埋め(`links`)、md を作り(`markdown`)、決定的な検証の指摘を出す(`validation`)。生成(LLM の呼び出し)と保存は [56-2](./Phase-56-2.md)。

自動実装モード: on([introduction](./Phase-56-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/documents/test_spec/model.py`](../samples/backend/app/documents/test_spec/model.py) | 新規 | `CaseLevel`・`Viewpoint`・`VIEWPOINTS`・`ERROR_VIEWPOINT`・`SpecPolicy`・`SpecCase`・`TestSpecModel`(`cases`・`tests_for`)・`case_id` |
| [`app/documents/test_spec/links.py`](../samples/backend/app/documents/test_spec/links.py) | 新規 | `ApiLink`・`api_links`・`simple_links`・`detailed_links`(API → 処理 → 単位) |
| [`app/documents/test_spec/obligations.py`](../samples/backend/app/documents/test_spec/obligations.py) | 新規 | `Obligation`・`error_statuses`・`required_tests`・`obligation_rows`(必要なテストの一覧) |
| [`app/documents/test_spec/assemble.py`](../samples/backend/app/documents/test_spec/assemble.py) | 新規 | `CaseDraft`・`TestSpecDraft`・`api_key`・`build_model` |
| [`app/documents/test_spec/markdown.py`](../samples/backend/app/documents/test_spec/markdown.py) | 新規 | `render_test_spec`・`expected_cell`・`trace_rows` |
| [`app/documents/test_spec/validation.py`](../samples/backend/app/documents/test_spec/validation.py) | 新規 | `validate_test_spec`・`is_outdated`・`row_counts` |
| [`app/documents/test_spec/__init__.py`](../samples/backend/app/documents/test_spec/__init__.py) | 新規 | 上の6モジュールの re-export |
| ── ここからテスト ── | | |
| [`tests/fixtures/spec_documents.py`](../samples/backend/tests/fixtures/spec_documents.py) | 新規 | `spec_requirements`・`spec_external`・`spec_draft`(と API の定数) |
| [`tests/unit/test_test_spec_obligations.py`](../samples/backend/tests/unit/test_test_spec_obligations.py) | 新規 | 必要なテストの一覧 |
| [`tests/unit/test_test_spec_model.py`](../samples/backend/tests/unit/test_test_spec_model.py) | 新規 | 組み立てと API → 処理 → 単位 |
| [`tests/unit/test_test_spec_validation.py`](../samples/backend/tests/unit/test_test_spec_validation.py) | 新規 | 検証・古い・件数 |
| [`tests/unit/test_test_spec_markdown.py`](../samples/backend/tests/unit/test_test_spec_markdown.py) | 新規 | md |

パッケージの形は4文書(`app/documents/requirements/` など)と同じ。`__init__` の re-export:

```python
# app/documents/test_spec/__init__.py
from app.documents.test_spec.assemble import CaseDraft, TestSpecDraft, api_key, build_model
from app.documents.test_spec.links import ApiLink, api_links, detailed_links, simple_links
from app.documents.test_spec.markdown import render_test_spec
from app.documents.test_spec.model import (VIEWPOINTS, CaseLevel, SpecCase, SpecPolicy,
                                            TestSpecModel, Viewpoint, case_id)
from app.documents.test_spec.obligations import (Obligation, error_statuses, obligation_rows,
                                                  required_tests)
from app.documents.test_spec.validation import is_outdated, row_counts, validate_test_spec
```

依存の向きは `model` ← `links`・`obligations` ← `assemble` ← `validation`、`markdown` は `model` だけ。生成の入出力(`drafting`)は [56-2](./Phase-56-2.md) で足し、`__init__` からは re-export しない(4文書と同じく、サービスが `app.documents.test_spec.drafting` から直接 import する)。

## 要点の抜粋

### 1. model

```python
# app/documents/test_spec/model.py
CaseLevel = Literal["integration", "system"]
Viewpoint = Literal["正常", "異常", "境界", "セキュリティ", "非機能"]

class SpecCase(BaseModel):
    id: str; level: CaseLevel; target: str; viewpoint: Viewpoint
    precondition: str = ""; steps: str = ""; expected: str = ""
    design_gap: str = ""          # 期待結果に要るのに設計で決まっていないこと
    req_ids: list[str]; screens: list[str]
    functions: list[str]; units: list[str]   # コードが埋める(links)

class TestSpecModel(BaseModel):
    __test__ = False              # pytest に集めさせない
    policy: SpecPolicy; integration: list[SpecCase]; system: list[SpecCase]
    known_req_ids; req_priorities; must_fr_ids; known_apis; known_screens   # 生成時の写し
    inputs: dict[str, int | None]   # 生成時の入力の版(doc:<種類>・stage:<N>)
```

- 結合と総合を別の表にした(見本どおり。総合は前提・処理の列を持たない)。行の型は1つにして `level` で分ける(検証と対応表は両方を同じに扱うため)。
- ID(`IT-001`・`ST-001`)は生成のたびに並び順で振る。要件 ID や画面 ID と違い、後続の文書や段階から参照されないので、前の版から引き継がない。
- 名前が `Test` で始まるクラスを pytest はテストとして集めようとする(テストのモジュールに import したとき)。`TestSpecModel` には `__test__ = False` を置き、行・方針の型は `SpecCase`・`SpecPolicy`、ID の関数は `case_id` にした(`test_id` という関数はテストとして呼ばれてしまう)。

### 2. 必要なテストの一覧(テストパターンの戦略)

```python
# app/documents/test_spec/obligations.py
def required_tests(requirements: RequirementsModel | None,
                   external: ExternalDesignModel) -> list[Obligation]:
```

| 観点 | 技法 | 元 |
|---|---|---|
| 正常 | 同値分割(有効なクラスの代表) | API ごとに1件 |
| 異常 | エラーの一覧の網羅 | API の「エラー」欄の HTTP ステータス(4xx・5xx)ごと。欄に無ければ1件 |
| 境界 | 境界値分析 | 本文を持つ API(`BODY_METHODS` で、本文が「なし」でない) |
| セキュリティ | 認可 | パスに `{…}` を持つ API(ほかの利用者のリソースを指せる) |
| 非機能 | ― | 非機能要件ごとに総合テスト1件 |
| 正常 | 状態遷移(主な経路) | Must の画面を通す流れの総合テスト1件 |
| 正常 | ― | API にも画面にも結ばれていない Must の機能要件ごとに総合テスト1件 |

- どのテストを作るかを LLM に任せると、安いモデルではテストの数が縮む(Phase 51 の測定 (d): 指示を増やすと指摘が2〜3件に縮んだ)。そこでコードが一覧を決め、LLM は各項目の中身(前提・手順・期待結果)を書く([56-2](./Phase-56-2.md))。
- 一覧は**生成の誘導だけ**に使う。検証(`validation`)は一覧と照らさない(境界・認可の抜けは見ない、という 51-2 の決定を広げないため)。
- `obligation_rows` は生成の入力に渡す表の行(`種類|対象|観点|理由|要件|画面`)。

### 3. API → 処理 → 単位

```python
# app/documents/test_spec/links.py
def api_links(triggers: Iterable[tuple[str, str]], plan: PlanModel | None) -> dict[str, ApiLink]:
    # (処理ID, トリガー)の並びと計画から、endpoint_key → (処理ID, 単位の ID)
def simple_links(internal, plan)     # 内部設計書の処理別データフロー(DF-1)→ 実装計画書のタスク
def detailed_links(functions, plan)  # 段階1の処理(F-01)→ 段階7の単位
```

- 処理のトリガーが API の文字列(`POST /api/v1/x`)で、単位が処理 ID を持つ、という既存の形(段階1・段階7、簡易は内部設計書・実装計画書)をそのまま使う。照合は `endpoint_key`(パスの `{…}` の中身を問わない)。
- 簡易モードの実装計画書のタスクの「処理」はデータフローの ID なので、同じ `api_links` で両モードを扱える(`ImplementationPlanModel.to_plan()`)。

### 4. 組み立て

```python
# app/documents/test_spec/assemble.py
def build_model(draft: TestSpecDraft, *, requirements, external,
                links: Mapping[str, ApiLink], inputs: Mapping[str, int | None]) -> TestSpecModel:
```

- 結合テストの対象は、外部設計書の同じ API(`api_key` = `endpoint_key`)の書き方にそろえる(`post /api/v1/x/` → `POST /api/v1/x`)。外部設計書に無い API は書かれたまま残し、検証で指摘する。
- 要件 ID は `normalize_req_id`(`fr-1` → `FR-001`)、画面 ID は `split_ids` で大文字にそろえる。形の違う要件 ID は書かれたまま残す。
- 処理・単位は結合テストだけに埋める(総合テストは画面の流れ・非機能なので空)。

### 5. md と検証

- md の章立ては見本と同じ(1 方針 / 2 結合 / 3 総合 / 4 要件との対応)。`design_gap` があれば期待結果の後ろに「(**設計に無い**: …)」を付け、最後に件数を書く。要件との対応は Must の機能要件を先に(テストが無ければ「**テストが無い**」)、続けてテストが指すほかの要件。
- 検証の5つの指摘:

| コード | 重要度 | 内容 |
|---|---|---|
| `MUST_REQUIREMENT_UNTESTED` | major | テストの無い Must の機能要件 |
| `UNKNOWN_REQUIREMENT` | major | 要件定義書に無い要件 ID(写しが空なら見ない) |
| `UNKNOWN_API` | major | 外部設計書に無い API(結合テストの対象。写しが空なら見ない) |
| `UNKNOWN_SCREEN` | minor | 外部設計書に無い画面 ID(写しが空なら見ない) |
| `API_WITHOUT_ERROR_TEST` | minor | 異常系のテストが無い API(テストが0件の API も含む) |

- `is_outdated(model, current_inputs)`: 入力の版の写しが今と違えば古い。写しを持たない版は古いとみなさない。

## テスト観点

用語: SUT = テスト対象、ドライバ = SUT を呼ぶ側、スタブ = SUT が呼ぶ相手の代わり(初出は Phase 1。ここでは関係だけを書く)。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `required_tests`・`error_statuses`・`obligation_rows` | pytest(`test_test_spec_obligations.py`) | スタブ不要 ── 対象が純粋で、要件定義書・外部設計書の model だけから決まるため | エラー欄ごとの異常・欄が空でも異常1件・`{id}` のセキュリティ・本文なしは境界なし・NFR・API に無い Must・要件定義書が無いとき |
| `build_model`・`api_key`・`case_id` | pytest(`test_test_spec_model.py`) | 同上(下書きと上流の model だけから決まる) | 統合スモーク: 見本の下書きを1回組む。ID の付番・対象と ID の正規化・写し・処理と単位は結合だけ |
| `api_links`・`simple_links`・`detailed_links` | 同上 | 同上(計画とトリガーだけから決まる) | API でないトリガーは読まない・計画が無ければ単位は空・上流が無ければ空 |
| `validate_test_spec`・`is_outdated`・`row_counts` | pytest(`test_test_spec_validation.py`) | 同上(model だけから決まる) | 見本で Must と異常系の2つ・重要度・存在しない参照3つ・写しが空なら照合しない・古い |
| `render_test_spec`・`trace_rows`・`expected_cell` | pytest(`test_test_spec_markdown.py`) | 同上 | 章の順・結合の行・設計に無い・対応表の順と「テストが無い」・空の model |

テストの入力は `tests/fixtures/spec_documents.py` の見本(Must 2つのうち FR-002 は API にも画面にも無い、API 3つのうち削除は本文なし・`{id}` あり・エラー欄なし)。どの関数も純粋なので、テストダブルは要らない。モードの違い(簡易 / 詳細)は `links` の入り口2つに押し出したので、`build_model` は対応の辞書を受け取るだけで済む。

```sh
cd devex-api/backend && uv run pytest tests/unit -k test_spec
```

# Phase-28-1: 参照の展開と、単位の参照の API(BE)

## この章の目的

Phase 27 の `unit_refs` が導いた参照(段階5の手順・段階6の関数・段階4のモジュール)を、承認済みの設計の該当箇所の md に展開する。段階7の 07章 横断事項と開発環境も、共通の節として添える。展開はバックエンドの純粋関数1か所に置き、28-2 の生成の入力と、28-4 の画面の単位の詳細(読み取り専用の API)が同じものを使う。

自動実装モード: on([introduction](./Phase-28-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/document/markdown.py`](../samples/backend/app/detailed_design/document/markdown.py) | 更新 | 05 の手順の表(`procedure_table`)と 06 の仕様と擬似フロー(`logic_spec`)を切り出し、詳細設計書の組み立てと参照の展開で共有する |
| [`app/detailed_design/procedure_doc.py`](../samples/backend/app/detailed_design/procedure_doc.py) | 更新 | `find_unit`(段階7の単位を ID で引く) |
| [`app/detailed_design/procedure_doc_refs.py`](../samples/backend/app/detailed_design/procedure_doc_refs.py) | 新規 | `DesignBook`・`ExpandedRef`・`UnitContext`、`design_book`・`ref_label`・`expand_ref`・`crosscutting_section`・`environment_section`・`unit_context`(純粋) |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | `find_unit` の re-export |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `DesignUnitNotFoundError`(404) |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `DesignRefRead`・`UnitContextRead` |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `unit_context`(段階8が開いているか・単位があるかを確かめて展開を返す) |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | `GET /design-stages/units/{unit_id}/context` |
| ── ここからテスト ── | | |
| [`tests/unit/test_procedure_doc_refs.py`](../samples/backend/tests/unit/test_procedure_doc_refs.py) | 新規 | 展開の順・見出し・05・06 の表との一致・設計に無い参照・基盤の単位・`find_unit` |
| [`tests/unit/test_design_stage_procedure_doc.py`](../samples/backend/tests/unit/test_design_stage_procedure_doc.py) | 更新 | 参照の API(正常・開いていない段階8・段階7に無い単位) |

`procedure_doc_refs.py` は `procedure_doc.py` を import するので、`procedure_doc.py` の `find_unit` と合わせて、この順に写す。`__init__.py` からは `procedure_doc_refs` を re-export しない(使うのはサービスと 28-2 の下書きだけ。`document` を親から re-export しないのと同じ理由)。

## 要点の抜粋

```python
# app/detailed_design/procedure_doc_refs.py
@dataclass(frozen=True)
class DesignBook:             # 展開に使う、承認済みの段階1・4〜7の内容
    functions: Mapping[str, FunctionRow]      # 処理ID → 機能一覧の行
    procedures: Mapping[str, Procedure]       # 処理ID → 手順
    logics: Mapping[str, LogicRow]            # logic_key → 関数の詳細
    logic_ids: Mapping[str, str]              # logic_key → L-ID(05 の「→ 詳細: L-01」にも使う)
    modules: Mapping[str, ModuleRow]          # パス → モジュール一覧の行
    plan: PlanModel                           # 段階7

@dataclass(frozen=True)
class ExpandedRef:            # DesignRef + 見出し + md(設計に無い参照は None)
    kind; key; resolved; via; label: str; markdown: str | None

@dataclass(frozen=True)
class UnitContext:
    unit: PlanUnit
    refs: tuple[ExpandedRef, ...]
    crosscutting: str         # 「### 07章 横断事項」の表(無ければ空)
    environment: str          # 「### 段階7 開発環境」(無ければ空)

def expand_ref(ref: DesignRef, book: DesignBook) -> str | None:
    # procedure: 見出し + トリガー + procedure_table(05 と同じ表)+ 注記
    # logic:     見出し(L-ID つき)+ 呼ばれる手順(via)+ logic_spec(06 と同じ形)
    # module:    「- 段階4 `path`(層): 責務 / 依存先: …」の1行
def unit_context(unit: PlanUnit, stages) -> UnitContext   # unit_refs → expand_ref + 共通の節
```

```python
# app/services/design_stage_service.py
async def unit_context(self, project, unit_id) -> UnitContextRead:
    _ensure_detailed(project); _ensure_open(views[PROCEDURE_DOC_STAGE])
    plan = PlanModel.model_validate(sources.stages.get(PLAN_STAGE) or {})
    unit = find_unit(plan, unit_id)          # 無ければ DesignUnitNotFoundError(404)
    context = unit_context(unit, sources.stages)
```

## 設計判断

### 展開はバックエンドの1か所(Claude の判断)

展開を使うのは、手順書の生成の入力(28-2)、画面の単位の詳細(28-4)、AI 向けの出力(Phase 30。zip と画面の「AI 向けにコピー」)である。[25-1](../Phase-25/Phase-25-1.md) 決定6は「zip と画面で中身は同じ」と決めている。FE にもデモの `expandRef` を移すと、同じ書式を2つの言語で持つことになり、ずれた時点で「画面で見た設計」と「AI に渡した設計」が食い違う。そこで展開はバックエンドだけに置き、画面へは読み取り専用の API(`GET /design-stages/units/{unit_id}/context`)で渡す。中身は承認済みの段階1〜7から毎回導き、保存しない(保存すると、設計を直すたびに作り直す必要がある)。

### 05・06 の表を切り出して共有する(#17)

手順の表と関数の仕様は、詳細設計書の md(`document/markdown.py` の `_procedures`・`_logics`)がすでに組み立てている。同じ表をもう一度書くと、列の増減(Phase 29 で段階5に種別の欄が増える予定)で2か所を直すことになる。この Phase の展開という実在の消費者があるので、`procedure_table`・`logic_spec` として切り出し、両方から呼ぶ。詳細設計書の md の中身は変わらない(既存の組み立てのテストで確かめた)。

### 設計に無い参照は展開しない

解決できない参照(段階5に手順が無い処理・段階6に詳細の無い関数・段階4に無いモジュール)は `markdown=None` にし、見出しだけを返す。何が足りないかは Phase 27 の検証(`NO_PROCEDURE` など)が指摘するので、展開の側では理由を書かない。画面はこれを赤いバッジ(押せない)で、下書きの入力は「設計にありません」の1行で示す。

### 共通の節(07章・開発環境)

基盤の単位は処理を持たず、参照が空になる。それでも手順書を書く根拠が要るので、段階7の 07章 横断事項と開発環境を、どの単位にも共通の節として添える。単位ごとの参照(`DesignRef`)には入れない(Phase 27 の検証の対象ではないため)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `unit_context`・`expand_ref`・`ref_label`・`crosscutting_section`・`environment_section`・`design_book`・`find_unit` | pytest(`test_procedure_doc_refs.py`) | スタブ不要 ── 純粋で、段階の内容(dict)だけから決まり、DB や LLM を呼ばないため | 第一テストの統合スモーク: 機能の単位の参照が手順 → 関数 → モジュールの順で、見出しに処理名・L-ID が入る。手順・関数の md は `procedure_table`・`logic_spec` の出力を含む(05・06 と同じ表)。段階5・6が空なら手順は `markdown=None`、関数の参照は導かれない。基盤の単位は参照が空で共通の節だけ |
| `DesignStageService.unit_context`・ルート | pytest(`test_design_stage_procedure_doc.py`) | スタブ不要 ── DB はインメモリ SQLite(fixture)で、LLM を呼ばないため | 段階8の行が無くても展開を返す。段階7が未承認なら `DesignStageLockedError`、段階7に無い単位は `DesignUnitNotFoundError` |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_procedure_doc_refs.py tests/unit/test_design_stage_procedure_doc.py
```

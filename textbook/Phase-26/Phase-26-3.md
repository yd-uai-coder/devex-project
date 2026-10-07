# Phase-26-3: 実装計画の出力 ── 単位の表と処理の割り当て(BE)

## この章の目的

実装計画の md・HTML(zip の `implementation_plan.md`・`.html`)を、26-1 の単位の形に合わせる。マイルストーンごとの表を「区分の表」から「単位の表」(ID・種別・タスク・処理・依存・モジュール・環境・設定のファイル(例))にし、「処理の割り当て」をマイルストーンの M-ID から単位の ID に改める。HTML では単位の行に ID のアンカーを置き、依存と割り当ての ID から移れるようにする。

自動実装モード: on([introduction](./Phase-26-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/document/views.py`](../samples/backend/app/detailed_design/document/views.py) | 更新 | `UNIT_HEADERS`・`UNIT_KIND_LABELS`(md と HTML で同じ表の列と種別の表示)、`FunctionPlan.units`・`function_plans`(処理ごとの単位の ID) |
| [`app/detailed_design/document/markdown.py`](../samples/backend/app/detailed_design/document/markdown.py) | 更新 | `to_plan_markdown` の単位の表と、マイルストーンの処理の導出 |
| [`app/detailed_design/document/html.py`](../samples/backend/app/detailed_design/document/html.py) | 更新 | `_milestone`(単位の表、行ごとの ID のアンカー、依存のバッジ)・`to_plan_html` |
| ── ここからテスト ── | | |
| [`tests/unit/test_detailed_design_plan_document.py`](../samples/backend/tests/unit/test_detailed_design_plan_document.py) | 更新 | 単位の表の行・処理の割り当て・HTML のアンカーとバッジ・未計画の印 |
| [`tests/unit/test_detailed_design_plan_export.py`](../samples/backend/tests/unit/test_detailed_design_plan_export.py) | 更新 | zip の実装計画の処理の割り当てが単位の ID になること |

## 要点の抜粋

```python
# app/detailed_design/document/views.py
UNIT_HEADERS = ("ID", "種別", "タスク", "処理", "依存", "モジュール", "環境・設定のファイル(例)")
UNIT_KIND_LABELS = {"feature": "機能", "base": "基盤"}

@dataclass(frozen=True)
class FunctionPlan:
    function_id: str; name: str
    units: tuple[str, ...]      # その処理を書いた単位の ID(空なら未計画)。旧 milestones
```

```python
# app/detailed_design/document/html.py
def _milestone(index, milestone) -> str:
    ids = [task_id(index, t) for t in range(len(milestone.tasks))]
    rows = [[mono(uid), 種別, タスク, 処理, "".join(badge(d) for d in t.depends_on), モジュール, 環境・設定]...]
    row_attrs = [f' id="{anchor(uid)}"' for uid in ids]     # m-01-t02 へ移れる
    return 見出し(M-ID のアンカー) + table(UNIT_HEADERS, rows, row_attrs=row_attrs)
```

md の表は、空の欄を「—」で出す(`md_cell` の既存の規則)。

## 設計判断

### 表の列と種別の表示は views に1回だけ書く

md と HTML は同じ表を出す(Phase 22 からの形)。列の見出しと「機能/基盤」の表示を `views.py` に置き、`markdown.py`・`html.py` は書き方だけを持つ。画面(`devex-ui` の `labels.ts` の `UNIT_KIND_LABELS`)とも同じ言葉にした。

### 処理の割り当ては単位の ID で

Phase 23 では処理ごとに M-ID を出していた。手順書は単位ごとに作るので、どの単位がその処理を実装するかが分かる方がよい。複数の単位にある処理は、ID を並べて出す(検証では `DUPLICATE_FUNCTION` の警告。26-1)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `to_plan_markdown`・`to_plan_html`・`function_plans` | pytest | スタブ不要。純粋(段階の内容は fixture の `sample_document_source` で渡す) | 第一テストの統合スモーク。単位の表の行(基盤と機能、依存、空の欄の「—」)、処理の割り当ての単位の ID、M-ID と単位の ID のアンカーとバッジ、未計画の印、エスケープ |
| `UNIT_HEADERS`・`UNIT_KIND_LABELS` | pytest | スタブ不要。同上 | md の見出しの行と、HTML の種別の表示 |
| `DetailedDesignExportService`(zip) | pytest + インメモリ SQLite | スタブ不要。図は描かない(`render=False` の既存の形) | zip の `implementation_plan.md` の処理の割り当てが単位の ID |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_detailed_design_plan_document.py tests/unit/test_detailed_design_plan_export.py
# 14 passed
```

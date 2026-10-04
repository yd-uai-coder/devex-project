# Phase-23-2: 組み立ての拡張 ── 07章と実装計画(BE)

## この章の目的

Phase 22 の組み立て(純粋関数)に、段階7の出力を足す。

- 詳細設計書に **07 横断事項** の章を足す。段階7が承認済みなら表を書き、それ以外は「未承認」と書く(01〜06章と同じ規則)。
- 実装計画を、詳細設計書とは別の md・HTML(`to_plan_markdown`・`to_plan_html`)にする(着手時の決定4)。
- `to_markdown`・`to_html` に `chapters` 引数を足し、章を絞れるようにする。段階7の生成は、01〜06章だけを入力にする(23-4)。

学習モード([introduction](./Phase-23-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/document/source.py`](../samples/backend/app/detailed_design/document/source.py) | 更新 | **コア** | `CHAPTERS` に `Chapter(7, "07", "横断事項")`、`DocumentSource.plan`、`document_source` が段階7の model を渡す |
| [`app/detailed_design/document/views.py`](../samples/backend/app/detailed_design/document/views.py) | 更新 | **コア** | `FunctionPlan`・`function_plans`(処理ごとの M-ID。実装計画の「処理の割り当て」) |
| [`app/detailed_design/document/markdown.py`](../samples/backend/app/detailed_design/document/markdown.py) | 更新 | 定型 | `to_markdown(source, chapters=CHAPTERS)`、07章の本文、`to_plan_markdown` |
| [`app/detailed_design/document/html.py`](../samples/backend/app/detailed_design/document/html.py) | 更新 | 定型 | `to_html(source, chapters=CHAPTERS)`、`_page`(ページの外枠の共通化)、07章の本文、`to_plan_html` |
| [`app/detailed_design/document/__init__.py`](../samples/backend/app/detailed_design/document/__init__.py) | 更新 | 定型 | `to_plan_html`・`to_plan_markdown`・`FunctionPlan`・`function_plans` の re-export |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `document_stage_models` に段階7、`create_document_project` を `create_stage7_project`(段階1〜6)と新しい `create_document_project`(段階1〜7)に分ける |
| [`tests/unit/test_detailed_design_plan_document.py`](../samples/backend/tests/unit/test_detailed_design_plan_document.py) | 新規 | 定型 | 07章、`chapters` 引数、処理の割り当て、実装計画の md・HTML |
| [`tests/unit/test_detailed_design_document_source.py`](../samples/backend/tests/unit/test_detailed_design_document_source.py) | 更新 | 定型 | 章が 01〜07 になったこと |
| [`tests/unit/test_detailed_design_document_markdown.py`](../samples/backend/tests/unit/test_detailed_design_document_markdown.py) | 更新 | 定型 | 見出しに「07 横断事項」が加わったこと |

## 要点の抜粋

```python
# app/detailed_design/document/source.py
CHAPTERS = (Chapter(1, "01", "機能(処理)一覧"), ..., Chapter(6, "06", "処理ロジックの詳細"),
            Chapter(7, "07", "横断事項"))                 # Phase 23

class DocumentSource:
    ...
    logics: LogicModel | None = None
    plan: PlanModel | None = None                        # 段階7(承認していなければ None)
```

```python
# app/detailed_design/document/views.py
@dataclass(frozen=True)
class FunctionPlan:
    function_id: str; name: str; milestones: tuple[str, ...]   # 空なら計画の漏れ

def function_plans(plan: PlanModel, function_list: FunctionListModel | None) -> list[FunctionPlan]
```

```python
# app/detailed_design/document/markdown.py
def to_markdown(source: DocumentSource, chapters: Sequence[Chapter] = CHAPTERS) -> str
def to_plan_markdown(source: DocumentSource) -> str
#   # 実装計画書: <題>
#   ## 1 マイルストーン(一覧の表 → ### M-01 名前(優先度)ごとのタスクの表)
#   ## 2 処理の割り当て(処理ID | 名称 | マイルストーン。無ければ「未計画」)
#   ## 3 開発環境・事前準備
#   ## 4 想定リスクと対策
```

```python
# app/detailed_design/document/html.py
def to_html(source, chapters=CHAPTERS) -> str:  ... return _page(f"詳細設計書: {title}", header + body)
def _page(title: str, content: str) -> str      # STYLE と SCRIPT を持つ自己完結の1ページ(共通)
def to_plan_html(source) -> str                  # M-ID はアンカー(m-01)を持ち、バッジから移れる
```

## 設計判断

### 07 は詳細設計書の中、実装計画は別のファイル

| 案 | 採否 | 理由 |
|---|---|---|
| 07 は詳細設計書の章、実装計画は `implementation_plan.{md,html}` | **採用** | 07 は設計の一部(全処理に共通する実装の方針)で、実装計画は進め方の文書。簡易モードでも実装計画書は別の文書 |
| 実装計画も詳細設計書の 08 章にする | 不採用 | 設計と計画が1冊に混ざる。計画だけを見直して配る場面に向かない |

2つは同じ段階7から作る。そのため、どちらも `DocumentSource.plan` を入力にし、段階7が未承認なら、どちらも「未承認」になる。

### 章を絞る `chapters` 引数

段階7の生成は、承認済みの段階1〜6を入力にする(`STAGE_INPUTS[7]`)。組み立てた md をそのまま渡すと、まだ作っていない07章が「未承認」として入ってしまう。入力に余計な文が混ざるのを避けるため、章を絞れるようにした。

既定は全章にしたので、既存の呼び出し(出力サービス)は変わらない。

### 「処理の割り当て」は保存せず導く

実装計画には、処理ID ごとに、どのマイルストーンで作るかの表を入れた。マイルストーンの `function_ids` とタスクの `function_ids` から、`function_plans` で導く。どこにも書かれていない処理は「未計画」と出る。

検証の `UNPLANNED_FUNCTION`(23-1)と同じ情報を、成果物の上でも確かめられる。M-ID は保存しないので(23-1)、この表も保存しない。

### ページの外枠を `_page` に共通化

詳細設計書と実装計画は、同じ CSS(ライト・ダーク)とスクリプトを使う。HTML のページを組み立てる部分を `_page(title, content)` に切り出し、両方から呼ぶ。

スクリプトはタブとアンカーの移動を受け持つ。実装計画にはタブが無いが、M-ID のバッジを押したときの強調に、同じ仕組みを使える。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `document_source`・`to_markdown`・`to_plan_markdown`・`to_plan_html` | pytest | スタブ不要。純粋(副作用なし)で、外部依存を呼ばないため | 第一テストの統合スモーク(段階7が承認済みなら、07章と実装計画ができる) |
| 07章(`to_markdown`・`to_html`) | pytest | スタブ不要。同上 | 横断事項の表。段階7がレビュー中なら「未承認」 |
| `chapters` 引数 | pytest | スタブ不要。同上 | 01〜06章だけにすると、07 が出ない(md・HTML とも) |
| `function_plans` | pytest | スタブ不要。同上 | 機能一覧の順。計画に無い処理は空のタプル |
| `to_plan_markdown` | pytest | スタブ不要。同上 | 見出しの並び、表の行、横断事項を書かないこと、未承認なら1文だけ |
| `to_plan_html` | pytest | スタブ不要。同上 | 文字のエスケープ、M-ID のリンク先のアンカーがあること、未計画の印、未承認 |
| `CHAPTERS`(`test_detailed_design_document_source.py`)・見出し(`..._markdown.py`) | pytest | スタブ不要。同上 | Phase 22 のテストを、01〜07章に改めた |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_detailed_design_plan_document.py tests/unit/test_detailed_design_document_source.py \
  tests/unit/test_detailed_design_document_markdown.py tests/unit/test_detailed_design_export.py
# すべて成功(test_detailed_design_plan_document.py は 10 passed)
```

`test_detailed_design_export.py`(Phase 22)も、この章で一緒に流す。fixture の `create_document_project` を段階1〜7の承認に改めたので、07章が加わっても「未承認」の文字は出ない。

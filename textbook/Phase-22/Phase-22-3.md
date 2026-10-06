# Phase-22-3: md の組み立て(BE)

## この章の目的

`DocumentSource` と 22-2 の導出から、詳細設計書の Markdown(01〜06章)を書き出す。md は差分を取る・AI に読ませるための形で、章の間のリンクと生の HTML を持たず、ID を本文に書く。

自動実装モード: on([introduction](./Phase-22-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/document/markdown.py`](../samples/backend/app/detailed_design/document/markdown.py) | 新規 | 定型(リンクを持たない判断はコア) | `to_markdown`・`md_cell`・`md_table`・`image`、章ごとの書き出し、`UNAPPROVED_TEXT`・`SKIPPED_TEXT`・`CRUD_LEGEND` |
| [`app/detailed_design/document/__init__.py`](../samples/backend/app/detailed_design/document/__init__.py) | 更新 | 定型 | `to_markdown` の re-export を追記 |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `sample_document_source(states?, models?)`(全章がそろう入力。図は小さな SVG)・`DOCUMENT_DATA_ITEM_ID` |
| [`tests/unit/test_detailed_design_document_markdown.py`](../samples/backend/tests/unit/test_detailed_design_document_markdown.py) | 新規 | 定型 | 章の並び、画像の参照、ID を本文に書くこと(リンク・生の HTML が無い)、未承認と省略 |

## 要点の抜粋

```python
# app/detailed_design/document/markdown.py
UNAPPROVED_TEXT = "未承認(段階{stage}が承認されていません。承認すると、この章が組み立てられます)"
SKIPPED_TEXT = "省略(段階6を飛ばしました)"

def md_cell(text) -> str:      # 改行は空白に、| は \| に、空は「—」(<br> は生の HTML なので使わない)
def image(diagram) -> str:     # "![データフロー図: reservations](diagrams/dfd_reservations.svg)"

def to_markdown(source) -> str:
    lines = [f"# 詳細設計書: {source.title}", ""]
    for chapter in CHAPTERS:
        lines += [f"## {chapter.number} {chapter.title}", ""]
        lines += _chapter_body(source, chapter)     # 未承認 / 省略 / _BODIES[段階](source)
```

| 章 | 中身 |
|---|---|
| 01 | 機能一覧の表(処理ID/名称/種別/トリガー/関連画面/機能グループ/概要) |
| 02 | 機能グループごとの DFD の画像、データ辞書(データ項目/フィールド/使う処理)、処理概要表 |
| 03 | ER の画像、テーブルごとの定義(列/型/キー/NULL/制約/説明)、CRUD 図と記号の凡例 |
| 04 | 構成図の画像、モジュール一覧(`all_functions` は「全処理」) |
| 05 | 5.0 索引、5.0.1 関与表、5.N 処理ごとの手順の表(関数の欄に「→ 詳細: L-01」)と注記 |
| 06 | 6.0 逆引き、6.N 関数ごとの「呼ばれる手順」・項目の表・擬似フロー |

## 設計判断

### ID は本文に書き、リンクにしない

md のビューアは、生の HTML のアンカー(`<a id>`)を消したり、日本語の見出しから作るアンカーの規則がまちまちだったりする(Phase 14 の決定)。md では「→ 詳細: L-01」「呼ばれる手順: F-01#1」と ID を書き、読み手が検索で辿る。表のセルの改行も `<br>` にせず空白にした(生の HTML を書かない)。

### 図は相対パスの画像で載せる

画像の参照(`![題](diagrams/x.svg)`)は章の間のリンクではなく、zip の中の図ファイルを指すだけ。ステージ3の zip(内部設計書の md)と同じ形で、md のビューアで zip を展開して開けば図が見える。リンクを持たない規則とは矛盾しない。

### CRUD の記号は印で書き分ける

md には色が無いので、22-2 の3分類を印で書く(印なし / `+` / `*`)。表の下に凡例を置く。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `md_cell`・`md_table` | pytest | スタブ不要。純粋関数(副作用なし)で、外部依存を呼ばないため | `|` と改行で表が崩れない |
| `to_markdown` | pytest | スタブ不要。図は描画済みの値を fixture の `sample_document_source` で渡す(描画はサービス層の責務) | 第一テストの統合スモーク(全章の見出しが順に並ぶ)。画像の参照、「→ 詳細: L-01」、`<a `・`<br>`・`](#` が無いこと、未承認と省略 |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_detailed_design_document_markdown.py
# 5 passed
```

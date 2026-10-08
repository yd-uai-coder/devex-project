# Phase-30-3: HTML 1枚

## この章の目的

`implementation_procedure/implementation_procedure.html` を組み立てる。詳細設計書・実装計画と同じ自己完結の1ページで、単位をタブにせず縦に並べる(着手時の決定2)。中身は 30-2 の md と同じで、読むための形にする。

自動実装モード: on([introduction](./Phase-30-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/document/html.py`](../samples/backend/app/detailed_design/document/html.py) | 更新 | 1ページの枠 `_page` を公開名 `page` にした(詳細設計書・実装計画・実装手順書で共有) |
| [`app/detailed_design/procedure_output/html.py`](../samples/backend/app/detailed_design/procedure_output/html.py) | 新規 | `to_procedure_html`・`PROCEDURE_UNAPPROVED_HTML` |
| [`app/detailed_design/procedure_output/__init__.py`](../samples/backend/app/detailed_design/procedure_output/__init__.py) | 更新 | `to_procedure_html` を re-export |
| ── ここからテスト ── | | |
| [`tests/unit/test_procedure_html.py`](../samples/backend/tests/unit/test_procedure_html.py) | 新規 | 自己完結・決定的・アンカー・図の SVG・エスケープ・未承認・`page` |

## 要点の抜粋

```python
# app/detailed_design/procedure_output/html.py
def to_procedure_html(source) -> str:
    # 未承認なら header + 「未承認 ── 段階8が承認されていません…」だけ
    # 1 実装概要 / 2 実装前提・制約 / 3 単位の一覧 / 4 未定義の一覧 / 5 完了条件 / 6 単位ごとの手順書
    # 単位の節は <article id="m-01-t02">。一覧・依存・未定義の単位の ID は badge(…) で移る
```

`html.py` の import 先: `document.html`(`badge`・`e`・`mono`・`page`・`table`)、`document.views`(`UNIT_KIND_LABELS`・`anchor`)、`procedure_output.markdown`(30-2 の定数と `file_kind_label`)、`procedure_output.source`(30-1)。依存の向きは source ← markdown ← html(md と HTML で見出し・列・完了条件の文言を共有するため、HTML が md の定数を読む)。

## 設計判断

### 単位を縦に並べる(着手時の決定2)

詳細設計書の 05 はタブだが、単位は10件を超えることが多く、タブの列が長くなる。縦に並べればページ内の検索と印刷で全単位を通して読める。実装計画の HTML と同じく、一覧の単位の ID からその単位の手順書へアンカーで移る形にした。

- 手順書の無い単位の ID はバッジにしない(移る先が無い)。
- 単位の手順書の枠は `.panel` を使わず、スタイルを直接書いた。`.panel` はタブ用で、スクリプトが有効なとき選ばれていないものを隠すため。

### 参照の見出しのバッククォート

参照の見出し(`ref_label`)は md 用で、パスを `` ` `` で囲む。HTML ではそのまま見えてしまう(ブラウザで描いて見つけた)ので、HTML の側で `` ` `` を除いてから書く。

### `_page` を公開名にした

詳細設計書と実装計画で共有していた `_page` を、別パッケージの実装手順書からも使うため `page` にした(#17: 消費者は `to_procedure_html`)。CSS とスクリプトは同じものを使う。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `to_procedure_html`・`page` | pytest(`test_procedure_html.py`) | スタブ不要 ── `ProcedureOutputSource`(fixture)だけから決まる純粋関数のため | 第一テスト(統合スモーク): 自己完結(外部のスクリプト・スタイルを読まない)・同じ入力で同じ出力・6節のアンカー。手順書のある単位だけバッジで移れる。手順の図の SVG を埋め込む。参照の見出しの `` ` `` を除く。文字はエスケープする。未承認なら節も単位も出さない |

# Phase-22-4: HTML の組み立て(BE)

## この章の目的

`DocumentSource` と 22-2 の導出から、詳細設計書の HTML(01〜06章)を書き出す。HTML は読むための形で、ブラウザで開けばリンクが必ず動く自己完結の単一ファイルにする。

- レビュー画面と同じタブ(02 の DFD、05 の処理、06 の関数)と、双方向のリンク(バッジ)を持つ。
- スクリプトが無効でも、全件を並べて表示し、アンカーで飛べる。
- 図は SVG を中に入れる。

学習モード([introduction](./Phase-22-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/document/html.py`](../samples/backend/app/detailed_design/document/html.py) | 新規 | 定型(SVG の扱いとアンカーの規則はコア) | `to_html`、`STYLE`・`SCRIPT`、`e`・`badge`・`mono`・`table`・`tabs`・`panel`・`figure`、章ごとの書き出し |
| [`app/detailed_design/document/__init__.py`](../samples/backend/app/detailed_design/document/__init__.py) | 更新 | 定型 | `to_html` の re-export を追記 |
| ── ここからテスト ── | | | |
| [`tests/unit/test_detailed_design_document_html.py`](../samples/backend/tests/unit/test_detailed_design_document_html.py) | 新規 | 定型 | 自己完結、全リンクの行き先がある、05↔06 の双方向、エスケープと SVG、未承認と省略 |

## 要点の抜粋

```python
# app/detailed_design/document/html.py
def badge(identifier, label=None) -> str:   # <a class="badge" href="#f-01-1">F-01#1</a>
def figure(diagram) -> str:                 # SVG はそのまま埋め込む(下の設計判断)

def to_html(source) -> str:
    # <!doctype html> ... <style>{STYLE}</style> ... 目次 + 01〜06章 ... <script>{SCRIPT}</script>
```

| リンク | 出す場所 → 行き先 |
|---|---|
| 01 の処理ID | 05 に手順がある処理だけ → 05 の処理のタブ(`#f-01`) |
| 05 の索引 | 処理ID → 処理のタブ、詳細(06) → 06 の関数のタブ(`#l-01`) |
| 05 の関与表のセル | 手順番号 → 手順の行(`#f-01-1`) |
| 05 の手順の行 | 「詳細 L-01 ↓」→ 06 の関数のタブ |
| 06 の逆引き・各項目 | 「↑ F-01#1」→ 05 の手順の行 |

`SCRIPT` はデモ・出力見本と同じ動き: 読み込み時に `js` のクラスを付けて各タブの先頭だけを見せる。`hashchange` で行き先の要素を探し、それが入っているタブを開いて強調し、スクロールする。同じアンカーをもう一度押したときも動かし直す。

## 設計判断

### 文字はすべてエスケープし、SVG だけそのまま入れる

利用者が書いた名前・説明は `html.escape` で書く(スクリプトの埋め込みを防ぐ)。ただし図の SVG は、自前の出力エンジン(`app/uml/export/svg.py`)が要素の名前などをエスケープ済みで書いた文字列である。もう一度エスケープすると、図ではなく SVG のソースが文字として表示される。そこで `figure` だけは SVG をそのまま埋め込む。SVG の出どころがエンジンに限られることが、この例外の前提である(利用者が SVG を直接渡す経路は無い)。

### スクリプトに頼らない

タブを隠すのは `js` のクラスが付いたときだけ(`.js .panel:not(.active) { display:none; }`)。スクリプトが無効な環境(メールのプレビュー・一部のビューア)では全件が並び、アンカーのリンクはそのまま飛べる。

### アンカーの規則

アンカーは 22-2 の `anchor`(小文字、`#` → `-`)で ID から作る。手順の行は `id="f-01-1"`、処理のタブは `id="f-01"`、関数のタブは `id="l-01"`。DFD のタブは機能グループ名(日本語・空白を含みうる)を使わず、並びの番号(`dfd-1`)にした。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `to_html` | pytest(標準の `html.parser` でアンカーとリンクを集める) | スタブ不要。純粋関数(副作用なし)で、外部依存を呼ばないため | 第一テストの統合スモーク(doctype・style・script があり、外部の src/href が無い)。すべての `href="#…"` の行き先がある。05↔06 のバッジ、分岐の行の印、未承認と省略 |
| `badge`・`figure` | pytest | スタブ不要。同上 | 名前の `<b>` はエスケープされ、SVG はそのまま |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_detailed_design_document_html.py
# 5 passed
```

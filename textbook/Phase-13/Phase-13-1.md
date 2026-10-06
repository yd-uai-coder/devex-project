# Phase-13-1: アンカーの解析・挿入・置換と、記法ごとの要素表(`app/uml/sync/`、純粋)

## この章の目的

承認済みの UML 図を内部設計書へ反映するための、純粋関数を作る。決めることは2つある。

- **どこに置くか**(`anchors.py`): 見出しの固定形式を手がかりに、図ごとの範囲をアンカーコメントで区切って差し込む。同じ図のアンカーが既にあれば、その位置のまま置き換える。
- **何を置くか**(`tables.py`): 記法ごとの要素表(component: 名称/種別/説明/依存先、ER: カラムと関連、DFD: 元/データ/変換/先とデータ項目)。

DB も HTTP も使わないので、13-2 以降のサービスは、これらを呼んで結果を保存するだけになる。

自動実装モード: on([introduction](./Phase-13-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/generation/sections.py`](../samples/backend/app/uml/generation/sections.py) | 更新 | 定型 | `find_section_heading_end`・`find_dfd_heading_end`(見出し行の直後の位置を返す) |
| `app/uml/sync/anchors.py` | 新規 | **コア** | `AnchorBlock`、`render_block`、`parse_anchors`、`find_block`、`upsert_block`(13-4 で `ImageLink`・`with_image_links` を足す) |
| `app/uml/sync/tables.py` | 新規 | **コア** | `DataItemSummary`、`render_element_table`、`render_block_body` |
| `app/uml/sync/__init__.py` | 新規 | 定型 | 公開名の re-export(13-3・13-4 で追記) |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_generation_sections.py`](../samples/backend/tests/unit/test_uml_generation_sections.py) | 更新 | 定型 | 見出しの直後の位置と、DFD を処理名で探すこと |
| `tests/unit/test_uml_sync_anchors.py` | 新規 | **コア** | 往復、壊れたアンカー、記法ごとの位置、同じ節の2枚目、置換と冪等性、付録へのフォールバック |
| `tests/unit/test_uml_sync_tables.py` | 新規 | 定型 | 記法ごとの列、DFD の「変換」の出どころ、セルのエスケープ、注意書き |

## 要点の抜粋

```python
# app/uml/generation/sections.py(追記)
def find_section_heading_end(markdown: str, number: str) -> int | None:   # `## 3.2 ...` の行の直後
def find_dfd_heading_end(markdown: str, title: str) -> int | None:        # `#### DF-n: <title>` の行の直後
```

```python
# app/uml/sync/anchors.py
_START = re.compile(r"<!-- uml:diagram:(?P<id>[0-9A-Za-z-]+):start v=(?P<version>\d+) -->")
_SECTION_FOR_NOTATION = {"component": "3.3", "er": "3.2"}   # DFD は DF 見出しの直下

def render_block(diagram_id: str, version: int, body: str) -> str:
    # 開始コメント / 空行 / 本文 / 空行 / 終了コメント
def parse_anchors(markdown: str) -> list[AnchorBlock]:        # 終了の無い開始は無視する
def upsert_block(markdown, *, diagram_id, version, body, notation, subject) -> str:
    existing = find_block(markdown, diagram_id)
    if existing is not None:                                # 1. 既にあればその位置で置き換える
        return markdown[: existing.start] + block + markdown[existing.end :]
    heading_end = _heading_end_for(markdown, notation, subject)
    if heading_end is None:
        return _insert_into_appendix(markdown, block)       # 3. 見出しが無ければ「## 付録: 設計図」
    return _insert_after_blocks(markdown, heading_end, block)  # 2. 見出しの直下(既存ブロックの後ろ)
```

```python
# app/uml/sync/tables.py
@dataclass(frozen=True)
class DataItemSummary:            # データ辞書はDBにあるので、呼び出し側が詰めて渡す
    name: str
    field_names: tuple[str, ...]

def render_element_table(model, data_items: Mapping[uuid.UUID, DataItemSummary]) -> str
def render_block_body(title: str, table: str) -> str   # "> 図: <題名> ── …上書きされます。" + 表
```

`app/uml/sync/__init__.py` は、`anchors`・`tables`(13-3 で `staleness`)の公開名を re-export する。依存の向きは次のとおりである。

- `anchors.py` → `app.uml.domain`(`NotationType`)、`app.uml.generation.sections`(見出しの位置)
- `tables.py` → `app.uml.domain`(意味モデルの型)
- `app/uml/sync` は DB・HTTP・サービスに依存しない。サービス(13-2)が `app/uml/sync` を使う。

## 設計判断

### アンカーを LLM に出力させない理由(確定事項2)

アンカーは図の ID(`uml_diagrams.id`)を含む。図は内部設計書を入力に AI で作るので、文書を生成する時点では図の ID が存在しない。LLM に「ID なしの目印」を出させて後で埋める案もあった。しかし、それには Phase 2 のプロンプトの改訂が要り、LLM が目印を落としたときのフォールバックも結局必要になる。

見出しの固定形式(`## 3.2`・`## 3.3`・`#### DF-n: <処理名>`)は、Phase 10 で DFD の候補を列挙するために既に使っている。同じ手がかりで位置も決められる。見出しが見つからないときのフォールバック(付録の節)だけを用意すれば足りる。

### 見出しの「直下」に置き、同じ節の2枚目は後ろに並べる

ER は全体図と部分図が同じ `## 3.2` に入る。見出しの直下に単純に挿入すると、後から反映した図が前に来て、反映の順序と表示の順序が逆になる。`_insert_after_blocks` は、見出しの直後に続いている既存のブロックを読み飛ばしてから挿入する。

### 置換は「同じ位置のまま」

2回目以降の反映では、アンカーの範囲だけを置き換える。位置を探し直さないので、利用者から見て図が動かない。同じ本文で2回反映しても結果が変わらない(冪等)ため、再反映ボタンを何度押してもよい。

### 本文の前後に空行を入れる

表の最終行の直後に終了コメントが続くと、Markdown の処理系によっては表の続きと解釈される。開始コメントの後と終了コメントの前に空行を入れ、コメントを独立したブロックにした。

### 壊れたアンカーは直さない

終了コメントの無い開始コメントは、どこまでが機械の管理する範囲か分からない。推測で直すと利用者の文章を消すおそれがあるので、`parse_anchors` は無視する。次の反映では、新しいブロックを別に挿入する。

### DFD の「変換」は、元の処理の説明

prompt の形式(元 / データ / 変換 / 先)に合わせ、フロー1本を1行にした。フローの元が処理ノードなら、「どう加工された結果のデータか」として元の処理の `description` を載せる。元が外部実体・データストアなら「—」にする。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `find_section_heading_end`・`find_dfd_heading_end` | pytest | スタブ不要。文字列から位置を返す純粋関数のため | DF-n の番号ではなく処理名で探すこと |
| `render_block`・`parse_anchors`・`upsert_block` | pytest(Phase 10 の `INTERNAL_DESIGN_MD` を入力にする) | スタブ不要。文字列を受け取り文字列を返す純粋関数のため | 往復、壊れたアンカー、記法ごとの位置、同じ節の2枚目、置換と冪等性、付録 |
| `render_element_table`・`render_block_body` | pytest | スタブ不要。意味モデルとデータ辞書の要約を渡すだけで DB を読まないため | データ辞書を `DataItemSummary` にして渡す形にしたので、DB 無しで DFD の表まで確かめられる |

データ辞書を関数の中で読まず、呼び出し側が `DataItemSummary` に詰めて渡す形にしたことが、この章のテストが全部スタブ不要になった理由である。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_uml_sync_anchors.py tests/unit/test_uml_sync_tables.py tests/unit/test_uml_generation_sections.py
# 23 passed(13-4 の追記分を含む最終状態での件数)
```

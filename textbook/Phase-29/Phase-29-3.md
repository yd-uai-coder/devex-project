# Phase-29-3: SVG と、詳細設計書の 05章(BE)

## この章の目的

29-2 のシーケンス図のモデルを SVG に書き出す純粋関数を作り、詳細設計書の 05章に載せる。HTML は処理のタブに SVG を入れ、md は手順の表の後に Mermaid のコードブロックを入れる。SVG は 29-4 の画面と 29-5 の手順書の単位でも使う。

自動実装モード: on([introduction](./Phase-29-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/sequence_svg.py`](../samples/backend/app/detailed_design/sequence_svg.py) | 新規 | `to_sequence_svg`・`message_label`(純粋・決定的) |
| [`app/detailed_design/document/views.py`](../samples/backend/app/detailed_design/document/views.py) | 更新 | `procedure_sequence`(05 に載せる処理の図。依存先は承認済みの段階4) |
| [`app/detailed_design/document/markdown.py`](../samples/backend/app/detailed_design/document/markdown.py) | 更新 | `sequence_block`(Mermaid のコードブロック)、05 の各処理の表の後に入れる |
| [`app/detailed_design/document/html.py`](../samples/backend/app/detailed_design/document/html.py) | 更新 | `_sequence_figure`、05 の各処理のタブに SVG を入れる |
| ── ここからテスト ── | | |
| [`tests/unit/test_sequence_svg.py`](../samples/backend/tests/unit/test_sequence_svg.py) | 新規 | 参加者・矢印・注記、決定的・エスケープ、矢印の種類、ラベルの番号と切り詰め、列の幅 |
| [`tests/unit/test_detailed_design_document_markdown.py`](../samples/backend/tests/unit/test_detailed_design_document_markdown.py) | 更新 | 05 の Mermaid のブロック |
| [`tests/unit/test_detailed_design_document_html.py`](../samples/backend/tests/unit/test_detailed_design_document_html.py) | 更新 | 05 のシーケンス図の SVG |

## 要点の抜粋

```python
# app/detailed_design/sequence_svg.py
def message_label(event: SequenceMessage) -> str     # "2: create(予約)"、推測した戻りは "(2 の戻り) 予約"
def to_sequence_svg(diagram: SequenceDiagram) -> str # 参加者 = 列、イベント = 行
```

```python
# app/detailed_design/document/views.py
def procedure_sequence(procedure, modules: ModuleListModel | None) -> SequenceDiagram:
    return to_sequence(procedure, module_dependencies(modules))

# app/detailed_design/document/markdown.py
def sequence_block(diagram) -> list[str]:   # 「シーケンス図(…直すのは表):」+ ```mermaid … ```。参加者が無ければ []
```

## 設計判断

### レイアウトエンジンを使わない

既存の図のパイプライン(`app/uml/`)は箱と線の図のためのもので、シーケンス図の配置は「参加者 = 列、手順 = 行」で決まる([25-5](../Phase-25/Phase-25-5.md))。文字の幅の見積もり(`app/uml/layout/text.py` の `tw`)・フォント(`app/uml/export/svg.py` の `FONT_FAMILY`)・矢じりの形は既存の出力にそろえ、配置だけを新しく書いた。

- 列の間隔は、隣の参加者の箱の幅と、その間をまたぐ矢印のラベルが収まる幅の大きいほう。足りなければ、またぐ間隔に均等に足す。
- ラベルは 48 文字で切り詰める(全文は手順の表にある)。
- 同期 = 実線と塗りの矢じり、非同期 = 実線と開いた矢じり、戻り = 破線と開いた矢じり。推測した戻りはラベルを斜体・灰色にする。分岐の注記は黄色の箱。
- 文字はすべて `html.escape` する。HTML の詳細設計書と画面は、この SVG をエスケープせずに埋め込む(既存の図と同じ扱い)。

### md は Mermaid、図のファイルは足さない

詳細設計書の md は、ほかの図を zip の中の SVG への画像の参照で載せている。シーケンス図は手順の表から導く別の見え方なので、[25-5](../Phase-25/Phase-25-5.md) の決定どおり Mermaid のテキストにした(AI が読める形のまま。段階8の参照の展開と同じブロックを使う ── 29-5)。Devex 自身の md プレビューでは図にならずコードとして見えるが、許容する。

### 図の入力は承認済みの段階4

05章は承認済みの段階だけで組み立てる(Phase 22)。依存先の指摘は詳細設計書には出さないが、図のモデルは段階5の検証と同じ関数(`to_sequence`)で作るので、依存先も `DocumentSource.modules`(承認済みの段階4)から渡す。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `to_sequence_svg`・`message_label` | pytest(`test_sequence_svg.py`) | スタブ不要 ── 純粋関数で、`to_sequence` で作った図のモデルだけから決まるため | 第一テストの統合スモーク: 参加者の箱・分岐の注記が出る。同じ入力から同じ文字列。`<本文>` はエスケープ。同期・自己呼び出しは塗りの矢じり、非同期と推測した戻りは開いた矢じり、戻りは破線、推測した戻りは斜体。長いラベルで図が広がる。参加者が無くても SVG を返す |
| `to_markdown`・`sequence_block` | pytest(markdown のテスト) | スタブ不要 ── 図は fixture の `sample_document_source` の段階4・5から導くため | 各処理の表の後、06 より前に ```mermaid のブロック。参加者が無ければ空 |
| `to_html` | pytest(html のテスト) | スタブ不要(同上) | 05 の処理のタブに `aria-label="F-01 のシーケンス図"` の SVG |

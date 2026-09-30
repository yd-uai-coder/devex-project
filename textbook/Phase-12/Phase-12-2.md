# Phase-12-2: 辺ラベルをレイアウトエンジンで配置する(Phase 9・11 への遡及)

## この章の目的

出力する図(12-3)に辺ラベルを描けるようにする。ラベルは、ER 図では多重度(`1:N` など)、DFD ではデータ項目名である。

Phase 9 で移植した `finalize.place_labels` は、ラベルがノード・他のラベル・他の線に重ならない位置を探す処理である。devex の意味モデルは辺ラベルを持たないため、`LayoutEdge.label` は常に空で、この処理は何もしていなかった。本章では、ラベルの文字列を意味モデルとデータ辞書から組み立ててエンジンに渡し、見つかった位置を `LayoutEdgeGeometry.label_pos` に保存する。

学習モード([introduction](./Phase-12-introduction.md)参照)。Phase 9 のコード(`layout/__init__.py`・`model.py`)と Phase 11 のコード(`reconcile.py`)への #12 遡及である。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/layout/labels.py`](../samples/backend/app/uml/layout/labels.py) | 新規 | **コア** | `edge_labels(model, data_item_names) -> dict[関係id, 文字列]`。文言はレビュー画面と同じにする |
| [`app/uml/layout/model.py`](../samples/backend/app/uml/layout/model.py) | 更新 | 定型 | `LayoutEdgeGeometry.label_pos: tuple[float, float] \| None = None`(ラベルの中心) |
| [`app/uml/layout/reconcile.py`](../samples/backend/app/uml/layout/reconcile.py) | 更新 | **コア** | `points=[]` の辺は `label_pos` も None にする |
| [`app/uml/layout/__init__.py`](../samples/backend/app/uml/layout/__init__.py) | 更新 | **コア** | `compute_layout(..., label_texts=None)`。`LayoutEdge.label` を埋め、`label_pos` の中心を保存する。`edge_labels` を re-export する |
| [`app/services/uml_diagram_service.py`](../samples/backend/app/services/uml_diagram_service.py) | 更新 | 定型 | `compute_layout` がラベルを組み立てて渡す。DFD のときだけデータ辞書を引く `_data_item_names` |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_layout_labels.py`](../samples/backend/tests/unit/test_uml_layout_labels.py) | 新規 | 定型 | ER は多重度、DFD はデータ項目名(無ければ既定の文言)、component は空 |
| [`tests/unit/test_uml_layout_compute.py`](../samples/backend/tests/unit/test_uml_layout_compute.py) | 更新 | **コア** | ラベル付きの ER 図で、`label_pos` がノードに重ならないこと。ラベル無しなら None |
| [`tests/unit/test_uml_layout_reconcile.py`](../samples/backend/tests/unit/test_uml_layout_reconcile.py) | 更新 | 定型 | 折れ点を捨てた辺だけ `label_pos` が落ちること |
| [`tests/unit/test_uml_diagram_service.py`](../samples/backend/tests/unit/test_uml_diagram_service.py) | 更新 | 定型 | DFD の自動レイアウトで `label_pos` が保存されること(データ辞書を引く経路) |

## 要点の抜粋

```python
# app/uml/layout/labels.py
ER_RELATION_LABELS: dict[ErRelationType, str] = {
    "one_to_one": "1:1", "one_to_many": "1:N", "many_to_many": "N:M",
}
UNKNOWN_DATA_ITEM_LABEL = "(不明なデータ項目)"

def edge_labels(model, data_item_names: Mapping[uuid.UUID, str] | None = None) -> dict[str, str]:
    if isinstance(model, ErSemanticModel):
        return {rel.id: ER_RELATION_LABELS[rel.relation_type] for rel in model.relations}
    if isinstance(model, DfdSemanticModel):
        names = data_item_names or {}
        return {f.id: names.get(f.data_item_id, UNKNOWN_DATA_ITEM_LABEL) for f in model.relations}
    return {}  # component
```

```python
# app/uml/layout/__init__.py(抜粋)
edges = [
    LayoutEdge(id=rel.id, a=rel.source_id, b=rel.target_id, label=label_texts.get(rel.id, ""))
    for rel in model.relations
]
...
LayoutEdgeGeometry(
    points=[(float(x), float(y)) for x, y in e.pts],
    # place_labels の label_pos は(中心x, 中心y, 矩形)。保存するのは中心だけ
    label_pos=((float(e.label_pos[0]), float(e.label_pos[1])) if e.label_pos else None),
)
```

```python
# app/uml/layout/reconcile.py(抜粋)
edges = {
    edge_id: geo if geo.points else geo.model_copy(update={"label_pos": None})
    for edge_id, geo in layout.edges.items()
    if edge_id in relation_ids
}
```

`app/uml/layout/__init__.py` の `__all__` に `edge_labels` が加わる。依存の向きは次のとおりである。

- `labels.py` は `app.uml.domain` だけに依存する。
- `__init__` は `labels` を re-export する。
- サービスは `app.uml.layout` から `edge_labels` を import する。

## 設計判断

### なぜエンジンで配置し、位置を保存するのか(ユーザー確定事項2)

出力の時点で「線の最も長い区間の中点」に置くだけの案もあった。レイアウトに触れずに済むが、ラベルがノードや他のラベルと重なる。

`place_labels` は、候補の位置ごとにノード・配置済みのラベル・他の線との衝突を数え、最も衝突の少ない位置を選ぶ。この処理は Phase 9 で移植済みで、入力(`e.label`)が空だっただけである。入力を埋めるだけで働くものを使わない理由は無い。

交差削減の山登り(`crossing_reduction._score`)は、ラベルが置けずに重なった数(`label_fallback`)も小さな重みで評価している。そのため、ラベル付きの図では、配置そのものもラベルを置きやすい方へ寄る。ラベルの無いゴールデンテスト(Phase 9)の結果は変わらない。

### なぜラベルの文言をレビュー画面と揃えたか

承認するのは、レビュー画面(React Flow)で見た図である。出力のラベルが画面と違う文言だと、承認した見た目と出力が一致しない。そこで、FE の `reactFlowAdapter.ts` の `ER_RELATION_LABELS`(`1:1`/`1:N`/`N:M`)と、DFD の既定の文言(`(不明なデータ項目)`)を、BE にも同じ値で置いた。

同じ定数が BE と FE の2か所にあることは、言語の境界による必然とした(#17 (c))。

### なぜ `points=[]` の辺はラベル位置も捨てるのか

ラベルの位置は、エンジンが引いた経路に沿って探したものである。端点のノードを手で動かすと経路は捨てられる(D2)。そのため、ラベル位置だけが古い経路の近くに浮いて残ってしまう。

経路と一緒に無効にしておけば、出力(12-3)は「`label_pos` が無ければ経路の中点に置く」の1つの規則で済む。FE の `applyMovedPositions` は、もともと動かした辺を `{ points: [] }` で置き換えていた。そのため、FE から送られる配置では、`label_pos` は既に落ちている。サーバー側でも同じことを保証する。

### データ辞書は DFD のときだけ引く

component と ER のラベルは、意味モデルだけで決まる。DB を読むのは、DFD のデータ項目名が要るときだけにした(`_data_item_names`)。この関数は 12-4 の出力でも使う。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `edge_labels` | pytest | スタブ不要。データ辞書を DB から引かず、引数(dict)で受け取る純粋関数のため | データ辞書を引数にしたことが、スタブ不要という形で表れている |
| `compute_layout`(ラベル付き) | pytest | スタブ不要。純粋な計算のため | 見積もりのラベル矩形がどのノードとも重ならないことを確かめる |
| `reconcile_layout` | pytest | スタブ不要 | 折れ点のある辺は `label_pos` を保ち、空の辺だけ落とす |
| `UmlDiagramService.compute_layout`(DFD) | pytest(インメモリ SQLite) | スタブ不要 | データ辞書を実際に作り、サービスが名前を引いてエンジンへ渡す経路を通す |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_uml_layout_labels.py tests/unit/test_uml_layout_compute.py tests/unit/test_uml_layout_reconcile.py tests/unit/test_uml_layout_finalize.py tests/unit/test_uml_diagram_service.py
# 45 passed(Phase 9 のゴールデンテストを含む。ラベルの無い図の結果は変わらない)
```

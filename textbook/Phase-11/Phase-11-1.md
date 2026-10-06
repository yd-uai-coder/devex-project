# Phase-11-1: PUT に座標(`layout_model`)を追加する

## この章の目的

レビュー画面で手で動かしたノードの座標を保存できるようにする。Phase 8 の `PUT /diagrams/{id}` は意味モデルしか受け付けなかった。そこで任意の `layout_model` を足し、意味モデルと座標を1回の保存・1つの version で保存する。

保存の直前に、配置を新しい意味モデルに突き合わせる(`reconcile_layout`)。削除した要素・関係のジオメトリは落とし、追加した要素の座標は補わない。

自動実装モード: on([introduction](./Phase-11-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/layout/model.py`](../samples/backend/app/uml/layout/model.py) | 更新 | 定型 | `LayoutEdgeGeometry.points == []` が「折れ点なし」(D2)を意味すると docstring に明記する。スキーマは変えない |
| [`app/uml/layout/reconcile.py`](../samples/backend/app/uml/layout/reconcile.py) | 新規 | **コア** | `reconcile_layout(layout, model) -> LayoutModel`。意味モデルに無い id のジオメトリを落とし、はみ出したら幅・高さを広げる |
| [`app/uml/layout/__init__.py`](../samples/backend/app/uml/layout/__init__.py) | 更新 | 定型 | `reconcile_layout` を re-export する |
| [`app/schemas/uml_diagram.py`](../samples/backend/app/schemas/uml_diagram.py) | 更新 | 定型 | `UmlDiagramUpdate.layout_model: LayoutModel \| None = None` |
| [`app/services/uml_diagram_service.py`](../samples/backend/app/services/uml_diagram_service.py) | 更新 | **コア** | `update(..., layout_model=None)`。渡された配置、または保存済みの配置を reconcile してから保存する |
| [`app/api/routes/uml.py`](../samples/backend/app/api/routes/uml.py) | 更新 | 定型 | `payload.layout_model` をサービスへ渡す |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_layout_reconcile.py`](../samples/backend/tests/unit/test_uml_layout_reconcile.py) | 新規 | **コア** | 削除の反映、追加を補わないこと、手動移動で幅・高さが広がること |
| [`tests/unit/test_uml_diagram_service.py`](../samples/backend/tests/unit/test_uml_diagram_service.py) | 更新 | 定型 | 座標を同じ version で保存すること、省略時は保存済みの配置を保ち削除分だけ落とすこと |
| [`tests/unit/test_uml_diagram_routes.py`](../samples/backend/tests/unit/test_uml_diagram_routes.py) | 更新 | 定型 | ルートが `layout_model` をサービスへ渡すこと |

## 要点の抜粋

```python
# app/uml/layout/reconcile.py
def reconcile_layout(layout: LayoutModel, model: _AnySemanticModel) -> LayoutModel:
    element_ids = {el.id for el in model.elements}
    relation_ids = {rel.id for rel in model.relations}
    nodes = {i: box for i, box in layout.nodes.items() if i in element_ids}   # 削除は落とす
    edges = {i: geo for i, geo in layout.edges.items() if i in relation_ids}
    width = max([layout.width] + [b.x + b.w for b in nodes.values()] + [...])  # 広げるだけ
    ...
    return layout.model_copy(update={"nodes": nodes, "edges": edges, "width": width, "height": height})
```

```python
# app/services/uml_diagram_service.py(update の抜粋)
diagram.semantic_model = semantic_model.model_dump(mode="json")
base_layout = layout_model if layout_model is not None else (
    LayoutModel.model_validate(diagram.layout_model) if diagram.layout_model is not None else None
)
if base_layout is not None:
    diagram.layout_model = reconcile_layout(base_layout, semantic_model).model_dump(mode="json")
diagram.version += 1
```

`app/uml/layout/__init__.py` の公開シンボルは `__all__ = ["LayoutModel", "compute_layout", "reconcile_layout"]` になる。依存の向きは `reconcile` → `model`・`app.uml.domain` で、`__init__` がそれを re-export する。

## 設計判断

### なぜ座標を PUT に含めたか(ユーザー確定事項1)

座標だけを保存する `PATCH .../layout` を別に作る案もあった。採らなかった理由は2つある。

- **保存が2回に分かれる**。要素を削除してノードを動かした後の保存は、「意味モデルの PUT」と「座標の PATCH」の2回になる。1回目が成功して2回目が失敗すると、要素は消えたのに座標が古い、という中途半端な状態が残る。
- **version の扱いが複雑になる**。座標にも楽観ロックが要るのか、要るなら意味モデルと同じ version か別の version か、を決める必要が出る。1つの PUT にまとめれば、既存の version 1つで両方を守れる。

代わりに、`layout_model` は**任意**にした。省略した場合は保存済みの配置を保つ。そのため、Phase 10 までの呼び出し方(意味モデルだけを送る)はそのまま動く。

### なぜ「削除は落とす・追加は補わない」なのか

- **削除は落とす**: 要素を消した後の保存で、その要素の座標が配置に残ると、Phase 12 の draw.io 出力が存在しない要素を描こうとする。FE が座標を消し忘れても保存を止めないよう、未知の id はエラーにせず黙って落とす。
- **追加は補わない**: サーバーが座標を補うと、自動レイアウトを勝手に走らせることになる。M6 は「手動座標は自動レイアウトで上書きしない」なので、自動レイアウトは明示的な再実行(`POST /layout`)のときだけにする。追加した要素の仮の位置は FE が決める(11-3 の `placeMissingNodes`)。

### 幅・高さを「広げるだけ」にした理由

手で右下へ動かしたノードは、エンジンが計算した `width`/`height` の外に出ることがある。Phase 12 の SVG 出力はこの値でキャンバスの大きさを決めるので、はみ出しは広げて吸収する。逆に、要素を消しても縮めない。縮めると余白の取り方がエンジンの計算とずれるため、自動レイアウトを再実行したときに揃えれば足りる。

`metrics`(交差数など)は計算し直さない。手動移動の後の値は、最後に自動レイアウトしたときのままである。Phase 12 への申し送りに記録した。

### 省略時も保存済みの配置を reconcile する理由

座標を送らずに要素だけを削除する呼び出し方(Phase 10 までの FE や API の直接利用)でも、削除した要素の座標を残さないためである。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `reconcile_layout` | pytest | スタブ不要。`LayoutModel` と意味モデルを受け取って新しい値を返す純粋関数のため | 引数を書き換えないこと(`model_copy`)も合わせて確認できる |
| `UmlDiagramService.update` | pytest(インメモリ SQLite) | スタブ不要。外部呼び出しが無いため | 保存済みの配置を作るのに `compute_layout`(実エンジン)を使う |
| `update_diagram`(ルート関数) | pytest(ルート関数を直接呼ぶ) | スタブ不要 | Phase 8 以降のルートテストと同じく、HTTP を通さず関数を呼ぶ |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_uml_layout_reconcile.py tests/unit/test_uml_diagram_service.py tests/unit/test_uml_diagram_routes.py
# 26 passed
uv run ruff check .
# All checks passed!
uvx pyright
# 既知の1件(app/ai/llm/gemini.py の E2eFakeLLM)のみ
```

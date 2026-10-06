# Phase-12-3: 出力エンジン `app/uml/export/`(中間表現・SVG・draw.io)

## この章の目的

承認済みの図を SVG と draw.io(`.drawio`)に書き出す、決定的(AI 非依存)なエンジンを作る。移植元の図生成エンジンの `Diagram.to_svg`/`to_drawio` をコピーし、出自を明記する(D3)。Phase 9 では、描画の属性がレイアウト(座標の計算)には要らないため、この部分を移植していなかった。

出力は2段に分ける。

1. `build_render`: 意味モデル+配置+辺ラベルから、描画用の中間表現(`RenderDiagram`)を組み立てる。「何を描くか」を決める段。
2. `to_svg` / `to_drawio`: 中間表現を各形式に書き出す。「どう書くか」を担う段。

自動実装モード: on([introduction](./Phase-12-introduction.md) 参照)。パッケージはすべて純粋関数で、DB・HTTP に依存しない。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/layout/finalize.py`](../samples/backend/app/uml/layout/finalize.py) | 更新 | 定型 | `_label_size` を公開名 `label_size` にする(SVG のラベル背景も同じ大きさで描くため) |
| [`app/uml/layout/__init__.py`](../samples/backend/app/uml/layout/__init__.py) | 更新 | 定型 | `_element_kind`/`_element_text` を公開名 `element_kind`/`element_text` にして re-export する |
| [`app/uml/export/render.py`](../samples/backend/app/uml/export/render.py) | 新規 | **コア** | `RenderNode`/`RenderEdge`/`RenderDiagram`、`build_render`、`orthogonal_fallback`、`path_midpoint`、色の対応 |
| [`app/uml/export/svg.py`](../samples/backend/app/uml/export/svg.py) | 新規 | 定型 | `to_svg(render) -> str`(移植元 `to_svg`/`_node_svg` から、レーン・グループ・未使用の図形を除いたもの) |
| [`app/uml/export/drawio.py`](../samples/backend/app/uml/export/drawio.py) | 新規 | 定型(変更点3つはコア) | `to_drawio(render, *, diagram_id, title) -> str`(移植元 `to_drawio` から同上) |
| [`app/uml/export/__init__.py`](../samples/backend/app/uml/export/__init__.py) | 新規 | 定型 | `RenderDiagram`・`build_render`・`orthogonal_fallback`・`to_drawio`・`to_svg` を re-export する |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_export_render.py`](../samples/backend/tests/unit/test_uml_export_render.py) | 新規 | **コア** | エンジンの経路を使うこと、行の折り返し、ER の行と矢印の有無、`points=[]` の簡易経路、配置の無い要素の拒否、経路の中点 |
| [`tests/unit/test_uml_export_svg.py`](../samples/backend/tests/unit/test_uml_export_svg.py) | 新規 | 定型 | XML としてパースでき全ノード・辺を描くこと、エスケープ、決定性 |
| [`tests/unit/test_uml_export_drawio.py`](../samples/backend/tests/unit/test_uml_export_drawio.py) | 新規 | **コア** | セルの id と接続、`points=[]` の辺は出入口・折れ点を書かないこと、2重のエスケープ、決定性 |

## 要点の抜粋

```python
# app/uml/export/render.py(中間表現)
@dataclass(frozen=True)
class RenderEdge:
    id: str
    source_id: str
    target_id: str
    points: list[Point]         # 描く経路(始点・折れ点・終点)
    routed: bool                # True: エンジンの経路 / False: ここで作った簡易経路
    label: str
    label_pos: Point | None     # None なら経路の中点に置く
    arrow: bool                 # ER は多重度のラベルで表すので矢印を付けない

def build_render(model, layout: LayoutModel, label_texts: Mapping[str, str]) -> RenderDiagram:
    # 配置の無い要素 → UmlLayoutRequiredError(承認の条件で弾いているので通常は起きない)
    ...
    routed = geometry is not None and len(geometry.points) >= 2
    points = list(geometry.points) if routed else orthogonal_fallback(src_box, dst_box)
```

```python
# app/uml/export/render.py(points=[] の辺の簡易経路)
def orthogonal_fallback(a: LayoutBox, b: LayoutBox) -> list[Point]:
    # 左右に離れていれば横から出入りし、中間の x で1回曲がる(Z字)。そうでなければ上下から
    if apart_x and (not apart_y or abs(bcx - acx) >= abs(bcy - acy)):
        ...; return clean([(ax, acy), (mx, acy), (mx, bcy), (bx, bcy)])
    ...; return clean([(acx, ay), (acx, my), (bcx, my), (bcx, by)])
```

```python
# app/uml/export/drawio.py(辺の書き分け)
style = "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;jettySize=auto;orthogonalLoop=1;"
if edge.routed:   # エンジンの経路どおりに出入りさせ、折れ点を書く
    style += f"exitX={ex:.4f};exitY={ey:.4f};...;entryX={nx:.4f};entryY={ny:.4f};..."
    waypoints = f'<Array as="points">{inner}</Array>' if inner else ""
# routed=False(手で動かした辺)は何も書かず orthogonalEdgeStyle に経路を任せる(D2)
```

依存の向きは次のとおりである。

- `svg`・`drawio` → `render` → `app.uml.layout`(`element_kind`/`element_text`/`LayoutModel`/`clean`/`wrap`/`PADX`)と `app.services.errors`(`UmlLayoutRequiredError`)。
- `svg` は、`app.uml.layout.finalize.label_size` も使う。
- `export/__init__.py` が3つのモジュールを re-export する。
- レイアウトのパッケージは `export` に依存しない(出力はレイアウトの下流)。

## 設計判断

### なぜ中間表現を挟んだか

移植元では、`Diagram` クラスがレイアウトの状態と描画の両方を持ち、`to_svg`/`to_drawio` はその属性を直接読んでいた。devex では、レイアウトの結果は `LayoutModel` として DB に保存され、出力するときに意味モデルと組み合わせて読み戻す。その組み合わせ方は、SVG と draw.io で共通である。

- ノードの行を折り返し直す。
- 種類から色を決める。
- `points=[]` の辺の扱いを決める。
- ラベルの文字列を引く。

この共通の判断を `build_render` に1回だけ書いた。`to_svg`/`to_drawio` は、中間表現を文字列に書き出すだけの、移植元に近いコードになった。

### `points=[]` の辺: SVG は簡易経路、draw.io は任せる(ユーザー確定事項3)

D2 は「手で動かした辺は折れ点を捨て、draw.io は `orthogonalEdgeStyle`、React Flow は smoothstep に任せる」と決めていた。SVG には描画を任せられる相手が無いので、`orthogonal_fallback` で経路を作る。

draw.io では、`routed=False` の辺に出入口も折れ点も書かない。draw.io が自分で直交経路を引き、ユーザーが draw.io 上でノードを動かしても追従する。

簡易経路はノードを避けない。自動レイアウトを再実行すればエンジンの経路に戻るので、既知の制約として introduction に記録した。承認の前に自動レイアウトを必須にする案は、手で決めた配置が失われるので採らなかった。

### ノードの行を折り返し直す理由

`LayoutModel` はノードの箱(x, y, w, h)だけを保存し、折り返した後の行は保存していない。エンジンのノードの幅は「最も長い行の幅+左右の余白」で決まるので、`w - 2*PADX` で折り返し直せば同じ行に戻る。浮動小数の誤差で1文字あふれないよう、0.5px の余裕を持たせた。

FE の格子配置で仮の大きさになったノードでは、行数が箱の高さに合わないことがある。承認の前に自動レイアウトを実行すれば揃う。

### 移植元からの変更点(`drawio.py`)

- **セルの id**: 移植元の連番(`c2`, `c3`, ...)をやめ、`n-<要素id>`/`e-<関係id>` にした。draw.io で開いたとき、意味モデルの要素と対応が取れる。draw.io が予約する `0`/`1` とは、接頭辞で衝突しない。
- **ラベルの位置**: 移植元はラベルの「線上の比率」を持っていたが、devex は中心座標(`label_pos`)だけを保存する。draw.io は `x=0` の辺ラベルを経路の中点に置くので、中点からのずれ(`offset`)として書く。
- **2重のエスケープ**: `html=1` のセルは、値を HTML として解釈する。そこで、文字列を HTML としてエスケープした後、XML 属性としてもう一度エスケープする(移植元と同じ)。名前に `<b>` を含むモジュールが、太字としてではなく文字どおりに表示される。

### 除いたもの

レーン帯(ユーザー確定事項4)、グループ枠、分岐・端子・注記のノード、破線、両端の矢印は、devex の3記法では使わないので移植しなかった。分岐(`dec`)は、Phase 14 のアクティビティ図で必要になれば、そのときに足す。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `build_render`・`orthogonal_fallback`・`path_midpoint` | pytest | スタブ不要。意味モデル・配置・ラベルを受け取って値を返す純粋関数のため | 配置は純粋な `compute_layout` で作るか、`LayoutModel.model_validate` で手で組み立てる |
| `to_svg` | pytest + `xml.etree.ElementTree` | スタブ不要。中間表現を文字列にする純粋関数のため | パースできること自体がエスケープの検証になる |
| `to_drawio` | pytest + `xml.etree.ElementTree` | スタブ不要 | セルを id で引き、style 属性の中身(`exitX` の有無)を見る |

**出力のパッケージ全体がスタブ不要なのは、I/O(DB からの読み出し・状態の更新・HTTP)をすべてサービスとルート(12-4)に置いたからである**。`app/uml/` を「I/O を持たない純粋ロジック」とする配置の方針(Phase 10 完了後の合意)に沿っている。

決定性(同じ入力 → 同じ文字列)は、文字列の一致で確かめた。ゴールデンファイル(期待する出力の全文)を置く案もあった。しかし、移植元の座標の書式(`.1f`)を変えるたびに更新が必要になるため、この章では置かなかった。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_uml_export_render.py tests/unit/test_uml_export_svg.py tests/unit/test_uml_export_drawio.py
# 13 passed
```

加えて、DFD と ER のサンプルを scratchpad に書き出し、SVG をヘッドレス Chromium で PNG にして目視した。

- **自動レイアウトの図**: ラベルはノードに重ならず、線の脇に置かれていた。
- **手で動かした図**: 簡易経路は描かれた。ただし、ラベルがノードに重なる場合があった(既知の制約)。

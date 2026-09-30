# Phase-11-3: React Flow Adapter(純粋関数)

## この章の目的

意味モデル(正本)と配置を、React Flow の nodes/edges に変換する Adapter を作る。逆方向では、React Flow でドラッグし終えた位置を配置へ戻す。この変換は対称ではない。React Flow から戻すのは「ノードの位置」だけで、要素・関係の追加や属性の編集は React Flow を経由しない(11-6 の `editOps`)。

あわせて、配置の無い要素(編集で追加した要素、30件超で自動レイアウトできない図の全要素)に仮の位置を与える格子配置を用意する。

学習モード([introduction](./Phase-11-introduction.md)参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`package.json`](../samples/frontend/package.json) | 更新 | 定型 | `@xyflow/react` を追記する(Phase 7 で本体に追加済み。samples が追従していなかった) |
| [`src/features/uml/adapters/reactFlowAdapter.ts`](../samples/frontend/src/features/uml/adapters/reactFlowAdapter.ts) | 新規 | **コア** | `toReactFlow`・`applyMovedPositions`・`placeMissingNodes`・`nodeTypeOf`・`edgeLabelOf`・`estimateSize`・`EMPTY_LAYOUT` と、型 `UmlFlowNode`/`UmlFlowEdge`/`UmlNodeType`/`Position` |
| ── ここからテスト ── | | | |
| [`src/features/uml/adapters/__tests__/reactFlowAdapter.test.ts`](../samples/frontend/src/features/uml/adapters/__tests__/reactFlowAdapter.test.ts) | 新規 | **コア** | 下記テスト観点参照 |

## 要点の抜粋

```ts
// src/features/uml/adapters/reactFlowAdapter.ts
export type UmlNodeType = "component" | "erTable" | "dfdProcess" | "dfdExternal" | "dfdStore";
export type UmlFlowNode = Node<{ element: UmlElement }, UmlNodeType>;
export type UmlFlowEdge = Edge<{ points: [number, number][] }>;

export function toReactFlow(model, layout, { dataItemNames }) {
  nodes: 要素ごとに { id, type: nodeTypeOf(...), position: {x, y}, width: w, height: h, data: { element } }
  edges: 関係ごとに { type: points.length > 0 ? "orthogonal" : "smoothstep",       // D2
                      label: edgeLabelOf(...),                                        // DFD=データ項目名, ER=多重度
                      markerEnd: ER 以外は矢印, data: { points } }
}

export function applyMovedPositions(layout, model, moved: Record<string, Position>): LayoutModel {
  // 動かしたノードの x, y を更新し、そのノードにつながる辺の points を [] にする(D2)
}

export function placeMissingNodes(model, layout | null): LayoutModel {
  // 配置の無い要素だけを、既存の配置の下へ4列の格子で置く。既にある要素は動かさない(M6)
}
```

依存の向きは `reactFlowAdapter.ts` → `@xyflow/react`(型と `MarkerType`)・`api/types.ts`。React Flow の型を import するのは Adapter と描画コンポーネント(11-5)だけで、`api/types.ts` と `model/`(11-6)は React Flow を知らない。

## 設計判断

### なぜ変換を非対称にしたか

appendix の設計([`uml-review-drawio-requirements-external-design.md`](../../appendix/uml-review-drawio-requirements-external-design.md) 2.7節)は `toReactFlow()` と `fromReactFlow()` の対を想定していた。本 Phase では、逆方向を「位置だけ」に絞った。

- React Flow の nodes/edges を正本にして編集結果を丸ごと意味モデルへ戻すと、`data` に載せた要素を React Flow の中で書き換えることになる。React Flow の変更通知(`applyNodeChanges`)と意味モデルの整合を、毎回取り直す必要が出る。
- 意味モデルを正本にし、表示は毎回作り直すことにすれば、変更の流れは「意味モデル → 表示」の一方向になる。React Flow から来るのは、ドラッグで確定した位置だけである。
- そのため `fromReactFlow` という名前は使わず、戻す内容がはっきり分かる `applyMovedPositions` にした。

「React Flow 固有のプロパティを意味モデルに混ぜない」(appendix 2.7)は、この構成でそのまま守れる。

### 手で動かしたノードにつながる辺の折れ点を捨てる(D2)

エンジン(Phase 9)の `points` は絶対座標の直交折れ線で、端点のノードが計算した位置にあるときだけ正しい。ノードを動かした後も古い折れ線を描くと、線がノードから離れて宙に浮く。そこで、動かしたノードにつながる辺だけ `points` を `[]` にする。`toReactFlow` はそれを見て辺の type を `smoothstep`(React Flow 組み込みの直交風の線)に替える。

`points=[]` は保存される(11-1)。Phase 12 の draw.io 出力では、この辺を `orthogonalEdgeStyle` で描く(Phase 12 への申し送り)。

### 格子配置の位置づけ

`placeMissingNodes` は自動レイアウトの代わりではなく、「座標が無いと React Flow に置けない」ことへの最小限の対処である。

- 高さはエンジンの式(`geometry.py` の `size_nodes`: 1行 20px、上下の余白 9px ずつ)に合わせ、幅はエンジンの文字幅推定(`app/uml/layout/text.py`)を使わない目安値にした(`estimateSize`: component/DFD は 160×38、ER は 200×(20×(カラム数+1)+24))。
- `lane`/`row` は自動レイアウトの結果ではないので 0 にした。レーン帯を描く後続の Phase は、これを区別する必要がある(申し送り)。
- 自動レイアウトを再実行すれば、エンジンの寸法と位置に置き換わる。

### ノードの大きさを配置の `w`/`h` に合わせる

`toReactFlow` はノードの `width`/`height` に配置の `w`/`h` を渡す。React Flow の表示寸法と、Phase 12 の draw.io/SVG の寸法を揃えるためである(appendix の「Level 2 再現性」)。

## テスト観点(#14)

用語: **SUT**(テスト対象)、**ドライバ**(SUT を呼び出す側)、**スタブ**(SUT が呼ぶ依存を置き換えるもの)。

| テスト対象(SUT) | ドライバ | スタブ | 見ること |
|---|---|---|---|
| `toReactFlow` | vitest | スタブ不要。モデルと配置を受け取って nodes/edges を返す純粋関数のため | 座標・寸法の写し、`orthogonal`/`smoothstep` の切り替え、矢印の有無 |
| `nodeTypeOf`・`edgeLabelOf` | vitest | スタブ不要(純粋関数) | DFD の element_type ごとの type、DFD はデータ項目名(不明なら代わりの文言)、ER は多重度 |
| `applyMovedPositions` | vitest | スタブ不要(純粋関数) | 動かしたノードだけ更新、つながる辺の `points` が `[]`、引数を書き換えない、未知の id は無視 |
| `placeMissingNodes` | vitest | スタブ不要(純粋関数) | null から全要素を格子に置く、既存の要素は動かさない、欠けが無ければ同じ参照を返す |

スタブが1つも要らないのは、Adapter が「入力を受け取って値を返すだけ」で、ストアや API を呼ばないからである。副作用(保存・取得)は 11-5 のストアに寄せてある。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/uml/adapters
# 11 passed
```

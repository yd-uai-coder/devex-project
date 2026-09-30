# Phase-11-5: レビュー画面(表示・ドラッグ・保存・自動レイアウト)

## この章の目的

`/projects/[id]/uml/[diagramId]` に、React Flow のレビュー画面を作る。この章で扱うのは次のとおりである。

- 図を3記法のカスタムノードで表示する。
- ノードをドラッグして配置を変える。
- 意味モデルと座標を保存する(11-1 の PUT)。
- 自動レイアウトを実行する。初回は自動、以降は明示的な再実行のときだけ(M6)。

要素・関係の編集は 11-6 で足す。

学習モード([introduction](./Phase-11-introduction.md)参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`src/features/uml/uml-editor-store.ts`](../samples/frontend/src/features/uml/uml-editor-store.ts) | 新規 | **コア** | `diagram`・`model`・`layout`・`dirty`・`conflict`・`layoutNotice` と `load`・`moveNodes`・`save`・`runLayout`(11-6 のタグ部分を除く) |
| [`src/features/uml/components/nodes/nodeStyles.ts`](../samples/frontend/src/features/uml/components/nodes/nodeStyles.ts) | 新規 | 定型 | `nodeBoxStyle(selected, extra)`。テーマの CSS 変数を使う |
| [`src/features/uml/components/nodes/NodeHandles.tsx`](../samples/frontend/src/features/uml/components/nodes/NodeHandles.tsx) | 新規 | 定型 | 入力を左、出力を右に置く接続点。普段は隠し、マウスを乗せたとき・選択中だけ表示する(`uml-handle`) |
| [`src/app/globals.css`](../samples/frontend/src/app/globals.css) | 更新 | 定型 | 接続点(`uml-handle`)を普段は隠す CSS を末尾に追記する(samples は追記分のみ) |
| [`src/features/uml/components/nodes/ComponentNode.tsx`](../samples/frontend/src/features/uml/components/nodes/ComponentNode.tsx) | 新規 | 定型 | モジュール名と layer |
| [`src/features/uml/components/nodes/ErTableNode.tsx`](../samples/frontend/src/features/uml/components/nodes/ErTableNode.tsx) | 新規 | 定型 | テーブル名と、PK/FK の印つきカラム |
| [`src/features/uml/components/nodes/DfdNode.tsx`](../samples/frontend/src/features/uml/components/nodes/DfdNode.tsx) | 新規 | 定型 | 処理(角丸。説明はツールチップ)・外部実体(太枠)・データストア(上下線)を1つの部品で描き分ける |
| [`src/features/uml/components/edges/OrthogonalEdge.tsx`](../samples/frontend/src/features/uml/components/edges/OrthogonalEdge.tsx) | 新規 | **コア** | エンジンの `points` をそのまま折れ線で描く。`midpointOf` でラベル位置を決める |
| [`src/features/uml/components/UmlCanvas.tsx`](../samples/frontend/src/features/uml/components/UmlCanvas.tsx) | 新規 | **コア** | ストアの正本を Adapter で表示し、ドラッグ確定時に `moveNodes` を呼ぶ。`NODE_TYPES`/`EDGE_TYPES`(11-6 のタグ部分を除く) |
| [`src/features/uml/components/UmlDiagramPageContent.tsx`](../samples/frontend/src/features/uml/components/UmlDiagramPageContent.tsx) | 新規 | 定型 | ツールバー(保存・自動レイアウト・状態の表示)、競合・レイアウト失敗の表示(11-6 のタグ部分を除く) |
| [`src/app/projects/[id]/uml/[diagramId]/page.tsx`](../samples/frontend/src/app/projects/[id]/uml/[diagramId]/page.tsx) | 新規 | 定型 | `params` を解決して `UmlDiagramPageContent` へ渡す |
| ── ここからテスト ── | | | |
| [`src/features/uml/__tests__/uml-editor-store.test.ts`](../samples/frontend/src/features/uml/__tests__/uml-editor-store.test.ts) | 新規 | **コア** | 下記テスト観点参照(11-6 のタグ部分を除く) |
| [`src/features/uml/components/nodes/__tests__/nodeStyles.test.ts`](../samples/frontend/src/features/uml/components/nodes/__tests__/nodeStyles.test.ts) | 新規 | 定型 | 同上 |
| [`src/features/uml/components/edges/__tests__/OrthogonalEdge.test.ts`](../samples/frontend/src/features/uml/components/edges/__tests__/OrthogonalEdge.test.ts) | 新規 | 定型 | 同上 |
| [`src/features/uml/components/__tests__/UmlCanvas.test.tsx`](../samples/frontend/src/features/uml/components/__tests__/UmlCanvas.test.tsx) | 新規 | 定型 | 同上(ノード部品と辺部品の登録も直接 import して確かめる) |
| [`src/features/uml/components/__tests__/UmlDiagramPageContent.test.tsx`](../samples/frontend/src/features/uml/components/__tests__/UmlDiagramPageContent.test.tsx) | 新規 | 定型 | 同上(11-6 のタグ部分を除く) |
| [`src/app/projects/[id]/uml/[diagramId]/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/uml/[diagramId]/__tests__/page.test.tsx) | 新規 | 定型 | 同上 |

## 要点の抜粋

```ts
// src/features/uml/uml-editor-store.ts
function fromServer(diagram: UmlDiagramRead) {
  return { diagram, model: diagram.semantic_model,
           layout: placeMissingNodes(diagram.semantic_model, diagram.layout_model), dirty: false };
}
load: 図とデータ辞書を並行取得 → layout_model が null で要素があれば runLayout()(M6 の初回)
save: PUT { version: diagram.version, semantic_model: model, layout_model: layout }
      → 409 かつ code === "VERSION_CONFLICT" なら conflict = true
runLayout: dirty なら先に save() → POST /layout
      → code が "LAYOUT_" で始まる 400 なら layoutNotice に理由を入れ、格子配置のまま続ける
```

```tsx
// src/features/uml/components/UmlCanvas.tsx
export const NODE_TYPES = { component: ComponentNode, erTable: ErTableNode,
                            dfdProcess: DfdNode, dfdExternal: DfdNode, dfdStore: DfdNode };
export const EDGE_TYPES = { orthogonal: OrthogonalEdge };   // smoothstep は組み込み
const derived = useMemo(() => toReactFlow(model, layout, { dataItemNames }), [...]);
const [nodes, setNodes] = useState(derived.nodes);          // ドラッグ中の途中経過だけを持つ
useEffect(() => { setNodes(derived.nodes); setEdges(derived.edges); }, [derived]);
const onNodeDragStop = (_e, _node, draggedNodes) => moveNodes({ [id]: position, ... });
```

依存の向き: `UmlDiagramPageContent` → `UmlCanvas` → `nodes/*`・`edges/*`・`adapters/reactFlowAdapter`・`uml-editor-store` → `api/umlApi`。ノード部品は `adapters` の型(`UmlFlowNode`)だけに依存し、ストアを読まない。

## 設計判断

### 正本はストア、React Flow は表示だけ

`UmlCanvas` は React Flow の nodes/edges をローカル state に持つ。ただしこれは、ドラッグの途中経過(`applyNodeChanges` が毎フレーム反映する位置)を描くためだけに使う。

- ストアの `model`/`layout` が変わると、Adapter で作り直して上書きする。
- ドラッグを離したとき(`onNodeDragStop`)だけ、位置をストアへ戻す。複数選択で動かした場合も、動いた全ノードをまとめて戻す。

この形にすると、React Flow の state とストアが食い違っても、次に正本が変わった時点で表示が正本に揃う。

### 保存・自動レイアウトの順序

`POST /layout` は、DB に保存済みの意味モデルを配置する(Phase 9)。未保存の編集があるまま呼ぶと、画面の図とは違うモデルを配置してしまう。そこで `runLayout` は、`dirty` なら先に `save()` を呼び、失敗したら中止する。検証(11-6)も同じ理由で同じ順序にする。

自動レイアウトは、手で動かした座標を置き換える。M6 は「手動座標は自動レイアウトで上書きしない」なので、再実行はボタンの確認(`window.confirm`)を経たときだけにした。

### 初回の自動レイアウト

AI で生成・再生成した直後の図は `layout_model` が null である(Phase 10)。レビュー画面を開いたときに1回だけ自動レイアウトを実行する。

- 30件超(`LAYOUT_NODE_LIMIT_EXCEEDED`)や検証エラー(`LAYOUT_VALIDATION_FAILED`)で配置できないときは、エラーにせず格子配置(11-3)のまま表示を続け、理由を `layoutNotice` で見せる。図を直せば再実行できる。
- 格子配置のまま保存すると、`layout_model` は null でなくなるため、次に開いたときは自動で配置しない。そのときは「自動レイアウト」ボタンで実行する。

### 競合(409)は `code` で見分ける

保存の 409 には2つの意味がある。`VERSION_CONFLICT`(他の画面や再生成で version が進んだ)と `UML_GENERATION_IN_PROGRESS`(生成中)である。前者だけを `conflict` として扱い、「再読み込み」ボタンを出す。再読み込みすると未保存の変更は失われる。これは画面の文言で明示した。生成中の図は、そもそも保存ボタンを無効にしてある。

### 直交辺の描き方

`OrthogonalEdge` は、React Flow が計算する端点(`sourceX` など)を使わず、`data.points` の絶対座標をそのまま `M … L …` のパスにする。エンジンの経路は、ノードの位置が配置と一致している間だけ正しい。一致しなくなった辺は 11-3 で `smoothstep` に替わるので、この部品が古い経路を描くことはない。

### ノードの見た目をエンジンの寸法に合わせる(デモページでの確認で修正)

バックエンド無しのデモページ(`/uml-demo`、下記)でブラウザ表示を確かめたところ、次の3点が見つかり修正した。

- **直交辺の矢印が接続点に隠れる**: エンジンの経路はノードの枠ちょうどで終わり、そこに常に表示した接続点(黒い点)が矢印の先端を覆っていた。接続点は普段は隠し、ノードにマウスを乗せたとき・選択中だけ表示する(`globals.css` の `.uml-handle`)。
- **ER の最後のカラムが枠で切れる**: 部品の行の高さがエンジンの計算(1行 20px、上下の余白 9px)より大きかった。`ErTableNode` の行の高さを 20px に揃えた。
- **DFD の処理の説明が枠からはみ出す**: エンジンは名前だけでノードの寸法を決める。説明は枠に入れず、ツールチップ(`title`)と属性パネルで見せる。

React Flow の表示寸法とエンジン(Phase 12 の draw.io/SVG)の寸法を揃えるという方針(11-3)は、部品の中身もエンジンの寸法に収まる前提で成り立つ。

### ハンドルを左右に置く理由

Phase 9 の配置は、レーンを左から右へ並べる。そのため入力を左、出力を右に置いた。`smoothstep` になった辺も、左右の向きの流れを保つ。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 見ること |
|---|---|---|---|
| `useUmlEditorStore`(load・save・runLayout) | vitest | `stubFetch` | 配置のある図では自動レイアウトを呼ばない / null なら1回呼ぶ、`LAYOUT_*` で格子配置と理由、座標込みの PUT、409 の conflict、保存→配置の順序 |
| `UmlDiagramPageContent` | `render` + `userEvent` | `UmlCanvas` を `vi.mock`、ストアのアクションを `vi.fn`、`window.confirm` を `vi.spyOn` | load の呼び出し、保存ボタン、確認のキャンセル、競合時の再読み込み、レイアウト失敗の表示 |
| `UmlCanvas` | `render` | スタブ不要。ストアの状態を `setState` で与え、React Flow を実際に描く | 3記法のカスタムノードが要素の内容を描くこと、`NODE_TYPES`/`EDGE_TYPES` の登録 |
| `midpointOf`・`nodeBoxStyle` | vitest | スタブ不要(純粋関数) | 中央の線分の中点、選択時の枠 |
| `ProjectUmlDiagramPage` | 関数を直接呼んで `render` | `UmlDiagramPageContent` と `next/navigation` を `vi.mock` | `id`・`diagramId` を渡すこと |

jsdom には描画エンジンが無いので、`UmlCanvas` のテストは座標や辺の形を見ない。ドラッグと直交辺の見た目は、ブラウザで確認する対象である(下記)。`ResizeObserver` は Phase 7 で `vitest.setup.ts` に入ったポリフィルがそのまま効く。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/uml "src/app/(pages)/(protected)/projects/[id]/uml"
# 15 files / 63 passed(11-5 完了時点)
npx tsc --noEmit && npm run lint
# エラーなし(既存の警告1件のみ)
npm run build
# /projects/[id]/uml/[diagramId] が動的ルートとしてビルドされる
```

**ブラウザでの確認(デモページ)**: この環境では Docker が使えず、バックエンドを起動できなかった。そこで、本物の画面部品とストアを固定データで動かすデモページ `/uml-demo` を devex-ui に追加し(教材・samples の対象外。開発用)、ヘッドレスブラウザで表示・ドラッグ・記法の切り替え・属性パネルを確かめた。配置はエンジンを実際に実行した出力を埋め込んでいる。

**未実施**: 実バックエンドとつないだ確認(保存して再読み込みしても座標が保たれること、自動レイアウトの再実行、409 の競合表示)。写経後に `docker compose up` と `npm run dev` で確認してほしい。

# Phase 11 導入: フロントエンド(Adapter・React Flow のプレビュー/編集)と、生成の受け付け・ポーリング・履歴

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節 ステージ3ロードマップの「Phase 11: フロントエンド(Adapter・React Flowプレビュー/編集)」を実装する。対象は M5(レビュー UI)と M6(自動レイアウトの初回・再実行、手動座標を上書きしない)。画面は SCR-007([`docs/external_design.md`](../../docs/external_design.md) 2.6節)である。

あわせて、[`Phase-10-introduction.md`](../Phase-10/Phase-10-introduction.md)「後続 Phase への申し送り」を解消する。

- `POST /diagrams` の 202 を受け、`GET /diagrams` の `generation_status` をポーリングして完了を検知する。
- `GET /candidates` で生成対象を選ばせ、`GET /generation-runs` で止まった理由を見せる。
- 候補が0件で内部設計書がある場合(旧形式)は、再生成を促す。

承認フロー(M7)と draw.io/SVG の出力は Phase 12 で扱う。

## 実装前の設計判断(このセッションで確定)

着手前の相談で、次の3点を確定した。詳細は [`textbook/q_a.md`](../q_a.md) を参照。

1. **手動座標の保存は PUT を拡張する**。
   - Phase 10 までの `PUT /diagrams/{id}` は `semantic_model` しか受け付けず、手で動かした座標を保存する経路が無かった。
   - `UmlDiagramUpdate` に `layout_model`(任意)を足し、意味モデルと座標を1回の保存・1つの version で保存する。
   - 座標専用の PATCH を別に作る案もあったが、保存が2回に分かれ、競合の扱いが複雑になるため採らなかった。
2. **編集の範囲**。
   - 3記法とも、要素の追加・削除・属性の編集と、関係の追加・削除を扱う。ER はカラム表の編集を含む。
   - DFD のフローは、既存のデータ項目から選ぶだけにする。
   - データ辞書の管理 UI と undo/redo(Should)は後の Phase に回す。
3. **画面は2つに分ける**。
   - `/projects/[id]/uml`: 生成パネル・生成履歴・図の一覧。
   - `/projects/[id]/uml/[diagramId]`: React Flow のレビュー・編集。
   - 状態(ストア)とテストを画面ごとに分けられる。

## パイプライン上の位置づけ・前提

```
生成:  [FE] 生成パネル → POST /diagrams(202) → ポーリング(GET /diagrams, /generation-runs)
表示:  GET /diagrams/{id} → 意味モデル + 配置 → [FE] toReactFlow → React Flow
編集:  意味モデル ← editOps(追加・削除・属性)     ← 属性パネル・キャンバスの接続/削除
       配置     ← applyMovedPositions(位置だけ) ← ドラッグ確定
保存:  PUT /diagrams/{id} {version, semantic_model, layout_model}(楽観ロック)
配置:  (保存してから)POST /diagrams/{id}/layout
```

- **前提として読むもの**:
  - [`Phase-7-3.md`](../Phase-7/Phase-7-3.md): React Flow × Tamagui のスパイク。本 Phase はこのスパイクの配置(`uml/page.tsx` + `UmlPageContent.tsx`)をそのまま本実装に置き換える。
  - [`Phase-8-introduction.md`](../Phase-8/Phase-8-introduction.md): 意味モデルの形、`DfdFlow.data_item_id`、楽観ロック。
  - [`Phase-9-introduction.md`](../Phase-9/Phase-9-introduction.md): 配置(`LayoutModel`)の形、レーンと `layer`、要素数の上限(`MAX_ELEMENTS=30`)。
  - [`Phase-10-introduction.md`](../Phase-10/Phase-10-introduction.md): 生成の受け付けと履歴、`MAX_SUBJECTS_PER_REQUEST=5`、ER 部分図。
  - [`Phase-3-6.md`](../Phase-3/Phase-3-6.md): FE の store・ポーリング(`useGenerationPolling`)の既存パターン。
- **本 Phase 開始時点の状態**:
  - `devex-ui/src/features/uml/` には、Phase 7 の使い捨てスパイク(ダミーノードの固定表示)しか無い。
  - FE の `ApiError` は `status` と `message` しか持たず、バックエンドの `code`(`VERSION_CONFLICT` など)を読めない。
- **既存コードに前例が無い新規パターン**:
  1. 正本(意味モデル)と表示(React Flow の nodes/edges)を分け、Adapter で片方向に作り直す。React Flow から戻すのは、ドラッグで確定した位置だけにする。
  2. 「未保存の変更を先に保存してから、サーバー側の処理(自動レイアウト・検証)を呼ぶ」という順序の制御。
  3. 409 の中を `code` で見分ける(競合と生成中を区別する)。

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も並行して作った)。

> 旧ルール(学習モード / 納期モード)では、11-2 だけを納期モード、他を学習モードとした。旧・納期モードの章は、#14 の SUT/ドライバ/スタブの言語化を省いている。旧ルールから自動実装モードへ改めた経緯は [`overall-retrospective.md`](../appendix/overall-retrospective.md) を参照。

## 章一覧

| 章 | トピック | 旧モード | 依存 |
|---|---|---|---|
| [`Phase-11-1.md`](./Phase-11-1.md) | BE: PUT に `layout_model` を追加。配置と意味モデルの突き合わせ(`reconcile_layout`) | 学習 | なし |
| [`Phase-11-2.md`](./Phase-11-2.md) | FE: UML API クライアントと型、`ApiError.code` | 納期 | 11-1 |
| [`Phase-11-3.md`](./Phase-11-3.md) | FE: React Flow Adapter(純粋関数) | 学習 | 11-2 |
| [`Phase-11-4.md`](./Phase-11-4.md) | FE: 生成・一覧画面(候補の選択、個別生成と一括生成、ポーリング、生成履歴、旧形式の警告、文書画面からの導線) | 学習 | 11-2 |
| [`Phase-11-5.md`](./Phase-11-5.md) | FE: レビュー画面(キャンバス、カスタムノード・辺、ドラッグ、保存、自動レイアウト) | 学習 | 11-3, 11-4 |
| [`Phase-11-6.md`](./Phase-11-6.md) | FE: 編集(純粋な編集操作、属性パネル、要素・関係の追加と削除、検証結果) | 学習 | 11-5 |
| [`Phase-11-7.md`](./Phase-11-7.md) | BE: レイアウトエンジンの重なり修正(`ranking.py`、Phase 9 への #12 遡及)。11-5 のデモページで発見 | 学習 | なし |

## サンプルコード一覧

- **バックエンド**(`textbook/samples/backend/`、`devex-api/backend/` と同じ相対パス):
  - 新規: `app/uml/layout/reconcile.py`、`tests/unit/test_uml_layout_reconcile.py`
  - 更新: `app/uml/layout/{__init__,model,ranking}.py`、`app/schemas/uml_diagram.py`、`app/services/uml_diagram_service.py`、`app/api/routes/uml.py`、`tests/unit/test_uml_diagram_{service,routes}.py`、`tests/unit/test_uml_layout_{ranking,compute}.py`(`ranking` と2つのテストは 11-7)
- **フロントエンド**(`textbook/samples/frontend/`、`devex-ui/` と同じ相対パス。ただし `src/app/(pages)/(protected)/` は `src/app/` に平坦化):
  - 新規: `src/features/uml/` 配下の `api/{types,umlApi}.ts`、`adapters/reactFlowAdapter.ts`、`model/editOps.ts`、`hooks/useUmlGenerationPolling.ts`、`uml-store.ts`、`uml-editor-store.ts`、`labels.ts`、`test-utils/umlFixtures.ts`、`components/` の各コンポーネント(`nodes/`・`edges/` を含む)、`src/app/projects/[id]/uml/[diagramId]/page.tsx`
  - 更新: `src/lib/api/client.ts`、`src/hooks/useGenerationPolling.ts`、`src/features/uml/components/UmlPageContent.tsx`、`src/features/documents/components/DocumentsPageContent.tsx`、`src/app/projects/[id]/uml/page.tsx`、`package.json`(`@xyflow/react`。Phase 7 で本体に追加済みで、samples が追従していなかった)

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 11-1 | `app/uml/layout/reconcile.py`(新規)、`app/schemas/uml_diagram.py`・`app/services/uml_diagram_service.py`・`app/api/routes/uml.py`・`app/uml/layout/{__init__,model}.py`(更新) | 意味モデルと座標を同じ version で保存する。削除した要素の座標は落とし、追加した要素の座標は補わない | `uv run pytest tests/unit/test_uml_layout_reconcile.py tests/unit/test_uml_diagram_service.py tests/unit/test_uml_diagram_routes.py` |
| 11-2 | `src/lib/api/client.ts`(更新)、`src/features/uml/api/{types,umlApi}.ts`、`src/features/uml/test-utils/umlFixtures.ts`(新規) | バックエンドの契約を TS の型に写し、`code` でエラーを見分けられるようにする | `npx vitest run src/lib/api src/features/uml/api` |
| 11-3 | `src/features/uml/adapters/reactFlowAdapter.ts`(新規) | 意味モデル+配置 → nodes/edges(表示のたびに作り直す)、ドラッグ位置 → 配置(D2 で折れ点を捨てる)、配置の無い要素の格子配置 | `npx vitest run src/features/uml/adapters` |
| 11-4 | `uml-store.ts`・`labels.ts`・`hooks/useUmlGenerationPolling.ts`・`components/{GenerationPanel,GenerationRunHistory,DiagramList,UmlPageContent}.tsx`、`DocumentsPageContent.tsx`・`useGenerationPolling.ts`(更新) | 生成の受け付けと完了の検知、止まった理由の表示、生成対象の選び方 | `npx vitest run src/features/uml/__tests__/uml-store.test.ts src/features/uml/hooks src/features/uml/components src/features/documents` |
| 11-5 | `uml-editor-store.ts`・`components/{UmlCanvas,UmlDiagramPageContent}.tsx`・`components/nodes/*`・`components/edges/OrthogonalEdge.tsx`・`app/.../uml/[diagramId]/page.tsx` | 正本をストアに置き、表示は Adapter で作る。保存(座標込み)・自動レイアウト(初回と再実行)・競合 | `npx vitest run src/features/uml src/app` |
| 11-6 | `model/editOps.ts`・`components/{ElementInspector,ValidationPanel}.tsx`(新規)、`uml-editor-store.ts`・`UmlCanvas.tsx`・`UmlDiagramPageContent.tsx`(更新) | 編集は意味モデルへの純粋な操作。削除は関係と座標まで連鎖させる。検証は保存してから | `npx vitest run src/features/uml` |
| 11-7 | `app/uml/layout/ranking.py`・`app/uml/layout/model.py`(更新) | 同じレーンの同じ行に2ノードを置かない(衝突したら次の空き行へ) | `uv run pytest tests/unit/test_uml_layout_ranking.py tests/unit/test_uml_layout_compute.py` |

## 写経順序(#23)

章番号順(11-1 → 11-2 → 11-3 → 11-4 → 11-5 → 11-6 → 11-7)に進める。11-7 はバックエンドだけの修正で FE の章に依存しないので、11-1 の直後に写経してもよい。各章の中は依存順(#30)で、順番は各章の表を参照。

次の3ファイルは、11-5 で作り 11-6 で完成する。11-6 の担当分には `// Phase-11-6:追記` / `// Phase-11-6：更新` タグを付けてある。11-5 の時点では、タグの付いた部分を除いて写経する。

- `src/features/uml/uml-editor-store.ts`
- `src/features/uml/components/UmlCanvas.tsx`
- `src/features/uml/components/UmlDiagramPageContent.tsx`

## Stage 3 固有の運用(Phase 7 から継続)

`textbook/samples/` への反映と並行して、Claude が本体に直接実装する。対象は `devex-api`(`stage3` ブランチ)と `devex-ui`(`main`)。samples 側の Phase タグは本体には書かない。

## 後続 Phase への申し送り

- **Phase 12(承認・出力)**:
  - `layout_model.edges[id].points` が空リストの辺は、手で動かしたノードにつながる辺である。draw.io では `orthogonalEdgeStyle` にし、折れ点を書かない(D2)。
  - `reconcile_layout` は幅・高さを広げるだけで、`metrics`(交差数など)は計算し直さない。手動移動の後の `metrics` は、自動レイアウトを最後に実行したときの値のままである。
  - M7「approved 後に編集すると reviewing に戻す」は、まだ実装していない。レビュー画面の状態表示は読み取り専用。
  - 格子配置(`placeMissingNodes`)の要素は `lane=0, row=0` で保存される。レーン帯を描くときは、自動レイアウトの結果かどうかを区別する必要がある。
- **Phase 9 のエンジンの不具合(デモページで発見)**: 同じレーンに依存の深さが同じ要素が2つ以上あると、ノードが同じ位置に重なっていた。[`Phase-11-7.md`](./Phase-11-7.md) で修正済み。`metrics.overlaps` は線の重なりの指標で、ノードの重なりは数えない(docstring に明記)。
- **後続(時期は未定)**:
  - データ辞書の管理 UI。DFD の線を追加すると、先頭のデータ項目で作られる。項目が0件なら追加できない。
  - undo/redo(Should)。
  - レビュー画面でのレーン帯の表示。配置はレーン番号だけを持ち、ラベルは持たない。
- **既知の制約**:
  - 生成のポーリングは3分で打ち切る。4文書生成の値を再利用しており、UML 生成向けに実測した値ではない。打ち切った後は「再読み込み」で再開する。
  - プロセスが落ちて `generating` が残った図は、これまでどおり再生成できない。

## 後続 Phase での改訂

- [`Phase-12-2.md`](../Phase-12/Phase-12-2.md): `reconcile_layout`が、折れ点を捨てた辺(`points=[]`)の`label_pos`も捨てるようにした。FE の`LayoutEdgeGeometry`型に`label_pos?`を足した(12-5)。
- [`Phase-12-5.md`](../Phase-12/Phase-12-5.md): レビュー画面の状態表示を`DiagramReviewActions`(承認・出力の操作)へ移し、ストアに`approve`/`exportDiagram`を足した。申し送りだった M7 と`points=[]`の辺の draw.io 出力は Phase 12 で解消した。
- Phase 24 完了後の調整([`q_a.md`](../q_a.md)「Phase 24 完了後 ── 文書プレビューの不具合・簡易モードの設計図の削除・モード表示」): 簡易モードの設計図の画面(SCR-007。`UmlPageContent`・`UmlDiagramPageContent`・`GenerationPanel`・`GenerationRunHistory`・`DiagramList`・`uml-store`・`/uml-demo` のデモ)を削除した。図のエディタ(`UmlDiagramEditor` など)は、詳細設計モードの段階2〜4が使うので残した。

## Phase 完了チェック(#22)

1. React Flow から意味モデルへ戻すのが「ノードの位置」だけで、要素・関係の追加や属性の編集は React Flow を経由しない理由を、「正本は意味モデル」という決定(appendix 2.7)から説明できるか。
2. 手で動かしたノードにつながる辺の折れ点を捨てる理由(D2)と、その辺が `orthogonal` から `smoothstep` に替わる仕組みを、Adapter と `LayoutEdgeGeometry.points` の関係から説明できるか。
3. 自動レイアウトと検証の前に「未保存の変更を先に保存する」必要がある理由を、`POST /layout`・`POST /validate` が何を入力にしているかから説明できるか。
4. 座標を PUT に含め、意味モデルと同じ version で保存する設計にした理由を、座標専用の PATCH を作る案と比べて説明できるか。
5. `ApiError` に `code` を足した理由を、409 が「競合」と「生成中」の2つの意味を持つことから説明できるか。
6. 自動割り当てで「1つの `(lane, row)` に1ノード」という前提が抜け落ちた理由を、移植元では lane/row を人が与えていたことから説明できるか。また、既存テストがなぜその不具合を捕まえられなかったか(期待値と `metrics.overlaps` の意味)を説明できるか(11-7)。

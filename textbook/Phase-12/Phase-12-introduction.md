# Phase 12 導入: 承認フロー(M7)と draw.io/SVG の出力(M8)・ダウンロード

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節 ステージ3ロードマップの「Phase 12: 承認フロー・draw.io/SVG出力・ダウンロード」を実装する。対象は次の2つである。

- **M7(状態遷移)**: `draft → reviewing → approved → exported`。承認した後に編集したら `reviewing` へ戻す。
- **M8(出力)**: 決定的(AI 非依存)な出力エンジンで、承認済みの図を `.drawio` と `.svg` に書き出してダウンロードさせる。

画面は SCR-007([`docs/external_design.md`](../../docs/external_design.md) 2.6節)のレビュー画面(Phase 11)に、承認と出力の操作を足す。

あわせて、[`Phase-11-introduction.md`](../Phase-11/Phase-11-introduction.md)「後続 Phase への申し送り」を解消する。

- 折れ点が空(`points=[]`)の辺は、draw.io では `orthogonalEdgeStyle` に任せる(D2)。SVG では出力の時点で簡易な経路を作る(12-3)。
- M7 を実装する(12-1)。レビュー画面の状態表示は、読み取り専用から操作できる形になる(12-5)。
- 格子配置の要素(`lane=0, row=0`)は、レーン帯を描かないので区別しなくてよい(下の確定事項4)。
- 手動移動の後の `metrics` は再計算しないまま残る。出力は `metrics` を使わないため、影響しない。

## 実装前の設計判断(このセッションで確定)

着手前の相談で、次の4点を確定した。詳細は [`textbook/q_a.md`](../q_a.md) を参照。

1. **状態遷移**
   - 保存(PUT。座標だけの保存を含む)と自動レイアウト(POST /layout)を行うと、どの状態からでも `reviewing` になる。
   - 承認は `draft` と `reviewing` から行える。AI の出力を手直しせずに承認するケースがあるため、`draft` からも許す。
   - 承認は `{version}` を受け取り、画面で見ていた版と違えば 409 にする。
   - 出力の GET が成功したら、`approved` を `exported` にする。
   - 状態が変わっても `version` は増やさない。`version` は内容の楽観ロック専用である。
2. **辺ラベルはレイアウトエンジンで配置する**
   - Phase 9 で移植済みの `place_labels` を有効にし、配置した位置を `LayoutEdgeGeometry.label_pos` に保存する(Phase 9 への #12 遡及)。
   - 出力の時点で中点に置くだけの案もあった。しかし、それではラベルがノードや他のラベルと重なる。
3. **SVG での `points=[]` の辺は、出力の時点で簡易な直交経路を計算する**
   - 経路はZ字またはL字で、ノードは避けない(既知の制約)。
   - 承認の前に自動レイアウトを必須にする案もあった。しかしそれでは手で決めた配置が失われる。
4. **レーン帯は描かない**
   - レビュー画面にもレーン帯はまだ無い。承認した見た目と出力を一致させるためである。
   - レーン帯は、レビュー画面に表示するときにまとめて扱う(時期は未定)。

## パイプライン上の位置づけ・前提

```
配置:  POST /layout ─ edge_labels(ER多重度・DFDデータ項目名) → compute_layout → label_pos も保存   (12-2)
        │                                                              status → reviewing (12-1)
保存:  PUT /diagrams/{id} ─ reconcile_layout(points=[] の辺は label_pos も捨てる)  status → reviewing
承認:  POST /approve {version} ─ 生成中? → version? → 状態? → 全要素の配置? → 検証?  status → approved
出力:  GET /export/drawio | /export/svg ─ build_render → to_drawio | to_svg (12-3)  status → exported (12-4)
[FE]:  DiagramReviewActions ─ 承認(未保存なら先に保存) / 出力 → saveFile → 図を取り直す      (12-5)
```

- **前提として読むもの**:
  - [`Phase-9-introduction.md`](../Phase-9/Phase-9-introduction.md): 移植したレイアウトエンジン(`place_labels` を含む `finalize.py`)と、出力を移植しなかった理由(描画属性は Phase 12 の関心事)。
  - [`Phase-11-introduction.md`](../Phase-11/Phase-11-introduction.md): 手動座標の保存(`reconcile_layout`)、D2(`points=[]`)、「未保存の変更を先に保存してからサーバーの処理を呼ぶ」順序。
  - [`Phase-7-4.md`](../Phase-7/Phase-7-4.md): 移植元エンジンの構造(D3: コピー+出自の明記)。
- **本 Phase 開始時点の状態**:
  - `uml_diagrams.status` は、既定の `draft` から変わらない(AI の再生成が `draft` を書き込むだけ)。
  - 移植元の `Diagram.to_svg`/`to_drawio` は、Phase 9 では移植していない。
  - `place_labels` は移植済みだが、devex の意味モデルは辺ラベルを持たないため、`LayoutEdge.label` は常に空で、何もしていなかった。
- **既存コードに前例が無い新規パターン**:
  1. 状態遷移の規則を、DB にも HTTP にも依存しない純粋関数のモジュール(`app/uml/domain/status.py`)に集め、サービスはそれを呼ぶだけにする。
  2. 「何を描くか」を中間表現(`RenderDiagram`)に1回だけ決め、「どう書くか」を形式ごと(SVG/draw.io)に分ける。
  3. GET で状態を変える(出力の記録)。docs の API 表どおり GET のままにし、何度出力しても `exported` のままという冪等な変更に留める。

## モード宣言(#21)

- **12-4 だけを納期モード**にする。
  - 条件(a): ルート2本の配線、`content_disposition` の移動、ファイル名の組み立てが中心で、定型が過半。
  - 条件(b): コアループ(チャット ↔ 4文書生成)ではない。
- **残りの章は学習モード**。状態遷移の置き場所、辺ラベルをエンジンで配置する判断、中間表現による出力の分割、「先に保存してから承認」の順序は、いずれも設計判断そのものだからである。
- 12-3 の `svg.py`・`drawio.py` は移植元の逐語コピーが多く、写経レベルは「定型」とした。ただし章の中心である `render.py` が「コア」なので、章としては学習モードのままにした。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-12-1.md`](./Phase-12-1.md) | BE: 状態遷移(M7)を純粋関数に集め、承認 API を足す | 学習 | なし |
| [`Phase-12-2.md`](./Phase-12-2.md) | BE: 辺ラベルをレイアウトエンジンで配置する(Phase 9・11 への遡及) | 学習 | なし |
| [`Phase-12-3.md`](./Phase-12-3.md) | BE: 出力エンジン `app/uml/export/`(中間表現・SVG・draw.io、純粋) | 学習 | 12-1, 12-2 |
| [`Phase-12-4.md`](./Phase-12-4.md) | BE: 出力 API とダウンロード用ヘッダーの共通化 | 納期 | 12-1, 12-3 |
| [`Phase-12-5.md`](./Phase-12-5.md) | FE: 承認・出力の操作、M7・D6 の注意書き、ダウンロード部品の共通化 | 学習 | 12-1, 12-4 |

12-3 が 12-1 に依存するのは、出力エンジンが配置の無い要素を `UmlLayoutRequiredError`(12-1 で追加)で拒否するためである。

## サンプルコード一覧

- **バックエンド**(`textbook/samples/backend/`、`devex-api/backend/` と同じ相対パス):
  - 新規: `app/uml/domain/status.py`、`app/uml/layout/labels.py`、`app/uml/export/{__init__,render,svg,drawio}.py`、`app/api/responses.py`
  - 新規(テスト): `tests/unit/test_uml_diagram_status.py`、`tests/unit/test_uml_layout_labels.py`、`tests/unit/test_uml_export_{render,svg,drawio}.py`
  - 更新: `app/uml/domain/__init__.py`、`app/services/errors.py`、`app/services/uml_diagram_service.py`、`app/schemas/uml_diagram.py`、`app/api/routes/{uml,projects}.py`、`app/uml/layout/{__init__,model,reconcile,finalize}.py`
  - 更新(テスト): `tests/unit/test_uml_diagram_{service,routes}.py`、`tests/unit/test_uml_layout_{compute,reconcile}.py`、`tests/unit/test_document_download.py`
- **フロントエンド**(`textbook/samples/frontend/`、`devex-ui/` と同じ相対パス。ただし `src/app/(pages)/(protected)/` は `src/app/` に平坦化):
  - 新規: `src/lib/api/download.ts`、`src/features/uml/components/DiagramReviewActions.tsx`
  - 新規(テスト): `src/lib/api/__tests__/download.test.ts`、`src/features/uml/components/__tests__/DiagramReviewActions.test.tsx`
  - 更新: `src/lib/api/client.ts`、`src/features/documents/api/documentsApi.ts`、`src/features/documents/components/DocumentMarkdownView.tsx`、`src/features/uml/api/{types,umlApi}.ts`、`src/features/uml/uml-editor-store.ts`、`src/features/uml/components/UmlDiagramPageContent.tsx`
  - 更新(テスト): `src/features/uml/api/__tests__/umlApi.test.ts`、`src/features/uml/__tests__/uml-editor-store.test.ts`、`src/features/uml/components/__tests__/UmlDiagramPageContent.test.tsx`
- samples に無い本体だけの変更: `devex-ui` のデモページ(`/uml-demo`、Phase 11 で devex-ui だけに追加)を Phase 12 に合わせて広げた(Phase 12 完了後の依頼。[`q_a.md`](../q_a.md) 参照)。
  - 承認・出力も、バックエンド無しで試せるようにした。承認は状態を `approved` にする(検証による拒否は起きない)。出力は、実エンジンで書き出したファイル(`demo/demoExports.ts`)を保存させる。保存・自動レイアウトでは `reviewing` に戻る。
  - 「3. 出力のプレビュー」節に、記法ごとの出力 SVG を表示する。
  - `demoModels.ts` の配置を、Phase 12 のエンジン(辺ラベルつき)で作り直した。座標は変わらず、`label_pos` だけが加わった。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 12-1 | `app/uml/domain/status.py`(新規)、`errors.py`・`uml_diagram_service.py`・`schemas/uml_diagram.py`・`routes/uml.py`・`domain/__init__.py`(更新) | 状態遷移の規則を1か所に置き、保存・自動レイアウトで `reviewing`、承認は5つの条件を確かめてから `approved` | `uv run pytest tests/unit/test_uml_diagram_status.py tests/unit/test_uml_diagram_service.py tests/unit/test_uml_diagram_routes.py` |
| 12-2 | `app/uml/layout/labels.py`(新規)、`layout/{__init__,model,reconcile}.py`・`uml_diagram_service.py`(更新) | 辺ラベルの文言を組み立て、エンジンに位置を探させて `label_pos` に保存する。手で動かした辺ではラベル位置も捨てる | `uv run pytest tests/unit/test_uml_layout_labels.py tests/unit/test_uml_layout_compute.py tests/unit/test_uml_layout_reconcile.py tests/unit/test_uml_diagram_service.py` |
| 12-3 | `app/uml/export/{render,svg,drawio,__init__}.py`(新規)、`layout/{__init__,finalize}.py`(更新) | 意味モデル+配置+ラベル → 中間表現 → SVG / draw.io。`points=[]` の辺は簡易経路(SVG)・`orthogonalEdgeStyle`(draw.io) | `uv run pytest tests/unit/test_uml_export_render.py tests/unit/test_uml_export_svg.py tests/unit/test_uml_export_drawio.py` |
| 12-4 | `app/api/responses.py`(新規)、`routes/{uml,projects}.py`・`uml_diagram_service.py`・`errors.py`(更新) | 承認済みの図だけを出力し、`exported` にする。ファイル名の禁止文字を置き換える | `uv run pytest tests/unit/test_uml_diagram_service.py tests/unit/test_uml_diagram_routes.py tests/unit/test_document_download.py` |
| 12-5 | `src/lib/api/download.ts`・`components/DiagramReviewActions.tsx`(新規)、`client.ts`・`documentsApi.ts`・`DocumentMarkdownView.tsx`・`umlApi.ts`・`types.ts`・`uml-editor-store.ts`・`UmlDiagramPageContent.tsx`(更新) | 承認(未保存なら先に保存)と出力の操作。状態ごとにボタンを出し分け、M7・D6 の注意を出す | `npx vitest run src/lib/api src/features/uml src/features/documents` |

## 写経順序(#23)

章番号順(12-1 → 12-2 → 12-3 → 12-4 → 12-5)に進める。12-2 は 12-1 に依存しないので、先に写経してもよい。各章の中は依存順(#30)で、順番は各章の表を参照。

次のファイルは、複数の章で少しずつ完成する。各章の担当分には `# Phase-12-<n>:追記` / `# Phase-12-<n>：更新` のタグを付けてある。写経するときは、その章までのタグの部分だけを書く。

- `app/services/uml_diagram_service.py`(12-1 → 12-2 → 12-4)
- `app/services/errors.py`(12-1 → 12-4)
- `app/api/routes/uml.py`(12-1 → 12-4)
- `app/uml/layout/__init__.py`(12-2 → 12-3。`element_kind`/`element_text` を公開名にするのは 12-3)
- `tests/unit/test_uml_diagram_service.py`・`tests/unit/test_uml_diagram_routes.py`(12-1 → 12-2 → 12-4)

途中に古い Phase のコードが続く箇所には、`# ── ここから Phase-<N>-<n> の作成分 ──` という境界の印を付けた(#12 の「章番号が後退する境界では必ず再タグを付ける」)。

## Stage 3 固有の運用(Phase 7 から継続)

`textbook/samples/` への反映と並行して、Claude が本体に直接実装する。対象は `devex-api`(`stage3` ブランチ)と `devex-ui`(`main`)。samples 側の Phase タグは本体には書かない。

## 後続 Phase への申し送り

- **Phase 13(図による補完・zip)**:
  - 内部設計書のプレビューへの SVG の差し込みは、12-3 の `build_render` → `to_svg` をそのまま使える。承認済み(`approved`/`exported`)の図だけを差し込む。
  - zip ダウンロード(md + 図ファイル、D8)で、図のファイル名を決めるときは、12-4 の `_export_filename`(禁止文字の置き換え)を共有する。
  - 図を差し込んだ文書を出力しても、図の状態は `exported` にしない。`exported` は、図そのものを出力した記録である。どう扱うかは Phase 13 で決める。
- **出力の既知の制約**:
  - 手で動かしたノードにつながる辺は、SVG では簡易な直交経路で描く。そのため、ノードを避けず、ラベルがノードに重なることがある。自動レイアウトを再実行すれば解消する。
  - データ項目の名前を変えても、`label_pos` は自動レイアウトを再実行するまで旧名の幅で計算したままになる。出力するラベルの文字列は、新しい名前になる。
  - レビュー画面(React Flow)は、ラベルを線の中央に置く。エンジンが計算した `label_pos` は、出力だけが使う。
- **後続(時期は未定)**:
  - レーン帯の表示(レビュー画面と出力の両方)。配置はレーン番号だけを持ち、ラベルは持たない。格子配置の要素(`lane=0, row=0`)と自動レイアウトの結果とを区別する必要がある(Phase 11 からの申し送りを持ち越す)。
  - 承認の取り消し(`approved` → `reviewing` を保存せずに行う操作)。今は、保存すれば `reviewing` に戻る。
- **検証していないこと**:
  - Docker が使えないため、ブラウザでの目視確認は未実施である。
  - 出力した `.drawio` を draw.io で開く確認も未実施である。テストでは XML としてパースできることだけを確認した。
  - SVG は、ヘッドレス Chromium で PNG にして目視した。自動レイアウトの図は重なりなし。手で動かした図では、上の既知の制約を確認した。

## 後続 Phase での改訂

(なし)

## Phase 完了チェック(#22)

1. 状態遷移の規則をサービスのメソッドの中に書かず、`app/uml/domain/status.py` の純粋関数に集めた理由を、テストのスタブの要否(12-1 のテスト観点)から説明できるか。
2. 承認で `version` を確かめるのに、状態が変わっても `version` を増やさない理由を、「`version` は何の楽観ロックか」から説明できるか。
3. 辺ラベルの位置を出力の時点で決めず、レイアウトエンジンに探させて保存した理由と、その代わりに `reconcile_layout` で `points=[]` の辺の `label_pos` を捨てる必要が生じた理由を説明できるか。
4. 出力を「中間表現(`build_render`)→ 形式ごとの書き出し」に分けたことで、`points=[]` の辺の扱いが SVG と draw.io でどう分かれたかを説明できるか(D2)。
5. draw.io のセルの値を2回エスケープする理由(`html=1` のセルは値を HTML として解釈する)を、テスト `test_to_drawio_escapes_values_twice_for_html_labels` から説明できるか。

# Phase-9-4: 仕上げ処理+交差削減

## この章の目的

経路探索(9-3)後の辺の点列を仕上げる処理(出入口オフセット・通路スロット割当・ポート順序最適化・ラベル配置・指標計測)と、それらを束ねる`route()`相当のオーケストレーション(`pipeline.py`)、さらに行の入れ替えによる交差削減の山登り(`crossing_reduction.py`、移植元との対比での簡略化を含む)を実装する。

学習モード([introduction](./Phase-9-introduction.md)参照)。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30)。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/layout/finalize.py`](../samples/backend/app/uml/layout/finalize.py) | 新規 | **コア** | 出入口オフセット(`_assign_ports`)・通路スロット割当(`assign_slots`、区間スケジューリング)・再ルーティング(`reroute_final`)・ポート順序最適化(`optimize_ports`、4本以下は全順列/5本以上は山登り)・スロット順序最適化(`optimize_slots`)・ラベル配置(`place_labels`)・指標計測(`count_metrics`/`measure`) |
| [`app/uml/layout/pipeline.py`](../samples/backend/app/uml/layout/pipeline.py) | 新規 | 定型 | ジオメトリ→経路探索→仕上げ処理のオーケストレーション(移植元の`Diagram.route()`相当) |
| [`app/uml/layout/crossing_reduction.py`](../samples/backend/app/uml/layout/crossing_reduction.py) | 新規 | **コア** | 同じレーン内での行入れ替え山登りによる交差削減。**全要素を対象にする**という決定的な簡略化 |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_layout_finalize.py`](../samples/backend/tests/unit/test_uml_layout_finalize.py) | 新規 | **コア** | ポートグループ化・オフセット計算・通路スロットの区間スケジューリング・指標計測 |
| [`tests/unit/test_uml_layout_pipeline.py`](../samples/backend/tests/unit/test_uml_layout_pipeline.py) | 新規 | **コア** | シンプルな配置での交差ゼロ、行入れ替えによる交差解消のゴールデンテスト |

## 設計判断

### なぜ「全要素を交差削減の対象にする」という簡略化を行ったか(移植元との対比)

移植元エンジンは`Diagram.allow_swap(*ids)`で「行の入れ替えを許すノード」を人が明示的に宣言する前提だった(手で配置した行の意図を保護するため、DFD等の一部の図だけがこの山登りの対象になっていた)。devexでは行(row)自体が`ranking.py`(9-1)によって全て自動算出されるため、保護すべき「人が意図して配置した行」が存在しない。よって`crossing_reduction.optimize`では意味モデルの全要素を交差削減の対象にする、という決定的な簡略化を行った。これは移植元エンジンより単純だが、devexの前提(lane/rowが常に自動算出)に照らして正当な単純化であり、CLAUDE.md #17の「以前のPhaseのコードを共通化のために触ってよいか」の判断基準とは別の、**移植元(別リポジトリ)との差分を明示する**という文脈での判断である。

### なぜポート順序最適化(`optimize_ports`)は4本以下と5本以上で戦略を変えるか

同じノード・同じ側に複数の辺が集まる場合、その並び順を入れ替えることで交差・重なりを減らせる。全順列を試すアプローチは`k`本の辺に対し`k!`通りかかり、5本で120通り・6本で720通りと非現実的に増える。移植元の実装をそのまま踏襲し、4本以下(`4! = 24`通りまで)は全順列を試して真の最適解を求め、5本以上は隣同士の入れ替えの山登り(近似解)に切り替える閾値にした。

### なぜ`route()`相当の関数を独立した`pipeline.py`に切り出したか

`crossing_reduction.optimize`は内部で「ジオメトリ→経路探索→仕上げ処理」の一連の流れ(移植元の`Diagram.route()`相当)を繰り返し呼ぶ必要がある。この一連の流れは`geometry.py`(9-2)・`routing.py`(9-3)・`finalize.py`(本章)の3ファイルにまたがるため、どの既存ファイルに置いても他のファイルへの前方参照になってしまう。CLAUDE.md #15の前方import禁止に従い、この3ファイルが全て出揃った本章(9-4)で初めて`pipeline.py`という薄いオーケストレーション専用ファイルを新設し、そこに置いた。

## テスト観点(#14)

**SUT/ドライバ/スタブ**の用語定義は[Phase-8-1.md](../Phase-8/Phase-8-1.md)参照。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `_assign_ports`/`_offs_from_groups` | pytest(直接呼び出し。前段で`pipeline.route`を実行し`choice`を確定させる) | スタブ不要 ── 対象が純粋なため | `test_uml_layout_finalize.py` |
| `assign_slots` | pytest(直接呼び出し。`choice`を直接gapタグに設定し区間スケジューリングのロジック単体を検証) | スタブ不要 ── 同上 | 同上。同じ通路(gap)でも区間が重なる辺には別スロットが割り当てられることを確認 |
| `measure`/`count_metrics` | pytest(直接呼び出し、`pipeline.route`経由) | スタブ不要 ── 同上 | 同上。`report`に期待するキーが揃うことを確認 |
| `pipeline.route`(ゴールデンテスト) | pytest(直接呼び出し) | スタブ不要 ── 同上 | `test_uml_layout_pipeline.py`。シンプルな2レーン3ノードの配置で交差数0・衝突数0を主張 |
| `crossing_reduction.optimize` | pytest(直接呼び出し) | スタブ不要 ── 同上 | 同上。X字に交差する初期配置が、行の入れ替えにより交差数0まで改善することを確認(ゴールデンテスト) |

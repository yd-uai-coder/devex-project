# Phase-9-3: 経路探索

## この章の目的

移植元エンジンの辺の経路探索(候補生成・妥当性チェック・コスト計算・貪欲選択)を移植する。辺の出入口の側(t/b/l/r)×通路(direct/L1/L2/gap/gutter)の組み合わせを全て候補として生成し、コスト最小のものを選ぶ。

自動実装モード: on([introduction](./Phase-9-introduction.md) 参照)。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30)。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/layout/routing.py`](../samples/backend/app/uml/layout/routing.py) | 新規 | **コア** | 経路候補生成(`_candidates`)・妥当性チェック(`_valid`)・コスト計算(`_cost`、用途コメント付き定数)・2ラウンド貪欲選択(`route_edges`)。経路探索失敗の例外化 |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | `LayoutRouteNotFoundError`を追加 |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_layout_routing.py`](../samples/backend/tests/unit/test_uml_layout_routing.py) | 新規 | **コア** | 隣接行の直行接続、独立した2辺の交差回避、経路探索失敗時の例外化(monkeypatchで候補ゼロを再現) |

## 設計判断

### なぜ`_cost()`の重み定数に用途コメントを付けたか(Phase-7-4.md申し送り#3)

移植元の`_cost()`は「交差+400」「重なり+1500」のようなマジックナンバーが無コメントで埋め込まれていた。移植にあたり、`_LENGTH_WEIGHT`(経路長のペナルティ)・`_BEND_PENALTY`(折れ1箇所)・`_BACKWARD_EXIT_PENALTY`(出入口の向きの不自然さ)・`_NODE_COLLISION_PENALTY`(ノード衝突、実質不採用)・`_EDGE_CROSSING_PENALTY`(既存辺との交差)・`_EDGE_OVERLAP_BASE_PENALTY`(既存辺との重なり)・`_SHARED_CHANNEL_PENALTY`(通路の混雑)という名前付き定数に分解し、それぞれの用途をコメントで明記した。数値自体(400/1500/25/60/100000/8等)は移植元での実績をそのまま踏襲し、変更していない(実績のあるチューニング値を、根拠なく変えるリスクを避けるため)。

### なぜ経路探索失敗(`LayoutRouteNotFoundError`)のテストをmonkeypatchで再現したか

候補生成(`_candidates`)は、出入口4方向×4方向×(直行/L字2種/gap全行/gutter全レーン)という非常に多くの候補を生成するため、実際の意味モデルからこの例外を自然に発生させる入力を作るのは現実的でない(ほぼ必ず何らかの候補が見つかる設計になっているため)。そのため、`route_edges`内の「候補が1つも見つからなかった場合」というガード条件自体を、`_candidates`を空のイテレータに差し替えるmonkeypatchで直接検証した。これは「本当に発生しうるレアケース」ではなく「ガードロジックが正しく機能すること」を確認するテストである。

## テスト観点(#14)

**SUT/ドライバ/スタブ**の用語定義は[Phase-8-1.md](../Phase-8/Phase-8-1.md)参照。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `route_edges`(正常系) | pytest(直接呼び出し。`geometry.py`のジオメトリ計算を前段で実行) | スタブ不要 ── 対象が純粋(`LayoutState`を直接構成して渡すのみ)なため | `test_uml_layout_routing.py`。隣接行の直行接続(折れが少ない)、独立した2辺が交差しないことを確認 |
| `route_edges`(異常系) | pytest(直接呼び出し、`monkeypatch`で`_candidates`を差し替え) | `_candidates`をスタブ化(空のイテレータを返す) ── ガードロジック自体の検証が目的で、実際の候補生成ロジックは対象外のため | 同上 |

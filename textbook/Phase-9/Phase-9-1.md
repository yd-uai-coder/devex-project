# Phase-9-1: レーン/行割り当て

## この章の目的

意味モデル(`app/uml/domain`の要素・関係)からレイアウト計算に必要なlane(レーン、列)・row(行)を算出する、移植元には無い新規アルゴリズムを実装する。移植元エンジンは`Diagram.node(id, lane, row, ...)`で人手指定する前提のため、この自動割り当てはdevex独自に設計する必要がある(`appendix/stage3-requirements-organization.md`診断3)。

学習モード([introduction](./Phase-9-introduction.md)参照)。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30)。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/layout/ranking.py`](../samples/backend/app/uml/layout/ranking.py) | 新規 | **コア** | lane算出(`layer`属性の初出順+未設定要素のフォールバックレーン。ERは単一レーン固定)、row算出(DFSによるback edge検出+`graphlib`による最長経路レイヤリング。ERは定義順index) |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_layout_ranking.py`](../samples/backend/tests/unit/test_uml_layout_ranking.py) | 新規 | **コア** | 直線状・ダイヤモンド状・循環を含むグラフでのrow算出、layer初出順でのlane算出、ERの単一レーン+定義順row |

## 設計判断

### なぜ「最長経路法+循環除去」でrowを算出するか

`appendix/stage3-requirements-organization.md`診断3は「行は最長経路法による層分けと循環辺の除去」と明記しており、これはSugiyamaフレームワークの層(layer/rank)割り当てとして標準的な手法である。実装は、DFSで木の祖先へ戻る辺(back edge)を検出してランク計算から除外し(GraphViz/dotのrank計算等で使われる一般的な近似手法。最小feedback arc setの厳密解ではない)、残った有向非巡回グラフを標準ライブラリ`graphlib.TopologicalSorter`で層分けする。入力の無いノードはrow=0になる。

```python
# app/uml/layout/ranking.py(抜粋。_longest_path_rank)
sorter: TopologicalSorter[str] = TopologicalSorter(dict.fromkeys(node_ids, ()))
for a, b in edges:
    if (a, b) not in back_edges:
        sorter.add(b, a)  # bはaの後(aが前提)
sorter.prepare()
while sorter.is_active():
    ready = sorter.get_ready()  # 前提を全て処理し終えたノードの1バッチ
    for n in ready:
        rank[n] = level  # バッチ番号 = 最長経路rank
    sorter.done(*ready)
    level += 1
```

`get_ready()`は「前提ノードが全て`done()`済みになったノード」を1バッチずつ返すので、バッチ番号はそのまま「入ってくる辺の中で最大のrank+1」(最長経路rank)になる。当初は`deque`でKahnのアルゴリズムを手書きしていたが、同じ結果を標準ライブラリで得られるため置き換えた(次節「ライブラリ適用の検討」)。

### ライブラリ適用の検討(networkx等を採用しなかった理由)

レイアウト処理全体(`app/uml/layout/`)について、ライブラリで簡略化できる箇所を検討した。前提は要素数 n ≦ `MAX_ELEMENTS`(30)。

| 箇所 | 候補 | 判定 | 理由 |
|---|---|---|---|
| row算出のトポロジカル層分け | 標準ライブラリ`graphlib` | **採用** | 依存追加ゼロ。ランダムな2000グラフ(n≦30、循環あり)で手書き版と結果が完全一致することを確認済み |
| 同上 | networkx `topological_generations` | 不採用 | 置き換えられる量は`graphlib`と同じ。一方で`import networkx`だけで約17.8MB(tracemallocのピーク値)・初回約2.7秒かかり、グラフ構築+計算も約52KB(`graphlib`版は約16KB、手書き版は約12KB)。n≦30では得るものが無い |
| back edge検出(DFS) | networkx `dfs_labeled_edges` / `condensation` | 不採用(自作DFSを維持) | `dfs_labeled_edges`はback edgeを交差辺・前進辺と区別せず`nontree`にまとめるので、結局この判定を自前で書く必要がある。強連結成分への縮約は循環内の全ノードを同じ行にしてしまい、同一レーン内でノードが重なる |
| 辺の経路探索・仕上げ処理(9-3・9-4) | graphviz(dot)・grandalf・libavoid | 不採用 | 「レーン×行の格子上の直交ルーティング」という前提に合うPythonライブラリが無い。graphvizはシステムバイナリが必要で、レーン制約を表現できない。grandalfはメンテナンスが止まっている |
| 線分の交差・衝突判定(9-2 `model.py`) | shapely | 不採用 | 各10行程度で、軸平行専用・±1pxの許容・端点は数えないという独自の意味を持つ。shapelyの`intersects`等とは挙動が違い、C拡張(GEOS)への依存も増える |
| 交差削減の山登り(9-4) | ― | 対象外 | 重いのはCPU(`route()`の繰り返し呼び出し)で、グラフライブラリを入れても軽くならない |

**判断の軸**: 依存を1つ増やすコスト(メモリ・起動時間・Dockerイメージ・保守)が、削れる行数に見合うかどうか。削れる行数が少なく、標準ライブラリで同じことができるなら標準ライブラリを使う。

### なぜlaneは「レーン(列)」・rowは「行」という対応にしたか

移植元の命名(`lane`=列、`row`=行、レーンが横に並び、行が縦の時系列)をそのまま踏襲した。laneは`ComponentElement`/`DfdProcess`が持つ`layer`属性(モジュール層・actor等)から決まり、これは意味モデルの設計判断(Phase 8)そのものを流用する。rowは関係(依存・フロー)から機械的に計算される。

### なぜER図だけ最長経路法を使わないか

ER図の関係(`ErRelation.relation_type`)は多重度(one_to_one/one_to_many/many_to_many)を表すだけで、時系列や依存の向きを持たない。最長経路法をそのまま適用すると意味の無い順序が生まれてしまうため、このセッションでの相談を経て「ER図は単一レーン(`lane=0`固定)+意味モデル内の定義順index」という機械的なフォールバックに決定した(詳細は[introduction](./Phase-9-introduction.md)「実装前の設計判断」・[`decision-digest.md`](../decision-digest.md)参照)。

### なぜlane未設定の要素を例外にせず「共有のフォールバックレーン」にまとめるか

AI生成(Phase 10)や手動編集の初期段階では、すべての要素に`layer`が設定されているとは限らない。未設定を例外扱いにするとレイアウト計算自体が止まってしまうため、`layer`を持たない要素は末尾に追加した共有のフォールバックレーン(見出し無し、`None`)にまとめ、レイアウト自体は常に完了できるようにした。

## テスト観点(#14)

**SUT/ドライバ/スタブ**の用語定義は[Phase-8-1.md](../Phase-8/Phase-8-1.md)参照。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `assign_lanes_and_rows` | pytest(直接呼び出し) | スタブ不要 ── 対象が純粋(意味モデルの要素・関係を直接渡すのみ、DB・外部依存を一切呼ばない)なため | `test_uml_layout_ranking.py`。直線状・ダイヤモンド状・循環を含む3パターンのrow算出、layer初出順でのlane算出、ER図の単一レーン+定義順rowを確認 |

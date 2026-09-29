# Phase-9-2: 文字幅推定+ジオメトリ

## この章の目的

移植元エンジンの文字幅推定(`wrap`/`tw`/`cw`)を逐語移植し、レイアウト計算の内部表現(`LayoutNode`/`LayoutEdge`/`LayoutState`、出力スキーマ`LayoutModel`)を定義した上で、レーン幅・ノードサイズ・行位置・ポート座標を計算する`geometry.py`を実装する。

学習モード([introduction](./Phase-9-introduction.md)参照)。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30)。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/layout/text.py`](../samples/backend/app/uml/layout/text.py) | 新規 | 定型 | 日本語文字幅推定(`cw`/`tw`)・折り返し(`wrap`)。移植元からの逐語移植 |
| [`app/uml/layout/model.py`](../samples/backend/app/uml/layout/model.py) | 新規 | **コア** | レイアウト内部表現(`LayoutNode`/`LayoutEdge`/`LayoutState`)・幾何プリミティブ(`seg_hits_rect`/`seg_cross`/`seg_overlap`/`clean`)・出力スキーマ(`LayoutBox`/`LayoutEdgeGeometry`/`LayoutMetrics`/`LayoutModel`) |
| [`app/uml/layout/geometry.py`](../samples/backend/app/uml/layout/geometry.py) | 新規 | **コア** | レーン幅(均等割り)・ノードサイズ・行位置・ポート座標の計算。幅960px超過の例外化 |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | `LayoutWidthExceededError`を追加 |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_layout_geometry.py`](../samples/backend/tests/unit/test_uml_layout_geometry.py) | 新規 | **コア** | レーン幅の均等割り・幅超過例外・ノードサイズ(proc/table)・行位置・ポート座標の計算 |

## 設計判断

### なぜ移植元の`Diagram`クラスを1つのクラスとして移植しなかったか

移植元エンジンは`Diagram`クラスのメソッド(`self.xxx()`)として幾何計算・経路探索・仕上げ処理を実装しているが、devexではCLAUDE.md #30の依存順ファイル分割(章ごとに1ファイル)に合わせ、可変状態(`LayoutState`)を受け取る関数群として`geometry.py`/`routing.py`(9-3)/`finalize.py`(9-4)/`crossing_reduction.py`(9-4)に分割した(`self.method()` → `function(state)`という書き換え。アルゴリズム自体は不変)。`LayoutState`自体は`model.py`にまとめている。

### なぜ`lane_weights`/`lane_w_hint`を持たない均等割りに簡略化したか

移植元の`_lane_geometry`は、レーンごとの重み(`lane_weights`)や明示的な幅ヒント(`lane_w_hint`)を受け取れるが、devexにはAIが出力するレーン幅ヒントに相当する入力が無い。よって全レーンを均等幅として扱う簡略化を行った。この結果、幅960px超過(`_ensure_width_within_limit`)は現在の計算式では理論上到達しないが(`n * min(320, avail/n) + 2*MARGIN <= avail + 2*MARGIN == MAX_W`という不変条件)、将来レーンごとの幅ヒントを追加する等でこの不変条件が崩れた場合に備え、独立した関数として残した(移植元の`_lane_geometry`の`assert`を`LayoutWidthExceededError`に置き換えたもの。Phase-7-4.md申し送り#1)。テストは、この理論上到達しない性質を明記した上で、ガード関数自体を直接呼んで検証している。

### なぜノードの`kind`を移植元の語彙そのまま(`proc`/`ent`/`store`/`table`/`dec`/`term`)残すか

Stage 3のMust notation(component/ER/DFD)が実際に使うのは`proc`(コンポーネント/DFD処理)・`ent`(DFD外部実体)・`store`(DFDデータストア)・`table`(ERテーブル)の4種のみだが、`dec`(六角形の分岐)・`term`(丸みを帯びた終端)はPhase 14のactivity図が必要とする可能性が高く、移植元のサイズ計算・ポート位置計算のロジックをそのまま流用できる(同じドメインの事実の共有、CLAUDE.md #17)。空撃ちのコード追加ではなく、既に移植元に実装されている分岐を消さずに残しただけであり、Phase 9時点で追加のテストや複雑さを要求しない。

## テスト観点(#14)

**SUT/ドライバ/スタブ**の用語定義は[Phase-8-1.md](../Phase-8/Phase-8-1.md)参照。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `compute_lane_geometry` | pytest(直接呼び出し) | スタブ不要 ── 対象が純粋(`LayoutState`を直接構成して渡すのみ)なため | `test_uml_layout_geometry.py`。均等割りの幅計算、多数レーンでも上限内に収まる不変条件を確認 |
| `_ensure_width_within_limit` | pytest(直接呼び出し) | スタブ不要 ── 同上 | 同上。現在の計算式では到達しない例外パスを、ガード関数を直接呼んで検証 |
| `size_nodes` | pytest(直接呼び出し) | スタブ不要 ── 同上 | proc種別の折り返し、table種別の生行(折り返し無し)を確認 |
| `place_rows` | pytest(直接呼び出し) | スタブ不要 ── 同上 | 行の縦位置(上から下)・図全体の高さを確認 |
| `port_center`/`port_at` | pytest(直接呼び出し) | スタブ不要 ── 同上 | 4方向のポート座標・オフセットの向きを確認 |

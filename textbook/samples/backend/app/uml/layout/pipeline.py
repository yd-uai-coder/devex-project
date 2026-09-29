# 作成：Phase-9-4
# 写経レベル: 定型 ── geometry/routing/finalizeを順に呼ぶだけのオーケストレーション。
"""ジオメトリ計算→経路探索→仕上げ処理のオーケストレーション。"""

from app.uml.layout.finalize import finalize
from app.uml.layout.geometry import compute_lane_geometry, place_rows, size_nodes
from app.uml.layout.model import LayoutState
from app.uml.layout.routing import route_edges


def route(state: LayoutState) -> None:
    """レイアウトを1回計算する: レーン幅→ノードサイズ→行位置→辺のルーティング→仕上げ処理、
    の順に実行し、`state`を書き換える。`crossing_reduction.optimize`から繰り返し呼ばれる。
    """
    state.report = {}
    compute_lane_geometry(state)
    size_nodes(state)
    place_rows(state)
    route_edges(state)
    finalize(state)

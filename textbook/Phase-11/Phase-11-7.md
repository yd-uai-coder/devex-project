# Phase-11-7: レイアウトエンジンの重なり修正(Phase 9 への #12 遡及)

## この章の目的

自動レイアウトで、ノードが同じ位置に重なって置かれる不具合を直す。同じレーン(レイヤー)の中に、依存の深さが同じ要素が2つ以上あると起きる。AI 生成の図でも普通に起こる形である。

この不具合は、11-5 のデモページ(`/uml-demo`)をブラウザで確認して見つかった。Phase 9 のコードの修正だが、Phase 11 が未コミットのうちに見つかったため、Phase 11 の章として記録する(#12)。

自動実装モード: on([introduction](./Phase-11-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/layout/model.py`](../samples/backend/app/uml/layout/model.py) | 更新 | 定型 | `LayoutMetrics` の docstring に、3つの指標がすべて線についてのもので、ノードの重なりは数えないことを明記する |
| [`app/uml/layout/ranking.py`](../samples/backend/app/uml/layout/ranking.py) | 更新 | **コア** | `_longest_path_rank` を `_assign_rows(node_ids, edges, lane_of)` に置き換える。レーンごとに1行1ノード |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_layout_ranking.py`](../samples/backend/tests/unit/test_uml_layout_ranking.py) | 更新 | **コア** | ひし形のテストの期待値を改め、3件を追加する(下記テスト観点) |
| [`tests/unit/test_uml_layout_compute.py`](../samples/backend/tests/unit/test_uml_layout_compute.py) | 更新 | **コア** | 交差削減の後も `(lane, row)` が一意で、矩形が重ならないこと |

## 症状と原因

デモのコンポーネント図では、「認証ルート」と「プロジェクトルート」、「ユーザーリポジトリ」と「プロジェクトリポジトリ」が完全に重なっていた。DFD では「利用者」と「users」が重なっていた。原因は2つある。

1. **行の割り当て**: `ranking.py` は、最長経路法の層番号をそのまま `row` にしていた。一方、エンジン(移植元)は「1つの `(lane, row)` のマスに1ノード」という前提で動く。`geometry.place_rows` は、ノードをレーンの中央・行の縦位置に置くからである。同じレーンで同じ深さの要素は同じマスになり、完全に重なる。
   - 移植元では、人が lane/row を手で与えていたので、この前提が自然に守られていた。自動割り当て(Phase 9 の新規アルゴリズム)で前提が抜け落ちた。
   - 既存のテスト `test_assign_rows_diamond_shape_takes_longest_path` は、同じレーンの `b` と `c` を両方 row 1 と期待していた。**テストが不具合を仕様として固定していた**ことになる。
2. **指標が捕まえない**: `metrics.overlaps` は、線どうしが同じ区間を重ねて走る数である。ノードどうしの重なりはどこでも数えていない。そのため、重なりがあっても `overlaps=0` と報告され、Phase 9 のテストをすり抜けた。

## 要点の抜粋

```python
# app/uml/layout/ranking.py
def _assign_rows(node_ids, edges, lane_of) -> dict[str, int]:
    back_edges = _find_back_edges(node_ids, edges)
    ...  # back edge を除いた辺で TopologicalSorter と predecessors を作る
    taken: set[tuple[int, int]] = set()          # 使用済みの (lane, row)
    while sorter.is_active():
        ready = sorted(sorter.get_ready(), key=定義順)   # 決定的にする
        for n in ready:
            r = max((row[p] + 1 for p in predecessors[n]), default=0)  # 全ての前提より下
            while (lane_of[n], r) in taken:       # 同じレーンで衝突したら次の空き行へ
                r += 1
            row[n] = r
            taken.add((lane_of[n], r))
        sorter.done(*ready)
    return row
```

呼び出し側(`assign_lanes_and_rows`)は、レーンを先に決めてから `_assign_rows(element_ids, edges, lane_of)` を呼ぶ。ER の分岐(単一レーン+定義順)は元から一意なので変えていない。

## 設計判断

### なぜ「次の空き行へ下げる」なのか(ユーザー確定事項)

もう1つの案は、深さごとに「そのレーン内の最大ノード数」だけ行の束を確保する方法だった。深さと行の対応は読み取りやすいが、1ノードしか無いレーンでは束の中に空き行ができ、図が縦に長くなる。

「次の空き行へ下げる」なら、次の性質を持つ。

- 衝突が無い図では、最長経路法と同じ行になる。
- ずれるのは衝突したときだけなので、縦の伸びが最小になる。
- 行は常に全ての前提の行より大きいので、辺の向き(上から下)が逆転しない。
- 別レーンの要素は同じ行を共有できる。

### 定義順で並べて決定的にする

`graphlib.TopologicalSorter.get_ready()` が返す順は文書化されていない。同じ層の中を要素の定義順でソートし、同じ意味モデルからは常に同じ配置が出るようにした(再現性。ゴールデンテストや draw.io の差分が安定する)。

### 実行時のチェックも指標も足さない

交差削減(`crossing_reduction.optimize`)は、同じレーンの2ノードの行を入れ替えるか、空いている行へ動かすだけである。そのため一意性は保たれる。一意性はテスト(下記)で守り、実行時のチェックは足さなかった。

ノードの重なりの指標を `metrics` に足す案も採らなかった。`LayoutModel` のスキーマ・FE の型・11-1 の `reconcile` まで波及するうえ、割り当ての段階で重なりが起きなくなるためである。代わりに、`overlaps` が線の重なりであることを docstring に明記した。

### 副次的な効果

デモの図では、線がノードを横切る数(`collisions`)も、コンポーネント図で 3→0、DFD で 2→0 に減った。重なったノードを線が通り抜けていたためである。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 見ること |
|---|---|---|---|
| `assign_lanes_and_rows` | pytest | スタブ不要。要素と関係を受け取って lane/row を返す純粋関数のため | ひし形で `b`・`c` が別の行になり `d` が両方より下、同じレーンで前提の無い要素が別の行、別レーンは同じ行を共有してよい、衝突時は定義順 |
| `compute_layout`(交差削減の後) | pytest | スタブ不要。実エンジンを最後まで動かす | デモと同じ形のコンポーネント図で、`(lane, row)` が一意で、矩形どうしが重ならない |

`compute_layout` のテストは、修正前のコードに戻すと失敗し、修正後は成功することを確認した(不具合を捕まえられるテストであることの確認)。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest
# 335 passed(Phase 9 のゴールデンテストは lane/row を人手で与えるため影響なし)
uv run ruff check .
# All checks passed!
uvx pyright
# 既知の1件のみ
```

デモページの配置データ(`devex-ui/src/features/uml/demo/demoModels.ts`)を修正後のエンジンで作り直した。ヘッドレスブラウザで、全ノードが重ならずに表示されることを確認した。

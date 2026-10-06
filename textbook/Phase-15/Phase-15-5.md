# Phase-15-5: 自動レイアウトの高速化(BE)

## この章の目的

自動レイアウトの所要時間が、DFD の要素と線の数に対して急に伸びる(気づき#10)。出力見本の付録の実測では、9要素・18本で65秒、11要素・23本で245秒かかった。上限の30要素に近い DFD では、`/layout` の応答が数分を超える。

[Phase-14-5](../Phase-14/Phase-14-5.md) の候補 A(行の順を決める段階では、中心を結んだ線分の交差数で評価する)と、候補 B(回数・時間の上限)を実装し、新旧を測って比べる。候補 C(外部の役者とデータストアのレーンを分ける)は、今回は試していない。

自動実装モード: on([introduction](./Phase-15-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/layout/crossing_reduction.py`](../samples/backend/app/uml/layout/crossing_reduction.py) | 更新 | **コア** | `sketch_score`(近似)、`quick_route_score`(簡易な実経路)、`_hill_climb`(回数・時間の上限つき)、`optimize`(2段) |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_layout_crossing_reduction.py`](../samples/backend/tests/unit/test_uml_layout_crossing_reduction.py) | 新規 | **コア** | 近似の交差数、ノードを貫く線分、簡易な評価と全体の一致、時間の上限 |

既存の [`tests/unit/test_uml_layout_pipeline.py`](../samples/backend/tests/unit/test_uml_layout_pipeline.py)(行の入れ替えで X 字の交差が消えること)は、変えずに通る。

## 遅さの原因

移植したときの `optimize` は、次のように動いていた。

- 同じレーンの要素の行を、2つずつ入れ替える。空いている行への移動も試す。
- 1回試すたびに、経路探索と仕上げの全体(`pipeline.route`)を走らせて評価する。
- 改善が止まるまで、回数の上限なしに繰り返す。

`pipeline.route` は1回で、9要素・18本で約0.8秒、30要素・45本で約11秒かかる。内訳の大半は `route_edges`(辺ごとに候補の経路を作り、既にある経路との交差を数える。2巡する)で、仕上げ(`finalize`)は3割ほどである。入れ替えの候補は要素数の2乗で増えるので、数十〜数百回の評価が積み重なる。

## 要点の抜粋

```python
# app/uml/layout/crossing_reduction.py
def sketch_score(state) -> float:
    """ノードの中心(レーン番号, 行番号)を結ぶ線分で見積もった、配置の悪さ。"""
    centers = {nid: (float(n.lane), float(n.row)) for nid, n in state.nodes.items()}
    ...  # 端点を共有しない線分の組の交差数 + 線分が他のノードを貫く数 × 2

def quick_route_score(state) -> float:
    """経路探索を1巡だけ行い、仕上げを省いて、交差と重なりを数える。"""
    compute_lane_geometry(state); size_nodes(state); place_rows(state)
    route_edges(state, rounds=1)
    crossings, overlaps, _ = count_metrics(state)
    return crossings * 1000 + overlaps * 300

def optimize(state) -> None:
    original_rows = {nid: n.row for nid, n in state.nodes.items()}
    original = quick_route_score(state)
    if original >= _SCORE_THRESHOLD:                                   # 交差があるときだけ
        _hill_climb(state, sketch_score, time.monotonic() + SKETCH_BUDGET_SECONDS)   # 3秒
        if quick_route_score(state) > original:                       # 近似で悪くなったら戻す
            restore(original_rows)
        _hill_climb(state, quick_route_score, time.monotonic() + REFINE_BUDGET_SECONDS,  # 15秒
                    good_enough=_SCORE_THRESHOLD - 1)
    route(state)                                                       # 全体は最後の1回だけ
```

`_hill_climb` は、入れ替え・移動の1回ごとに時間を確かめ、上限を超えたらその時点の最良の配置で止まる。`MAX_PASSES`(20)は、改善が続くときの回数の上限である。

## 測定

見本の DFD 3枚(`appendix/detailed-design-devex/content.py`)に加えて、乱数で作った大きめの DFD を3枚使った。245秒かかった11要素・23本の版は、見本を絞ったときに残っていないため、同じ規模の図を合成した(合成の DFD はレイヤーの指定が無く、要素が1つのレーンに並ぶ)。測定のスクリプトは本体には置いていない(Claude の作業領域で実行した)。

| 図 | 要素・線 | 旧: 秒 | 旧: 交差 | 新: 秒 | 新: 交差 |
|---|---|---|---|---|---|
| 見本 hearing | 9・18 | 65.2 | 2 | 16.4 | 5 |
| 見本 docs | 7・11 | 0.5 | 0 | 0.4 | 0 |
| 見本 uml | 9・18 | 105.8 | 1 | 16.8 | 4 |
| 合成 | 11・23 | 157.9 | 3 | 17.1 | 4 |
| 合成 | 15・30 | 849.1 | 8 | 19.4 | 23 |
| 合成 | 30・49 | 30分を超えて打ち切り | ― | 39.4 | 30 |

途中の試行(同じ15秒の上限で比べた):

| 方式 | hearing の交差 | uml の交差 | 15・30 の交差 |
|---|---|---|---|
| A だけ(近似で並べ、経路探索は最後の1回) | 11 | 4 | 22 |
| B だけ(旧の評価のまま、15秒で打ち切る) | 8 | 1 | 22 |
| B(評価を簡易な実経路にしたもの) | 7 | 1 | 26 |
| **A+B(採用)** | **5** | **4** | **22〜23** |

### 読み取り

- **所要時間**: 新方式は、時間の上限(近似3秒+仕上げ15秒)と最後の経路探索1回に収まる。30要素では、経路探索の全体1回(約11秒)と簡易な評価の数回が加わり、約40秒になる。旧方式の数分〜数十分は無くなった。
- **交差数**: 旧方式に時間の制限が無ければ、交差数は旧方式の方が少ない(hearing 2 対 5、15・30 で 8 対 23)。旧方式は、数分〜十数分かけて山登りを続けられるからである。同じ時間(15秒)の上限で比べると、A+B は、大きい図ほど B だけより少ない。
- **近似だけでは足りない理由**: 中心を結ぶ直線と、実際の直交の経路(レーンの間の通路や行の間を通る)では、交差の数え方が違う。近似で並べた配置は「良い出発点」にはなるが、そのままでは実際の交差が残る。

## 設計判断

### 近似で並べてから、実際の経路で仕上げる

A だけ(近似で並べ、経路探索は最後の1回)は速いが、hearing で交差が11本残った。近似の評価は経路探索より3桁以上軽いので、出発点を作るのには向く。仕上げは実際の経路の評価が要る。そこで、経路探索を1巡だけ行い仕上げを省いた簡易な評価(`quick_route_score`)で、時間の上限まで山登りを続ける。簡易な評価は、全体の3分の1程度の時間で済み、交差数は全体とほぼ一致する。

### 時間の上限を置き、上限で「その時点の最良」を返す

上限が無いと、図の大きさによって応答が数分〜数十分になる。上限で止めても、それまでに見つけた最良の配置は失われない。手で動かした配置は SCR-007 で保存できるので、自動の配置は「十分に良い出発点」であればよい。

### 交差数の悪化をどう扱うか(未確定)

見本の DFD では、交差が2〜3本増えた(hearing 2→5、uml 1→4)。仕上げの時間の上限(`REFINE_BUDGET_SECONDS`)を延ばすと、交差は減るが待ち時間が伸びる。今の15秒は、画面で待てる長さを優先した値である。上限の値と候補 C(レーンを分ける)は、Phase 16 で機能グループごとの DFD を実際に作るときに、見た目と合わせて決める([introduction](./Phase-15-introduction.md) の申し送り)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `sketch_score` | pytest | スタブ不要。配置を受け取って数を返す純粋関数のため | X 字の交差、1つ飛ばしの線分がノードを貫く |
| `quick_route_score` | pytest | スタブ不要 | 小さな図で、交差数が `pipeline.route` と一致する |
| `optimize`(時間の上限) | pytest | スタブ不要。上限の定数を monkeypatch で0にする | 上限が0でも、最後の経路探索まで終えて結果を返す |
| `optimize`(既存) | pytest(`test_uml_layout_pipeline.py`) | スタブ不要 | 行の入れ替えで X 字の交差が消える |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_uml_layout_crossing_reduction.py tests/unit/test_uml_layout_pipeline.py
# 6 passed
uv run pytest tests/unit -k "layout or uml_diagram"     # レイアウトとそれを使うサービスの既存テストも通る
```

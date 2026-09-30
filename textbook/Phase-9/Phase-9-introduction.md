# Phase 9 導入: レイアウトエンジン移植・レーン/行割り当て・`/layout` API

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節 ステージ3ロードマップが定める「Phase 9: レイアウトエンジン移植・レーン/行割り当て・`/layout` API」を実装する。M6(自動レイアウト)を対象とし、`app/uml/domain`の意味モデル(Phase 8)から`uml_diagrams.layout_model`(ノード座標・辺の折れ点)を計算する。`to_svg`/`to_drawio`(出力、`app/uml/export/`)はPhase 12の対象でありPhase 9には含まない。

## 実装前の設計判断(このセッションで確定)

着手にあたり、[`Phase-7-4.md`](../Phase-7/Phase-7-4.md)「Phase 9への申し送り」5点と、移植元エンジン`engine.py`(950行)全文の精読(2エージェントによる横断調査)を行った。詳細は[`textbook/decision-digest.md`](../decision-digest.md)「Phase 9着手前」節参照。

**Phase-7-4.md申し送り5点への対応方針**:

1. **`assert`ベースの不変条件チェック** → 移植元の`node()`/`edge()`由来の3つ(重複ID・lane範囲外・未定義ノード参照)は、レイアウト実行前にM4構造検証(`app.uml.validation.validate_diagram`)を必須にすることで到達し得ない状態にする(統合)。実行時に本当に起こり得る2つ(幅960px超過・経路探索失敗)のみ、`LayoutWidthExceededError`/`LayoutRouteNotFoundError`として専用例外化する。
2. **計算量** O(n²)〜O(n!) → `MAX_ELEMENTS`(`app.uml.validation.structural`と共有、目安30)超過は`/layout`実行前に`LayoutNodeLimitExceededError`(診断3「上限超過の検証エラー化」)。レイアウト計算自体は`asyncio.to_thread`でイベントループをブロックしない。
3. **未使用コード・マジックナンバー** → 未使用の`import math`は移植しない。`_cost()`の重み定数(交差+400、重なり+1500等)は用途コメント付きの名前付き定数にした。
4. **日本語文字幅推定**(`wrap`/`tw`/`cw`)→ そのまま逐語移植。
5. **既存テストが無い** → 各章でゴールデンテスト(既知の小規模配置で交差数ゼロを主張する等)を新規に書く。

**移植元エンジンとdevexの前提の差(3点、appendix診断3で指摘済み)への対応**:

- **lane/rowの自動割り当てが無い** → 移植元は`Diagram.node(id, lane, row, ...)`で人手指定する前提。devexはAI/ユーザー生成の意味モデルから算出する必要があるため、**新規アルゴリズム**(`ranking.py`: lane=`layer`属性、row=最長経路法によるレイヤリング+循環除去)を追加する。
- **`allow_swap`の手動選別が不要** → 移植元は「行の入れ替えを許すノード」を人が明示的に宣言する前提だったが、devexは行(row)自体が全て自動算出のため保護すべき「人の意図」が無い。**全要素を交差削減の対象にする**という簡略化を行う(`crossing_reduction.py`)。
- **レーンの重み(`lane_weights`)が無い** → devexにはAIが出力するレーン幅ヒントに相当する入力が無いため、全レーンを均等幅として扱う(`geometry.py`)。

**このセッションで確定した設計判断**:

- **ER図のlane割り当て**: `ErElement`には`layer`が無く、ER図はモジュール依存・時系列を表す図ではない。ER図も同じレイアウトエンジンに乗せ、`lane=0`固定(単一レーン)・`row`=意味モデル内の定義順indexという機械的なフォールバック値を割り当てる。将来ER専用のレイアウト改善は別Phaseの余地として残す。

## パイプライン上の位置づけ・前提

- 前提として読むべきもの: [`Phase-7-4.md`](../Phase-7/Phase-7-4.md)(申し送り5点)、[`Phase-8-introduction.md`](../Phase-8/Phase-8-introduction.md)(`app.uml.domain`の意味モデル・`layer`フィールド・`MAX_ELEMENTS`)、[`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md) 診断3(自動レイアウトの実行環境)・§3(移植元エンジン調査)、[`docs/internal_design.md`](../../docs/internal_design.md) 3.2節⑦(`layout_model`列)・3.3節①(`app/uml/layout/`パッケージ)・3.3節②(`/layout`エンドポイント)。
- 本Phase開始時点の既知の状態: `app/uml/layout/`パッケージは存在しない。Phase 8が既に`ComponentElement`/`DfdProcess`に`layer`フィールド、`app/uml/validation/structural.py`に`MAX_ELEMENTS=30`を用意済み(いずれもPhase 9向けの伏線として記載済み)。
- 既存コードベースに前例が無い新規パターンが1つある: `asyncio.to_thread`によるCPU負荷の高い同期処理のオフロード(devex-api既存コードにはLLM呼び出し(非同期I/O)しかなく、CPU負荷の高い同期計算を別スレッドへ逃がす前例が無い)。

## モード宣言(#21)

全章**学習モード**。`appendix/stage3-requirements-organization.md`章立て案が本Phaseを「コア級 → 学習モード」と明記済み。lane/row自動割り当てアルゴリズム・移植元との対比の簡略化はいずれも設計判断そのものであり、#21のモード切替条件(a)「定型タグが過半数」を満たさない。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-9-1.md`](./Phase-9-1.md) | レーン/行割り当て(`ranking.py`。新規アルゴリズム: 循環除去+最長経路レイヤリング) | 学習 | なし |
| [`Phase-9-2.md`](./Phase-9-2.md) | 文字幅推定+ジオメトリ(`text.py`/`model.py`/`geometry.py`。移植+均等割り簡略化) | 学習 | 9-1(パッケージ構成として先行) |
| [`Phase-9-3.md`](./Phase-9-3.md) | 経路探索(`routing.py`。移植、コスト関数の定数コメント化) | 学習 | 9-2 |
| [`Phase-9-4.md`](./Phase-9-4.md) | 仕上げ処理+交差削減(`finalize.py`/`pipeline.py`/`crossing_reduction.py`) | 学習 | 9-2, 9-3 |
| [`Phase-9-5.md`](./Phase-9-5.md) | 意味モデルアダプタ+サービス層+`/layout` API(`app/uml/layout/__init__.py`、`UmlDiagramService.compute_layout`) | 学習 | 9-1, 9-4 |

## サンプルコード一覧

`textbook/samples/backend/`配下、`devex-api/backend/`と同じ相対パスに配置する。各ファイルの新規/更新・写経レベルは各章の「この章で作成・更新したファイル」表を参照。新規パッケージ: `app/uml/layout/{__init__,ranking,text,model,geometry,routing,finalize,pipeline,crossing_reduction}.py`。既存ファイルへの追記: `app/services/errors.py`(4例外)、`app/services/uml_diagram_service.py`(`compute_layout`)、`app/schemas/uml_diagram.py`(`layout_model`フィールド)、`app/api/routes/uml.py`(`/layout`エンドポイント)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 9-1 | `app/uml/layout/ranking.py`(新規) | lane(layer属性/ERフォールバック)・row(最長経路法+循環除去/ER定義順)の算出 | `uv run pytest tests/unit/test_uml_layout_ranking.py` |
| 9-2 | `app/uml/layout/text.py`(新規)、`app/uml/layout/model.py`(新規)、`app/uml/layout/geometry.py`(新規)、`app/services/errors.py`(更新) | 日本語文字幅推定・レイアウト内部表現・レーン幅/ノードサイズ/行位置/ポート座標の計算 | `uv run pytest tests/unit/test_uml_layout_geometry.py` |
| 9-3 | `app/uml/layout/routing.py`(新規)、`app/services/errors.py`(更新) | 辺の経路候補生成・コスト最小選択 | `uv run pytest tests/unit/test_uml_layout_routing.py` |
| 9-4 | `app/uml/layout/finalize.py`(新規)、`app/uml/layout/pipeline.py`(新規)、`app/uml/layout/crossing_reduction.py`(新規) | 出入口オフセット・通路スロット・ラベル配置・指標計測、および交差削減の山登り | `uv run pytest tests/unit/test_uml_layout_finalize.py tests/unit/test_uml_layout_pipeline.py` |
| 9-5 | `app/uml/layout/__init__.py`(新規)、`app/services/uml_diagram_service.py`(更新)、`app/schemas/uml_diagram.py`(更新)、`app/api/routes/uml.py`(更新)、`app/services/errors.py`(更新) | 意味モデル→LayoutStateアダプタ、`asyncio.to_thread`実行、`POST .../layout` API | `uv run pytest tests/unit/test_uml_layout_compute.py tests/unit/test_uml_diagram_service.py tests/unit/test_uml_diagram_routes.py` |

## 写経順序(#23)

章番号順(9-1 → 9-2 → 9-3 → 9-4 → 9-5)。各章内のファイル順序は依存順(#30、各章の「この章で作成・更新したファイル」表を参照)。

## Stage 3固有の運用(Phase 7から継続)

`textbook/samples/backend/`への反映と並行して、`devex-api`本体(`stage3`ブランチ)へClaudeが直接実装する。samples側のPhaseタグ(`# 作成：Phase-9-1`等、#29形式)は本体には一切書かない。

## 後続Phaseへの申し送り

- **Phase 10(AI生成)**: 要素に`layer`を適切に設定する責務を持つ(Phase 9のlane算出はこの`layer`値に依存する)。診断8の「上位図と下位図の境界フローが一致する」検証規則(Phase 8で申し送り済み)は、診断8本文が示す「APIエンドポイント/バッチごとに1枚」というフラットな複数図構成を前提に設計すること(Phase 8-introduction.md参照)。
- **Phase 12(承認・export)**: `to_svg`/`to_drawio`は`layout_model`(ノード座標・辺の折れ点・lane/row)をそのまま使う想定。移植元で座標算出とSVG/drawio出力が同一コードだったため、Phase 9の`LayoutModel`スキーマがPhase 12のexportに必要な情報を過不足なく持つよう設計した(不足があれば拡張する)。

## 後続 Phase での改訂(#12)

- [`Phase-10-5.md`](../Phase-10/Phase-10-5.md): `UmlDiagramService.compute_layout`に、AI生成中の図を拒否するガード(`UmlGenerationInProgressError`)を追加した。M4検証の呼び出しは、DFDの未参照判定を全DFD横断にするため`_validate_model`へ集約した。
- [`Phase-11-1.md`](../Phase-11/Phase-11-1.md): `LayoutEdgeGeometry.points`の空リストを「折れ点なし」(D2。手動移動したノードにつながる辺)の意味として明記した。`app/uml/layout/reconcile.py`(`reconcile_layout`)を追加し、`__init__`から re-export した。
- [`Phase-11-7.md`](../Phase-11/Phase-11-7.md): `ranking.py`の行の割り当てを、レーンごとに1行1ノードの最長経路法に改めた(`_longest_path_rank` → `_assign_rows`)。同じレーンで同じ深さの要素が同じ`(lane, row)`になり、ノードが重なる不具合があった。既存のひし形のテストはこの不具合を期待値として固定していたため改めた。`LayoutMetrics`の3指標が線についてのものであることを明記した。
- [`Phase-12-2.md`](../Phase-12/Phase-12-2.md): 辺ラベル(ERの多重度・DFDのデータ項目名)を`labels.edge_labels`で組み立てて`compute_layout(..., label_texts)`に渡し、移植済みの`place_labels`で配置した位置を`LayoutEdgeGeometry.label_pos`に保存するようにした。[`Phase-12-3.md`](../Phase-12/Phase-12-3.md)で、出力と共有するため`_element_kind`/`_element_text`/`finalize._label_size`を公開名にした。

## Phase完了チェック(#22)

1. 移植元に無い「lane/rowの自動割り当て」がなぜ必要か、そのアルゴリズム(最長経路法+循環除去)の要点を説明できるか。
2. devexが「全要素を交差削減の対象にする」という簡略化を行った理由(移植元の`allow_swap`との違い)を説明できるか。
3. 移植元の5つの`assert`のうち、Phase 9で専用例外化したのは2つだけである理由(残り3つがM4構造検証との統合で到達し得なくなること)を説明できるか。
4. `asyncio.to_thread`でレイアウト計算をラップする理由を、devex-api既存コードの非同期処理(LLM呼び出し等)との違いを踏まえて説明できるか。
5. `layout_model`が`to_svg`/`to_drawio`(Phase 12)の出力ではなく、ノード座標・辺の折れ点というデータであることの意味を説明できるか。

## 次のフェーズ

**Phase 10**: AI生成(構造化出力)・内部設計書プロンプトへの「処理別データフロー」節追加。

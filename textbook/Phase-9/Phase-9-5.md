# Phase-9-5: 意味モデルアダプタ+サービス層+`/layout` API

## この章の目的

意味モデル(`app.uml.domain`)をレイアウト内部表現(`LayoutState`)へ変換するアダプタ(`app/uml/layout/__init__.py`)を実装し、`UmlDiagramService.compute_layout`(ノード数上限チェック・M4検証・`asyncio.to_thread`実行・永続化)と`POST .../diagrams/{id}/layout` APIで一連のパイプラインを完成させる。Phase 8-5で確定した「常にService経由、Repository直参照は層違反として禁止」方針をそのまま踏襲する。

自動実装モード: on([introduction](./Phase-9-introduction.md) 参照)。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30)。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/layout/__init__.py`](../samples/backend/app/uml/layout/__init__.py) | 新規 | **コア** | 意味モデル→`LayoutState`アダプタ(`_build_state`。lane/row算出は`ranking`に委譲、kind/text組み立ては本ファイルの責務)、`LayoutState`→`LayoutModel`変換(`_to_layout_model`)、`compute_layout`(トップレベルAPI) |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | `LayoutNodeLimitExceededError`/`LayoutValidationFailedError`を追加 |
| [`app/services/uml_diagram_service.py`](../samples/backend/app/services/uml_diagram_service.py) | 更新 | **コア** | `compute_layout`メソッド追加(ノード数上限チェック→M4検証→`asyncio.to_thread`実行→永続化) |
| [`app/schemas/uml_diagram.py`](../samples/backend/app/schemas/uml_diagram.py) | 更新 | 定型 | `UmlDiagramRead`に`layout_model: LayoutModel \| None`を追加 |
| [`app/api/routes/uml.py`](../samples/backend/app/api/routes/uml.py) | 更新 | 定型 | `POST /diagrams/{diagram_id}/layout`エンドポイント追加 |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_layout_compute.py`](../samples/backend/tests/unit/test_uml_layout_compute.py) | 新規 | **コア** | component/ER/DFD3notationそれぞれの`compute_layout`(kind/text組み立て・lane/row反映) |
| [`tests/unit/test_uml_diagram_service.py`](../samples/backend/tests/unit/test_uml_diagram_service.py) | 更新 | **コア** | `compute_layout`の永続化、ノード数上限超過・M4検証失敗時の例外化 |
| [`tests/unit/test_uml_diagram_routes.py`](../samples/backend/tests/unit/test_uml_diagram_routes.py) | 更新 | 定型 | `compute_diagram_layout`ルート関数のテスト |

## 設計判断

### なぜノード数上限チェック→M4検証→レイアウト計算という順序にしたか

いずれも「実行前に安く済ませられるチェックを先に行う」という原則に従っている。ノード数チェック(`len(model.elements) > MAX_ELEMENTS`)は意味モデルの属性を数えるだけで、M4構造検証(`validate_diagram`)より圧倒的に軽い。M4検証も、実際にレイアウト計算(経路探索・交差削減の山登り)を行うよりはるかに軽い。安価なチェックから順に行うことで、無駄な計算(特にCPU負荷の高いレイアウト計算)を避けられる。

### なぜM4検証を通らない意味モデルはレイアウト計算を拒否するか(Phase-7-4.md申し送り#1との統合)

移植元の`node()`/`edge()`が持っていた3つの`assert`(重複ID・lane範囲外・未定義ノード参照)は、devexでは意味モデルの構造上ありえない状態として扱いたい。これを実現する最も自然な方法は、レイアウト計算の入口で「M4構造検証(`app.uml.validation.validate_diagram`)にエラーが1件でもあれば拒否する」というゲートを設けることであり、これにより`app/uml/layout/`パッケージ自体は「常に構造的に正しい意味モデルが渡ってくる」という前提の上で、防御的なassert/例外を持たずに書ける(Phase-9-2〜9-4のコードにこの種のガードが登場しないのはこのため)。

### なぜ`compute_layout`は新しいServiceクラスを作らず`UmlDiagramService`に追加したか

`compute_layout`は「1件のUML図を取得し、その状態(`layout_model`)を更新して返す」という、既存の`get`/`update`/`validate`と同じ形のユースケースである。新しいServiceクラス(例: `UmlLayoutService`)を作ると、`UmlDiagramRepository`への依存や`_get_owned`のような所有権チェックのヘルパーを重複して持つことになる。既存の`UmlDiagramService`に1メソッドとして追加する方が、Phase 8-5で確立した「1リソースにつき1つのService」という一貫性を保てる。

### なぜ`layout_model`を`UmlDiagramRead`に追加する際、既存フィールドの並び順を変えなかったか

`semantic_model`のすぐ後ろに`layout_model`を挿入した。DBのカラム順(`docs/internal_design.md` 3.2節⑦)と同じ並びにすることで、スキーマとテーブル定義を見比べる際の認知コストを下げる意図がある。

## テスト観点(#14)

**SUT/ドライバ/スタブ**の用語定義は[Phase-8-1.md](../Phase-8/Phase-8-1.md)参照。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `compute_layout`(`app/uml/layout/__init__.py`) | pytest(直接呼び出し) | スタブ不要 ── 対象が純粋(意味モデルを直接渡すのみ)なため | `test_uml_layout_compute.py`。component(lane分離)・ER(単一レーン+カラム数によるサイズ差)・DFD(process/entity/store混在)の3notationを確認 |
| `UmlDiagramService.compute_layout` | pytest(直接呼び出し、インメモリSQLite `db_session`) | スタブ不要 ── DBアクセスのみで外部呼び出しを含まないため(`asyncio.to_thread`はCPUバウンドな純粋関数を別スレッドで実行するだけで、モックすべき外部依存ではない) | `test_uml_diagram_service.py`。永続化・ノード数上限超過(`LayoutNodeLimitExceededError`)・参照切れによるM4検証失敗(`LayoutValidationFailedError`)の3系統 |
| `compute_diagram_layout`(route関数) | pytest(直接呼び出し、`test_prompt_templates_routes.py`と同じパターン) | スタブ不要 ── 同上 | `test_uml_diagram_routes.py` |

## 動作確認(実施済み、9-1〜9-5まとめて実施)

samples反映後、`devex-api`(`stage3`ブランチ)の実環境へ反映して以下を確認した。

```bash
cd backend
uv run pytest tests/unit/test_uml_layout_*.py -q
# 23 passed
uv run pytest -m "not integration" -q
# 261 passed, 5 deselected(既存分・Phase 8分を含む全体。Phase 9由来の破壊的変更なし)
uv run ruff check .
# All checks passed!
uvx pyright
# 1 error, 0 warnings(既知の1件、app/ai/llm/gemini.pyのみ残存。Phase 9由来の新規エラー0件)
uv run alembic history
# a96a8c02c148 -> f1a2b3c4d5e6 (head)(既存のマイグレーションチェーンに変更なし。
# layout_model/data_itemsは既にPhase 8のマイグレーションで確保済みの列・テーブルを使うため、
# Phase 9は新規マイグレーションを追加していない)
```

## 既知の残課題

- `app/uml/export/`(`to_svg`/`to_drawio`、Phase 12)は未着手。`LayoutModel`がPhase 12の要求を過不足なく満たすかは、Phase 12着手時に確認する。
- `LayoutNodeLimitExceededError`発生時のフロントエンド側の見せ方(Phase 11の関心事)は本Phaseでは扱っていない。

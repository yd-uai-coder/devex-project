# Phase 8 導入: 意味モデル・データ辞書・CRUD/validate API

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節 ステージ3(UML設計図パイプライン)の最初の実装Phase。[`Phase-7-introduction.md`](../Phase-7/Phase-7-introduction.md)「次のフェーズ」・[`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md) 7節の章立て案が定める「意味モデル(Pydantic)・データ辞書(`DataItem`)・`uml_diagrams`・CRUD/validate API(component/ER/DFD)」を実装する。M1(生成トリガーのプレースホルダー)・M2/M2b(意味モデル・データ辞書)・M3(永続化)・M4のうち境界フロー一致を除く4規則、を対象とする。M1の実AI生成(構造化出力)はPhase 10、レイアウト(`/layout`)はPhase 9、承認・エクスポートはPhase 12が対象。

## 実装前の設計判断(このセッションで確定)

`docs/internal_design.md`には「データ辞書(`DataItem`)の永続化実体はPhase 8で確定する」という明示的な未決事項があり、また`DataItem`用の専用API・DFDの階層(上位図/下位図)検証規則は文書上に記載が無かった。本Phase着手前の相談で以下3点を確定した(詳細は[`textbook/decision-digest.md`](../decision-digest.md)「Phase 8着手前」節・[`textbook/q_a.md`](../q_a.md)参照):

1. **`DataItem`の永続化**: 専用テーブル`data_items`(project_id FK + name + fields)。項目単位のCRUD・一意性制約・参照検証を素直に書けることを優先した。
2. **`DataItem`のAPI**: 最小限のCRUD APIを`/projects/{id}/uml/data-items`系として公開する。
3. **DFD階層(上位図/下位図)**: `uml_diagrams`に`parent_diagram_id`/`level`は追加せず、診断8の「境界フローが一致する」検証規則はPhase 10へ申し送る。**Phase 10開始時の設計判断は、診断8本文が示す「APIエンドポイント/バッチごとに1枚」というフラットな複数図構成を前提に行う**(階層分解の要否・粒度そのものをPhase 10で決める。列を先に追加すると、実際に検証を機能させるにはノード単位の対応情報が別途必要になり、Phase 10で結局作り直す手戻りリスクの方が大きいと判断した)。

## パイプライン上の位置づけ・前提

- 前提として読むべきもの: [`docs/internal_design.md`](../../docs/internal_design.md) 3.2節⑦(`uml_diagrams`テーブル定義)・3.3節①②③(ディレクトリ構成・APIエンドポイント一覧・図↔文書対応)、[`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md) 4節(M1〜M9b)・5節診断3/診断8、[`devex-api/CLAUDE.md`](../../devex-api/CLAUDE.md)(レイヤー構成・エラーハンドリング・リポジトリ層の既存方針)。
- 本Phase開始時点の既知の状態: `devex-api`に`app/uml/`パッケージ・`data_items`/`uml_diagrams`テーブルは一切存在しない。既存の`app/repositories/base.py`の`CRUDRepository[ModelType]`・`app/api/deps.py`の`CurrentProjectDep`(所有権スコープの404化)・`app/core/errors.py`の`AppError`体系をそのまま踏襲する。
- 既存コードベースに前例が無い新規パターンが2つある: (1) 型付きPydanticモデルをJSONBカラムのAPIスキーマとしてそのまま再利用する(既存の`project.intake`等は生`dict`)、(2) 楽観ロック(`version`不一致で409)。`generated_documents.version`は「再生成のたびに増える版数」であり意味が異なる。

## モード宣言(#21)

全章**学習モード**。写経レベル(#19)は各章とも「コア」が過半数(意味モデルの型設計・楽観ロック・DFD規則はいずれも設計判断そのもの)であり、#21のモード切替条件(a)「定型タグが過半数」を満たさないため。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-8-1.md`](./Phase-8-1.md) | 意味モデル(`app/uml/domain/`。component/er/dfdのPydantic定義、discriminated union) | 学習 | なし |
| [`Phase-8-2.md`](./Phase-8-2.md) | 永続化層(`data_items`・`uml_diagrams`のORM・alembic・リポジトリ) | 学習 | 8-1 |
| [`Phase-8-3.md`](./Phase-8-3.md) | バリデーション(`app/uml/validation/`)・サービス層(楽観ロック・生成プレースホルダー) | 学習 | 8-1, 8-2 |
| [`Phase-8-4.md`](./Phase-8-4.md) | API層(`app/schemas/`・`app/api/routes/uml.py`) | 学習 | 8-1, 8-2, 8-3 |
| [`Phase-8-5.md`](./Phase-8-5.md) | ルーター層の設計統一(Repository直接参照の禁止。`projects.py`/`prompt_templates.py`の既存コードへの追補) | 学習 | 8-4完了後(既存コードへの改訂) |

## サンプルコード一覧

`textbook/samples/backend/`配下、`devex-api/backend/`と同じ相対パスに配置する。各ファイルの新規/更新・写経レベルは各章の「この章で作成・更新したファイル」表を参照。新規パッケージ: `app/uml/__init__.py`, `app/uml/domain/{__init__,base,data_item,component,er,dfd}.py`, `app/uml/validation/{__init__,base,structural,dfd_rules}.py`。新規モデル/リポジトリ/サービス/スキーマ: `app/models/{data_item,uml_diagram}.py`, `app/repositories/{data_item,uml_diagram}.py`, `app/services/{data_item_service,uml_diagram_service}.py`, `app/schemas/{data_item,uml_diagram}.py`, `app/api/routes/uml.py`。新規alembicマイグレーション1本(`data_items`+`uml_diagrams`)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 8-1 | `app/uml/domain/{base,data_item,component,er,dfd,__init__}.py`(すべて新規) | component/er/dfd3notationの意味モデル(Pydantic)+discriminated union | `uv run pytest tests/unit/test_uml_domain_models.py` |
| 8-2 | `app/models/{data_item,uml_diagram}.py`(新規)、`app/models/__init__.py`(更新)、alembicマイグレーション(新規)、`app/repositories/{data_item,uml_diagram}.py`(新規)、`app/services/errors.py`(更新) | `data_items`/`uml_diagrams`テーブルの永続化・所有権スコープの取得 | `uv run pytest tests/unit/test_data_item_repository.py tests/unit/test_uml_diagram_repository.py` |
| 8-3 | `app/uml/validation/{base,structural,dfd_rules,__init__}.py`(新規)、`app/services/{data_item_service,uml_diagram_service}.py`(新規) | M4構造検証・DFD規則4点、CRUD+楽観ロック+検証実行のユースケース | `uv run pytest tests/unit/test_uml_validation.py tests/unit/test_data_item_service.py tests/unit/test_uml_diagram_service.py` |
| 8-4 | `app/schemas/{data_item,uml_diagram}.py`(新規)、`app/api/routes/uml.py`(新規)、`app/api/routes/__init__.py`(更新) | REST API(diagrams CRUD+validate、data-items CRUD) | `uv run pytest tests/unit/test_data_item_routes.py tests/unit/test_uml_diagram_routes.py` |
| 8-5 | `app/services/{project,chat_service,doc_generator_service,prompt_template}.py`(更新/新規)、`app/api/routes/{projects,prompt_templates}.py`(更新) | ルーター層のRepository直接参照をService経由へ統一(既存コードの改訂) | `uv run pytest -m "not integration"`(全体) |

## 写経順序(#23)

章番号順(8-1 → 8-2 → 8-3 → 8-4 → 8-5)。各章内のファイル順序は依存順(#30、各章の「この章で作成・更新したファイル」表を参照)。8-5は8-1〜8-4完了後、動作確認後の相談を受けて追加した追補章(Phase 6-6と同じ位置づけ)。

## Stage 3固有の運用(Phase 7から継続)

`textbook/samples/backend/`への反映と並行して、`devex-api`本体(`stage3`ブランチ)へClaudeが直接実装する。samples側のPhaseタグ(`# 作成：Phase-8-1`等、#29形式)は本体には一切書かない。

## 後続Phaseへの申し送り

- **境界フロー一致検証(診断8)**: `uml_diagrams`に階層列(`parent_diagram_id`/`level`)が無いため、Phase 8では実装しない。Phase 10のAI生成設計は、診断8本文の「APIエンドポイント/バッチごとに1枚」というフラットな複数図構成を前提に行う。
- **実AI生成トリガー**: `POST /diagrams`は本Phaseでは要素・関係が空のdraftを作るプレースホルダー(`UmlDiagramService.create`)。Phase 10でこの内部をAI呼び出しに置き換える。

## Phase完了チェック(#22)

1. `DataItem`の永続化を専用テーブルにした理由と、プロジェクト単位のJSONBに寄せた場合に失うものを説明できるか。
2. `semantic_model`をAPIスキーマ(`app/schemas/uml_diagram.py`)で生`dict`ではなく型付きdiscriminated unionとして扱っている理由を、既存の`project.intake`との違いを踏まえて説明できるか。
3. `UmlDiagram.version`による楽観ロックが、`generated_documents.version`とどう意味が異なるかを説明できるか。
4. DFD検証規則のうち「境界フローが一致する」をPhase 8で実装しなかった理由と、その判断がPhase 10の設計自由度にどう影響するかを説明できるか。
5. `app/uml/validation`配下の関数群がなぜ「スタブ不要」と言えるかを、#14の定義に沿って説明できるか。
6. 「常にService経由、Repository直参照は層違反として禁止」という方針(8-5)が、既存コードの暗黙の基準(単純な読み取りはRepository直呼び)とどう異なるか、なぜこちらを採用したかを説明できるか。

## 次のフェーズ

**Phase 9**: レイアウトエンジン移植・レーン/行割り当て・`/layout` API。着手前に[`Phase-7-4.md`](../Phase-7/Phase-7-4.md)「Phase 9への申し送り」節(レイアウトエンジン移植時の対応点5点)を必ず参照すること。

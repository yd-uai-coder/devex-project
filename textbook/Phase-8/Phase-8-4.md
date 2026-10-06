# Phase-8-4: API層

## この章の目的

Phase-8-3のサービス層をREST APIとして公開する。`docs/internal_design.md` 3.3節②のエンドポイント表のうちPhase 8対象分(diagrams CRUD+validate)に加え、本Phaseで新規に確定した`DataItem`用CRUD 4エンドポイントを実装する。

自動実装モード: on([introduction](./Phase-8-introduction.md) 参照)。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30)。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/schemas/data_item.py`](../samples/backend/app/schemas/data_item.py) | 新規 | 定型 | `DataItemRead`/`DataItemCreate`/`DataItemUpdate`(`fields`は`app.uml.domain.DataItemField`をそのまま再利用) |
| [`app/schemas/uml_diagram.py`](../samples/backend/app/schemas/uml_diagram.py) | 新規 | **コア** | `UmlDiagramRead`/`UmlDiagramCreate`/`UmlDiagramUpdate`(`semantic_model`は生`dict`ではなく`app.uml.domain.SemanticModel`をそのまま再利用) |
| [`app/api/routes/uml.py`](../samples/backend/app/api/routes/uml.py) | 新規 | **コア** | `/projects/{project_id}/uml`配下のdiagrams CRUD+validate、data-items CRUD(計8エンドポイント) |
| [`app/api/routes/__init__.py`](../samples/backend/app/api/routes/__init__.py) | 更新 | 定型 | `uml_router`を登録 |
| ── ここからテスト ── | | | |
| [`tests/unit/test_data_item_routes.py`](../samples/backend/tests/unit/test_data_item_routes.py) | 新規 | 定型 | route関数を`test_prompt_templates_routes.py`と同じパターンで直接awaitするテスト |
| [`tests/unit/test_uml_diagram_routes.py`](../samples/backend/tests/unit/test_uml_diagram_routes.py) | 新規 | **コア** | 同上。楽観ロック競合(409)・notation不一致(400)・所有権チェック(404)の各経路を含む |

## 設計判断

### なぜ`semantic_model`をAPIスキーマで型付きのまま扱うか(既存パターンとの違い)

既存の`ProjectDetail.intake: dict | None`や`PromptTemplateRead.default_environment: dict | None`は、JSONBカラムの中身をAPI境界でも生`dict`のまま扱う(構造の検証をしない)。今回は`app.uml.domain.SemanticModel`という型付きdiscriminated unionをPhase-8-1で用意済みなため、`UmlDiagramRead`/`UmlDiagramUpdate`はこれをそのまま`semantic_model`の型として使った。これにより、PUTリクエストの意味モデルの構造(要素のnotation別スキーマ・DFDフローの`data_item_id`必須等)がFastAPIのリクエストバリデーション(422)の時点で検証され、サービス層に不正な形が渡ってくる余地が構造的に無くなる。`pyproject.toml`に`jsonschema`等の別ライブラリが無いため、Pydantic v2ネイティブの機構だけで完結させている。

### なぜ`/projects/{project_id}/uml`をrouterのprefixに含めたか(既存パターンとの違い)

既存の`routes/projects.py`はrouterのprefixを`/projects`のみにし、ネストしたリソース(`/projects/{project_id}/documents/...`等)のパスはエンドポイント側に書く。UML設計図パイプラインは`docs/internal_design.md`が設計段階から`/projects/{id}/uml/...`という独立したサブツリーとして扱っており、`api/routes/uml.py`という別ファイルに全エンドポイントをまとめる方針([`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md) 7節「構成案」で`api/routes/uml.py`と明記済み)だったため、`APIRouter(prefix="/projects/{project_id}/uml", ...)`とrouter自体のprefixに含めた。FastAPIは複数routerにまたがるパスパラメータ名でも、コンパイル後の完全なパス上で名前が一致していれば依存関数(`CurrentProjectDep`の`get_current_project(project_id, ...)`)に正しく注入するため、動作上の違いは無い。

### なぜdata-items用のエンドポイントを`docs/internal_design.md`に無いまま実装したか

3.3節②のエンドポイント表には元々diagrams系4本のみが記載されていた。「実装前の設計判断」で確定したとおり、Phase 8でデータ辞書の専用CRUD APIを追加公開することを決めたため、本章の実装と合わせて`docs/internal_design.md`にも4行を追記する(教材本文とdocsの反映順序は本Phase固有 ── 通常のPhase 7-2のような設計フェーズを別途設けず、実装章の中で確定・反映する)。

## テスト観点(#14)

**SUT/ドライバ/スタブ**の用語定義は[Phase-8-1.md](./Phase-8-1.md)参照。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `create_data_item`/`list_data_items`/`update_data_item`/`delete_data_item`(route関数) | pytest(直接呼び出し、`test_prompt_templates_routes.py`と同じパターンでFastAPI経由を通さず直接awaitする) | スタブ不要 ── DBアクセスのみで外部呼び出しを含まないため | `test_data_item_routes.py` |
| `create_diagram`/`get_diagram`/`update_diagram`/`validate_diagram`(route関数) | pytest(直接呼び出し、同上) | スタブ不要 ── 同上 | `test_uml_diagram_routes.py`。楽観ロック競合・notation不一致・所有権チェックの3種の異常系を含む |

## 動作確認(実施済み、8-1〜8-4まとめて実施)

samples反映後、`devex-api`(`stage3`ブランチ)の実環境へ反映して以下を確認した(コミットはユーザー指示時点、本Phase固有の運用は[introduction](./Phase-8-introduction.md)参照)。

```bash
cd backend
uv run pytest tests/unit/test_uml_domain_models.py tests/unit/test_data_item_repository.py \
  tests/unit/test_uml_diagram_repository.py tests/unit/test_uml_validation.py \
  tests/unit/test_data_item_service.py tests/unit/test_uml_diagram_service.py \
  tests/unit/test_data_item_routes.py tests/unit/test_uml_diagram_routes.py -q
# 52 passed
uv run pytest -m "not integration" -q
# 222 passed, 5 deselected(既存分を含む全体。Phase 8由来の破壊的変更なし)
uv run ruff check .
# All checks passed!
uvx pyright
# 1 error, 0 warnings(既知の1件、app/ai/llm/gemini.pyのみ残存。Phase 8由来の新規エラー0件)
uv run alembic history
# a96a8c02c148 -> f1a2b3c4d5e6 (head), add uml pipeline tables (data_items, uml_diagrams)
# (リビジョンチェーンの連結を確認。alembic historyはDB接続不要)
```

**未実施(環境制約)**: `uv run alembic upgrade head` / `downgrade -1`の実DB(Postgres)往復確認は、本セッションの実行環境にDockerが無く(`docker compose`起動不可)、`localhost:5432`にPostgresも立っていなかったため実施できなかった。`Base.metadata.create_all`(インメモリSQLite、ユニットテスト全222件)によるORM定義自体の整合性は確認済みだが、マイグレーションファイル(`f1a2b3c4d5e6_add_uml_pipeline_tables.py`)のSQL文そのものをPostgres上で実行して確認する作業は次回`docker compose up postgres`が可能な環境で行うこと。

### 過程で見つけて修正したバグ2件

テスト実行(動作確認)の過程で、実装時には気づかなかった2件の不具合が見つかり、その場で修正した。

1. **`updated_at`の`MissingGreenlet`**(サービス層): [Phase-8-3.md](./Phase-8-3.md)「動作確認で見つかった落とし穴」参照。`UmlDiagramService.update`/`DataItemService.update`に`await self._session.refresh(...)`を追加。
2. **テストの`users.email`一意制約違反・SQLiteの`func.now()`秒解像度**(リポジトリ層テスト): [Phase-8-2.md](./Phase-8-2.md)「動作確認で見つかった落とし穴」参照。`_create_project`ヘルパーのメールアドレスをテスト呼び出しごとに一意化し、更新日時降順のテストは明示的に`updated_at`をずらした。

いずれも実装コード自体の設計は正しく、テストの独立性・タイミング前提の不備だった。samples側にも同じ修正を反映済み。

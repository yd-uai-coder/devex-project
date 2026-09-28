# Phase-6-3: プロンプトテンプレートAPI

## この章の目的

SCR-003(プロンプト設定・テンプレート選択画面、Should have)のバックエンドを実装する。固定シードデータ2件(「Webアプリケーション標準」「API向け」)の一覧取得API、プロジェクト作成時に選択したテンプレートIDの永続化(`projects.template_id`)、そしてヒアリングチャットのシステムプロンプトへのテンプレート合流(内部設計書3.2節⑤で確定済み: 合流先は4文書生成ではなくヒアリングチャット)を実装する。テンプレート自体のCRUD機能は設けない(仕様診断#28で確定済み、固定シードデータのみ)。

納期モード([`Phase-6-introduction.md`](./Phase-6-introduction.md)参照)。合流先・保持方針は仕様診断#28で確定済みの判断のため、#14のSUT/ドライバ/スタブの言語化は省略しない(判断の再現性を残すため、下記「テスト観点」で明記する)。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): テストはまとめて表の末尾に置いている。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`alembic/versions/3f9ce4d4a23b_add_template_id_to_projects.py`](../samples/backend/alembic/versions/3f9ce4d4a23b_add_template_id_to_projects.py) | 新規 | 定型 | `projects.template_id`(nullable FK→`prompt_templates.id`)の追加マイグレーション |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | 定型 | `template_id`カラムを追加。既存カラム・リレーションは変更なし |
| [`app/repositories/prompt_template.py`](../samples/backend/app/repositories/prompt_template.py) | 新規 | 定型 | `PromptTemplateRepository`(`list_all_templates`のみ。CRUDは設けない) |
| [`app/repositories/project.py`](../samples/backend/app/repositories/project.py) | 更新 | 定型 | `create`に`template_id`引数を追加(既定`None`) |
| [`app/schemas/prompt_template.py`](../samples/backend/app/schemas/prompt_template.py) | 新規 | 定型 | `PromptTemplateRead`(外部設計書2.5節2項のデータ構造例どおり`system_prompt`も含める) |
| [`app/schemas/project.py`](../samples/backend/app/schemas/project.py) | 更新 | 定型 | `ProjectDetail`に`template_id`を追加 |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | `PromptTemplateNotFoundError`を追加 |
| [`app/services/project.py`](../samples/backend/app/services/project.py) | 更新 | **コア** | `create`が`template_id`を受け取り、存在確認(FK制約違反による未捕捉500を防ぐ)の上で永続化する |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | **コア** | `_build_messages`が`template`引数を受け取り、`system_prompt`を基本のヒアリングプロンプトへ合流させる。`stream_reply`/`check_completion`/`generate_opening_reply`が`_load_template`経由でテンプレートを解決する |
| [`app/api/routes/prompt_templates.py`](../samples/backend/app/api/routes/prompt_templates.py) | 新規 | 定型 | `GET /api/v1/prompt-templates`(認証必須、プロジェクト非依存の一覧) |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | 定型 | `POST /projects`が`template_id`フォームフィールドを受け取る。`GET /projects/{id}`のレスポンスに`template_id`を追加 |
| [`app/api/routes/__init__.py`](../samples/backend/app/api/routes/__init__.py) | 更新 | 定型 | `prompt_templates_router`を登録 |
| [`scripts/seed.py`](../samples/backend/scripts/seed.py) | 更新 | 定型 | 固定テンプレート2件の投入(`seed_prompt_templates`、name一致で冪等) |
| ── ここからテスト(まとめて末尾) ── | | | |
| [`tests/unit/test_prompt_template_repository.py`](../samples/backend/tests/unit/test_prompt_template_repository.py) | 新規 | 定型 | `list_all_templates`の並び順・`get_by_id`の未存在時挙動 |
| [`tests/unit/test_project_repository.py`](../samples/backend/tests/unit/test_project_repository.py) | 更新 | 定型 | `template_id`の永続化・既定値`None`のテストを追加 |
| [`tests/unit/test_project_service.py`](../samples/backend/tests/unit/test_project_service.py) | 更新 | 定型 | 有効な`template_id`の永続化・不正な`template_id`での`PromptTemplateNotFoundError`のテストを追加 |
| [`tests/unit/test_chat_service.py`](../samples/backend/tests/unit/test_chat_service.py) | 更新 | 定型 | `_build_messages`のテンプレート合流・`generate_opening_reply`経由の合流を確認するテストを追加 |
| [`tests/unit/test_prompt_templates_routes.py`](../samples/backend/tests/unit/test_prompt_templates_routes.py) | 新規 | 定型 | route関数(`list_prompt_templates`)を`test_document_versions.py`と同じパターンで直接呼ぶテスト |
| [`tests/unit/test_seed_prompt_templates.py`](../samples/backend/tests/unit/test_seed_prompt_templates.py) | 新規 | 定型 | `seed_prompt_templates`の投入・冪等性のテスト |

## 設計判断

### なぜテンプレートIDの検証をルーターではなくサービス層で行うか

`devex-api/CLAUDE.md`のレイヤー方針(「ルーターはリクエスト/レスポンスの変換のみ」)に従い、「存在しない`template_id`を拒否する」というドメインルールは`ProjectService.create`に置いた。検証しない場合、DBレベルのFK制約違反(`IntegrityError`)がそのまま未捕捉の500として露出してしまう。これは`app/services/errors.py`の`AppError`体系(`register_error_handlers`による一括変換)を経由しないため、他のバリデーションエラー(`TooManyFilesError`等)と扱いが不揃いになる。事前に`PromptTemplateRepository.get_by_id`で存在確認し、`PromptTemplateNotFoundError`(404)として扱うことで、他のドメイン例外と同じ経路に統一した。

### なぜ`system_prompt`の合流を`_build_messages`(純粋関数)ではなく呼び出し側で解決するか

`_build_messages`自体はDBアクセスを持たない純粋関数(`ChatHistory`のリスト+`Project`+`PromptTemplate | None`を受け取り`list[BaseMessage]`を返すだけ)のまま保ちたかった。テンプレートの解決(`project.template_id`からDBを引く処理)は`ChatService._load_template`という新しいprivateメソッドに切り出し、`stream_reply`/`check_completion`/`generate_opening_reply`の3箇所がそれぞれ呼び出した結果を`_build_messages`へ渡す設計にした。これにより`_build_messages`単体のテスト(`PromptTemplate`インスタンスを直接組み立てるだけ、DB不要)と、`ChatService`経由の結合テスト(DBに永続化した`template_id`からの解決を含む)を分けて書ける。

### なぜ`PromptTemplateRead`に`system_prompt`を含めるか

内部の実装詳細(LLMへの指示文)をクライアントに露出することに一見抵抗があるが、[外部設計書](../../docs/external_design.md) 2.5節2項の「プロンプトテンプレート選択データ」のデータ構造例が明示的に`system_prompt`を含む形で定義されているため、これに合わせた。SCR-003の画面自体が`system_prompt`を表示するかは外部設計書の管轄(UI/UX詳細は仕様診断#28で「中程度」に分類、Phase 6-4で扱う)であり、本章はAPIの応答形状をドキュメントの定義どおりに実装するところまでを担う。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `PromptTemplateRepository.list_all_templates`/`get_by_id` | pytest(直接呼び出し) | スタブ不要 ── DBアクセスのみで外部LLM呼び出しを含まないため | `test_prompt_template_repository.py` |
| `ProjectRepository.create`(`template_id`) | pytest(直接呼び出し) | スタブ不要 ── 同上 | `test_project_repository.py` |
| `ProjectService.create`(`template_id`検証) | pytest(直接呼び出し) | スタブ不要 ── DBアクセスのみ | `test_project_service.py` |
| `_build_messages`(テンプレート合流、純粋関数) | pytest(直接呼び出し) | スタブ不要 ── 対象が純粋(`PromptTemplate`インスタンスを直接渡すのみ、DB・LLMいずれも呼ばない)なため | `test_chat_service.py` |
| `ChatService.generate_opening_reply`(テンプレート解決込み) | pytest(直接呼び出し) | `FakeLLM`(`invoke_messages`に渡されたメッセージ列を記録、合流結果を検証) | `test_chat_service.py` |
| `list_prompt_templates`(route関数) | pytest(直接呼び出し、`test_document_versions.py`と同じパターンでルート関数をFastAPI経由を通さず直接awaitする) | スタブ不要 | `test_prompt_templates_routes.py` |
| `seed_prompt_templates` | pytest(直接呼び出し) | スタブ不要 ── DBアクセスのみで外部呼び出しを含まないため | `test_seed_prompt_templates.py`。投入・冪等性(2回実行しても件数が変わらない)の両方を確認 |

## 動作確認(実施済み)

samples反映後、devex-apiの実環境へ一時的に適用して以下を確認した(検証後は元の状態に復元済み、実プロジェクトへの反映は各自の写経による)。

```bash
cd backend
uv run pytest tests/unit/test_prompt_template_repository.py tests/unit/test_prompt_templates_routes.py \
  tests/unit/test_seed_prompt_templates.py tests/unit/test_project_repository.py \
  tests/unit/test_project_service.py tests/unit/test_chat_service.py -v
# 42 passed
uv run pytest -m "not integration"
# 134 passed
uv run ruff check .
# (本章が触れた範囲は全てAll checks passed。検証時に見つけた行長超過は即修正済み)
uvx pyright
# 本章の変更による新規エラー0件(既知の1件、app/ai/llm/gemini.pyのみ残存)
uv run alembic history
# 3bacecabb584 -> 3f9ce4d4a23b (head), add template_id to projects が正しく連結
```

あわせて`app.openapi()`で`/api/v1/prompt-templates`が正しく登録され、既存ルートとのパス衝突が無いことを確認した。

### 検証時のメモ(このセッションでの状況)

検証作業の途中、`app/api/routes/projects.py`に対して**本章の対象外であるPhase 6-1(バージョン履歴API)のルート実装(`list_document_versions`/`restore_document_version`とその import)が、実プロジェクト側で並行して手作業により追加されている**ことを確認した。本章の検証はこの状態の上に行い(共存に問題は無いことを確認済み)、リバートの際は本章が追加した差分(`template_id`関連の3箇所)のみを取り除き、その並行作業分はそのまま残した。

## 既知の残課題

- SCR-003のテンプレート選択UI(`IntakeForm.tsx`への組み込み)はPhase 6-4で扱う。本章はAPI・永続化・チャットへの合流までが対象。
- テンプレートの`default_environment`をSCR-004の環境設定へプリフィルする処理はフロントエンド側(Phase 6-4)の実装であり、本章では扱わない。

# Phase-6-1: バージョン履歴API

## この章の目的

SCR-006(バージョン履歴管理画面、Should have)の土台となるバックエンドAPIを実装する。既存のバージョン増分+直近3件保持の機構(Phase-2-1で実装済み)は変更せず、その上に「保管済み全バージョンの一覧取得」「指定バージョンを新バージョンとして復元」の2エンドポイントを追加する(仕様診断#28で確定した設計、[`Phase-6-introduction.md`](./Phase-6-introduction.md)参照)。

納期モード([`Phase-6-introduction.md`](./Phase-6-introduction.md)参照)。復元の意味論(新バージョン追加・上書きしない)は仕様診断で確定済みの判断のため、本章では#14のSUT/ドライバ/スタブの言語化を省略しない(判断の再現性を残すため、下記「テスト観点」で明記する)。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): テストはまとめて表の末尾に置いている。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py) | 更新 | 定型 | `list_versions`(保管済み全バージョンを新しい順に取得)・`get_version`(指定バージョンを1件取得)を追加。既存の`create_version`・`MAX_VERSIONS_PER_DOC_TYPE`は変更なし |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | **コア** | `DocGeneratorService`に`list_versions`・`restore_version`を追加。復元の意味論(新バージョンとして追加、既存版は上書きしない)は仕様診断#28で確定した設計判断そのもの |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | 定型 | `GET .../documents/{doc_type}/versions`・`POST .../documents/{doc_type}/versions/{version}/restore`の2ルートを追加。既存ルートは変更なし |
| ── ここからテスト(まとめて末尾) ── | | | |
| [`tests/unit/test_generated_document_repository.py`](../samples/backend/tests/unit/test_generated_document_repository.py) | 更新 | 定型 | `list_versions`・`get_version`のテストを追加 |
| [`tests/unit/test_doc_generator_service.py`](../samples/backend/tests/unit/test_doc_generator_service.py) | 更新 | 定型 | `DocGeneratorService.list_versions`・`restore_version`のテストを追加(復元=新バージョン追加であることを固定する回帰テスト含む) |
| [`tests/unit/test_document_versions.py`](../samples/backend/tests/unit/test_document_versions.py) | 新規 | 定型 | route関数(`list_document_versions`・`restore_document_version`)を`test_document_download.py`と同じパターンで直接呼ぶテスト |

## 設計判断

### なぜ`GeneratedDocumentRepository`に新メソッドを2つ追加するに留めたか

`list_versions`は既存の`get_latest`と全く同じ形(`list_all`に`order_by`+`project_id`/`doc_type`フィルタを渡すだけ)、`get_version`は`find_one`にversionフィルタを1つ追加するだけの薄いラッパーである。`MAX_VERSIONS_PER_DOC_TYPE`・`create_version`のプルーニングロジックには一切手を触れていない(仕様診断#28の決定1: 保持件数ポリシーは現状の3件キャップを維持)。

### なぜ「復元」を`DocGeneratorService`に実装したか(routeに直接書かない理由)

復元は「指定バージョンの存在確認→内容取得→`create_version`呼び出し→commit」という複数ステップの処理であり、`devex-api/CLAUDE.md`のレイヤー方針(「ルーターはリクエスト/レスポンスの変換のみ」)に従い、ビジネスロジックとして`DocGeneratorService`(既存の4文書生成サービス)に置いた。新しいサービスクラスを増やすのではなく既存の`DocGeneratorService`に足したのは、`generated_documents`に対するドメイン操作(生成・一覧・復元)を1箇所に集約するため(CLAUDE.md #17: 実在の消費者=同じテーブルへの操作)。

### 復元の意味論(仕様診断#28の決定2)

> **[Phase 6-6 で確定 ── 復元で新バージョンを作らない]** 当初〈復元は`create_version`で新バージョンとして追加〉→ 撤回。理由〈復元のたびに同一内容のバージョンが増え、保持3件を消費するため〉。以後`restore_version`は`GeneratedDocumentRepository.set_current`で`is_current`を付け替えるのみ。詳細は[`Phase-6-6.md`](./Phase-6-6.md)。以下の記述は当初案の記録。

`restore_version`は`get_version`で取得した過去バージョンの`content`を、`create_version`へそのまま渡して**新バージョンとして追加**する。既存版の上書きはしない。これにより:
- `create_version`の既存プルーニングロジック(直近3件保持)がそのまま働き、復元後も3件キャップが自然に維持される。
- 「バージョンv1の内容を復元した結果、それが新しいv4になる」という直感的な履歴になる(v1自体が書き換わるわけではない)。

## テスト観点

`db_session`(インメモリSQLite)を使ったユニットテスト。SUT(テスト対象)/ドライバ/スタブの関係:

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `GeneratedDocumentRepository.list_versions`/`get_version` | pytest(直接呼び出し) | スタブ不要 ── DBアクセスのみで外部LLM呼び出しを含まないため | `test_generated_document_repository.py` |
| `DocGeneratorService.list_versions`/`restore_version` | pytest(直接呼び出し) | スタブ不要 ── これらのメソッド自体はLLMを呼ばない(既存の`generate`とは独立) | `test_doc_generator_service.py` |
| `list_document_versions`/`restore_document_version`(route関数) | pytest(直接呼び出し、`test_document_download.py`と同じパターンでルート関数をFastAPI経由を通さず直接awaitする) | スタブ不要 | `test_document_versions.py` |

## 動作確認(実施済み)

samples反映後、devex-apiの実環境へ一時的に適用して以下を確認した(検証後は元の状態に復元済み、実プロジェクトへの反映は各自の写経による):

```bash
cd backend
uv run pytest tests/unit/test_generated_document_repository.py tests/unit/test_doc_generator_service.py tests/unit/test_document_versions.py -v
# 25 passed
uv run pytest -m "not integration"
# 130 passed(既存121件+新規9件)
uv run ruff check .
# All checks passed!
uvx pyright
# 既知の1件(app/ai/llm/gemini.py、本章と無関係)を除き0エラー
```

あわせて`app.openapi()`で新設した2ルートが`/api/v1/projects/{project_id}/documents/{doc_type}/versions`・`.../restore`として正しく登録され、既存ルートとのパス衝突が無いことを確認した。

## 既知の残課題

- バージョン間の差分(diff)表示は本章の対象外(仕様診断#28で「中程度」に分類、Phase-6-2のUI設計時に検討する)。
- 統合テスト(`tests/integration/test_projects_flow.py`)への追加は行っていない。ユニットテストで十分カバーできているため(#15の前方import監査も参照)。

# Phase-6-6: 動作確認後の修正(完了判定・生成ボタン・復元の仕様変更)

## この章の目的

ステージ2の動作確認で見つかった3件を修正する。(1) ヒアリング完了バナーが、まだ確認事項が残っている段階で早く出る。(2) 設計書生成後にチャットへ戻って再送信すると、新しい完了バナーの生成ボタンが押せないまま。(3) バージョン履歴の「復元」を押すたびに同じ内容のバージョンが増える。(3)は仕様変更(復元=新バージョン追加 → 復元=表示バージョンの切替)を伴い、[`Phase-6-1.md`](./Phase-6-1.md)・[`Phase-6-2.md`](./Phase-6-2.md)の決定を改訂する。

自動実装モード: off([introduction](./Phase-6-introduction.md) 参照)。

## この章で作成・更新するファイル

写経順序は依存順(CLAUDE.md #30): テストはまとめて表の末尾に置いている。

| ファイル | 新規/更新 | 写経レベル | 責務・要点 |
|---|---|---|---|
| [`alembic/versions/b7e1d2c4a9f0_add_is_current_to_generated_documents.py`](../samples/backend/alembic/versions/b7e1d2c4a9f0_add_is_current_to_generated_documents.py) | 新規 | 定型 | `generated_documents.is_current`(bool、`server_default=false`)追加。既存データは各`(project_id, doc_type)`の最大versionを`true`に更新(従来は常に最新版を表示していたため挙動不変) |
| [`app/models/generated_document.py`](../samples/backend/app/models/generated_document.py) | 更新 | 定型 | `is_current: Mapped[bool]`追加。同一`project_id`+`doc_type`でちょうど1行だけ`true` |
| [`app/schemas/document.py`](../samples/backend/app/schemas/document.py) | 更新 | 定型 | `GeneratedDocumentRead.is_current`追加(履歴の「表示中」バッジ用) |
| [`app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py) | 更新 | **コア** | `create_version`が新版を`is_current=True`で作り既存の`is_current`を外す。`list_latest_for_project`を`get_current`/`list_current_for_project`へ置換(currentが無ければ最大versionへフォールバック)。`set_current`を新設(指定版が無ければ何も変更せず`None`) |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | **コア** | `restore_version`を「`set_current`のみ・新しい行を作らない」へ変更。存在しない版は`DocumentNotFoundError` |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | 定型 | 一覧は`list_current_for_project`(表示中の版)を返す。復元エンドポイントのdocstring更新。ダウンロードは`doc_id`指定のまま(フロントが表示中ドキュメントのidを渡す) |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | **コア** | `_COMPLETION_CHECK_PROMPT`を厳格化(根拠はユーザー発言のみ・未回答の質問や「確認したい事」が残れば未達・迷えばfalse)。`_MIN_USER_TURNS_FOR_COMPLETION=3`を追加し、`check_completion`はユーザー実発話(`sender='user'`)が下限未満なら、LLMがtrueでも`is_sufficient=False`+`missing_points`に理由を追加して返す(一方向のみ) |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 定型 | E2E用フェイクの閾値を「intake1+発話3=4件」へ(ガードとフェイクの食い違いを避ける) |
| [`src/features/documents/api/documentsApi.ts`](../samples/frontend/src/features/documents/api/documentsApi.ts) | 更新 | 定型 | `GeneratedDocumentRead.is_current`追加 |
| [`src/features/hearing/hearing-store.ts`](../samples/frontend/src/features/hearing/hearing-store.ts) | 更新 | **コア** | `sendMessage`が`projectStatus: completed→revising`を即時反映(サーバー側`stream_reply`と同じ遷移)。`approveAndGenerate`が`projectStatus: "generating"`・`completion: null`にする(使用済みの完了判定を持ち越さない) |
| [`src/features/hearing/components/HearingCompletionBanner.tsx`](../samples/frontend/src/features/hearing/components/HearingCompletionBanner.tsx) | 更新 | 定型 | `projectStatus==="completed"`ならボタン無効・「設計書は生成済みです」表示。storeを購読するので、`revising`に変わると再描画され押下可能に戻る |
| [`src/features/documents/components/VersionHistoryPanel.tsx`](../samples/frontend/src/features/documents/components/VersionHistoryPanel.tsx) | 更新 | **コア** | 復元後は一覧に足さず`is_current`(「(表示中)」)のみ付け替える。表示中の版には復元ボタンを出さない。「(最新)」は最大versionに残す(両者は復元後に異なりうる) |
| [`src/lib/api/base-url.ts`](../samples/frontend/src/lib/api/base-url.ts)(新規)、`src/lib/api/client.ts`・`src/features/hearing/api/streamChat.ts`・`src/features/documents/api/documentsApi.ts`・`src/lib/api/server-fetch.ts`(更新) | 更新 | **コア** | `NEXT_PUBLIC_API_URL`の末尾スラッシュを除去する`API_BASE_URL`を1か所に集約し、各APIクライアントから使う(下記「設計判断」参照。`server-fetch.ts`はsamples未収録のためdevex-uiのみ) |
| `tests/unit/test_chat_service.py`・`test_fake_llm_e2e.py`・`test_generated_document_repository.py`・`test_document_versions.py`・`test_doc_generator_service.py`・`test_document_download.py`、`tests/integration/test_projects_flow.py`(すべて更新) | 更新 | 定型 | 下記テスト観点 |
| `src/features/hearing/**/__tests__/HearingCompletionBanner.test.tsx`・`hearing-store.test.ts`、`src/features/documents/**/__tests__/VersionHistoryPanel.test.tsx`・`DocumentMarkdownView.test.tsx`・`DocumentTabs.test.tsx`・`documents-store.test.ts`・`documentsApi.test.ts`、`e2e/devex-flow.spec.ts`(すべて更新) | 更新 | 定型 | 下記テスト観点 |

## 設計判断

### 完了判定の早期発火: プロンプトだけに頼らず、コード側に下限を持つ

LLMは根拠の乏しい条件も「満たした」と楽観的に判定しがちで、プロンプトの文言調整だけでは再発しうる。そこで(1)プロンプトを厳格化し、(2)`check_completion`にユーザー実発話数の決定論的な下限(3件)を設けた。ガードは「trueをfalseにする」一方向のみで、LLM自身のfalse判定や`missing_points`は変えない。intake・添付・AI発話は「ユーザーの実発話」ではないため数えない。

### 「生成ボタンが戻らない」の原因: サーバーの状態変化にstoreが追従していなかった

バナーのボタンは`projectStatus`に依存するが、`projectStatus`は`loadHistory`でしか更新されず、`sendMessage`でサーバーが`completed→revising`に遷移しても`"completed"`のまま残っていた(ダッシュボード経由で`loadHistory`が走り直すと直る、という症状と一致)。サーバーと同じ遷移をクライアントの楽観更新で反映する。承認済みの`completion`も破棄し、生成後にチャットへ戻った際に古いバナーが再表示されないようにした。

### 復元は「表示バージョンの切替」に: `is_current`カラム

復元のたびに同じ内容のバージョンが増えると保持3件を無意味に消費する。復元は新しい行を作らず`is_current`を付け替えるだけにし、番号が増えるのは再生成(`create_version`)のときだけにした。「表示中」をどこに持つかは、フロントのみ(リロード・別端末で失われる)ではなくDBカラムとした。一覧・ダウンロード・履歴バッジがすべて同じ値を参照でき、ダウンロードは常に表示中の版になる。新版は常にcurrentになるため、保持数超過で削除される最古版がcurrentであることは無い。

> 既知の残課題: `DocumentTabs`は`LayoutTabs.content`へ毎レンダー新しい関数コンポーネントを渡すため、復元後の`documents-store`再取得で`VersionHistoryPanel`が再マウントされ、パネルが閉じる(再度開けば最新の一覧が取得され、バッジも正しい)。機能上は問題ないため今回は対象外とした。

### API ベースURLの末尾スラッシュ除去(本番で発見した不具合)

本番でF5するとログインが切れた。Vercelの`NEXT_PUBLIC_API_URL`に末尾スラッシュが付いており、`${API_BASE_URL}${path}`が`https://host//api/v1/auth/refresh`になっていた。サーバーは`//api/...`でもルーティングするため通常のAPI呼び出しは成功するが、ブラウザのCookieのパスマッチは厳密で、`Path=/api/v1/auth`のリフレッシュトークンCookieは`//api/...`のリクエストには送られない。結果、F5後の`refresh`だけが401になった(サーバーのRedis・`Set-Cookie`は正常だった)。ローカルは`http://localhost:8000`(末尾スラッシュ無し)のため再現しなかった。環境変数の設定ミスに依存するので、定数側で`replace(/\/+$/, "")`して吸収する。

## テスト観点(#14)

- `test_chat_service.py`: SUT=`ChatService.check_completion`、ドライバ=pytest、スタブ=`FakeLLM`(LLM呼び出しは外部依存のため注入)。発話が下限未満ならLLMがtrueでもfalse・下限以上ならLLM判定を尊重・intake/attachment/aiを数えない・LLMのfalseはそのまま。
- `test_generated_document_repository.py`・`test_doc_generator_service.py`・`test_document_versions.py`: SUT=リポジトリ/サービス/ルート関数、ドライバ=pytest、スタブ不要 ── 実DB相当(SQLiteインメモリ)への読み書きのみで外部依存が無いため。`create_version`のcurrent切替・保持3件超過後もcurrentがちょうど1件・`set_current`(存在しない版で不変)・復元を繰り返しても版が増えない・一覧が表示中の版を返す・復元後に再生成した版がcurrentになる。
- `test_document_download.py`: 復元後の表示中ドキュメントのidで、その版の内容がダウンロードされる。
- `test_fake_llm_e2e.py`・`test_projects_flow.py`・`e2e/devex-flow.spec.ts`: 完了判定に必要な発話が3回になったことへの追従。
- `hearing-store.test.ts`: SUT=`useHearingStore`、ドライバ=vitest、スタブ=`stubFetch`+`streamChat`のモック。`completed`で送信すると`revising`・それ以外は不変・`approveAndGenerate`後に`completion=null`かつ`generating`。
- `HearingCompletionBanner.test.tsx`: SUT=バナー、ドライバ=Testing Library、スタブ不要(storeを`setState`で直接設定)。`completed`で無効・`completed→revising`の変化で再描画され押下可能に戻る。
- `base-url.test.ts`: SUT=`API_BASE_URL`(モジュール読み込み時に決まるため`vi.resetModules()`+動的import)、ドライバ=vitest、スタブ=環境変数(`vi.stubEnv`)+`stubFetch`。末尾スラッシュ無し/1個/複数・未設定のフォールバック・末尾スラッシュ付きでも`apiFetch`のURLに`//`が入らない。
- `VersionHistoryPanel.test.tsx`・`DocumentMarkdownView.test.tsx`: 「表示中」バッジ・復元後に行数が増えずバッジが移る・ダウンロードが表示中ドキュメントのidを使う。

## 実行確認

`devex-api`・`devex-ui`は変更せず、リポジトリの現状にsamplesを重ねた一時コピーで実行した(実プロジェクトへの反映は各自の写経による)。

- バックエンド: `pytest tests`(171件)通過。
- フロントエンド: `vitest run src/features/documents src/features/hearing`(88件)通過、`eslint`は既存の警告1件のみ。
- ブラウザE2E(Playwright)・実LLMでの完了判定の体感は未実施(写経後に確認: ①発話2往復では完了バナーが出ない ②生成→チャットへ戻る→送信→新バナーのボタンが押下可能 ③復元しても版数が増えず「表示中」が移る ④復元後のダウンロード内容が画面と一致)。

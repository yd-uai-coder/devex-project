# Phase-4-5: セキュリティ・パフォーマンス確認

## この章の目的

`docs/implementation_plan.md` 4.2節の統合テスト・QAタスクのうち「パフォーマンス・セキュリティ確認」(LLM呼び出しタイムアウト時の挙動確認、SQLインジェクション・不正アクセス対策のレビュー)を扱う。Phase 4の最終章として、これまでの章で見つけた欠落(`get_gemini_llm`のtimeout未設定、[`Phase-4-3.md`](./Phase-4-3.md)参照)の検証を完結させ、既存の防御(所有者チェック・ORMのパラメータ化クエリ)が実際にHTTPレイヤーで機能していることを確認する。

学習モード(CLAUDE.md #21: 攻撃面の分析という新規の判断を要し#21(a)の条件を満たさないため)。

サンプルは [`textbook/samples/backend/`](../samples/backend/) に追加・更新した。写経前提として[`Phase-4-1.md`](./Phase-4-1.md)〜[`Phase-4-4.md`](./Phase-4-4.md)の写経が完了していること。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): テストはまとめて表の末尾に置いている。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| ── ここからテスト(まとめて末尾) ── | | | |
| `tests/unit/test_llm_retry.py` | 更新 | コア | `TimeoutError`が他の一時的失敗と同様に扱われることの確認テストを追加 |
| `tests/integration/test_security_and_performance.py` | 新規 | コア | 不正アクセス・SQLインジェクション耐性のHTTPレイヤー確認 |

本章はロジック本体の変更が無い(検証のみ)ため、実装ファイルの新規・更新は無い。`get_gemini_llm`への`timeout`明示自体は[`Phase-4-3.md`](./Phase-4-3.md)で既に実施済みで、本章はその効果の検証に専念する。

## 実施した確認と結論

### 1. LLM呼び出しタイムアウト時の挙動確認

**発見**: [`Phase-4-3.md`](./Phase-4-3.md)で述べたとおり、`get_gemini_llm()`が`ChatGoogleGenerativeAI`に`timeout`を渡していなかった(既定`None`=無制限)。`invoke_with_retry`(Phase 2-5)は例外発生時のみ働くため、応答がハングして例外が発生しない限りリトライは機能せず、クライアント(ブラウザ)は無期限に待ち続けることになる。

**対応**: 既に[`Phase-4-3.md`](./Phase-4-3.md)で`settings.LLM_TIMEOUT_SECONDS`(既定60秒)を`ChatGoogleGenerativeAI(timeout=...)`へ渡す修正を行った。`timeout`超過時、langchain-google-genaiは`TimeoutError`(Python組み込み。`asyncio.TimeoutError`は3.11以降そのエイリアス)を送出する設計になっている(langchain-google-genaiのドキュメント記載を確認済み)。

**検証**: 実際にネットワークをハングさせて60秒待つテストは実行コストが高く再現性も低いため行わない。代わりに、`invoke_with_retry`が`TimeoutError`を他の一時的失敗と同じ経路(`_is_quota_error`に該当しない→リトライ→規定回数失敗後に`GenerationFailedError`)で扱うことをユニットテストで固定した。これにより「タイムアウトしても最終的にはユーザーへ日本語のエラーメッセージ(Phase 4-1で日本語化済み)が返る」という挙動が保証される(無期限ハングではなく、`LLM_TIMEOUT_SECONDS`×リトライ回数の上限が必ず存在する)。

**既知の限界**: `timeout`の値(60秒)自体が実際のGemini APIの応答時間分布に対して適切かどうかは、実測データが無いため検証できていない(本Phaseは`E2E_FAKE_LLM=true`で意図的に実Gemini APIを呼ばずに検証する方針のため。下記「Phase 4-5全体としての既知の残課題」の`GOOGLE_API_KEY`に関する訂正も参照)。実測に基づいて値を調整することを推奨する。

### 2. 不正アクセス対策のレビュー

**確認済みの既存設計**(コードレビューによる再確認、変更は無し):

- 他ユーザーのプロジェクトへのアクセスは、存在の有無を漏らさないため一律404(`RESOURCE_NOT_FOUND`)を返す設計になっている(`app/api/deps.py`の`get_current_project`、Phase 2-2)。403(Forbidden)にしてしまうと「そのIDのプロジェクトは存在するが権限が無い」ことを攻撃者に教えてしまうため、意図的に404にしている。
- 認証境界(`get_current_user`)は`AppError`の仕組みを使わず生の`HTTPException`で一律401にする設計(`devex-api/CLAUDE.md`に明記済みの既存方針)。失敗理由(トークン不正/期限切れ/ユーザー無効化)を外部に漏らさないためで、レスポンスに`code`フィールドが含まれないことも仕様の一部である。

**検証**: 上記2点を、依存関数の直接呼び出しではなく実際のHTTPリクエストを通して確認する統合テストを追加した(既存の`test_deps_current_project.py`は`get_current_project`を直接呼ぶのみで、`AppError`ハンドラを経由した実際のレスポンス形まではカバーしていなかった)。

### 3. SQLインジェクション対策のレビュー

**確認済みの既存設計**: `app/repositories/`配下は全てSQLAlchemyのORM(`select()`・属性アクセス)経由でクエリを組み立てており、生のSQL文字列結合箇所は存在しない(`grep -rn "text(\|execute(\|f\"SELECT\|f'SELECT"`相当の目視確認を`app/repositories/`・`app/services/`全体に対して実施し、該当箇所が無いことを確認した)。SQLAlchemyのORM層はパラメータ化クエリを内部で使うため、値として渡された文字列がSQL文として解釈されることは無い。

**検証**: 自由記述欄(`system_overview`)にSQLメタ文字を含む文字列(`'; DROP TABLE users; --`)を実際にHTTP経由で送信し、(a) 文字列としてそのまま保存・取得できること、(b) `users`テーブルへの実害が無いこと(プロジェクト一覧が壊れていないこと)を確認する統合テストを追加した。加えて、パスパラメータ(`project_id: uuid.UUID`)へのインジェクション試行が、DBへ到達する以前にPydantic/FastAPIの型検証(422)で弾かれることも確認した。

## テスト観点(学習モード)

### `invoke_with_retry`のTimeoutError処理

- SUT: `app.services.llm_retry.invoke_with_retry`
- ドライバ: `tests/unit/test_llm_retry.py`
- スタブ: 不要(`_call`引数として渡す非同期関数自体がテストコード内のクロージャであり、外部依存を一切呼ばない純粋なテスト)。

### 不正アクセス・SQLインジェクションのHTTPレイヤー確認

- SUT: FastAPIアプリケーション全体(ルーティング+`app/api/deps.py`の認証・所有者チェック+`AppError`ハンドラ)
- ドライバ: `tests/integration/test_security_and_performance.py`(`httpx.AsyncClient`+`ASGITransport`、実PostgreSQL/Redis)
- スタブ: 不要。本章の狙いが「実際のHTTPレイヤー・実際のDBを通した防御の再確認」であるため、LLMを呼ばない操作(プロジェクト作成・取得・一覧)のみを対象にしており、フェイクLLMすら必要としない。

## 動作確認(このセッション内で実施)

- `uv run pytest tests/unit/test_llm_retry.py`で6件green(既存4件+本章追加2件)。
- `uv run pytest -m integration tests/integration`(この時点で存在する全ファイル、`test_security_and_performance.py`の4件を含む計9件)を実PostgreSQL/Redis環境に対して一括実行し、**9件全てgreen**であることを確認した([`Phase-4-1.md`](./Phase-4-1.md)の`conftest.py`修正により一括実行が可能になったことの最終確認を兼ねる)。`uv run pytest tests/unit`で**125件green**(Phase 4完了時点の最終件数)、`uvx pyright`で0エラー。
- このセッション内で一時的に`devex-api/backend`へ反映して検証し、検証後は写経前の状態に戻してある。

## Phase 4-5全体としての既知の残課題(Phase 5以降への申し送り)

- `LLM_TIMEOUT_SECONDS`の値(60秒)は実測に基づかない暫定値。実際のレイテンシ分布を見て調整することを推奨する。
- レート制限(`CHAT_RATE_LIMIT_PER_HOUR`等、既存の`RateLimiter`)・ボディサイズ上限(`MAX_REQUEST_BODY_BYTES`)は既にPhase 2以前で実装済みの既存機構であり、本章では変更・追加検証を行っていない(スコープを「Phase 4で新たに発見された欠落」に絞ったため)。網羅的なペネトレーションテスト(自動スキャナ等)は本Phaseのスコープ外。
- **`GOOGLE_API_KEY`に関する既知の限界の訂正**: Phase 2〜Phase 4-4まで一貫して「`GOOGLE_API_KEY`未設定のため実LLM未検証」と記録してきたが、本章の検証中、`devex-api/.env`に実際の値が設定されていることを確認した(いつ設定されたかは本Phaseの範囲では特定していない)。ただし本Phaseは意図的に`E2E_FAKE_LLM=true`で実Gemini APIを一切呼ばずに検証する方針を取ったため(実APIコストを本Phaseの検証のためだけに消費しないため)、この鍵を使った実際の動作確認は本Phase自身も行っていない。「実Gemini APIでの動作確認が一度も行われていない」という過去の記録は、少なくとも鍵の有無という意味では既に正確でなくなっている可能性があり、Phase 5以降で実際に確認・記録を更新することを推奨する。

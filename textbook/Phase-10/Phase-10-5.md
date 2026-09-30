# Phase-10-5: サービス層とバックグラウンド生成

## この章の目的

UML 図の AI 生成のユースケースを `UmlGenerationService` として実装する。生成は2段に分かれる。

- **受け付け**(`request_generation`、リクエストの中で実行): 検証し、図を上書き対象として `generating` にし、履歴を作る。
- **実行**(`execute_run`、バックグラウンドで実行): 対象を1件ずつ LLM で生成する。

止まった理由(クォータ超過・トークン上限・出力の解釈失敗)は分類して、履歴と図に残す。あわせて、`UmlDiagramService` に「生成中の図は編集させない」ガードと、DFD の横断検証の集計を加える。

学習モード([introduction](./Phase-10-introduction.md)参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | 次の例外を追加する: `UmlSourceDocumentMissingError`・`UmlGenerationInProgressError`・`UmlSubjectNotFoundError`・`ErScopeRequiredError`・`TooManySubjectsError`・`LLMTokenLimitError`・`LLMInvalidOutputError` |
| [`app/services/llm_retry.py`](../samples/backend/app/services/llm_retry.py) | 更新 | **コア** | `LLMTokenLimitError` と入力トークン超過(Gemini の 400)はリトライしない(#12、Phase-2-5 の遡及) |
| [`app/uml/generation/failures.py`](../samples/backend/app/uml/generation/failures.py) | 新規 | **コア** | `unwrap_structured_result`(include_raw の結果を解釈する)・`classify_failure`(理由コードとユーザー向けの文言)・`SKIPPED_MESSAGE` |
| [`app/uml/generation/__init__.py`](../samples/backend/app/uml/generation/__init__.py) | 更新 | 定型 | 本章の担当分として、`failures` の公開シンボルを re-export する |
| [`app/uml/domain/__init__.py`](../samples/backend/app/uml/domain/__init__.py) | 更新 | 定型 | `empty_semantic_model` の利用者についてのコメントを更新する |
| [`app/services/uml_generation_service.py`](../samples/backend/app/services/uml_generation_service.py) | 新規 | **コア** | `list_candidates`・`list_runs`・`request_generation`・`execute_run` と、background エントリの `run_uml_generation` |
| [`app/services/uml_diagram_service.py`](../samples/backend/app/services/uml_diagram_service.py) | 更新 | **コア** | `update`/`compute_layout` の生成中ガード(`_ensure_not_generating`)、DFD 横断検証の集計(`_validate_model`) |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 定型 | E2E 用に、UML スキーマ3種の固定出力を返す。`include_raw` に対応する |
| ── ここからテスト ── | | | |
| [`tests/fixtures/fake_llm.py`](../samples/backend/tests/fixtures/fake_llm.py) | 更新 | 定型 | `with_structured_output(schema, include_raw=...)` に対応する。`structured_sequence` に dict(生の応答)を渡せるようにする |
| [`tests/unit/test_llm_retry.py`](../samples/backend/tests/unit/test_llm_retry.py) | 更新 | 定型 | トークン上限はリトライしないこと |
| [`tests/unit/test_uml_generation_failures.py`](../samples/backend/tests/unit/test_uml_generation_failures.py) | 新規 | **コア** | MAX_TOKENS と解釈失敗の判別、理由コードの分類(リトライ後の包み直しを含む) |
| [`tests/unit/test_uml_generation_service.py`](../samples/backend/tests/unit/test_uml_generation_service.py) | 新規 | **コア** | 受け付け時の検証、上書き、ER の scope の再利用、データ辞書の名前解決、クォータ超過での skipped、TOKEN_LIMIT・INVALID_OUTPUT |
| [`tests/unit/test_uml_diagram_service.py`](../samples/backend/tests/unit/test_uml_diagram_service.py) | 更新 | **コア** | 生成中ガード、他の DFD が参照する項目は警告しないこと |
| [`tests/unit/test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py) | 更新 | 定型 | E2E 用の UML 出力が include_raw の形で返ること |

## 要点の抜粋

```python
# app/uml/generation/failures.py
def unwrap_structured_result[T: BaseModel](result: dict[str, Any], schema: type[T]) -> T:
    parsed = result.get("parsed")
    if isinstance(parsed, schema):
        return parsed
    if (getattr(result.get("raw"), "response_metadata", None) or {}).get("finish_reason") == "MAX_TOKENS":
        raise LLMTokenLimitError(...)          # 再試行しても同じ → リトライしない
    raise LLMInvalidOutputError(...) from result.get("parsing_error")  # 揺らぎ → リトライ対象

def classify_failure(exc) -> GenerationFailure:  # QUOTA_EXCEEDED / TOKEN_LIMIT / INVALID_OUTPUT / GENERATION_FAILED
```

```python
# app/services/uml_generation_service.py
MAX_SUBJECTS_PER_REQUEST = 5

async def run_uml_generation(project_id, run_id, *, llm=None) -> None:   # 自前のセッション
    async with AsyncSessionLocal() as session:
        await UmlGenerationService(session).execute_run(project_id=project_id, run_id=run_id, llm=llm)

class UmlGenerationService:
    async def request_generation(self, *, project_id, notation, subjects) -> UmlGenerationRun:
        # 件数の確認 → 内部設計書の存在 → 生成中の図が無いこと → 候補との照合・scope の決定
        # → 図の upsert(generating) → 履歴('running')の作成 → commit
    async def execute_run(self, *, project_id, run_id, llm=None) -> None:
        # 対象を順番に処理: 成功なら上書きして commit
        # 失敗なら rollback → classify_failure → 図を failed にして理由を記録
        # QUOTA_EXCEEDED 以降は LLM を呼ばずに skipped
```

依存の向きは次のとおり。

- `uml_generation_service` → `app.uml.generation`(10-1〜10-3・本章)・リポジトリ(10-4・Phase 2・8)・`llm_retry`・`errors`
- `failures` → `app.services.errors`(末端モジュール。循環 import は起きない)

## 設計判断

### なぜ受け付けと実行を分けたか(ユーザー確定事項1)

4文書生成と同じく BackgroundTasks で実行する。BackgroundTasks はレスポンスを返した後に動くので、「受け付けられなかった」ことをユーザーに返せるのは、リクエストの中の処理だけになる。受け付けで弾くのは次のものである。

- 内部設計書が無い(409)
- 生成中の図がある(409)
- 候補に無い処理(400)
- ER のテーブル数超過(400)
- 5件超過(400)

検証を通ったものだけを `generating` にして、202 を返す。

### なぜ同時実行をプロジェクト単位で1本にしたか

一括生成と別の生成が並行すると、2つのタスクが同じ名前のデータ項目を同時に作ろうとして、一意制約の違反が起こりうる。また、無料枠のクォータを並行して消費することにもなる。`has_generating` で弾くのが最も単純で安全である。

### なぜクォータ超過で残りを skipped にするのか(ユーザー確定事項6)

クォータ超過は、同じ日のうちに呼び直しても失敗するだけである。残りの対象で LLM を呼んで失敗を積み重ねず、未着手(skipped)として記録する。そして「クォータが戻った後に、再度生成を指示してください」と伝える。トークン上限と解釈の失敗はその対象に固有の問題なので、次の対象の生成は続ける。

### なぜ `include_raw=True` なのか

`include_raw=False` だと、解釈の失敗は例外になるだけで、原因が「出力が `MAX_TOKENS` で打ち切られた」のか「出力が壊れた」のかを見分けられない。前者は同じ入力で再試行しても同じ結果になるので、`invoke_with_retry` の3回のリトライはクォータの無駄になる。後者は、再試行で直る可能性がある。`finish_reason` を読んで例外を分け、`llm_retry` は `LLMTokenLimitError` をリトライしないようにした。

`llm_retry` の変更は Phase-2-5 のコードの改訂(#12)にあたる。変更を駆動しているのは、本章の `_invoke_structured` である(#17 の判定)。

### 失敗したとき、前回の生成結果を残す理由

生成は上書きで行う。失敗した時点で空の図に戻すと、以前に成功した図(人がレビュー中かもしれない)が消えてしまう。失敗時は rollback して `generation_status='failed'` と理由だけを記録し、semantic_model には触れない。

### データ辞書の既存の項目を上書きしない理由

データ辞書は、人が CRUD API で編集できる(Phase 8)。AI の再生成でユーザーが直したフィールドを消さないよう、同じ名前の項目はそのまま使い、無い項目だけを作成する。

### 生成中の図の編集・レイアウトを拒否する理由

生成が終わると semantic_model は上書きされる。生成中に人が PUT した変更や、計算したレイアウトは、黙って消えてしまう。409(`UmlGenerationInProgressError`)で明示的に拒否する。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `unwrap_structured_result`・`classify_failure` | pytest | スタブ不要。例外や dict を受け取って値を返す純粋関数のため | `GenerationFailedError` の `__cause__` を見て INVALID_OUTPUT を判別すること |
| `invoke_with_retry`(トークン上限) | pytest | スタブ不要。呼び出す関数(`_call`)自体をテスト内で定義するため | 呼び出しが1回で終わること |
| `UmlGenerationService` | pytest(インメモリ SQLite) | **FakeLLM**(`tests/fixtures/fake_llm.py`)を Gemini の代わりに使う。`structured_sequence` に出力スキーマのインスタンス、生の応答の dict、例外を並べる | クォータ超過は `llm_retry._is_quota_error` を monkeypatch して起こす。リトライの待ち時間は `asyncio.sleep` を差し替えて省く |
| `UmlDiagramService`(ガード・横断検証) | pytest(インメモリ SQLite) | スタブ不要。外部呼び出しが無いため | |

**テストでの注意**: `execute_run` は失敗時に `session.rollback()` する。テストはサービスと同じセッションを共有しているので、rollback の後はテスト側の ORM オブジェクト(例: `project.id`)も失効し、読むと `MissingGreenlet` になる。失敗系のテストでは、ID を先に値として取り出しておく。本番のバックグラウンドタスクは自前のセッションで動くので、この問題は起きない。

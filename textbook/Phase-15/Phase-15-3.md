# Phase-15-3: 生成の失敗と固着への対処(BE)

## この章の目的

出力見本の付録で見つかった、生成まわりの4件(気づき#2〜#5)を直す。どれも「失敗したときに、利用者に何が見え、DB に何が残るか」の問題である。

| # | 問題 | 対処 |
|---|---|---|
| 3 | 文書生成が途中で失敗すると、rollback せずに commit する。途中まで作った版と古い版の削除が確定し、4文書の組がそろわない | rollback → 状態を戻す → 通知だけを commit。生の例外の文字列はチャットに出さない |
| 4 | 生成中でも生成を受け付ける。版の番号に一意制約が無い | 受け付け時に `generating` なら 409(`DOC_GENERATION_IN_PROGRESS`)。UNIQUE(project_id, doc_type, version) |
| 5 | 結果の保存で例外が出る、または途中で再起動すると、「生成中」のまま残る。以後の生成が 409 で塞がる | 15分を超えた「生成中」を回収する。UML 図は受け付け時と一覧の取得時、文書はプロジェクトの取得時と生成の要求時 |
| 2 | チャットの SSE は 200 を返してから処理するので、途中で失敗するとストリームが途切れるだけ | 失敗を `event: error`(`{code, detail}`)で送って終える |

学習モード([introduction](./Phase-15-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | `DocGenerationInProgressError`(409) |
| [`app/services/generation_staleness.py`](../samples/backend/app/services/generation_staleness.py) | 新規 | **コア** | `STALE_GENERATION_AFTER`(15分)、`is_stale`(純粋) |
| [`app/models/generated_document.py`](../samples/backend/app/models/generated_document.py) | 更新 | 定型 | UNIQUE(project_id, doc_type, version) |
| [`alembic/versions/e3f4a5b6c7d8_unique_generated_document_version.py`](../samples/backend/alembic/versions/e3f4a5b6c7d8_unique_generated_document_version.py) | 新規 | 定型 | 一意制約(既存の重複があれば止める) |
| [`app/services/llm_retry.py`](../samples/backend/app/services/llm_retry.py) | 更新 | 定型 | `as_llm_error`(再試行しない呼び出しの失敗を共通の例外に揃える) |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | **コア** | ストリームの途中の失敗を `as_llm_error` で揃えて送出する |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | **コア** | `request_generation`、`recover_if_stale`、失敗時の rollback |
| [`app/services/project.py`](../samples/backend/app/services/project.py) | 更新 | 定型 | `get_detail` で止まった生成を回収する |
| [`app/uml/generation/failures.py`](../samples/backend/app/uml/generation/failures.py) | 更新 | 定型 | 理由コード `STALE_GENERATION`、`STALE_MESSAGE` |
| [`app/uml/generation/__init__.py`](../samples/backend/app/uml/generation/__init__.py) | 更新 | 定型 | `STALE_MESSAGE` の re-export |
| [`app/repositories/uml_diagram.py`](../samples/backend/app/repositories/uml_diagram.py) | 更新 | 定型 | `list_generating` |
| [`app/repositories/uml_generation_run.py`](../samples/backend/app/repositories/uml_generation_run.py) | 更新 | 定型 | `list_running` |
| [`app/services/uml_generation_service.py`](../samples/backend/app/services/uml_generation_service.py) | 更新 | **コア** | `recover_stale`、受け付け時の回収 |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | **コア** | `_sse_error_event`、SSE の失敗、`trigger_generation` の 409 と受け付け前の状態の受け渡し |
| [`app/api/routes/uml.py`](../samples/backend/app/api/routes/uml.py) | 更新 | 定型 | 図の一覧の取得時に回収する |
| ── ここからテスト ── | | | |
| [`tests/unit/test_generation_staleness.py`](../samples/backend/tests/unit/test_generation_staleness.py) | 新規 | 定型 | しきい値の境界、タイムゾーンの無い時刻 |
| [`tests/unit/test_doc_generation_guard.py`](../samples/backend/tests/unit/test_doc_generation_guard.py) | 新規 | **コア** | ルートの 409 と受け渡し、rollback、回収、一意制約 |
| [`tests/unit/test_uml_stale_generation.py`](../samples/backend/tests/unit/test_uml_stale_generation.py) | 新規 | **コア** | 図と履歴の回収、一覧のルートでの回収 |
| [`tests/unit/test_chat_stream_errors.py`](../samples/backend/tests/unit/test_chat_stream_errors.py) | 新規 | **コア** | 途中の失敗が `event: error` で届き、発話が残らない |

`GenerationFailedError` の `code = "LLM_API_ERROR"` は、samples には Phase 2-5 からあった。本体の写経で抜けていたので、本体だけ直した(samples の変更は無い)。

## 要点の抜粋

```python
# app/services/doc_generator_service.py
async def request_generation(self, project: Project) -> str:
    await self.recover_if_stale(project)                 # 止まった「生成中」を先に回収する
    if project.status == "generating":
        raise DocGenerationInProgressError("設計書を生成しています。完了してから再度お試しください。")
    status_before_generation = project.status
    project.status = "generating"                         # 受け付けと同じリクエストで切り替える
    await self._session.commit()
    await self._session.refresh(project)                  # updated_at(開始時刻)はDB側で決まる
    return status_before_generation                       # 失敗したときに戻す先

# generate の except
except Exception as exc:
    await self._session.rollback()                        # 途中の版と古い版の削除を取り消す
    project = await self._projects.get_by_id(project_id, user_id=user_id)  # 失効したので読み直す
    project.status = status_before_generation
    await self._chat_histories.add(..., message=_QUOTA_MESSAGE if quota else _FAILED_MESSAGE)
    await self._session.commit()                          # 通知と状態だけを確定する
```

```python
# app/api/routes/projects.py(SSE)
async def event_stream():
    try:
        async for chunk in ChatService(session).stream_reply(...):
            yield f"data: {json.dumps({'delta': chunk}, ensure_ascii=False)}\n\n"
    except Exception as exc:                              # 200を返した後なので、イベントで伝える
        await session.rollback()
        yield _sse_error_event(exc)                       # event: error\ndata: {"code", "detail"}
        return
    yield "data: [DONE]\n\n"
```

```python
# app/services/generation_staleness.py
STALE_GENERATION_AFTER = timedelta(minutes=15)

def is_stale(started_at: datetime, now: datetime, *, after=STALE_GENERATION_AFTER) -> bool:
    if started_at.tzinfo is None:                         # SQLiteはタイムゾーンを付けない
        started_at = started_at.replace(tzinfo=UTC)
    return now - started_at > after
```

## 設計判断

### 失敗時は「巻き戻してから、通知だけを確定する」

`create_version` は文書ごとに flush する。flush は DB へ送るだけで、確定(commit)ではない。以前は、失敗しても rollback せずに commit していた。そのため、要件定義書だけ新しい版ができ、古い版の削除も確定していた。

rollback すると、その回の生成で作った版はすべて消え、4文書の組は前の回のまま残る。状態を戻すことと失敗の通知は、rollback の後に改めて書いて commit する。DB の例外で失敗した場合も、rollback でセッションが使える状態に戻るので、この commit は通る。

チャットに残す文言から、生の例外の文字列(`({exc})`)を外した。例外の中身は利用者には意味が無く、内部の情報が出る。種類はログ(`documents_generation_failed`)に残す。

### 409・一意制約・回収は、それぞれ別の穴を塞ぐ

| 対策 | 塞ぐ穴 |
|---|---|
| 受け付け時の 409 | 生成中の二度押し・別タブからの要求 |
| 画面のボタンの無効化(15-8) | 409 が返るまでの、ごく短い間の連打 |
| 一意制約 | 上の2つをすり抜けて並行した生成が、同じ版の番号を書くこと |
| 15分での回収 | 409 を入れたことで、止まった「生成中」が永久に生成を塞ぐこと |

409 だけを入れると、再起動で止まったプロジェクトは二度と生成できなくなる。回収はその副作用の手当てである(着手前の相談で、文書にも適用すると確定)。

### 回収は「読むときに直す」

止まった生成を見つけるために、定期的に走るジョブは置かなかった。

- バックグラウンドのジョブを動かす仕組みが devex-api に無い。
- 利用者が困るのは、画面を開いて「生成中」のまま進めないときだけである。

画面は生成の完了を、文書は `GET /projects/{id}`、UML 図は `GET /uml/diagrams` のポーリングで待つ。そこで、この2つの取得と、生成の要求のときに回収する。

文書は、生成前の状態を記録していない。そのため、文書が既にあれば `revising`、無ければ `interviewing` に戻す(どちらも「生成する」を押せる状態)。

### SSE の失敗はイベントで送り、発話は残さない

ストリーミングでは、最初の断片を送った時点で 200 とヘッダーが確定している。後から失敗しても、ステータスコードは変えられない。共通のエラーハンドラ(`register_error_handlers`)も働かない。そのため、ルートで例外を受けて `event: error` を送り、終える。

`stream_reply` は、利用者の発話と AI の応答を最後にまとめて commit する。途中で失敗したら rollback し、発話も残さない(「途中で切れた応答」を履歴に残さないため)。画面は、失敗を受け取ったら表示した発話を取り消す(15-8)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `is_stale` | pytest | スタブ不要。時刻を受け取って判定する純粋関数のため | ちょうど15分は止まっていない扱い |
| `DocGeneratorService`(request_generation / generate / recover_if_stale)、`trigger_generation`、`ProjectService.get_detail` | pytest(インメモリ SQLite) | FakeLLM(応答を1件だけ持たせ、2件目で尽きて例外になる) | 再試行の待ち(1秒)は `asyncio.sleep` を差し替えて省く。時刻は `now=` か `updated_at` の書き換えで進める |
| 一意制約 | pytest(インメモリ SQLite) | スタブ不要 | 同じ版を2行足すと `IntegrityError` |
| `UmlGenerationService.recover_stale`、`list_diagrams` | pytest(インメモリ SQLite) | スタブ不要。受け付けだけを行い、LLM を呼ぶ実行は走らせないため | 履歴に `STALE_GENERATION` の結果が足される |
| `send_hearing_message`(SSE) | pytest(StreamingResponse の本体を最後まで読む) | `_FailingStreamLLM`(1断片を返してから例外を出す) | `get_gemini_llm` を monkeypatch で差し替える。発話が残らないことも確かめる |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_generation_staleness.py tests/unit/test_doc_generation_guard.py \
  tests/unit/test_uml_stale_generation.py tests/unit/test_chat_stream_errors.py tests/unit/test_uml_generation_service.py
# 34 passed
```

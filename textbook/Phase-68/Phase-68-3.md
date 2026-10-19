# Phase-68-3: チャットと生成の呼び出しを替える

## この章の目的

ヒアリングのチャット・設計書の生成・詳細設計の段階の生成・参考資料(PDF)の取り込み・汎用チャットのグラフが、`.env` の全体で1つの Gemini(`get_gemini_llm`)ではなく、プロジェクトの持ち主の用途の LLM([68-2](./Phase-68-2.md) の `LlmResolver`)で呼ぶようにする。Claude に替えても動くよう、構造化出力の方式と本文の取り出しを provider によらない形にする。

自動実装モード: on([introduction](./Phase-68-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | コメントだけ(返す場所が `build_llm` になった) |
| [`app/services/intake_file_processor.py`](../samples/backend/app/services/intake_file_processor.py) | 更新 | PDF を読む LLM は呼び出し側が渡す(無ければ失敗として記録) |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | `_chat_llm`(チャットの用途で解決)・構造化出力の方式 |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 生成の用途で解決 |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | 生成の用途で解決(失敗の記録の `try` の中で) |
| [`app/services/project.py`](../samples/backend/app/services/project.py) | 更新 | `_ingest_file` に `user_id`。PDF は `resolve_pdf_reader` |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | 最初の発話で `LlmUnavailableError` も握りつぶす |
| `app/ai/graph/nodes.py` | 更新 | `llm_from(config)`。LLM を `RunnableConfig` から受け取る |
| `app/ai/graph/workflow.py` | 更新 | docstring だけ |
| `app/services/chat.py` | 更新 | チャットの用途で解決し、`config` で渡す |
| `app/ai/llm/gemini.py` | 削除 | 呼び出しが無くなった(`extract_text_content` は 68-1 で `content.py` へ) |
| [`tests/fixtures/fake_llm.py`](../samples/backend/tests/fixtures/fake_llm.py) | 更新 | コメントだけ |
| [`tests/fixtures/llm_resolver.py`](../samples/backend/tests/fixtures/llm_resolver.py) | 新規 | `stub_llm_resolver`(解決をフェイクに差し替え、呼ばれたユーザーと用途を記録) |
| [`tests/unit/test_llm_call_sites.py`](../samples/backend/tests/unit/test_llm_call_sites.py) | 新規 | 呼び出し箇所が持ち主と用途で解決する(統合スモーク) |
| `tests/unit/test_ai_graph_nodes.py`・`tests/unit/test_generic_chat_and_refresh.py` | 更新 | 汎用チャットの config |
| [`tests/unit/test_chat_service.py`](../samples/backend/tests/unit/test_chat_service.py)・[`tests/unit/test_chat_stream_errors.py`](../samples/backend/tests/unit/test_chat_stream_errors.py)・[`tests/integration/test_projects_flow.py`](../samples/backend/tests/integration/test_projects_flow.py) | 更新 | `get_gemini_llm` の差し替えを `stub_llm_resolver` に |

`nodes.py`・`workflow.py`・`test_ai_graph_nodes.py` は CL 開発の前のテンプレート由来で、この章で初めて samples に載せた(全文。タグの無い部分はテンプレートのまま)。

## 1. 呼び出し箇所

| 呼び出し | 用途 | ユーザー | 置き方 |
|---|---|---|---|
| `ChatService.stream_reply`・`judge_points`・`generate_opening_reply` | チャット | `project.user_id` | `_chat_llm(project, llm)`(渡されたらそれ、無ければ解決) |
| `DocGeneratorService.generate`(4文書・自己診断) | 生成 | 引数の `user_id` | 失敗の扱いの `try` の中で `llm or resolve(...)` |
| `DesignStageGenerationService.execute`(段階1〜8。DFD・ER・構成図も段階の中で) | 生成 | 引数の `user_id` | 同上(`try` に入れたので、解決の失敗も段階の `failed` になる) |
| `ProjectService._ingest_file`(PDF) | (用途にしない。Gemini) | `create` の `user_id` | `resolve_pdf_reader`。解決できなければ取り込みの失敗 |
| 汎用チャット(`/chat` のグラフ) | チャット | `send_message` の `user_id` | `RunnableConfig` の `configurable` で渡す |

```python
# app/services/chat_service.py(要点)
async def _chat_llm(self, project: Project, llm):
    if llm is not None:
        return llm
    return (await LlmResolver(self._session).resolve(project.user_id, Purpose.CHAT)).llm

structured_llm = llm.with_structured_output(HearingReplyOut, method=STRUCTURED_METHOD)
```

- **構造化出力の方式**: ヒアリングの返信と観点の判定、汎用チャットの最終回答は `with_structured_output` を直接呼んでいた(方式は既定のまま)。Claude だと既定が function_calling になるので、[68-1](./Phase-68-1.md) の `STRUCTURED_METHOD` を渡す。生成・段階は `invoke_structured` を経由するので、68-1 で既定を変えた時点で揃っている。
- **最初の発話**: プロジェクトの作成では、最初の発話に失敗しても作成は成功させる(既存の方針)。キーが無く LLM を解決できない(`LlmUnavailableError`)ときも同じに握りつぶす。チャットの送信(SSE)は、どの失敗も `event: error` で伝える既存の仕組みにそのまま乗る(`code` が `LLM_UNAVAILABLE`)。
- **PDF**: `extract_text` は LLM を受け取るだけにし(解決はサービス層)、PDF で LLM が無ければ「PDFを読むAIを使えませんでした」で失敗を記録する(ヒアリングは止めない。既存の方針)。

## 2. 汎用チャットのグラフ(`nodes.py`・`chat.py`)

グラフはプロセスで1つにコンパイルして使い回す(`get_chat_workflow` の `lru_cache`)ので、ユーザーごとの LLM をグラフに持たせられない。実行ごとに `RunnableConfig` で渡し、ノードが読む。

```python
# app/services/chat.py(要点)
resolver = LlmResolver(self._session)
llm = (await resolver.resolve(user_id, Purpose.CHAT)).llm
evaluator_llm = (await resolver.resolve(user_id, Purpose.CHAT, temperature=0)).llm
config: RunnableConfig = {"configurable": {"llm": llm, "evaluator_llm": evaluator_llm}}
result = await invoke_with_retry(lambda: workflow.ainvoke(initial_state, config))

# app/ai/graph/nodes.py(要点)
def llm_from(config: RunnableConfig, name: str = "llm") -> Any:
    return config["configurable"][name]

def draft_response(state: GraphState, config: RunnableConfig) -> dict: ...
```

- 検索結果の評価は今まで温度0の Gemini だったので、温度0のクライアントを別に解決して `evaluator_llm` で渡す(LangGraph のノードは引数に `config` を書けば受け取れる)。
- 評価と最終回答の本文は `response.content` をそのまま使っていた。Claude・Gemini がブロックのリストで返しても読めるよう `extract_text_content` を通す。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_llm_call_sites.py`(統合スモーク) | 最初の発話・4文書の生成・段階の生成・PDF の取り込み(`llm=` なし) | 各テスト関数がサービスを `llm=` なしで呼ぶ | `stub_llm_resolver`(E2E の偽物か FakeLLM を返し、呼ばれたユーザーと用途を記録)。PDF は `resolve_pdf_reader` を差し替える | 最初の発話はチャット、生成は生成の用途で、どちらも持ち主で解決し、設計書ができる / 段階の生成で解決できなければ段階を `failed` にする / PDF は持ち主の Gemini で読む / 解決できなければ取り込みの失敗として記録する |
| `test_ai_graph_nodes.py` | 各ノード | pytest の関数(ノードを `config` 付きで呼ぶ) | FakeLLM(呼び出し側が `config` に入れる LLM の代わり)・FakeSearchTool | 下書き・評価(評価用の LLM)・最終回答(方式 json_schema)/ ブロックのリストの本文 |
| `test_generic_chat_and_refresh.py` | `ChatService.send_message`(汎用チャット) | pytest の関数 | `_QuotaWorkflow`(LangGraph の代わり。渡された `config` を記録) | 利用上限は1回で `LLM_QUOTA_EXCEEDED` / `config` に温度0.7と0の2つの LLM |
| `test_chat_service.py`(追加分) | `create_project` のルート | pytest の関数 | `stub_llm_resolver`(`LlmUnavailableError` を投げる) | キーが無く解決できなくても、プロジェクトは作れる(最初の発話は無し)/ 最初の発話は作成した利用者のチャットの用途 |
| `test_chat_stream_errors.py`・`test_projects_flow.py` | (既存のまま) | (既存のまま) | `get_gemini_llm` の差し替えを `stub_llm_resolver` に | 既存の観点(SSE の順・失敗のイベント・API の一連の流れ) |

`fake.py` は `test_llm_call_sites.py` が、`workflow.py`・`chat.py` は `test_generic_chat_and_refresh.py` が、`projects.py` は `test_chat_service.py` が、`intake_file_processor.py` は既存の `test_intake_file_processor.py` が import する。`fake_llm.py`・`llm_resolver.py`(フィクスチャ)はこの章のテストが使う。

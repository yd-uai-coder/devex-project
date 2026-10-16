# Phase-68-1: LLM の組み立てと provider に固有の処理

## この章の目的

ユーザーと用途ごとに provider(Gemini・Claude)を入れ替えられるようにする前に、「provider・モデル・キー・用途」から LLM のクライアントを作る部品(`build_llm`)を1つにまとめる。あわせて、provider によって違う処理 ── 構造化出力の方式・出力の上限・タイムアウト・入力の超過と混雑の判定 ── を、どちらの provider でも同じように通るようにする。解決(どのユーザーのどの用途か)は [68-2](./Phase-68-2.md)。

自動実装モード: on([introduction](./Phase-68-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/core/config.py`](../samples/backend/app/core/config.py) | 更新 | `LLM_TIMEOUT_SECONDS`・`REVIEW_TIMEOUT_SECONDS`・`JUDGE_TIMEOUT_SECONDS` を削除(タイムアウトはカタログへ) |
| [`app/ai/llm/catalog.py`](../samples/backend/app/ai/llm/catalog.py) | 更新 | `CatalogModel.timeout_seconds`(モデルごとの秒数) |
| [`app/ai/llm/content.py`](../samples/backend/app/ai/llm/content.py) | 新規 | `extract_text_content`(`gemini.py` から移す。Claude の本文のブロックも読む) |
| [`app/ai/llm/factory.py`](../samples/backend/app/ai/llm/factory.py) | 新規 | `build_llm`・`STRUCTURED_METHOD`・`max_output_tokens`・`timeout_seconds`・`DEFAULT_GEMINI_TEMPERATURE` |
| [`app/services/llm_retry.py`](../samples/backend/app/services/llm_retry.py) | 更新 | 構造化出力の方式の既定・混雑の待ち(`OVERLOAD_RETRY_DELAYS`)・Claude の入力の超過 |
| `app/ai/llm/gemini.py`・`app/ai/llm/claude.py` | 更新 | この章では `build_llm` を呼ぶ薄い関数にする(呼び出しを替え終えた [68-3](./Phase-68-3.md)・[68-4](./Phase-68-4.md) で削除。samples からも削除) |
| [`tests/unit/test_llm_factory.py`](../samples/backend/tests/unit/test_llm_factory.py) | 新規 | provider ごとの引数・キャッシュ・E2E |
| [`tests/unit/test_llm_content.py`](../samples/backend/tests/unit/test_llm_content.py) | 新規 | 本文の取り出し(`test_gemini.py` から改名) |
| [`tests/unit/test_llm_retry.py`](../samples/backend/tests/unit/test_llm_retry.py) | 更新 | 混雑の待ち・Claude の入力の超過 |
| [`tests/unit/test_llm_catalog.py`](../samples/backend/tests/unit/test_llm_catalog.py) | 更新 | すべてのモデルにタイムアウト |
| [`tests/unit/test_review_llm.py`](../samples/backend/tests/unit/test_review_llm.py)・[`tests/unit/test_review_fix_check.py`](../samples/backend/tests/unit/test_review_fix_check.py) | 更新 | 取得関数の `cache_clear` と、組み立ての引数のテストを外す(`test_llm_factory.py` へ) |

## 1. モデルごとのタイムアウト(`catalog.py`・`config.py`)

着手時の相談で「カタログにモデルごと」に決めた(推奨どおり)。今までの3つの設定値は「生成30秒・レビュー180秒・判定60秒」と用途に付いていたが、ユーザーが用途のモデルを替えられるようになると、同じ用途でも速さが大きく違う(Flash-Lite の生成は最大約11秒、3.8 Flash は最大約176秒 ── Phase 60 の申し送り「生成のモデルと Gemini の無料枠」)。

```python
# app/ai/llm/catalog.py(要点)
@dataclass(frozen=True)
class CatalogModel:
    provider: Provider
    model_id: str
    label: str
    note: str
    timeout_seconds: float     # 1回の呼び出しを待つ上限
```

| モデル | 秒 | 根拠 |
|---|---|---|
| 3.5 / 3.1 Flash-Lite | 30 | 今までの `LLM_TIMEOUT_SECONDS`(実測の最長 11.25 秒の約2.7倍) |
| 3.6 Flash | 120 | 3.8 Flash より短い見込み |
| 3.8 Flash | 240 | 実測の最長 176 秒(Phase 51-1 の (f)) |
| Haiku 5.5 | 60 | 今までの `JUDGE_TIMEOUT_SECONDS` |
| Sonnet 5.5 | 180 | 今までの `REVIEW_TIMEOUT_SECONDS`(実測 25〜43 秒の約4倍) |
| Opus 5.5 / Fable 5.1 | 240 / 300 | 上位のモデルほど1回が長い |

## 2. 組み立て(`factory.py`)

```python
# app/ai/llm/factory.py(要点)
STRUCTURED_METHOD = "json_schema"   # 両 provider で揃える

def build_llm(provider, model, api_key, purpose, temperature=None) -> Any:
    if settings.E2E_FAKE_LLM:
        return get_e2e_fake_llm()          # キャッシュの外で分岐する
    return _build_client(provider, model, api_key, purpose, temperature)

@lru_cache(maxsize=64)
def _build_client(provider, model, api_key, purpose, temperature) -> Any:
    timeout = timeout_seconds(provider, model)       # カタログに無いモデルは ValueError
    limit = max_output_tokens(purpose)               # レビュー・判定だけ設定値
    if provider is Provider.GEMINI:
        return ChatGoogleGenerativeAI(model=..., api_key=..., temperature=0.7 or 指定,
                                      timeout=timeout, max_retries=1, [max_output_tokens=limit])
    return ChatAnthropic(model_name=..., api_key=..., max_tokens_to_sample=limit or 4000/16000,
                         timeout=timeout, max_retries=0, stop=None, [temperature=指定])
```

- **キャッシュの鍵**は (provider, モデル, キー, 用途, 温度)。[61-3](../Phase-61/Phase-61-3.md) の (provider, モデル, キー) に用途と温度を足した。用途で出力の上限が変わり、汎用チャットの評価だけ温度0で作るため。クライアントは接続を持つので、呼び出しのたびに作らない。キーが違えば別のクライアントになる(ユーザーごとのキーが混ざらない)。
- **E2E の分岐をキャッシュの外に置く**。テストが `E2E_FAKE_LLM` を切り替えたとき、前に作った実クライアントがキャッシュから返らないようにするため。
- **構造化出力の方式**: langchain-anthropic の既定は function_calling(ツールの呼び出し)、langchain-google-genai の既定は json_schema。レビュー・判定は今まで呼び出し側で `"json_schema"` を渡していた。チャット・生成を Claude に替えても同じ方式になるよう、方式を1つの定数にして、呼び出し側([68-3](./Phase-68-3.md))はこれを渡す。
- **出力の上限**: Anthropic の API は上限が必須。チャットは返信が短いので 4000、生成は1文書・1段階をまとめて書くので 16000、レビュー・判定は今までの設定値(16000・1000)。Gemini はチャット・生成に上限を付けない(今までどおりモデルの上限まで)。
- **SDK の中の再試行**は止める(Gemini は `max_retries=1`。`0` は「Google の既定(5回)」の意味になる。Claude は `0`)。再試行は `invoke_with_retry` だけにする(今までの取得関数と同じ理由)。

`extract_text_content` は Gemini 専用ではなくなったので `content.py` に移した。Claude も本文を `[{"type": "text", ...}, {"type": "tool_use", ...}]` のブロックで返すことがあり、`text` だけを読めばよい。

この章では呼び出し側を替えないので、`get_gemini_llm`・`get_review_llm`・`get_judge_llm` は `build_llm` に `.env` の値を渡すだけの関数にする(章をまたいで動く状態を保つため)。呼び出しを替え終えた章で削除する。

## 3. 再試行の判定(`llm_retry.py`)

```python
# app/services/llm_retry.py(要点)
OVERLOAD_RETRY_DELAYS = (5.0, 15.0)    # 1回目・2回目の失敗の後の待ち

def _retry_delay(exc, attempt) -> float:
    if _is_overloaded_error(exc):       # Gemini 503・504 / Anthropic 529・503
        return OVERLOAD_RETRY_DELAYS[min(attempt, 2) - 1]
    return RETRY_DELAY_SECONDS          # ほかの一時的な失敗は 1 秒のまま

def _is_input_token_limit_error(exc) -> bool:
    # Gemini: 400 で "token" を含む / Anthropic: 400 の "prompt is too long"・413
```

- **混雑**(着手時の相談。推奨どおり): 試行は最大3回のまま、混雑のときだけ間を 5秒 → 15秒 に伸ばす。混雑は1秒では引かないことが多く、最長でも約20秒の追加で済む。状態コードは Gemini が `code`、Anthropic が `status_code` に持つので `_status_code` で読む。
- **入力の超過**: 今までは Gemini の 400 だけを `LLMTokenLimitError`(再試行しない)にしていた。Claude に替えたとき、入力の超過を3回試して `GenerationFailedError` にしないよう、Anthropic の 400「prompt is too long」と 413 も同じに扱う。ほかの 400(スキーマの誤りなど)は今までどおり一時的な失敗の扱い。
- 429 の判定(`_is_quota_error`)は既に両 provider を扱っていたので変えていない。
- `invoke_structured_with_usage` の `method` の既定を `STRUCTURED_METHOD` にした(今までは「省略ならクライアントの既定」)。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_llm_factory.py` | `build_llm`・`timeout_seconds`・`max_output_tokens` | pytest の関数 | スタブ不要 ── 2つのクライアントのコンストラクタはネットワークを呼ばないので、実物を作ってフィールドを見る | Gemini はカタログの秒数・SDK の再試行1・温度0.7・チャットと生成に上限なし / 判定は上限と温度の指定 / Claude は用途ごとの上限・再試行0・キー / 同じ引数は同じもの、キー・用途が違えば別のもの / 実物をキャッシュした後でも E2E なら偽物 / カタログの外は ValueError / 方式は json_schema |
| `test_llm_retry.py`(追加分) | `invoke_with_retry` | pytest の関数 | 呼び出しは例外を投げる関数。`asyncio.sleep` を記録する関数に差し替える(待ちの秒数を見るため) | 混雑4種(Gemini 503・504、Anthropic 529・503)は 5秒・15秒 / 500 は 1秒 / Claude の 400「prompt is too long」・413 は1回で `LLMTokenLimitError` / ほかの 400 は再試行して `GenerationFailedError` |
| `test_llm_content.py` | `extract_text_content` | pytest の関数 | スタブ不要 ── 純粋関数 | 文字列・Gemini のブロック・text の無いブロック・Claude の text と tool_use のブロック |
| `test_llm_catalog.py`(追加分) | `CATALOG` | pytest の関数 | スタブ不要 ── 純粋なデータ | すべてのモデルに秒数があり、3.8 Flash は実測の176秒を超える |

`config.py` は `test_llm_factory.py` が `settings` で、`content.py` は `test_llm_content.py` が import する。`gemini.py`・`claude.py` の薄い関数は、既存の `test_review_llm.py`・`test_review_fix_check.py`(E2E の偽物・キーなし)がこの章の間だけ通す。

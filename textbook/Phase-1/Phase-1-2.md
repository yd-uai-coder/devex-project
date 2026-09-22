# Phase-1-2: 外部APIキー取得・`.env` 管理方針

納期モード([`Phase-1-introduction.md`](./Phase-1-introduction.md) 参照)。#14 の SUT/ドライバ/スタブの言語化は省略し、「動くこと」の確認に留める。[`Phase-1-1.md`](./Phase-1-1.md) で起動したスタックを使って確認する。

## この章で作成・更新したファイル

- [`devex-api/.env.example`](../../devex-api/.env.example)(root) ── `GEMINI_MODEL` を spec 確定値に修正
- [`devex-api/backend/.env.example`](../../devex-api/backend/.env.example) ── 同上
- [`devex-api/.env`](../../devex-api/.env) ── 同上(実ファイル)

## 外部APIキーの取得

| 環境変数 | 用途 | 取得元 |
|---|---|---|
| `GOOGLE_API_KEY` | Gemini API 呼び出し(`app/ai/llm/gemini.py`) | [Google AI Studio](https://aistudio.google.com/) でAPIキーを発行 |
| `TAVILY_API_KEY` | 既存の汎用デモ `/chat` ルート専用の Web検索ツール(`app/ai/tools/tavily.py`、LangGraph の `web_search` ノード) | [Tavily](https://tavily.com/) でAPIキーを発行 |

`.env`(root)にそれぞれ値を設定すれば、`docker compose up` 時に `backend` コンテナへ `env_file` 経由でそのまま渡る。

### `TAVILY_API_KEY` は Devex 本体には不要

[`docs/internal_design.md`](../../docs/internal_design.md) 3.3節の `chat_service.py`/`doc_generator_service.py` は LangChain ベースで、Web検索(Tavily)を要求する記述がない。現在 `TAVILY_API_KEY` が使われているのは、`devex-api` がスターターテンプレートとして持つ汎用デモ `/chat` ルート(`User → Gemini → Tavily → 評価 → Gemini → 最終回答`)のみである。Phase 2-3・2-4 で `chat_service.py`/`doc_generator_service.py` を実装する際、Tavily 連携を持ち込むかどうかは別途の設計判断になる(現時点では持ち込まない前提)。コードは変更せず、混同防止のためこの位置づけを明記するに留めた。

## `GEMINI_MODEL` の spec 整合

[`docs/requirements.md`](../../docs/requirements.md) 1.6節で LLM は「Gemini Flash-Lite(無料枠)」に確定済み(Phase 0 仕様診断項目8、[`decision-digest.md`](../decision-digest.md))だが、`.env.example`(root・backend 双方)と実ファイル `.env` の `GEMINI_MODEL` は旧テンプレートの値 `gemini-2.5-flash` のままだった。Google公式ドキュメント([Gemini 2.5 Flash-Lite | Gemini API](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite))で現行のモデルIDが `gemini-2.5-flash-lite` であることを確認した上で、3ファイルすべてを修正した。

```diff
- GEMINI_MODEL=gemini-2.5-flash
+ GEMINI_MODEL=gemini-2.5-flash-lite
```

修正後、アプリ起動時に `get_settings().GEMINI_MODEL` が `"gemini-2.5-flash-lite"` になることを確認した(既存の `app/ai/llm/gemini.py` の `get_gemini_llm()` はこの値をそのまま `ChatGoogleGenerativeAI` に渡す実装のため、コード変更は不要)。

## `.env` 管理方針

- **正本は `.env.example`**。実値は書かず、コミット対象は `.env.example` のみ(`.gitignore` で `.env`/`.env.*` を除外、`!.env.example`/`!backend/.env.example` で明示的に復活させる既存設定を継続)。
- **2系統の使い分け**:
  - [`devex-api/.env.example`](../../devex-api/.env.example)(root) ── `docker compose up` 経由での実行用。`DATABASE_URL`/`REDIS_URL` はコンテナ間ネットワークのホスト名(`postgres`/`redis`)を使う。
  - [`devex-api/backend/.env.example`](../../devex-api/backend/.env.example) ── `uv run uvicorn ...` でホスト上に直接立てる場合用。`DATABASE_URL`/`REDIS_URL` は `localhost` を使う。
- **本番相当の安全装置は既存のまま活用する**: `app/core/config.py` の `Settings._reject_unsafe_production_settings` が `ENVIRONMENT=production` 起動時に弱い `JWT_SECRET_KEY`(32文字未満、または `change-me` で始まる)や `DEBUG=true` を拒否する(`tests/unit/test_config_safety.py` で検証済み)。今回の `.env` 修正でも `JWT_SECRET_KEY` は既に32文字以上のランダム値になっていることを確認済み。

## テスト観点(納期モード: 「動くこと」の確認)

| 確認項目 | 手段 | 結果 |
|---|---|---|
| `.env.example`(root・backend)の`GEMINI_MODEL`が spec と一致 | 目視 + grep | `gemini-2.5-flash-lite` |
| 実行時に正しい値が読み込まれる | `Settings()` を起動し `GEMINI_MODEL` を確認 | `gemini-2.5-flash-lite` |
| 既存の本番安全バリデータに回帰がない | `pytest tests/unit/test_config_safety.py` | 4件 green |

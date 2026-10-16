# Phase-67-3: モデルと API キーの API

## この章の目的

マイページから、用途ごとのモデルを選んで保存し、provider ごとの API キーを登録・削除できる API を作る。キーは保存の前に費用のかからない呼び出し(モデルの一覧の取得)で確かめ、暗号化して持つ。LLM の呼び出しをこの設定で解決するのは Phase 68。

自動実装モード: on([introduction](./Phase-67-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/ai/llm/key_check.py`](../samples/backend/app/ai/llm/key_check.py) | 新規 | `KeyCheckResult`・`verify_api_key`・`get_key_verifier`(FastAPI の依存) |
| [`app/schemas/llm_settings.py`](../samples/backend/app/schemas/llm_settings.py) | 新規 | カタログ・用途の設定・キーの読み書きのスキーマ |
| [`app/services/llm_settings_service.py`](../samples/backend/app/services/llm_settings_service.py) | 新規 | `LlmSettingsService`(保存の規則) |
| [`app/api/routes/llm.py`](../samples/backend/app/api/routes/llm.py) | 新規 | `GET /llm/catalog` |
| [`app/api/routes/__init__.py`](../samples/backend/app/api/routes/__init__.py) | 更新 | `llm_router` を集約 |
| [`app/api/routes/users.py`](../samples/backend/app/api/routes/users.py) | 更新 | `GET/PUT /users/me/models`・`GET /users/me/api-keys`・`PUT/DELETE /users/me/api-keys/{provider}` |
| [`tests/unit/test_key_check.py`](../samples/backend/tests/unit/test_key_check.py) | 新規 | 送るヘッダーと応答の分け方 |
| [`tests/unit/test_llm_settings_service.py`](../samples/backend/tests/unit/test_llm_settings_service.py) | 新規 | 保存の規則・キーの登録と失敗・ルート |
| [`tests/integration/test_llm_settings_flow.py`](../samples/backend/tests/integration/test_llm_settings_flow.py) | 新規 | 実際の Postgres と Redis で一連の流れ・既定値の一意 |

## 1. API の形

| メソッド・パス | 本文 | 応答 | 失敗 |
|---|---|---|---|
| `GET /llm/catalog` | ― | `{providers, models, purposes}` | ― |
| `GET /users/me/models` | ― | `{settings: [PurposeSettingRead × 4]}` | ― |
| `PUT /users/me/models` | `{choices: [{purpose, provider, model}]}` | 同上 | 表に無い 422 `MODEL_NOT_IN_CATALOG`・選べない provider 422 `MODEL_PROVIDER_KEY_REQUIRED`・同じ用途を2回 422 |
| `GET /users/me/api-keys` | ― | `{encryption_available, keys: [{provider, key_hint, needs_reregister}]}` | ― |
| `PUT /users/me/api-keys/{provider}` | `{api_key}` | `{provider, key_hint, needs_reregister}` | 無効 422 `API_KEY_INVALID`・確かめられない 502 `API_KEY_CHECK_FAILED`・鍵が無い 503 `ENCRYPTION_UNAVAILABLE`・試行の上限 429 |
| `DELETE /users/me/api-keys/{provider}` | ― | 204(無くても 204) | ― |

- **カタログは別の API**(Claude の判断): 静的な表で、設定とは変わる理由が違う。用途の説明もここで返す。
- **`PUT /users/me/models` は全体の置き換え**(Claude の判断): 画面は4用途をまとめて保存するので、含めない用途 = 既定値に従う、とした。
- 用途の設定の応答 `PurposeSettingRead`:

```python
# app/schemas/llm_settings.py(要点)
class PurposeSettingRead(BaseModel):
    purpose: Purpose
    provider: Provider             # 選んでいなければ既定値
    model: str
    is_default: bool               # 既定値に従っているか
    key_missing: bool              # 選んだ provider のキーが無く、使うときは既定値に従う
    default_provider: Provider
    default_model: str
    selectable_providers: list[Provider]   # このユーザーがこの用途に選べる provider
```

画面は `selectable_providers` で選択肢を無効にし、`key_missing` で知らせる。規則を画面に二重に書かないため、サーバーが判定した結果を返す。

## 2. 保存の規則(`LlmSettingsService`)

```python
# app/services/llm_settings_service.py(要点)
def _selectable_providers(user, default_provider, key_providers) -> list[Provider]:
    return [p for p in Provider
            if user.is_superuser or p == default_provider or p in key_providers]
```

- **既定のキーの範囲**(着手時の相談。推奨どおり): 一般ユーザーが既定のキーで使えるのは、既定値と同じ provider だけ(チャット・生成は Gemini、レビュー・判定は Claude)。ほかの provider は自分のキーがあるときだけ選べる。superuser は既定のキーで何でも選べる。これで、一般ユーザーが既定の Claude キーでチャットを流す(課金が既定のキーに乗る)経路を作らない。レビューを既定のキーで使えるのが superuser だけ(61-1 の決定5)なのは変わらず、Phase 68 のレビューの実効値で見る。
- `key_providers` は「今の鍵で復号できる」キーだけ。読めないキーを根拠に選ばせない。
- **キーを消しても選択の行は消さない**: 再び登録すれば元の選択に戻る。読み出しで `key_missing` を返し、Phase 68 の解決で既定値に読み替える。
- 既定値は `_defaults()` で、seed の行を `env_default_models` の上に重ねて作る(行が無い用途は `.env` の値)。

キーの登録:

```python
async def register_api_key(self, user, provider, api_key) -> ApiKeyInfo:
    build_cipher(settings.ENCRYPTION_KEY)          # 鍵が無ければ、外部を呼ぶ前に 503
    result = await self._verifier(provider, api_key)
    # INVALID → ApiKeyInvalidError(422) / UNREACHABLE → ApiKeyCheckFailedError(502)
    await self._keys.upsert(..., encrypted_key=encrypt_secret(api_key), key_hint=api_key[-4:])
    await self._session.commit()
```

## 3. キーの確かめ(`app/ai/llm/key_check.py`)

| provider | 呼ぶもの | キーの渡し方 |
|---|---|---|
| Gemini | `GET https://generativelanguage.googleapis.com/v1beta/models?pageSize=1` | ヘッダー `x-goog-api-key` |
| Claude | `GET https://api.anthropic.com/v1/models?limit=1` | ヘッダー `x-api-key` と `anthropic-version: 2023-06-01` |

- 公式の資料(Context7)で、一覧の取得の URL とヘッダーを確かめた。キーは URL のクエリに載せない(アクセスのログに残さないため)。
- **失敗の分け方**(着手時の相談。推奨どおり): 200 は有効、400・401・403 は無効(Gemini は無効なキーに 400 を返す)、それ以外(429・5xx)と通信の例外は「確かめられない」。どちらの失敗も保存しない。429 を無効にしないのは、キーが正しくても混雑・上限で返りうるため。
- SDK を使わず `httpx` で呼ぶ。一覧の1件だけで足り、テストで `httpx.MockTransport` を差し込めるため。
- `get_key_verifier` は FastAPI の依存で、ルートが `Depends` で受け取る。テストは `app.dependency_overrides` で差し替える。`E2E_FAKE_LLM` のときは外部を呼ばずに有効とみなす(E2E を無料・決定論的に流すため)。
- **試行の上限**(Claude の判断): 登録の試行はユーザーごとに1時間10回(`API_KEY_RATE_LIMIT_PER_HOUR`。既存の `RateLimiter`)。この API をキーの当てずっぽうの確かめに使わせないため。上限はルートで数える(Redis を持つのはルートの依存のため。Phase 66 の今のパスワードの試行と同じ形)。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_key_check.py` | `verify_api_key`・`get_key_verifier` | pytest の関数 | `httpx.MockTransport`(provider の応答) | Gemini はキーをヘッダーで送り URL に載せない / Claude は2つのヘッダー / 400・401・403 は無効、429・500・503 と接続の例外は確かめられない / `E2E_FAKE_LLM` では呼ばずに有効 |
| `test_llm_settings_service.py` | `LlmSettingsService` の5つの操作・ルートの関数・`ModelSettingsUpdate`・`ApiKeyUpdate`・`GET /llm/catalog` | pytest の関数(ルートの関数を直接呼ぶ) | キーの確かめはフェイクの関数(結果を決めて返す)・`FakeRedis`(試行の回数)。DB は SQLite。鍵は settings を monkeypatch | 行が無いときは `.env` の既定値 / 一般ユーザーはキーが無いと別の provider を選べず 422、登録すると選べる / superuser は何でも選べる / 表に無いモデルは 422 / キーを消すと `key_missing` / 末尾の4文字と暗号化 / 無効は 422・確かめられないは 502 でどちらも保存しない / 鍵が無いと確かめの前に 503 / 鍵を外すと `needs_reregister` で選べる根拠にしない / 同じ用途を2回は 422 / ルートの往復 / 試行の上限 |
| `test_llm_settings_flow.py`(integration) | 6つの API(ルート → サービス → リポジトリ)と既定値の行の一意 | httpx の `AsyncClient`(ASGITransport) | キーの確かめを差し替え(`get_key_verifier`)・接続元の IP・鍵。利用者は DB に直接作る(登録の上限を避ける) | 一連の流れ(断られる → 無効 → 登録 → 選べる → 応答にキーが出ない → 削除で `key_missing`)/ 知らない provider は 422 / 鍵が無いと 503 で一覧は空 / seed を2回流しても既定値は4行・null の用途が重なると `IntegrityError`(`NULLS NOT DISTINCT`) |

`routes/__init__.py` は integration のテストが `app.main` を通して読み、`/llm/catalog` を呼ぶ。

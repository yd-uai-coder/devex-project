# Phase-67-1: 暗号とモデルのカタログ

## この章の目的

ユーザーが登録する API キーを暗号化して持つ仕組み(Fernet と環境変数 `ENCRYPTION_KEY`)と、マイページで選べるモデルの表(provider → モデル、用途の定義)を作る。どちらも DB を持たない土台で、テーブル([67-2](./Phase-67-2.md))と API([67-3](./Phase-67-3.md))が使う。

自動実装モード: on([introduction](./Phase-67-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`pyproject.toml`](../samples/backend/pyproject.toml) | 更新 | `cryptography` を直接の依存に(今までは推移的に入っていた) |
| [`app/core/config.py`](../samples/backend/app/core/config.py) | 更新 | `ENCRYPTION_KEY`・`API_KEY_RATE_LIMIT_PER_HOUR`・`API_KEY_CHECK_TIMEOUT_SECONDS` |
| [`app/core/errors.py`](../samples/backend/app/core/errors.py) | 更新 | 422 の基底 `UnprocessableEntityError`・503 の基底 `ServiceUnavailableError` |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | この Phase の例外6つ |
| [`app/core/crypto.py`](../samples/backend/app/core/crypto.py) | 新規 | `build_cipher`・`encryption_available`・`encrypt_secret`・`decrypt_secret` |
| [`app/ai/llm/catalog.py`](../samples/backend/app/ai/llm/catalog.py) | 新規 | `Provider`・`Purpose`・`CATALOG`(8モデル)・`PURPOSES`・`find_model`・`provider_of` |
| [`tests/unit/test_crypto.py`](../samples/backend/tests/unit/test_crypto.py) | 新規 | 往復・鍵の回し方・鍵なし |
| [`tests/unit/test_llm_catalog.py`](../samples/backend/tests/unit/test_llm_catalog.py) | 新規 | 表と検索の関数 |

## 1. 例外(`app/core/errors.py`・`app/services/errors.py`)

`AppError` の基底に 422 と 503 が無かったので足した(HTTP の状態を例外のクラスで持つ、既存の形のまま)。具体的な例外は、ほかと同じく `services/errors.py` に集める(循環 import を避ける末端のモジュール。devex-api の CLAUDE.md)。

| 例外 | 状態 | code | いつ |
|---|---|---|---|
| `EncryptionUnavailableError` | 503 | `ENCRYPTION_UNAVAILABLE` | 暗号の鍵が無い・形が正しくない |
| `DecryptionFailedError` | (HTTP にしない) | ― | 今のどの鍵でも復号できない。呼び出し側が「登録し直す」状態に読み替える |
| `ModelNotInCatalogError` | 422 | `MODEL_NOT_IN_CATALOG` | 表に無いモデル |
| `ModelProviderKeyRequiredError` | 422 | `MODEL_PROVIDER_KEY_REQUIRED` | 一般ユーザーが、キーの無い provider を既定値と違う用途に選んだ |
| `ApiKeyInvalidError` | 422 | `API_KEY_INVALID` | provider がキーを無効と答えた |
| `ApiKeyCheckFailedError` | 502 | `API_KEY_CHECK_FAILED` | 確かめが通信の失敗・混雑で結論を出せない |

`DecryptionFailedError` だけは `AppError` にしない。キーの一覧を読むときに起きても、画面には「登録し直してください」と出すだけで、要求そのものは成功させたいため。

## 2. 暗号(`app/core/crypto.py`)

```python
# app/core/crypto.py(要点)
def build_cipher(raw_keys: str | None) -> MultiFernet:
    keys = [key.strip() for key in (raw_keys or "").split(",") if key.strip()]
    if not keys:
        raise EncryptionUnavailableError(...)
    try:
        return MultiFernet([Fernet(key) for key in keys])
    except ValueError as exc:          # 鍵の形が正しくない
        raise EncryptionUnavailableError(...) from exc

def encrypt_secret(plain: str) -> str: ...      # 先頭の鍵で暗号化
def decrypt_secret(token: str) -> str: ...      # すべての鍵で試す。だめなら DecryptionFailedError
def encryption_available() -> bool: ...         # 画面の出し分け用
```

- **鍵の回し方**(着手時の相談。推奨どおり): `ENCRYPTION_KEY` をカンマ区切りで複数持てるようにし、`MultiFernet` で先頭の鍵で暗号化・全部で復号する。鍵を替えるときは新しい鍵を先頭に足し、古い鍵を後ろに残せば、ユーザーに登録し直してもらわずに読める。古い鍵を外したら、そのキーは `needs_reregister`([67-3](./Phase-67-3.md))になる。
- **鍵が無いとき**(61-1 の決定10): 起動は止めない。キーの登録だけが 503 になり、既定(環境変数)のキーでの利用は続く。
- 鍵の作り方は `.env.example` に書いた(`Fernet.generate_key()`)。本番の鍵の置き場は Phase 72 で `OPERATIONS.md` に書く。

## 3. モデルのカタログ(`app/ai/llm/catalog.py`)

```python
# app/ai/llm/catalog.py(要点)
class Provider(StrEnum):
    GEMINI = "gemini"
    CLAUDE = "claude"

class Purpose(StrEnum):
    CHAT = "chat"; GENERATION = "generation"; REVIEW = "review"; JUDGE = "judge"

@dataclass(frozen=True)
class CatalogModel:
    provider: Provider
    model_id: str
    label: str
    note: str                  # 画面に出す短い注記(費用・特徴)

CATALOG: tuple[CatalogModel, ...] = (...)   # 61-1 の決定7 の8モデル
PURPOSES: tuple[PurposeInfo, ...] = (...)   # 判定だけ recommend_low_cost=True

def find_model(provider, model_id) -> CatalogModel | None: ...   # 保存の検証
def provider_of(model_id) -> Provider | None: ...                # seed が .env のモデルに使う
```

- 純粋なデータと関数だけを置く(DB・設定に触れない)。終了の告知・新しいモデルはこの表を直して足す(`gemini-3.1-flash-lite` は 2027-05-07 以降に終了)。
- 用途の説明は API が返し、判定の「費用の低いモデルを推奨」の文言は画面が持つ(`recommend_low_cost` は印だけ)。
- PDF の取り込みは用途にしない(61-1 の決定6。Phase 68 で Gemini の解決に乗せる)。

## テスト観点

用語: **SUT** はテストする対象、**ドライバ** は SUT を呼ぶもの、**スタブ** は SUT が使う相手の代わり(テストダブル)。

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_crypto.py` | `crypto` の4関数 | pytest の関数 | スタブ不要 ── 暗号化は外部を呼ばない(鍵は settings を monkeypatch で替える) | 往復で元に戻る・暗号文は平文と違う / 新しい鍵を先頭に足すと古い暗号文を読める / 古い鍵を外すと `DecryptionFailedError` / 鍵が無い・空・形が違うと 503 `ENCRYPTION_UNAVAILABLE` |
| `test_llm_catalog.py` | `CATALOG`・`PURPOSES`・`find_model`・`provider_of` | pytest の関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため | provider ごとに4つ・ID の重複なし / provider とモデルの組が合わないものは無い / 用途は4つで判定だけが低費用の推奨 |

`config.py`・`errors.py` は `test_crypto.py` が import する(`settings`・2つの例外)。`pyproject.toml` は依存の宣言で、`cryptography` の import が通ることで確かめる。

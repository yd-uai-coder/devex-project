# Phase-68-2: 解決(LlmResolver)とレビューを使えるか

## この章の目的

マイページで登録した用途ごとのモデルと API キー([Phase 67](../Phase-67/Phase-67-introduction.md))から、「このユーザーのこの用途では、どの provider・モデル・キーで呼ぶか」を決める `LlmResolver` を作る。あわせて、レビューを使えるアカウントの条件を「superuser だけ」から「superuser、またはレビューの用途の AI の自分のキーがある」に広げる判定を足す。呼び出し側を替えるのは [68-3](./Phase-68-3.md)・[68-4](./Phase-68-4.md)。

自動実装モード: on([introduction](./Phase-68-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `LlmUnavailableError`(502 `LLM_UNAVAILABLE`) |
| [`app/services/llm_settings_service.py`](../samples/backend/app/services/llm_settings_service.py) | 更新 | `decrypted_api_key`(自分のキーを復号して返す。読めなければ None) |
| [`app/review/policy.py`](../samples/backend/app/review/policy.py) | 更新 | `review_allowed`(純粋関数) |
| [`app/review/__init__.py`](../samples/backend/app/review/__init__.py) | 更新 | `review_allowed` の re-export |
| [`app/services/llm_resolver.py`](../samples/backend/app/services/llm_resolver.py) | 新規 | `ResolvedLlm`・`LlmResolver`(`resolve`・`resolve_pdf_reader`・`review_allowed`) |
| [`tests/unit/test_llm_resolver.py`](../samples/backend/tests/unit/test_llm_resolver.py) | 新規 | 解決の規則とレビューを使えるか |

## 1. 解決の規則(`llm_resolver.py`)

```python
# app/services/llm_resolver.py(要点)
@dataclass(frozen=True)
class ResolvedLlm:
    llm: Any
    provider: Provider
    model: str
    own_key: bool          # 自分のキーで呼ぶか(既定のキーの1日の上限を数えるかに使う)

class LlmResolver:
    def __init__(self, session: AsyncSession) -> None: ...
    async def resolve(self, user_id, purpose, *, temperature=None) -> ResolvedLlm: ...
    async def resolve_pdf_reader(self, user_id) -> ResolvedLlm: ...    # Gemini 固定
    async def review_allowed(self, user: User) -> bool: ...
```

1. **モデル**: `LlmSettingsService.get_model_settings(user)` の用途の行。`key_missing`(選んだ AI のキーを消した)なら既定値に読み替える(Phase 67 の決定どおり)。
2. **キー**: その provider の自分のキー(今の鍵で復号できるもの)。無ければ `.env` の既定のキー。一般ユーザーが既定と違う provider を選べるのは自分のキーがあるときだけなので、「既定のキーで別の provider」を呼ぶ経路はここで生まれない。
3. **キーがどちらにも無い**: レビュー・判定は `ReviewUnavailableError`(今までの取得関数と同じ。呼び出し側は自己診断に切り替える)、チャット・生成は新しい `LlmUnavailableError`(superuser が既定のキーの無い provider を選んだときなど)。`E2E_FAKE_LLM` ならキーが無くても偽物を返す。
4. **組み立て**は [68-1](./Phase-68-1.md) の `build_llm`。

- **解決の置き場**(着手時の相談。推奨どおり): LLM を呼ぶ各サービスが、自分のセッションで `LlmResolver` を作って呼ぶ。ルート・ジョブの入口で解決して渡す案は、依存の流れは明快だが、入口のシグネチャ・`BackgroundTasks` の引数とそれを確かめるテストが広く変わる。サービスはどれもユーザー(`project.user_id`)とセッションを持っているので、そこで解決すれば入口を変えずに済む。テストの差し替え(`llm=`)は「渡されたらそれを使う」のまま残す。
- `ResolvedLlm` はキーを持たない(ログ・記録に出さないため。キーはクライアントの中だけ)。
- **PDF を読む LLM**: PDF をそのまま渡せるのは Gemini だけ(ChatAnthropic の画像の変換は `data:image/...` だけを受ける)。用途にはせず、生成の用途が Gemini ならそのモデル、違えば `GEMINI_MODEL` で読む。キーは自分の Gemini キー、無ければ既定。

自分のキーの復号は `LlmSettingsService` に寄せた(`_key_providers` と同じ「今の鍵で復号できるか」の規則を、同じクラスで持つため)。

```python
# app/services/llm_settings_service.py(要点)
async def decrypted_api_key(self, user: User, provider: Provider) -> str | None:
    row = await self._keys.get_for_user(user.id, provider)
    if row is None or not encryption_available():
        return None
    try:
        return decrypt_secret(row.encrypted_key)
    except DecryptionFailedError:
        return None          # 鍵を替えて読めないキーは使わない(既定のキーに戻る)
```

## 2. レビューを使えるか(`policy.py`)

```python
# app/review/policy.py(要点)
def review_allowed(*, is_superuser: bool, has_own_review_key: bool) -> bool:
    return is_superuser or has_own_review_key
```

`LlmResolver.review_allowed(user)` は、レビューの用途の provider(既定は Claude。`key_missing` なら既定)について、復号できる自分のキーがあるかを見てこの関数に渡す。Gemini のキーだけを持ち、レビューの用途が Claude のままなら使えない。

実効値(`review_effective`)の条件を改めるのは、呼び出し元をまとめて替える [68-4](./Phase-68-4.md)(この章で関数の引数を変えると、まだ替えていない5か所が壊れるため)。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_llm_resolver.py` | `LlmResolver`・`LlmSettingsService.decrypted_api_key`・`review_allowed` | pytest の関数 | スタブ不要 ── クライアントは実物を作り、どのキー・モデルで作られたかをフィールドで見る。DB はテスト用の SQLite、暗号の鍵と既定のキーは settings を monkeypatch | 既定は `.env` のモデルとキー / 選択と自分のキー(生成の Claude は上限 16000)/ 既定の provider でも自分のキーが優先 / キーを消した選択は既定へ / 鍵を替えて読めないキーは使わない / キーが無いとレビュー・判定は `ReviewUnavailableError`、チャットは `LlmUnavailableError` / E2E はキーなしで偽物 / 温度を渡せる / PDF は Gemini(生成が Gemini ならそのモデル)/ レビューを使えるのは superuser かレビューの用途の自分のキー(Gemini のキーでは使えない)/ `review_allowed` の真理値 |

`errors.py`・`llm_settings_service.py`・`policy.py`・`llm_resolver.py` はこのテストが import する。`review/__init__.py` は `app.review.policy` の import で実行される。

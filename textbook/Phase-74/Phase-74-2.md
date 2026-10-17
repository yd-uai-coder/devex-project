# Phase-74-2: ID トークンの検証の部品と設定

## この章の目的

画面の Google のボタンが返す credential(Google が署名した ID トークン)を API で確かめ、本人の値(`sub`・メール・メールが確認済みか・名前)を取り出す部品を作る。本物は `google-auth` で検証し、E2E では Google を呼べないので偽物を用意する。設定(クライアント ID・偽物の旗・上限)もこの章で足す。部品を使うログインの API は [74-3](./Phase-74-3.md)。

自動実装モード: on([introduction](./Phase-74-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`pyproject.toml`](../samples/backend/pyproject.toml) | 更新 | `google-auth`・`requests` を直接の依存に(`uv.lock` は版が変わらず、直接の依存の印だけが増えた) |
| [`app/core/config.py`](../samples/backend/app/core/config.py) | 更新 | `GOOGLE_CLIENT_ID`・`E2E_FAKE_GOOGLE`(本番では起動時に拒否)・`GOOGLE_RATE_LIMIT_PER_IP_PER_HOUR` |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 検証の4つの例外(503・401・502・400) |
| [`app/services/google_identity.py`](../samples/backend/app/services/google_identity.py) | 新規 | `GoogleIdentity`・`GoogleTokenVerifier`・本物と偽物の検証・設定に合った検証を返す関数 |
| [`tests/unit/test_google_identity.py`](../samples/backend/tests/unit/test_google_identity.py) | 新規 | 例外の振り分け・`aud`・偽物の形・関数の3つの分岐 |
| [`tests/unit/test_config_safety.py`](../samples/backend/tests/unit/test_config_safety.py) | 更新 | 本番の `E2E_FAKE_GOOGLE` の拒否 |

ルートと `backend/` の `.env.example` にも、`GOOGLE_CLIENT_ID`・`E2E_FAKE_GOOGLE`・`GOOGLE_RATE_LIMIT_PER_IP_PER_HOUR` の行を足した(設定ファイルなので samples にミラーしない。#21 の共通)。

## 1. 依存と設定

- `google-auth`(2.56.3)と `requests`(2.34.2)は、`google-genai` の間接依存として入っていた。ID トークンの検証で直接使うので、直接の依存に上げた(間接のままだと、`google-genai` が依存を変えたときに黙って消える)。
- `GOOGLE_CLIENT_ID` が無いときは Google のログインだけが 503 になり、メールとパスワードのログインはそのまま使える(`ENCRYPTION_KEY` と同じ考え方)。
- `E2E_FAKE_GOOGLE=true` は偽の credential で**だれにでもなれる**ので、`E2E_FAKE_LLM` と同じバリデータで、`ENVIRONMENT=production` の起動を止める。

## 2. 検証の部品

```python
# app/services/google_identity.py(抜粋)
@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    email_verified: bool
    name: str | None = None

class GoogleTokenVerifier(Protocol):
    async def verify(self, credential: str) -> GoogleIdentity: ...

class GoogleIdTokenVerifier:
    async def verify(self, credential: str) -> GoogleIdentity:
        claims = await run_in_threadpool(self._verify_sync, credential)
        return identity_from_claims(claims)

    def _verify_sync(self, credential: str) -> Mapping[str, Any]:
        try:
            return id_token.verify_oauth2_token(credential, google_requests.Request(), self._client_id)
        except google_exceptions.TransportError as exc:
            raise GoogleVerifyFailedError(...) from exc    # 502
        except (ValueError, google_exceptions.GoogleAuthError) as exc:
            raise GoogleTokenInvalidError(...) from exc    # 401

def get_google_token_verifier() -> GoogleTokenVerifier:
    if settings.E2E_FAKE_GOOGLE:
        return FakeGoogleTokenVerifier()
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleAuthUnavailableError(...)               # 503
    return GoogleIdTokenVerifier(settings.GOOGLE_CLIENT_ID)
```

- **`verify_oauth2_token`**(Context7 で確かめた): 署名・`iss`(Google か)・`aud`(このアプリのクライアント ID か)・`exp`/`iat` をまとめて確かめる。署名・`aud`・期限が合わないと `ValueError`、発行者が違うと `GoogleAuthError` を出す。どちらも「credential が不正」なので 401 にした。
- **例外の順序**: `TransportError` は `GoogleAuthError` の子なので、先に捕まえる。公開鍵を取りに行けなかったときは credential の良し悪しが分からないので、401 でなく 502 にした(画面は「しばらくして試す」の案内になる)。
- **threadpool**: `requests` の同期の通信で公開鍵を取りに行くので、`run_in_threadpool` で呼ぶ(イベントループを止めない)。公開鍵は呼ぶたびに取りに行くが、ログインは頻繁ではないので許す(Phase 73 の判断)。
- **`email_verified`**: `True` のときだけ確認済みとする(欠けている・文字列のときは確認されていない)。断るのは、本人を決めるサービス([74-3](./Phase-74-3.md))の仕事にした(検証の部品は「Google が何と言ったか」だけを返す)。
- **偽物**: `fake:<sub>:<email>` を受け付け、メールは確認済み、名前はメールのローカル部とする(Claude の判断)。`sub` を自由に選べるので、E2E で「別の Google アカウント」も作れる。形が違えば 401。
- **関数をルートの依存にする**: [74-3](./Phase-74-3.md) は `GoogleTokenVerifierDep`(`Depends(get_google_token_verifier)`)で受ける。テストは `dependency_overrides` で偽物に差し替えられる。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_google_identity.py`(新規)の本物の検証 | `GoogleIdTokenVerifier.verify` | pytest のテスト関数 | `id_token.verify_oauth2_token`(monkeypatch。返すクレームと出す例外を決め、Google の公開鍵を取りに行かせない) |
| 同・クレームの読み取りと偽物 | `identity_from_claims`・`FakeGoogleTokenVerifier.verify` | 同上 | スタブ不要 ── 純粋で外部を呼ばないため |
| 同・関数の分岐 | `get_google_token_verifier` | 同上 | `settings` の属性(monkeypatch) |
| `test_config_safety.py`(更新) | `Settings` のバリデータ | 同上 | スタブ不要 ── `Settings` を作るだけで完結するため |

- `aud` にクライアント ID を渡す / `ValueError`・`GoogleAuthError` は 401、`TransportError` は 502 / `sub`・`email` が無いクレームは 401、`email_verified` が無ければ確認されていない / 偽物は `fake:<sub>:<email>` だけを受け、`sub` が空・メールでない・欠けた形は 401 / 旗があれば偽物、クライアント ID が無ければ 503、あれば本物 / 本番の `E2E_FAKE_GOOGLE` は起動時に拒否。
- 作成・更新したファイルは、この章のテストがすべて import する(`errors.py` の4つの例外。`config.py` は `Settings` と `settings` を通して。上限の設定は 74-3 のテストが使う)。前方 import は無い(`google_identity.py` の import 先は `settings` とこの章の `errors.py` と外部のライブラリ)。

# Phase-74-3: `/auth/google`・`/auth/google/link`・レート制限・開発の上限

## この章の目的

[74-2](./Phase-74-2.md) の検証で取り出した本人の値から、ログインする利用者を決める API を作る。Google でのログイン(初めてなら登録)と、同じメールの既存アカウントをパスワードで確かめてから紐付ける連携の確かめの2つである。返し方は今の `/auth/login` と同じ(access は本文、refresh は Cookie)。あわせて、Google のログインを新しいカウンタで数え、開発用の compose で認証の上限を上げる(ステージ9 の申し送り)。

自動実装モード: on([introduction](./Phase-74-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 409 の2つ(`GOOGLE_LINK_REQUIRED`・`GOOGLE_ACCOUNT_CONFLICT`) |
| [`app/schemas/auth.py`](../samples/backend/app/schemas/auth.py) | 更新 | `GoogleLoginRequest{credential}`・`GoogleLinkRequest{credential, password}` |
| [`app/services/auth_rate_limit.py`](../samples/backend/app/services/auth_rate_limit.py) | 更新(samples に初めて載せた) | `google_ip` のカウンタと `enforce_google` |
| [`app/services/google_auth.py`](../samples/backend/app/services/google_auth.py) | 新規 | `GoogleAuthService.login_or_register`・`link` |
| [`app/api/deps.py`](../samples/backend/app/api/deps.py) | 更新 | `GoogleTokenVerifierDep` |
| [`app/api/routes/auth.py`](../samples/backend/app/api/routes/auth.py) | 更新 | `POST /auth/google`・`POST /auth/google/link`・発行の共通の関数 |
| [`tests/fixtures/fake_google.py`](../samples/backend/tests/fixtures/fake_google.py) | 新規 | credential → 決めた本人の値を返すフェイクの検証 |
| [`tests/unit/test_google_auth.py`](../samples/backend/tests/unit/test_google_auth.py) | 新規 | サービスの全分岐とルートの関数 |
| [`tests/unit/test_auth_rate_limit.py`](../samples/backend/tests/unit/test_auth_rate_limit.py) | 更新(samples に初めて載せた) | `google_ip` はログインと別のカウンタ |
| [`tests/integration/test_google_auth_flow.py`](../samples/backend/tests/integration/test_google_auth_flow.py) | 新規 | 実際の Postgres と Redis で、登録 → 再ログイン、409 → 連携 → 両方でログイン、503 |

本体の `docker-compose.yml`(開発の上限)と `docker-compose.e2e.yml`(`E2E_FAKE_GOOGLE`)も変えた。インフラの設定なので samples にミラーしない(#21 の共通)。

## 1. 本人の決め方(`GoogleAuthService`)

```python
# app/services/google_auth.py(抜粋)
async def login_or_register(self, identity: GoogleIdentity) -> User:
    _require_verified_email(identity)                       # 400 GOOGLE_EMAIL_NOT_VERIFIED
    user = await self._users.get_by_google_sub(identity.sub)
    if user is not None:
        return _require_active(user)                        # 無効なら 401
    existing = await self._users.get_by_email(identity.email)
    if existing is not None:
        if existing.google_sub is not None:
            raise GoogleAccountConflictError(...)            # 409 GOOGLE_ACCOUNT_CONFLICT
        raise GoogleLinkRequiredError(...)                   # 409 GOOGLE_LINK_REQUIRED
    # だれのメールでもない → パスワードの無い利用者として登録する
    ...

async def link(self, identity: GoogleIdentity, *, password: str) -> User:
    _require_verified_email(identity)
    user = await self._users.get_by_email(identity.email)
    if user is None or user.hashed_password is None or not verify_password(...):
        raise InvalidCredentialsError("Invalid email or password")   # 401(ログインと同じ)
    ...
    if user.google_sub == identity.sub:
        return user                                          # 連携のやり直しは成功
    if user.google_sub is not None or (await self._users.get_by_google_sub(identity.sub)) is not None:
        raise GoogleAccountConflictError(...)
    user.google_sub = identity.sub
```

- **`sub` が先、メールは後**: 連携した人は、Google 側のメールが変わっても同じアカウントに入れる。アプリのメールは変えない(マイページで変える)。
- **確かめずに紐付けない**: 登録でメールを確かめないので、同じメールのアカウントは他人が先に作ったものかもしれない。紐付けるのは、その人のパスワードを知っている本人だけ(連携の確かめ)。
- **パスワードが違うときは 401**(ユーザー決定): ログインでパスワードが違うときと同じ例外・同じ文言にした。メールのアカウントが無い・パスワードを持たない人も同じ 401 で、見分けさせない。ログイン前の画面の呼び出しなので、画面の `apiFetch` が 401 でログアウトの処理に入ることも無い(access を送っていない)。
- **別の Google と連携済みなら 409 `GOOGLE_ACCOUNT_CONFLICT`**(ユーザー決定): ID トークンで、呼んだ人がそのメールの持ち主だと分かっているので、「別の Google と連携済み」と知らせても新しい漏れにならない。連携の確かめでは、パスワードを確かめた後で同じ判定をする(この Google がほかの人と連携済みのときも同じコード)。
- **新規の登録**: パスワードは null、`user_name` は ID トークンの `name` を列の長さ(255文字)で切る。superuser にはしない。

## 2. ルートとレート制限

```python
# app/api/routes/auth.py(抜粋)
@router.post("/google", response_model=AccessToken)
async def google_login(payload, response, session, redis, client_ip, verifier: GoogleTokenVerifierDep):
    await AuthRateLimiter(redis).enforce_google(ip=client_ip)
    identity = await verifier.verify(payload.credential)
    user = await GoogleAuthService(session).login_or_register(identity)
    return await _issue_login(response, session, redis, user)

@router.post("/google/link", response_model=AccessToken)
async def google_link(...):
    limiter = AuthRateLimiter(redis)
    await limiter.enforce_google(ip=client_ip)
    identity = await verifier.verify(payload.credential)
    await limiter.enforce_login(ip=client_ip, email=identity.email)
    user = await GoogleAuthService(session).link(identity, password=payload.password)
    return await _issue_login(response, session, redis, user)
```

- **数えてから検証する**: 上限を超えたら Google の公開鍵を取りに行かない(ルートのテストで、検証が呼ばれないことを確かめた)。
- **`google_ip` は 30回/時**(ユーザー決定。`login_ip` と同じ)。連携の確かめは、パスワードの試行なので、検証の後に ID トークンのメールで `enforce_login`(IP・メール)でも数える。
- **`_issue_login`**: `AuthService.issue_tokens` と `set_refresh_cookie` をまとめた。Google のログインの後も、画面は `auth-store` の `login()` を通るので、ログインの印の cookie(Phase 63)は今と同じ場所で付く(Phase 76)。
- **503 の場所**: `GOOGLE_CLIENT_ID` が無いと、依存の `get_google_token_verifier` が 503 を出す。依存はルートの本体より先に解決されるので、503 の呼び出しは `google_ip` を数えない。

## 3. 開発用の上限

```yaml
# docker-compose.yml(backend。抜粋)
    environment:
      LOGIN_RATE_LIMIT_PER_IP_PER_HOUR: "1000"
      LOGIN_RATE_LIMIT_PER_EMAIL_PER_HOUR: "1000"
      REGISTER_RATE_LIMIT_PER_IP_PER_HOUR: "1000"
      GOOGLE_RATE_LIMIT_PER_IP_PER_HOUR: "1000"
```

- 4つとも 1000回/時(ユーザー決定)。`environment` は `env_file`(`.env`)より優先する。
- `docker compose config` で、`docker-compose.test.yml`・`docker-compose.e2e.yml` を重ねたときも 1000 になり、`docker-compose.prod.yml` だけのときは入らない(`.env` の 30・20・10)ことを確かめた。
- `docker-compose.e2e.yml` に `E2E_FAKE_GOOGLE: "true"` を足した(Phase 76・79 の E2E のため)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_google_auth.py`(新規)のサービス | `GoogleAuthService.login_or_register`・`link` | pytest のテスト関数 | DB はインメモリの SQLite。本人の値は `GoogleIdentity` を直接作る(検証を通さない) |
| 同・ルート | `auth.google_login`・`google_link` | pytest(ルートの関数を直接呼ぶ) | `FakeGoogleVerifier`(credential → 本人の値。Google を呼ばない)・FakeRedis(refresh の鍵と試行の回数) |
| `test_auth_rate_limit.py`(更新) | `AuthRateLimiter.enforce_google` | pytest のテスト関数 | FakeRedis |
| integration の `test_google_auth_flow.py`(新規) | `POST /auth/google`・`/auth/google/link` → `GET /users/me`・`POST /auth/login` | httpx の `AsyncClient` | 検証を E2E 用の偽物(`FakeGoogleTokenVerifier`)に、接続元 IP を一意の値に差し替える(`dependency_overrides`)。Postgres と Redis は本物 |

- 新しいメールは Google だけの利用者になる(パスワードは null、superuser でない、名前は 255文字で切る) / `sub` で見つかれば、Google 側のメールが変わっても同じ人 / 同じメールが未連携なら 409 `GOOGLE_LINK_REQUIRED`、別の `sub` と連携済みなら 409 `GOOGLE_ACCOUNT_CONFLICT` / メールが確認されていなければ 400 で、登録もしない / 無効な人は 401。
- 連携の確かめ: 正しいパスワードで `google_sub` が入り、パスワードは残る(両方でログインできる) / 違う・空のパスワード、アカウントが無い、パスワードを持たない人は同じ 401 / どちらかがほかと連携済みなら 409 / 同じ Google でのやり直しは成功 / メールが確認されていなければ 400。
- ルート: access の `sub` が利用者の ID で、refresh の Cookie が付く / 知らない credential は 401 / `google_ip` の上限を超えると 429 で、検証を呼ばない / 連携の確かめのパスワードの試行は、メールの上限で数える。
- integration: 登録 → `/users/me` の `has_password=false`・`google_linked=true` → 同じ credential で同じ人 → パスワードのログインは 401 / パスワードの利用者で 409 → 違うパスワードは 401 → 連携 → 両方でログイン → 別の Google で 409 `GOOGLE_ACCOUNT_CONFLICT` / 設定が無いと 503 `GOOGLE_AUTH_UNAVAILABLE`。
- 作成・更新したファイルは、この章のテストがすべて import する(`deps.py` は integration の `get_client_ip` とルートの依存として)。`fake_google.py` は、本体の `GoogleTokenVerifier` を満たすフェイク(#15 の「集約の機構のテストはフェイクで」)。前方 import は無い(import 先は 74-1・74-2 とこの章の、表で上に置いたファイル)。

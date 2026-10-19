# Phase-66-2: アカウントの API(ユーザーネーム・メール・パスワードの変更)

## この章の目的

マイページから、ユーザーネーム・メールアドレス・パスワードを本人が変えられるようにする。メールとパスワードは今のパスワードで本人を確かめる。パスワードを変えたら、ほかの端末のログインを切り(refresh を全部失効)、今の端末はログインを保つ。画面は [66-3](./Phase-66-3.md) で作る。

自動実装モード: on([introduction](./Phase-66-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/core/password_policy.py`](../samples/backend/app/core/password_policy.py) | 新規 | `password_violations`(登録の画面と同じ規則) |
| [`app/schemas/user.py`](../samples/backend/app/schemas/user.py) | 更新 | `UserNameUpdate`・`EmailUpdate`・`PasswordUpdate`(使われていなかった `UserUpdate` は消した) |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `CurrentPasswordMismatchError`(400) |
| [`app/services/user.py`](../samples/backend/app/services/user.py) | 更新 | `update_user_name`・`change_email`・`change_password` |
| [`app/services/auth.py`](../samples/backend/app/services/auth.py) | 更新(samples に初めて載せた) | `revoke_all_refresh_tokens` |
| [`app/api/refresh_cookie.py`](../samples/backend/app/api/refresh_cookie.py) | 新規 | `set_refresh_cookie`・`delete_refresh_cookie`(`routes/auth.py` から移した) |
| [`app/api/routes/auth.py`](../samples/backend/app/api/routes/auth.py) | 更新 | Cookie の付け外しを `refresh_cookie` に |
| [`app/api/routes/users.py`](../samples/backend/app/api/routes/users.py) | 更新 | `PATCH /users/me`・`PUT /users/me/email`・`PUT /users/me/password` |
| [`tests/fixtures/fake_redis.py`](../samples/backend/tests/fixtures/fake_redis.py) | 更新 | `exists`・`scan_iter`・複数の鍵の `delete` |
| [`tests/unit/test_password_policy.py`](../samples/backend/tests/unit/test_password_policy.py) | 新規 | 規則と `PasswordUpdate` の 422 |
| [`tests/unit/test_account.py`](../samples/backend/tests/unit/test_account.py) | 新規 | サービス・失効・ルート |
| `tests/unit/test_generic_chat_and_refresh.py` | 更新 | Cookie の寿命のテストを `refresh_cookie` に |
| [`tests/integration/test_account_flow.py`](../samples/backend/tests/integration/test_account_flow.py) | 新規 | 実際の Postgres と Redis で変更と失効 |

## 1. API の形(3つに分ける)

| メソッド・パス | 本文 | 応答 | 失敗 |
|---|---|---|---|
| `PATCH /users/me` | `{user_name}` | `UserRead` | 空・256文字以上は422 |
| `PUT /users/me/email` | `{new_email, current_password}` | `UserRead` | 不一致400・使われている409・形の誤り422 |
| `PUT /users/me/password` | `{current_password, new_password}` | `AccessToken` + refresh の Cookie | 不一致400・規則違反422 |

- 着手時の相談で **3つに分けた**(推奨どおり)。1つの `PATCH` にすると、「メールかパスワードがあるときだけ今のパスワードが要る」「パスワードのときだけトークンを出し直す」と、条件つきの検証と副作用が1つのルートに混ざる。
- **今のパスワードの不一致は 400**(`CURRENT_PASSWORD_MISMATCH`)。401 にすると、画面の `apiFetch` が「アクセストークンが切れた」とみなして refresh を試し、失敗すればログアウトする。ログイン中の操作の失敗は 401 にしない。
- **今のパスワードの試行を数える**: 盗まれたセッションから今のパスワードを総当たりできないよう、ログインと同じ上限(`AuthRateLimiter.enforce_login`。IP と今のメール)を通す。ログインと予算を共有するのは、どちらも「パスワードを当てる試み」だから。

## 2. パスワードの規則(`app/core/password_policy.py`)

```python
# app/core/password_policy.py(要点)
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128

def password_violations(password: str) -> list[str]:
    """規則に合わない点を文言の一覧で返す(合っていれば空)。"""
```

```python
# app/schemas/user.py(要点)
class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _check_policy(cls, value: str) -> str:
        violations = password_violations(value)
        if violations:
            raise ValueError(" / ".join(violations))
        return value
```

- 着手時の相談で、**画面と変更の API の両方**に規則を置くことにした(推奨どおり)。画面の zod は早めの知らせで、API が最後の砦。
- 規則と文言は画面(`validation-rules.ts`)に揃えた: 8〜128文字、大文字・小文字・数字・**ASCII の記号**(全角の「！」は記号に数えない)。
- **登録の API には課さない**: 既存のアカウントのパスワードや、規則より前に書いたテストのパスワード(`s3cret` など)を断らないため。今のパスワード(`current_password`)にも課さない。
- 規則は純粋な関数に切り出した。スキーマの検証から呼び、テストは素で呼べる。

## 3. サービス(`UserService`)

```python
# app/services/user.py(要点)
async def change_email(self, user, *, new_email, current_password) -> User:
    self._verify_current_password(user, current_password)
    if new_email == user.email:
        return user
    if await self._repo.get_by_email(new_email) is not None:
        raise UserAlreadyExistsError(...)
    user.email = new_email
    ...

async def change_password(self, user, *, current_password, new_password) -> User:
    self._verify_current_password(user, current_password)
    user.hashed_password = hash_password(new_password)
    ...
```

- 確かめは既存の `verify_password`、ハッシュは `hash_password`(登録と同じ)。
- メールの重複は登録と同じ `UserAlreadyExistsError`(409)。今と同じメールへの変更は何もせずに返す(自分のメールを「使われている」と断らない)。
- 確認メールは送らない(範囲の外。[61-3](../Phase-61/Phase-61-3.md))。アクセストークンの `sub` は利用者の ID なので、メールを変えてもログインは続く。
- `UserService` は Redis を持たない。refresh の失効と出し直しはルートが `AuthService` で行う(サービスの依存を増やさない)。

## 4. refresh の全部の失効(`AuthService.revoke_all_refresh_tokens`)

```python
# app/services/auth.py(要点)
async def revoke_all_refresh_tokens(self, user_id: uuid.UUID) -> int:
    keys = [key async for key in self._redis.scan_iter(match=f"refresh_token:{user_id}:*")]
    if not keys:
        return 0
    return await self._redis.delete(*keys)
```

- refresh は Redis に `refresh_token:{user_id}:{jti}` の鍵で1つずつ持っている(ログインの数だけある)。その人の鍵を全部消すと、どの端末の refresh も 401 になる。
- 鍵は `SCAN` で探す。`KEYS` は全部の鍵を1度に見る間 Redis を止める。
- **アクセストークン(30分)は失効させない**: JWT は Redis で管理していない。ほかの端末は、今のアクセストークンが切れて次に refresh したときにログイン必須になる。

## 5. パスワードの変更のルートと Cookie の共有

```python
# app/api/routes/users.py(要点)
@router.put("/me/password", response_model=AccessToken)
async def change_password(body, response, session, redis, client_ip, current_user) -> AccessToken:
    await AuthRateLimiter(redis).enforce_login(ip=client_ip, email=current_user.email)
    user = await UserService(session).change_password(current_user, ...)
    auth_service = AuthService(session, redis)
    await auth_service.revoke_all_refresh_tokens(user.id)
    access_token, refresh_token = await auth_service.issue_tokens(user)
    set_refresh_cookie(response, refresh_token)
    return AccessToken(access_token=access_token)
```

- 着手時の相談で、**今の端末はログインを保つ**ことにした(推奨どおり。[外部設計書](../../docs/external_design.md) 2.12節の「ほかの端末のログインを切る」のとおり)。全部を消した**後で**今の端末に出し直すので、今の端末だけが新しい refresh を持つ。
- 順序はハッシュの commit → 失効 → 出し直し。今のパスワードが合わなければ、失効の前に 400 で止まる(ほかの端末も切らない)。
- **Cookie の付け方を共有する**: `_set_refresh_cookie` は `routes/auth.py` の中にあった。パスワードの変更のルートも同じ Cookie(httpOnly・path `/api/v1/auth`・同じ寿命)を付けるので、`app/api/refresh_cookie.py` に移し、ログアウトの消し方も並べた(#17。駆動している消費者 = このルート)。Cookie の path は `/api/v1/auth` だが、付ける応答のパス(`/api/v1/users/me/password`)とは別でよい。
- `ReviewSettingsUpdate` と同じく、`UserUpdate`(テンプレートの、使われていなかった更新用スキーマ)は操作ごとのスキーマに分けたので消した。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_password_policy.py`(新規) | `password_violations`・`PasswordUpdate` の検証 | pytest | スタブ不要 ── 規則は純粋な関数で、外部の依存を呼ばないため |
| `test_account.py`(新規) | `UserService` の3つの変更・`AuthService.revoke_all_refresh_tokens`・ルートの関数(`update_current_user`・`change_email`・`change_password`)・`UserNameUpdate` | pytest(ルートの関数を直接呼ぶ) | FakeRedis(refresh の鍵と試行の回数)。DB はインメモリの SQLite |
| `test_generic_chat_and_refresh.py`(更新) | `set_refresh_cookie` の寿命 | pytest | スタブ不要 ── `Response` に付けた Cookie の見出しを読むだけ |
| `test_account_flow.py`(新規、integration) | 3つの API → サービス → Redis の SCAN と削除 | httpx の `AsyncClient` | `get_client_ip` だけを差し替える(試行の IP ごとの上限が、実行を重ねて溜まらないように)。利用者は DB に直接作る |

- ユーザーネームは前後の空白を除いて保存し、空・256文字は 422 / メールは今のパスワードで変わり、不一致は 400 `CURRENT_PASSWORD_MISMATCH`(値は変わらない)、使われているメールは 409、同じメールは成功 / 今のパスワードの試行はログインの上限で止まる / 失効はその人の鍵だけを消し、ほかの人の refresh は通る / パスワードの変更で、ほかの端末の refresh は 401、応答の Cookie の refresh は通る、新しいパスワードでログインでき古いものでは入れない / 不一致のときは、ほかの端末も切らない / 規則のそれぞれの違反と、全角の記号を数えないこと。
- `FakeRedis` に `exists`・`scan_iter`(`fnmatchcase` で glob を照らす)・複数の鍵の `delete` を足した。既存の使い方(1つの鍵の `delete`)はそのまま動く。
- 作成・更新したファイルは、この章のテストがすべて import する(`errors.py` は `CurrentPasswordMismatchError`、`routes/auth.py` は 66-1 の `test_user_rename.py` と integration)。前方 import は無い(新しく import したのは `typing.Annotated`・`pydantic.StringConstraints`・`pydantic.field_validator`・`fastapi.Response` と、この章の `password_violations`・`refresh_cookie`・`CurrentPasswordMismatchError`)。

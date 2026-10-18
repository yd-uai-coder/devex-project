# Phase-75-2: マイページからの連携と解除

## この章の目的

ログイン中の利用者が、マイページから Google アカウントと連携・解除できるようにする。連携は今のパスワードで確かめ、メールが違う Google アカウントも紐付けられる。解除はパスワードを持つ人だけができ、ほかの端末のログインを切る。Phase 74 の連携の確かめ(ログインの画面から)と、連携済みの判定を共有する。

自動実装モード: on([introduction](./Phase-75-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/schemas/user.py`](../samples/backend/app/schemas/user.py) | 更新 | `GoogleLinkCurrentRequest {credential, current_password}` |
| [`app/services/google_auth.py`](../samples/backend/app/services/google_auth.py) | 更新 | `link_current`・`unlink`。連携済みの判定と記録を `_attach` に移し、`link` と共有 |
| [`app/api/routes/users.py`](../samples/backend/app/api/routes/users.py) | 更新 | `POST /users/me/google`(応答は `UserRead`)・`DELETE /users/me/google`(応答は `AccessToken`) |
| [`tests/unit/test_google_link_mypage.py`](../samples/backend/tests/unit/test_google_link_mypage.py) | 新規 | 連携の条件・解除・ルートの上限と失効 |
| [`tests/integration/test_google_mypage_flow.py`](../samples/backend/tests/integration/test_google_mypage_flow.py) | 新規 | 設定 → メールの変更、連携 → Google のログイン → 解除 → ほかの端末が切れる |

## 1. 連携(`link_current`)

```python
# app/services/google_auth.py(抜粋)
async def link_current(self, user, identity, *, current_password) -> User:
    _require_verified_email(identity)
    require_password(user)                         # 75-1。無い人は 409 PASSWORD_NOT_SET
    if user.hashed_password is None or not verify_password(current_password, user.hashed_password):
        raise CurrentPasswordMismatchError("今のパスワードが正しくありません。")   # 400
    return await self._attach(user, identity)
```

- **今のパスワードで確かめる**(ユーザー決定): アクセストークンが盗まれたとき、他人の Google を足されると、その人は Google でいつまでも入れる(パスワードを変えても切れない)。メールの変更が今のパスワードを求めるのと同じ考え方。連携していない人は必ずパスワードを持つ(Google だけの人は、登録した時点で連携済み)ので、求めても困る人はいない。`require_password` は、その前提が崩れたときの守り。
- **400 にする**: ログイン中の操作なので、不一致を 401 にすると画面の `apiFetch` がセッション切れとみなしてログアウトする(Phase 66 と同じ)。ログインの画面からの連携の確かめ(74-3)は 401 のままで、別物。
- **メールが違ってもよい**(ユーザー決定): ログイン中の本人がパスワードで確かめているので、メールの一致で本人を推す必要が無い。仕事のメールでアカウントを作り、個人の Google で入りたい、という使い方を許す。アプリのメールは変えない。
- **メールの確認は求める**: メールを使わなくても、Google の検証の結果として `email_verified=false` は断る(ログインと同じ部品・同じ断り。画面の文言も同じでよい)。

## 2. 連携済みの判定を共有する(`_attach`)

```python
async def _attach(self, user, identity) -> User:
    if user.google_sub == identity.sub:
        return user                                 # 同じ Google でのやり直しは成功
    linked = await self._users.get_by_google_sub(identity.sub)
    if user.google_sub is not None or linked is not None:
        raise GoogleAccountConflictError(...)        # 409 GOOGLE_ACCOUNT_CONFLICT
    user.google_sub = identity.sub
    ...
```

- 74-3 の `link` の後半を、そのまま移した(#17: 実在の消費者 = `link_current`)。`link` は「メールのアカウントのパスワードで確かめる → `_attach`」、`link_current` は「ログイン中の本人の今のパスワードで確かめる → `_attach`」。本人の確かめ方だけが違う。
- 公開の挙動は変えないリファクタなので、[74-3](../Phase-74/Phase-74-3.md) の `test_google_auth.py` が番人(#12 の4)。

## 3. 解除(`unlink`)

```python
async def unlink(self, user) -> User:
    require_password(user)        # 無い人は 409(どちらでもログインできなくなる)
    if user.google_sub is None:
        return user               # 連携していなくても成功
    user.google_sub = None
    ...
```

- **今のパスワードは求めない**: 73-1 の決定7は「パスワードがあるときだけ」。解除はログインの手段を減らす操作で、盗まれたセッションでされても、本人はパスワードで入れる。
- **冪等**: 連携していなくても成功にした(API キーの削除と同じ)。画面の状態が古くても失敗させない。

## 4. ルート

```python
# app/api/routes/users.py(抜粋)
@router.post("/me/google", response_model=UserRead)
async def link_google(body, session, redis, client_ip, current_user, verifier) -> UserRead:
    limiter = AuthRateLimiter(redis)
    await limiter.enforce_google(ip=client_ip)
    identity = await verifier.verify(body.credential)
    await limiter.enforce_login(ip=client_ip, email=current_user.email)
    user = await GoogleAuthService(session).link_current(current_user, identity, current_password=...)
    return await user_read(session, user)

@router.delete("/me/google", response_model=AccessToken)
async def unlink_google(response, session, redis, current_user) -> AccessToken:
    user = await GoogleAuthService(session).unlink(current_user)
    return await _reissue_tokens(response, session, redis, user)
```

- **数え方**: 74-3 の連携の確かめと同じ順序。`google_ip` を数えてから検証を呼ぶ(上限を超えたら Google を呼ばない)。今のパスワードの試行は、メールの変更と同じく `enforce_login`(IP と**今の**メール)で数える。Google のメールでなく今のメールで数えるのは、当てに行く対象が今のアカウントのパスワードだから。
- **連携の応答は `UserRead`**: ログインの手段が増えるだけなので、端末は切らない。画面は `google_linked` を読み直せばよい。
- **解除の応答は `AccessToken`**(ユーザー決定でほかの端末を切る): 解除は Google アカウントを手放すときに行うことが多い。どの端末が Google で入ったかは見分けられないので、全部切って今の端末に出し直す(75-1 の `_reissue_tokens`)。
- 画面の文言(409 `PASSWORD_NOT_SET`・`GOOGLE_ACCOUNT_CONFLICT` など)は Phase 77 で決める。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_google_link_mypage.py`(新規)のサービス | `GoogleAuthService.link_current`・`unlink` | pytest のテスト関数 | DB はインメモリの SQLite。本人の値は `GoogleIdentity` を直接作る(検証を通さない) |
| 同・ルート | `users.link_google`・`unlink_google` | pytest(ルートの関数を直接呼ぶ) | [`FakeGoogleVerifier`](../samples/backend/tests/fixtures/fake_google.py)(74-3。credential → 本人の値)・FakeRedis(refresh の鍵と試行の回数) |
| integration の `test_google_mypage_flow.py`(新規) | `POST /users/me/password`・`PUT /users/me/email`・`POST`/`DELETE /users/me/google` → `GET /users/me`・`POST /auth/refresh`・`POST /auth/google`・`POST /auth/login` | httpx の `AsyncClient` | 検証を E2E 用の偽物(`FakeGoogleTokenVerifier`)に、接続元 IP を一意の値に差し替える。Postgres と Redis は本物 |

- 連携: メールが違う Google が入り、アプリのメールは変わらない / 今のパスワードが違えば 400 で入らない / メールが確認されていなければ 400 / その Google がほかの人と連携済み、または自分が別の Google と連携済みなら 409 / 同じ Google でのやり直しは成功 / パスワードが無い人は 409 `PASSWORD_NOT_SET`。
- 解除: `google_sub` が消え、パスワードでログインできる / 連携していなくても成功 / パスワードが無い人は 409 で、連携は残る。
- ルート: 連携の応答の `google_linked`・`has_password` / `google_ip` の上限を超えると 429 で、検証を呼ばない / 今のパスワードの試行はメールの上限で数える / 解除でほかの端末の refresh が消え、出し直した refresh で refresh できる。
- integration: Google だけの人のメールの変更は 409 `PASSWORD_NOT_SET` → 設定 → `has_password=true` → もう一度の設定は 409 `PASSWORD_ALREADY_SET` → メールの変更 → 新しいメールとパスワードでログイン / パスワードの人が違うパスワードで 400 → メールが違う Google を連携 → その Google でログイン(ほかの端末の役)→ 解除 → 今の端末は refresh でき、ほかの端末は 401 → 解除した Google は新しい利用者になる / Google だけの人の解除は 409。
- 作成・更新したファイルは、この章のテストがすべて import する。前方 import は無い(import 先は 74 と 75-1 と、この章の表で上に置いたファイル)。

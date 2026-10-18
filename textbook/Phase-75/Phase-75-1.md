# Phase-75-1: パスワードの設定と、パスワードが無い人の断り

## この章の目的

Google だけで登録した利用者(パスワードが null)が、マイページでパスワードを「設定」できるようにする(今のパスワードは求めない)。設定すれば、メールとパスワードでもログインでき、メールの変更も使える。あわせて、今のパスワードが要る変更(メール・パスワード)を、パスワードが無い人には「先に設定して」という理由(409 `PASSWORD_NOT_SET`)で断る。マイページからの連携と解除は [75-2](./Phase-75-2.md) で作る。

自動実装モード: on([introduction](./Phase-75-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `PasswordAlreadySetError`(409 `PASSWORD_ALREADY_SET`)・`PasswordNotSetError`(409 `PASSWORD_NOT_SET`) |
| [`app/schemas/user.py`](../samples/backend/app/schemas/user.py) | 更新 | `PasswordSet {new_password}`。規則の確かめを `_require_policy` に切り出し、`PasswordUpdate` と共有 |
| [`app/services/user.py`](../samples/backend/app/services/user.py) | 更新 | `set_password`・`require_password`(モジュールの関数)。`change_email`・`change_password` の頭で `require_password` |
| [`app/api/routes/users.py`](../samples/backend/app/api/routes/users.py) | 更新 | `POST /users/me/password`。失効と出し直しを `_reissue_tokens` に寄せ、`change_password` もそれを使う |
| [`tests/unit/test_user_google_columns.py`](../samples/backend/tests/unit/test_user_google_columns.py) | 更新 | Google だけの人の変更は 409 `PASSWORD_NOT_SET`(74-1 では 400) |
| [`tests/unit/test_password_set.py`](../samples/backend/tests/unit/test_password_set.py) | 新規 | 設定・ある人の 409・`require_password`・ルートの失効と出し直し・規則 |

## 1. 2つの例外

```python
# app/services/errors.py(抜粋)
class PasswordAlreadySetError(ConflictError):
    code: ClassVar[str | None] = "PASSWORD_ALREADY_SET"

class PasswordNotSetError(ConflictError):
    code: ClassVar[str | None] = "PASSWORD_NOT_SET"
```

- **どちらも 409**: 入力が悪いのでなく、今の状態(パスワードの有無)に合わない操作だから。画面は出し分ける(Phase 77)ので普通は来ないが、API を直接呼ばれたときに理由が分かるようにする。
- **74-1 との違い**: 74-1 では、Google だけの人のメールの変更は `_verify_current_password` の null の分岐で 400 `CURRENT_PASSWORD_MISMATCH` になっていた。「パスワードが違う」と「パスワードが無い」は、画面での案内が違う(入れ直す / 設定する)ので、コードを分けた。`_verify_current_password` の null の分岐は型を狭めるために残す(先に `require_password` が弾くので、実際には通らない)。

## 2. サービス

```python
# app/services/user.py(抜粋)
async def set_password(self, user: User, *, new_password: str) -> User:
    if user.hashed_password is not None:
        raise PasswordAlreadySetError("パスワードは設定済みです。")
    user.hashed_password = hash_password(new_password)
    ...

def require_password(user: User) -> None:
    if user.hashed_password is None:
        raise PasswordNotSetError("先にパスワードを設定してください。")
```

- **`require_password` はモジュールの関数**: `UserService` の中だけでなく、75-2 の `GoogleAuthService`(マイページの連携・解除)でも使う。インスタンスの状態を使わないので、メソッドにせず関数にした(#17: 実在の消費者 = 75-2 の `link_current`・`unlink`)。
- **設定は今のパスワードを求めない**: 求める値が無い。本人であることは、ログイン中(アクセストークン)であることで見る。73-1 の決定7のとおり。
- **連携は残す**: 設定した後は、Google とメールのどちらでもログインできる。

## 3. ルート

```python
# app/api/routes/users.py(抜粋)
@router.post("/me/password", response_model=AccessToken)
async def set_password(body: PasswordSet, response, session, redis, current_user) -> AccessToken:
    user = await UserService(session).set_password(current_user, new_password=body.new_password)
    return await _reissue_tokens(response, session, redis, user)
```

- **別の API にした**(ユーザー決定): 変更 `PUT /users/me/password` の `current_password` を省けるようにする案もあったが、変更の API の中に「確かめを飛ばす分岐」が入る。Phase 66 の「確かめ方と副作用が違う操作は API を分ける」に合わせた。同じパスで、メソッドで分ける(`PUT` = 変更、`POST` = 設定)。
- **ほかの端末を切る**: 変更と同じく、その人の refresh を全部失効させて、今の端末に出し直す(応答は `AccessToken`)。画面は変更と同じ扱いでよい。失効と出し直しの4行は `_reissue_tokens` に寄せ、`change_password` と、75-2 の解除でも使う。
- **ログインの上限で数えない**: `enforce_login` は「今のパスワードを当てる試行」を数えるためのもの。設定には当てるものが無い。
- **新しいパスワードの規則**: `PasswordSet` も `PasswordUpdate` と同じ規則(`app/core/password_policy.py`)を課す。`field_validator` の中身を `_require_policy` に切り出して共有した。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_password_set.py`(新規)のサービス | `UserService.set_password`・`require_password` | pytest のテスト関数 | DB はインメモリの SQLite(スタブ不要の部分は、DB を読むだけの純粋に近い判定) |
| 同・ルート | `users.set_password` | pytest(ルートの関数を直接呼ぶ) | FakeRedis(refresh の鍵) |
| 同・スキーマ | `PasswordSet` | pytest のテスト関数 | スタブ不要 ── 検証は純粋(副作用なし)で外部依存を呼ばないため |
| `test_user_google_columns.py`(更新) | `UserService.change_email`・`change_password` | pytest のテスト関数 | DB はインメモリの SQLite |

- 設定: Google だけの人にパスワードが入り、`google_sub` は残る / ある人は 409 で、パスワードは変わらない / `require_password` は無い人だけを断る。
- ルート: access の `sub` が利用者の ID / ほかの端末の refresh が消える / 出し直した refresh で refresh できる / 設定した後はメールとパスワードでログインできる。
- 規則: 短い・大文字が無い・小文字が無い・数字が無いは 422(`ValidationError`)。
- 変更の断り: Google だけの人のメール・パスワードの変更は 409 `PASSWORD_NOT_SET`。
- 作成・更新したファイルは、この章のテストがすべて import する(`errors.py`・`schemas/user.py`・`services/user.py`・`routes/users.py`)。`change_password` のルートの書き換え(`_reissue_tokens`)は、既存の [`test_account.py`](../samples/backend/tests/unit/test_account.py) が番人(#12 の4。公開の挙動は変えない)。前方 import は無い。

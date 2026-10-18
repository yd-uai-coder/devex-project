# Phase-79-1: ログインの失敗の文を日本語に

## この章の目的

メールでのログインと、Google との連携の確かめ(ログインの画面のダイアログ)でパスワードが違うと、API の英語の文 `Invalid email or password` がそのまま画面に出ていた(Phase 76 から。申し送りでは「画面確認で決める」)。本番へ出す前に、API の文を日本語にする(着手時の相談でユーザーが決定。推奨どおり)。画面は API の文をそのまま出すので、画面のコードは変えない。

自動実装モード: on([introduction](./Phase-79-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `InvalidCredentialsError` の2つの文を定数にする(`INVALID_CREDENTIALS_MESSAGE`・`INACTIVE_USER_MESSAGE`) |
| [`app/services/auth.py`](../samples/backend/app/services/auth.py) | 更新 | パスワードでのログインの 401 を、定数の文で投げる |
| [`app/services/google_auth.py`](../samples/backend/app/services/google_auth.py) | 更新 | 連携の確かめと無効な利用者の 401 を、同じ定数の文で投げる |
| [`tests/unit/test_auth_service.py`](../samples/backend/tests/unit/test_auth_service.py) | 更新(samples には新規。テンプレート由来) | パスワードが違うときの文・無効な利用者の文を確かめる |
| [`tests/unit/test_user_google_columns.py`](../samples/backend/tests/unit/test_user_google_columns.py) | 更新 | Google だけの人のパスワードのログインが、同じ文の 401 になる |
| [`tests/unit/test_google_auth.py`](../samples/backend/tests/unit/test_google_auth.py) | 更新 | 連携の確かめでパスワードが違うときも、同じ文になる |

## 要点の抜粋

```python
# app/services/errors.py
class InvalidCredentialsError(UnauthorizedError):
    """メールアドレスまたはパスワードが誤っている、もしくは無効化済みユーザーの場合に送出する。"""


# InvalidCredentialsError の文。パスワードでのログインと、Google との連携の確かめで同じ文にする
# (画面はこの文をそのまま出す)。
INVALID_CREDENTIALS_MESSAGE = "メールアドレスまたはパスワードが正しくありません。"
INACTIVE_USER_MESSAGE = "このアカウントは使えません。"
```

```python
# app/services/auth.py(google_auth.py の link・_require_active も同じ)
from app.services.errors import (
    INACTIVE_USER_MESSAGE,
    INVALID_CREDENTIALS_MESSAGE,
    InvalidCredentialsError,
    InvalidTokenError,
)
...
            raise InvalidCredentialsError(INVALID_CREDENTIALS_MESSAGE)
        if not user.is_active:
            raise InvalidCredentialsError(INACTIVE_USER_MESSAGE)
```

- **文を定数にした理由**: 2つの文は `auth.py` と `google_auth.py` の両方で投げる。ログインと連携の確かめで同じ文を返すのは「どのアカウントが Google だけか・パスワードが違うのかを見分けさせない」という決まり(Phase 74)なので、同じ事実を1か所に置く(#17)。置き場は、両方が既に import している `app/services/errors.py`(例外の定義の隣)。
- **API で変えた理由**(画面で 401 を読み替えない): 新しい API の文(Google・マイページ・レビュー)は既に日本語で、画面は `ApiError.message` をそのまま出す作り。画面で読み替えると、ログインの画面と連携のダイアログの2か所に同じ表が要る。
- **文言**: マイページの「今のパスワードが正しくありません。」(Phase 75)と同じ「正しくありません」にした。
- 残る英語の文: refresh の失敗(`Invalid or expired refresh token` など)。画面には出ない(401 で静かにログアウトする)ので変えていない。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_authenticate_rejects_wrong_password`(更新)・`test_authenticate_rejects_inactive_user_in_japanese`(新規) | `AuthService.authenticate` | テスト関数 | `FakeRedis`(生成に要るだけ)。DB はインメモリの SQLite(本物) |
| `test_password_login_of_google_only_user_is_the_same_401`(更新) | `AuthService.authenticate` | テスト関数 | 同上 |
| `test_link_with_wrong_password_is_401`(更新) | `GoogleAuthService.link` | テスト関数 | スタブ不要 ── 検証済みの本人の値(`GoogleIdentity`)を直接渡すので、Google の検証を呼ばないため |

- パスワードが違う・Google だけの人・連携の確かめで、文が同じ定数になる。無効な利用者は別の文になる。
- 1つ目のテストだけは、定数でなく文そのもの(日本語)とも比べる(定数ごと英語に戻っても気づけるように)。
- 画面に出る文は、[79-2](./Phase-79-2.md) の E2E で、ログインの画面と連携のダイアログの両方で確かめる。
- 更新した本体のファイルは、どれもこの表のテストが import する。前方 import は無い。

# Phase-74-1: `users` の変更と、パスワードの照合の null 対応

## この章の目的

Google だけで登録した利用者を持てるように、`users` に Google アカウントの識別子(`google_sub`)を足し、パスワード(`hashed_password`)を null 可にする。パスワードを照合する2か所(ログインと、マイページの「今のパスワード」)が null で落ちないようにし、`GET /users/me` にパスワードの有無と連携の有無を足す。Google の検証は [74-2](./Phase-74-2.md)、ログインの API は [74-3](./Phase-74-3.md) で作る。

自動実装モード: on([introduction](./Phase-74-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`alembic/versions/c4f8a2e6d1b9_add_google_sub_to_users.py`](../samples/backend/alembic/versions/c4f8a2e6d1b9_add_google_sub_to_users.py) | 新規 | `google_sub`(一意のインデックス)を足し、`hashed_password` を null 可に。往復できる |
| [`app/models/user.py`](../samples/backend/app/models/user.py) | 更新 | `hashed_password: str \| None`・`google_sub: str \| None` |
| [`app/repositories/user.py`](../samples/backend/app/repositories/user.py) | 更新 | `get_by_google_sub`・`create(..., hashed_password: str \| None, google_sub=)` |
| [`app/services/auth.py`](../samples/backend/app/services/auth.py) | 更新 | `authenticate` はパスワードが null の人も同じ 401 |
| [`app/services/user.py`](../samples/backend/app/services/user.py) | 更新 | `_verify_current_password` はパスワードが null なら不一致(400) |
| [`app/schemas/user.py`](../samples/backend/app/schemas/user.py) | 更新 | `UserRead.has_password`・`google_linked` |
| [`app/api/user_read.py`](../samples/backend/app/api/user_read.py) | 更新 | 2つの項目を ORM の値から埋める |
| [`tests/unit/test_user_google_columns.py`](../samples/backend/tests/unit/test_user_google_columns.py) | 新規 | sub での検索・null のパスワードの照合・応答の2項目 |

## 1. マイグレーション

```python
# alembic/versions/c4f8a2e6d1b9_add_google_sub_to_users.py
revision = 'c4f8a2e6d1b9'
down_revision = 'b8e4d0f2a6c3'   # Phase 69 の generation_finding_ids

def upgrade() -> None:
    op.add_column('users', sa.Column('google_sub', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_users_google_sub'), 'users', ['google_sub'], unique=True)
    op.alter_column('users', 'hashed_password', existing_type=sa.String(length=255), nullable=True)

def downgrade() -> None:
    op.alter_column('users', 'hashed_password', existing_type=sa.String(length=255), nullable=False)
    op.drop_index(op.f('ix_users_google_sub'), table_name='users')
    op.drop_column('users', 'google_sub')
```

- **一意のインデックス**: 1つの Google アカウントは1人にしか紐付かない。探すのも `google_sub` が先なので、インデックスを兼ねる。モデルは `unique=True, index=True` で、同じ名前(`ix_users_google_sub`)のインデックスになる。null はいくつあってもよい(Postgres の一意制約は null を重複とみなさない)。
- **downgrade の注意**: Google だけの利用者(パスワードが null)がいると、NOT NULL に戻せずに失敗する。docstring に「戻す前に null の行が 0 件か確かめる」を書いた。本番の手順は Phase 79 で `OPERATIONS.md` に書く。
- リビジョン ID の衝突が無く、head が1つであることを確かめてから上げた。

## 2. パスワードの照合

```python
# app/services/auth.py(抜粋)
if (
    user is None
    or user.hashed_password is None
    or not verify_password(password, user.hashed_password)
):
    raise InvalidCredentialsError("Invalid email or password")
```

- **同じ 401・同じ文言**: Google だけの利用者がパスワードでログインしようとしても、パスワードが違うときと区別しない。区別すると、どのメールが Google だけのアカウントかを外から調べられる(Phase 73 の Claude の判断)。
- `UserService._verify_current_password` も、null なら何を入れても不一致(400 `CURRENT_PASSWORD_MISMATCH`)にした。Google だけの利用者にはパスワードの「設定」を出す(Phase 75)ので、画面からはここに来ない。それまでの間に API を直接呼ばれても、例外で落ちないようにするためである。
- `app/core/security.py` の `verify_password` は変えない(照合する側で null を弾く)。null を受けるようにすると、「パスワードが無い」と「違う」の区別がハッシュの関数の中に隠れるため。

## 3. `UserRead` の2項目

```python
# app/api/user_read.py(抜粋)
"has_password": user.hashed_password is not None,
"google_linked": user.google_sub is not None,
```

- マイページの出し分け(パスワードの「変更」か「設定」か、Google の連携か解除か)と、ログインの画面の案内に使う。ハッシュや `sub` の値そのものは返さない。
- `review_allowed` と同じく、ルートが共通で使う `user_read` で埋める。スキーマの既定値は `False`(`model_validate` だけで作った応答でも、項目は欠けない)。

## テスト観点

用語(SUT = テストの対象、ドライバ = 対象を呼ぶもの、スタブ = 対象の依存の代わり)は、以前の Phase と同じ。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_user_google_columns.py`(新規) | `UserRepository.get_by_google_sub`・`create`、`AuthService.authenticate`、`UserService.change_email`・`change_password`、`user_read` | pytest のテスト関数 | FakeRedis(`AuthService` を作るのに要るだけ)。DB はインメモリの SQLite |

- `sub` で連携した人だけが見つかる / Google だけの利用者のパスワードでのログインは、違うときと同じ文言の 401 / 今のパスワードは何を入れても 400 / `has_password`・`google_linked` の組み合わせが、パスワードの利用者と Google だけの利用者で逆になる / 応答にハッシュと `sub` が出ない。
- マイグレーションはテストが import しない。dev の DB で `upgrade head` → `downgrade b8e4d0f2a6c3` → `upgrade head` の往復を流し、`google_sub` の一意のインデックスと、`hashed_password` が null 可であることを `\d users` で確かめた。
- 作成・更新したファイルは(マイグレーションを除き)この章のテストがすべて import する。前方 import は無い(新しい import は無い)。

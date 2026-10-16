# Phase-66-1: 表示名の列の改名(`full_name` → `user_name`)

## この章の目的

マイページで変える「ユーザーネーム」に名前を揃えるため、`users.full_name` を `user_name` に改名する。列の改名なので既存の値は残る。API のスキーマ・登録の画面(「氏名」→「ユーザーネーム」)・seed・E2E の登録の手順まで、同じ名前に揃える。変更の API は [66-2](./Phase-66-2.md)、画面は [66-3](./Phase-66-3.md) で作る。

自動実装モード: on([introduction](./Phase-66-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`alembic/versions/4b7e2d9c1a6f_rename_full_name_to_user_name.py`](../samples/backend/alembic/versions/4b7e2d9c1a6f_rename_full_name_to_user_name.py) | 新規 | `op.alter_column(..., new_column_name=...)` の往復 |
| [`app/models/user.py`](../samples/backend/app/models/user.py) | 更新 | `user_name` の列 |
| [`app/schemas/user.py`](../samples/backend/app/schemas/user.py) | 更新 | `UserBase.user_name` |
| [`app/repositories/user.py`](../samples/backend/app/repositories/user.py) | 更新(samples に初めて載せた) | `create(..., user_name=)` |
| [`app/services/user.py`](../samples/backend/app/services/user.py) | 更新 | `create_user(..., user_name=)` |
| [`app/api/routes/auth.py`](../samples/backend/app/api/routes/auth.py) | 更新 | 登録で `payload.user_name` を渡す |
| [`scripts/seed.py`](../samples/backend/scripts/seed.py) | 更新 | 固定の利用者の `user_name` |
| [`tests/unit/test_user_rename.py`](../samples/backend/tests/unit/test_user_rename.py) | 新規 | サービス・登録のルート・seed が `user_name` を持つ |
| [`tests/integration/test_auth_flow.py`](../samples/backend/tests/integration/test_auth_flow.py) | 更新 | 登録の本文を `user_name` に |
| [`tests/integration/test_projects_flow.py`](../samples/backend/tests/integration/test_projects_flow.py) | 更新 | 同上 |
| [`src/features/auth/schemas.ts`](../samples/frontend/src/features/auth/schemas.ts) | 更新 | `registerSchema.userName`(ラベル「ユーザーネーム」) |
| [`src/features/auth/components/RegisterForm.tsx`](../samples/frontend/src/features/auth/components/RegisterForm.tsx) | 更新 | 欄のラベルと送る本文(`user_name`) |
| [`e2e/helpers.ts`](../samples/frontend/e2e/helpers.ts) | 更新 | `getByLabel("ユーザーネーム")` |
| [`src/features/auth/components/__tests__/RegisterForm.test.tsx`](../samples/frontend/src/features/auth/components/__tests__/RegisterForm.test.tsx) | 更新 | ラベルと本文 |

## 1. マイグレーション

```python
# alembic/versions/4b7e2d9c1a6f_rename_full_name_to_user_name.py
revision = '4b7e2d9c1a6f'
down_revision = '8d4f1a2b6c3e'   # Phase 64 の deleted_at

def upgrade() -> None:
    op.alter_column('users', 'full_name', new_column_name='user_name')

def downgrade() -> None:
    op.alter_column('users', 'user_name', new_column_name='full_name')
```

- **列の改名で書く**: autogenerate は改名を見分けられず、「列を消して足す」を出す(値が消える)。改名は手で `alter_column` に書く。Postgres では `ALTER TABLE ... RENAME COLUMN` になり、表を書き直さないので一瞬で終わる。
- リビジョン ID が既存と重ならないこと、head が1つであることを確かめてから上げた(`alembic heads`)。

## 2. API・サービス・seed

- ORM の属性・スキーマの項目・リポジトリとサービスの引数を、すべて `user_name` に揃えた(名前を変えるだけ。振る舞いは同じ)。
- **API の項目の名前も変わる**: 登録の本文と `GET /users/me` の応答の `full_name` は `user_name` になる。古い名前を受ける互換は置かない(画面と E2E が同じリポジトリの中にしか無いため)。
- seed の固定の利用者は `user_name` を持つ。既存の dev の DB の利用者は、マイグレーションで値がそのまま `user_name` に移る。

## 3. 画面と E2E

- 登録の画面の欄を「氏名」から「ユーザーネーム」に、zod のキーを `fullName` から `userName` に改めた(必須・255文字まで、は同じ)。
- `e2e/helpers.ts` の `registerAndLogin` は欄をラベルで探すので、`getByLabel("ユーザーネーム")` に直した。E2E は Phase 72 で既存を含めて流す(#36)。

## テスト観点

この Phase で初めて書くテストの用語(SUT = テストの対象、ドライバ = 対象を呼ぶもの、スタブ = 対象の依存の代わり)は、以前の Phase と同じ。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_user_rename.py`(新規) | `UserService.create_user`・`UserRead`・登録のルート(`auth.register`)・`seed_users` | pytest(ルートの関数を直接呼ぶ) | FakeRedis(登録の回数を数えるだけ)。DB はインメモリの SQLite |
| integration の `test_auth_flow.py`・`test_projects_flow.py`(更新) | 登録 → ログインの流れ | httpx の `AsyncClient` | スタブ不要 ── 実際の Postgres と Redis で流れそのものを確かめる |
| `RegisterForm.test.tsx`(更新) | `RegisterForm` | ユーザーの操作(Testing Library) | fetch(`stubFetch`)・`next/navigation` |

- 登録で渡した名前が `user_name` に入り、応答にも `user_name` で出る(`full_name` は出ない) / seed の利用者が `user_name` を持つ / 画面は「ユーザーネーム」の欄で、`user_name` を送る。
- マイグレーションはテストが import しない。dev の DB で `upgrade head` → `downgrade 8d4f1a2b6c3e` → `upgrade head` の往復を流し、列が `user_name` になることを確かめた。
- 作成・更新したファイルは(マイグレーションを除き)この章のテストがすべて import する。前方 import は無い(新しい import は無い)。

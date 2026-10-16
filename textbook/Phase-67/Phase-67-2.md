# Phase-67-2: モデルと API キーのテーブル・seed

## この章の目的

用途ごとのモデルと、provider ごとの API キーを保存するテーブルを足す。システムの既定値は `user_id` が null の行で持ち、`scripts/seed.py` が `.env` のモデルから書く(値を seed に書かない)。

自動実装モード: on([introduction](./Phase-67-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/models/user_model_setting.py`](../samples/backend/app/models/user_model_setting.py) | 新規 | `UserModelSetting`(`(user_id, purpose)` を `NULLS NOT DISTINCT` で一意) |
| [`app/models/user_api_key.py`](../samples/backend/app/models/user_api_key.py) | 新規 | `UserApiKey`(暗号文と末尾の4文字) |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | 2つを re-export(alembic と `create_all` が拾う) |
| [`alembic/versions/9e1c5a7b3d20_add_user_llm_settings.py`](../samples/backend/alembic/versions/9e1c5a7b3d20_add_user_llm_settings.py) | 新規 | 2つのテーブル(down_revision `4b7e2d9c1a6f`) |
| [`app/repositories/user_model_setting.py`](../samples/backend/app/repositories/user_model_setting.py) | 新規 | `list_defaults`・`list_for_user`・`upsert_default`・`replace_for_user` |
| [`app/repositories/user_api_key.py`](../samples/backend/app/repositories/user_api_key.py) | 新規 | `list_for_user`・`get_for_user`・`upsert` |
| [`app/services/llm_defaults.py`](../samples/backend/app/services/llm_defaults.py) | 新規 | `env_default_models`(`.env` の3つのモデル → 4用途) |
| [`scripts/seed.py`](../samples/backend/scripts/seed.py) | 更新 | `seed_default_models`(実行のたびに上書き) |
| [`tests/unit/test_seed_models.py`](../samples/backend/tests/unit/test_seed_models.py) | 新規 | 既定値の割り当て・seed の上書き・2つのリポジトリ |

## 1. テーブルの形(着手時の相談。推奨どおり)

用途ごとに1行(`user_model_settings`)。1ユーザー1行(用途ごとに列を持つ)にしなかったのは、用途を足すと列が増え、「選ばない用途 = 行が無い = 既定値」と表せないため。列の一覧は [内部設計書](../../docs/internal_design.md) 3.2節 ⑫⑬。

```python
# app/models/user_model_setting.py(要点)
class UserModelSetting(Base):
    __tablename__ = "user_model_settings"
    __table_args__ = (
        UniqueConstraint("user_id", "purpose", name="uq_user_model_settings_user_purpose",
                         postgresql_nulls_not_distinct=True),
    )
    user_id: Mapped[uuid.UUID | None]   # null = システムの既定値
    purpose: Mapped[str]                # catalog.Purpose の値
    provider: Mapped[str]               # catalog.Provider の値
    model: Mapped[str]
```

- **`NULLS NOT DISTINCT`**: 普通の一意制約は null どうしを別の値とみなすので、既定値の行(`user_id` が null)が用途ごとに何行でも入ってしまう。PostgreSQL 15 以降のこの指定で、null を同じ値として扱う(dev・本番とも Postgres 17)。unit のテストの SQLite はこの指定を無視するので、一意は integration で確かめる([67-3](./Phase-67-3.md))。
- 用途・provider は文字列の列にし、値の検査はカタログ(`StrEnum`)でサービスが行う(既存の `hearing_points.status` などと同じ形)。
- `user_api_keys` は `(user_id, provider)` で一意。キーは暗号文(`encrypted_key`)と末尾の4文字(`key_hint`。平文)だけを持つ。

マイグレーションは手書きした(モデルと同じく `postgresql_nulls_not_distinct=True` を書く)。リビジョン ID の衝突が無く、head が1つであることを確かめてから、dev の DB で `upgrade 9e1c5a7b3d20` → `downgrade 4b7e2d9c1a6f` → `upgrade` の往復を確かめた。

## 2. リポジトリ

```python
# app/repositories/user_model_setting.py(要点)
async def list_defaults(self) -> list[UserModelSetting]: ...            # user_id IS NULL
async def upsert_default(self, *, purpose, provider, model) -> UserModelSetting: ...
async def replace_for_user(self, user_id, choices: list[tuple[str, str, str]]) -> list[...]:
    """渡さない用途の行は消す(既定値に従う)。"""
```

`replace_for_user` は「その人の行を全部消して、渡した組を入れ直す」。画面は4用途をまとめて保存するので、差分を取るより単純で、省いた用途が既定値に戻ることもそのまま表せる。commit はしない(サービスが握る。devex-api の CLAUDE.md)。

## 3. 既定値と seed(`app/services/llm_defaults.py`・`scripts/seed.py`)

```python
# app/services/llm_defaults.py(要点)
def env_default_models(settings: Settings) -> dict[Purpose, tuple[Provider, str]]:
    # チャットと生成は GEMINI_MODEL、レビューは REVIEW_MODEL、判定は JUDGE_MODEL。
    # provider はカタログから引き、表に無いモデルは ValueError(既定値をカタログの外にしない)
```

- **seed の上書きの規則**(着手時の相談。推奨どおり): 実行のたびに `.env` の値で既定値の行を上書きする(`.env` が正)。既定のモデルを替えるときは `.env` を直して seed を流し直せばよい。
- 既定値の行がまだ無い DB(seed を流していない)では、サービスが読み出しのときに `env_default_models` で補う([67-3](./Phase-67-3.md))。そのため、この関数は seed と API の両方が使うサービス層に置いた。
- `scripts/seed.py` は dev 専用と書かれている。本番で既定値の行をどう入れるか(seed のこの関数だけを流すか、行が無くても `.env` で補う今の形のままにするか)は Phase 72 で決める(未消化の申し送り)。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_seed_models.py` | `env_default_models`・`seed_default_models`・2つのリポジトリ・2つのモデル | pytest の関数 | DB はテスト用の SQLite のセッション。`.env` の値は settings を monkeypatch | 用途への割り当て(チャットと生成は同じモデル)/ カタログの外のモデルは `ValueError` / seed を2回流しても4行で、2回目の値に上書き / `replace_for_user` が渡さない用途を消す / キーの `upsert` が同じ provider を置き換える |

マイグレーションは往復の実行で確かめた。`app/models/__init__.py` は `test_seed_models.py` が `from app.models import UserApiKey, UserModelSetting` で import する。

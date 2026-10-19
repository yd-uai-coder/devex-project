# Phase-81-2: 合意済みの版(束)のテーブルとリポジトリ

## この章の目的

合意済みの版(束)を持つ2つの表を作る。束(`baselines`)は番号と合意の記録を、写し(`baseline_items`)は束を作った時点の文書と段階の中身を持つ([内部設計書](../../docs/internal_design.md) 3.2節⑭⑮)。文書は直近3版で巡回し、段階は1行を上書きするので、合意の時点を残すには別の表に写すしかない([80-1](../Phase-80/Phase-80-1.md) 決定2)。何を写すか・いつ作れるかは [81-3](./Phase-81-3.md) のサービスが決め、この章は永続化だけを作る。

自動実装モード: on([introduction](./Phase-81-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/models/baseline.py`](../samples/backend/app/models/baseline.py) | 新規 | `Baseline`(束)・`BaselineItem`(写し) |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | `Project.baselines`(番号の順) |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | `Baseline`・`BaselineItem` を alembic に見せる |
| [`alembic/versions/d28026a1521b_add_baselines.py`](../samples/backend/alembic/versions/d28026a1521b_add_baselines.py) | 新規 | 2つの表(一意制約・外部キーの CASCADE / SET NULL)。往復できる |
| [`app/repositories/baseline.py`](../samples/backend/app/repositories/baseline.py) | 新規 | `ItemSnapshot`・`BaselineRepository`(次の番号・作成・一覧・番号で取得) |
| [`tests/unit/test_baseline_repository.py`](../samples/backend/tests/unit/test_baseline_repository.py) | 新規 | 番号がプロジェクトごと・記録と写しの保存と並び・新しい順・番号の重複は DB が止める |

## 1. 2つの表

```python
# app/models/baseline.py(抜粋)
class Baseline(Base):
    __tablename__ = "baselines"
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_baselines_project_number"),)
    project_id   # FK projects.id, ondelete CASCADE
    number: int                  # プロジェクトの中の連番(B-1…)
    counterpart: str | None      # 合意の相手(自由文。空でもよい)
    agreed_at: datetime          # 合意した日時(記録した日時 created_at とは別)
    memo: str                    # 打ち合わせのメモ(空でもよい)
    reason: str                  # 理由
    recorded_by: uuid | None     # FK users.id, ondelete SET NULL
    items: list["BaselineItem"]  # cascade, order_by position

class BaselineItem(Base):
    __tablename__ = "baseline_items"
    __table_args__ = (UniqueConstraint("baseline_id", "key", name="uq_baseline_items_key"),)
    position: int; key: str      # 'requirements' / 'external_design' / 'test_spec' / 'stage:1'〜'stage:8'
    included: bool; state: str   # 入っているか・束を作った時点の状態
    source_version: int | None   # 文書の版 / 段階の approved_version
    content: str | None; model: dict | None; generated_model: str | None
```

- **写しを1つの表にまとめた**: 文書と段階で表を分けず、`key` で見分ける。予測(Phase 83)は文書の model と段階の `approved_model` を同時に読んで `DesignModels.from_dicts(stages, docs, er)` に渡すので、1回の読み出しで全部そろうほうが扱いやすい。段階3の `approved_model` は承認したときの ER の写し(`ER_SNAPSHOT_KEY`)を持つので、ER も別に写さなくてよい。
- **入っていないものも行を作る**: 承認したことの無い段階・無いテスト仕様書も `included=false` の行にして、そのときの状態を残す。「B-1 では段階8 はまだ下書きだった」が束だけで分かる。
- **番号は連番、一意制約で並行作成を止める**: `generated_documents` の版の番号と同じ方針(画面の二重押しは画面で、すり抜けた並行は DB で止める)。
- **記録した人は SET NULL**: 利用者を消してもプロジェクトは CASCADE で消えるので、今は効く場面が無い。ただし、後のステージで束を別の利用者(クライアント)と共有したとき(ステージ13)に、記録が消えないようにした。
- **直す・消す操作を持たない**(ユーザー決定): 消えるのはプロジェクトの削除の CASCADE だけ。`Project.baselines` の `cascade="all, delete-orphan"` は、ORM でプロジェクトを消したときのためのもので、ほかの子の表と同じ。

## 2. リポジトリ

```python
# app/repositories/baseline.py(抜粋)
@dataclass(frozen=True)
class ItemSnapshot:
    key: str; included: bool; state: str
    source_version: int | None = None; content: str | None = None
    model: dict | None = None; generated_model: str | None = None

class BaselineRepository(CRUDRepository[Baseline]):
    def _default_options(self): return (selectinload(Baseline.items),)
    async def next_number(self, project_id) -> int            # max(number) + 1
    async def create(self, *, project_id, number, agreed_at, reason, items, counterpart=None,
                     memo="", recorded_by=None) -> Baseline   # flush まで。created_at はアプリで入れる
    async def list_for_project(self, project_id) -> list[Baseline]   # 新しい順
    async def get_by_number(self, *, project_id, number) -> Baseline | None
```

- **`ItemSnapshot`**: サービスが作る写しの値。ORM の行を外で作らせず、並び(`position`)はリポジトリが渡された順に振る。
- **写しは束と一緒に読む**(`selectinload`): `ReviewRunRepository` が指摘を読むのと同じ型。一覧も写しを読むが、応答は要約のスキーマ(中身なし)で返す([81-3](./Phase-81-3.md))。
- **`created_at` をアプリで入れる**: 作った束をそのまま応答にするとき、読み直さずに日時を出すため(`ReviewRunRepository.create_run` の `started_at` と同じ)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_baseline_repository.py`(新規) | `BaselineRepository`(4つのメソッド)と `Baseline`・`BaselineItem` の定義 | pytest のテスト関数 | スタブ不要 ── 永続化そのものが検証対象のため、インメモリの SQLite を使う |

- 番号はプロジェクトごとに 1 から / 記録(相手・メモ・記録した人)と写し(版・md・model・モデル名)が読み直しても同じで、渡した順に並ぶ / 入っていない写しは model が `None` / 一覧は新しい順・無い番号は `None` / 同じ番号の2つ目は `IntegrityError`。
- プロジェクトの削除で束が消えること(外部キーの CASCADE)は、SQLite では外部キーが効かないので、[81-3](./Phase-81-3.md) の統合テスト(PostgreSQL)で確かめた。
- マイグレーションは dev の DB で往復を流し、`alembic check` でモデルとの差が無いことを確かめた。

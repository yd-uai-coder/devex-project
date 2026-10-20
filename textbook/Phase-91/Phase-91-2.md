# Phase-91-2: 合意の記録の表とリポジトリ

## この章の目的

要素ごとの合意の記録を持つ表(`agreement_records`)と、追記・読み出しのリポジトリを作る([内部設計書](../../docs/internal_design.md) 3.2節⑳)。記録は追記だけで、今の合意は「キーごとの最新」。束・「採用にする」・CR の3つの出どころの記録が同じ表に並ぶので、保護(Phase 92・93)は今の合意を、履歴(Phase 95)は記録の並びを読めばよい。何を記録するかは [91-3](./Phase-91-3.md) のサービスが決め、この章は永続化だけを作る。

自動実装モード: on([introduction](./Phase-91-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/models/agreement.py`](../samples/backend/app/models/agreement.py) | 新規 | `AgreementRecord`(記録1行) |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | `Project.agreement_records`(記録の順) |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | `AgreementRecord` を alembic に見せる |
| [`alembic/versions/05c8f8d7cf8b_add_agreement_records.py`](../samples/backend/alembic/versions/05c8f8d7cf8b_add_agreement_records.py) | 新規 | 表と索引。往復できる |
| [`app/repositories/agreement.py`](../samples/backend/app/repositories/agreement.py) | 新規 | `AgreementRepository`(追記・一覧・今の合意) |
| [`tests/unit/test_agreement_repository.py`](../samples/backend/tests/unit/test_agreement_repository.py) | 新規 | 連番・同じ日時・外れた記録・キーごとの最新・一意制約 |

## 1. 表

```python
# app/models/agreement.py(抜粋)
class AgreementRecord(Base):
    __tablename__ = "agreement_records"
    __table_args__ = (UniqueConstraint("project_id", "seq", name="uq_agreement_records_project_seq"),
                      Index("ix_agreement_records_project_key", "project_id", "key"))
    project_id        # FK projects.id, CASCADE
    seq: int          # プロジェクトの中の記録の順
    key: str          # req:FR-001 / users / screen:SCR-001 / api:GET /x / integration:<名前>
    kind: str; label: str
    content: dict | None       # 合意した中身。NULL は「外れた」
    origin: str                # baseline / adopt / change_request
    baseline_id                # FK baselines.id, CASCADE(NULL 可)
    change_request_id          # FK change_requests.id, SET NULL(NULL 可。Phase 93 で書く)
    recorded_by                # FK users.id, SET NULL
    created_at
```

- **1つの表に追記する**(docs 3.3節 12項): 今の合意と履歴を2つの表に分けると、二重に書く手間と、ずれの心配が生まれる。今の合意は、キーごとの最新の行から求める。
- **`seq` で順を決める**: 束を作ると1回で十数行を書き、日時は同じになる。並びを日時に頼らず、プロジェクトの中の連番で決める(番号の重複は一意制約で止める。束の番号と同じ方針)。
- **「外れた」は中身が NULL の行**: 束を作り直したとき、前の合意にあって束に無い要素(CR で消した要件など)を記録する。今の合意から外れるので、Phase 92 の保護が、消した要件を戻してしまわない(Claude の判断)。
- **出どころは種類 + 束・CR への外部キー**: 画面に `B-2`・`CR-3` を出すため、番号を持つ行を指す。束は消えない(プロジェクトの削除でだけ消える)ので CASCADE、CR は SET NULL(記録を残す)。
- **直す・消す操作を持たない**(ユーザー決定: 取り消しは持たない)。誤りは新しい束か CR で直す。

## 2. リポジトリ

```python
# app/repositories/agreement.py(抜粋)
class AgreementRepository(CRUDRepository[AgreementRecord]):
    async def append(self, *, project_id, items: Sequence[AgreedItem], origin: AgreementOrigin,
                     removed: Sequence[AgreementRecord] = (), baseline_id=None,
                     change_request_id=None, recorded_by=None) -> list[AgreementRecord]
    async def list_for_project(self, project_id) -> list[AgreementRecord]   # 記録の順
    async def current(self, project_id) -> list[AgreementRecord]            # キーごとの最新。外れたは除く
```

- **`append` は1回の合意を1回で書く**: 要素の順 → 外れた要素の順に連番を振り、日時はアプリで入れる(1回の記録の行は同じ日時)。外れた要素は、今の合意の記録からキー・種類・表示名を写し、中身を NULL にする(キーから種類を推し量らないため)。
- **`current` は全部読んで畳む**: 記録の数は「要素の数 × 合意の回数」ほどで小さい(開発 DB の最大のプロジェクトで数十行)。DB ごとの書き方(PostgreSQL の `DISTINCT ON` など)に頼らず、SQLite のユニットテストでも同じに動く。
- **出どころの束・CR は一緒に読む**(`selectinload`): 応答で番号を出すため([91-4](./Phase-91-4.md))。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_agreement_repository.py`(新規) | `AgreementRepository`(3つのメソッド)と `AgreementRecord` の定義 | pytest のテスト関数 | スタブ不要 ── 永続化そのものが検証対象のため、インメモリの SQLite を使う |

- 連番が 1 から続き、1回の記録の日時が同じ / 出どころの束を指す・採用は束を指さない / 外れた記録は中身が NULL で、キー・種類・表示名を写す / 今の合意はキーごとの最新で、外れたものと別のプロジェクトの記録を含まない / 同じ連番の2つ目は `IntegrityError`。
- プロジェクトの削除で記録が消えること(CASCADE)は、[91-4](./Phase-91-4.md) の統合テスト(PostgreSQL)で確かめた。
- マイグレーションは開発 DB で往復を流し、`alembic check` でモデルとの差が無いことを確かめた。

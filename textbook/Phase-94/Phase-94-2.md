# Phase-94-2: 利用者が決めた欄の保存

## この章の目的

確認事項の一覧は保存せず毎回組み立てる(94-1)。利用者が項目ごとに決めた欄(決める機会・状態・メモ)だけを、項目のキーで保存する表とリポジトリを作る。

自動実装モード: on([introduction](./Phase-94-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/models/confirmation.py`](../samples/backend/app/models/confirmation.py) | 新規 | `ConfirmationItemRecord`(表 `confirmation_items`) |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | alembic に import させる |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | `confirmation_items` の relationship |
| [`alembic/versions/382a5efa3508_add_confirmation_items.py`](../samples/backend/alembic/versions/382a5efa3508_add_confirmation_items.py) | 新規 | 表を足す |
| [`app/repositories/confirmation.py`](../samples/backend/app/repositories/confirmation.py) | 新規 | `list_for_project`・`save`(部分更新)・`mark_confirmed` |
| [`tests/unit/test_confirmation_repository.py`](../samples/backend/tests/unit/test_confirmation_repository.py) | 新規 | 作成と部分更新・確認済み・プロジェクトごと・一意 |

## 1. 表 `confirmation_items`(内部設計書 3.2節㉑)

- 列: `key`(項目のキー)・`kind`・`label`(保存した時点の表示名)・`opportunity`(NULL = 未設定)・`status`(既定 `unconfirmed`)・`memo`・`updated_by`(SET NULL)・`created_at`・`updated_at`。`UNIQUE(project_id, key)`、プロジェクトの削除で CASCADE。
- 合意の記録(⑳)と違い、**上書きする**表である。決める機会や状態は「今どうなっているか」で、変わった経緯を残す要求は無い(行の履歴は合意の記録で Phase 95)。
- `label` を持つのは、確認済みにして推測でなくなった行が今の一覧から消えた後も、名前を出すためである(94-3)。

## 2. リポジトリ

```python
# app/repositories/confirmation.py(抜粋)
UNSET: object = object()

async def save(self, project_id, item: ConfirmationItem, *, opportunity=UNSET,
               status=UNSET, memo=UNSET, updated_by=None) -> ConfirmationItemRecord
async def mark_confirmed(self, project_id, item, *, updated_by) -> ConfirmationItemRecord
```

- `save` は行が無ければ作り、**渡した欄だけ**変える。決める機会は NULL(未設定に戻す)を渡せるので、「渡さなかった」を `UNSET` で区別する。表示名は今の項目で書き直す。
- `mark_confirmed` は「採用にする」から呼ぶ(94-3)。決める機会・メモは変えない。
- `DocGeneratorService` は、`ConfirmationService` ではなくこのリポジトリを直接使う。`ConfirmationService` が `DocGeneratorService` を使うので、逆向きの import で循環しないようにするためである。

## 3. マイグレーション

- `382a5efa3508`(`956b403c67fe` の次)。表を足すだけで、データの移行は無い(行は利用者が欄を決めたときに作る)。
- 開発 DB で、単一の head と ID の衝突が無いことを確かめてから upgrade し、downgrade → upgrade の往復と `alembic check`(差なし)を流した。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_confirmation_repository.py`(新規) | `ConfirmationRepository` と `ConfirmationItemRecord` の ORM 定義(Project の relationship を含む) | pytest のテスト関数 | スタブ不要 ── 永続化そのものが検証対象のため、テスト用の SQLite のセッションを使う(CASCADE は統合テストで確かめる。94-3) |

- 統合スモーク: `save` で作り、別の欄だけを変えると前の欄が残る。決める機会は None で未設定に戻せる。
- `mark_confirmed` は決める機会・メモを変えない。
- 一覧はプロジェクトごと。同じプロジェクト・同じキーの2行は一意制約で弾く。
- マイグレーションはテストで import せず、開発 DB の往復と `alembic check` で確かめた(Phase 91・92 の表のマイグレーションと同じ)。

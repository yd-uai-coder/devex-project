# Phase-106-4: 巡回で消えた版の戻しの履歴

## この章の目的

再生成で合意の形へ戻した要素は、版の `protection` に残り、要素の履歴(Phase 95)に「合意の形へ戻した」として出る。ところが版は文書の種類ごとに直近3つまで(CR を反映した版・束が写した版を除く)で、古い版を消すと戻しの記録も一緒に消えていた(Phase 95 の決定で「巡回で消えた版は出ない」とした)。この章で、版を消す前に戻しの記録を小さな表へ写し、履歴に残す(着手時の相談 6)。

自動実装モード: on([introduction](./Phase-106-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/models/pruned_protection.py`](../samples/backend/app/models/pruned_protection.py) | 新規。表㉕ `pruned_protections` |
| [`backend/app/models/__init__.py`](../samples/backend/app/models/__init__.py) | `PrunedProtection` を alembic に見せる |
| [`backend/alembic/versions/a9c2e4f6b318_add_pruned_protections.py`](../samples/backend/alembic/versions/a9c2e4f6b318_add_pruned_protections.py) | 新規。表を足すマイグレーション |
| [`backend/app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py) | 巡回で消す前に写す。写しを読む `list_pruned_protections` |
| [`backend/app/services/agreement_service.py`](../samples/backend/app/services/agreement_service.py) | 履歴で残った版と写しを合わせる |
| [`backend/tests/unit/test_agreement_history_service.py`](../samples/backend/tests/unit/test_agreement_history_service.py) | 巡回で消えた版の戻しが履歴に出るテストを足した |

## 1. 表㉕ `pruned_protections`

```python
# app/models/pruned_protection.py(抜粋)
class PrunedProtection(Base):
    __tablename__ = "pruned_protections"
    project_id: Mapped[uuid.UUID]          # FK projects, CASCADE
    doc_type: Mapped[str]
    version: Mapped[int]
    protection: Mapped[list[dict]]         # 消えた版の protection(空は写さない)
    created_at: Mapped[datetime]           # 消えた版を作った日時(履歴の並び)
    pruned_at: Mapped[datetime]
```

- 写すのは戻しの記録だけ(版の md・model は写さない)。版を残すと巡回の意味が無くなる。「戻しのある版を消さない」案は、実 LLM では戻しがよく起きるので版がたまる(相談で比べた)。
- CR の番号は持たない。巡回で消えるのは CR を反映していない版だけだからである。
- 表を足す前に消えた版の分は戻らない(写しを作る元が無い)。マイグレーション `a9c2e4f6b318`。

## 2. 消す前に写す・合わせて読む

```python
# app/repositories/generated_document.py(create_version の抜粋)
for stale in plain[keep_count:]:
    if isinstance(stale.protection, list) and stale.protection:
        self._session.add(PrunedProtection(project_id=..., doc_type=..., version=...,
                                           protection=stale.protection, created_at=stale.created_at))
    await self._session.delete(stale)

# app/services/agreement_service.py(history の抜粋)
versions = await documents.list_protected(project.id, tuple(_DOCUMENT_KINDS))
pruned = await documents.list_pruned_protections(project.id, tuple(_DOCUMENT_KINDS))
# 両方を VersionFacts にして element_history へ(並びは日時で決まる)
```

- 写すのは巡回と同じ場所(`create_version`)。版を消すのはここだけなので、写し漏れが無い。
- 履歴の純粋関数(`app/agreements/history.py` の `element_history`)は変えていない。写しも `VersionFacts` の形にそろえて渡すだけである。

## テスト観点

- `test_agreement_history_service.py`(足した1件)
  - SUT: `GeneratedDocumentRepository.create_version` の巡回での写し・`list_pruned_protections`、`AgreementService.history`。ドライバ: テスト関数。スタブ: DB はインメモリ SQLite を本物のリポジトリで使う(版の削除と写しが検証対象のため)。
  - 戻しのある版・空の戻しの版・戻しの無い版を作り、巡回で3つとも消えるまで版を足す。写しは戻しのある版の1件だけで、履歴にその版の戻し(`dropped`、CR なし)が出る。

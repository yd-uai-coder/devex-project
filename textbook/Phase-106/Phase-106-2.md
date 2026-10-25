# Phase-106-2: CR の反映で確認事項を未確認に戻す

## この章の目的

確認事項の「推測の要件」を確認済みにすると、行は採用になり、確認事項の一覧から消える(Phase 94)。後で CR がその要件を書き換えて反映すると、再生成で行が「推測」に戻ることがある。そのとき確認事項は前の「確認済み」のまま出て、もう一度採用するには「未確認に戻す」を挟む必要があった(Phase 99 の申し送り)。この章で、CR の反映の時点で、文が変わった対象の要件の確認事項を未確認に戻し、どの CR で戻したかを残す(着手時の相談 3)。画面の「CR-n で変わった」は Phase 109。

自動実装モード: on([introduction](./Phase-106-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/confirmations/items.py`](../samples/backend/app/confirmations/items.py) | 文が変わった対象の要件のキー `changed_requirement_keys` を足した |
| [`backend/app/confirmations/__init__.py`](../samples/backend/app/confirmations/__init__.py) | `changed_requirement_keys` を re-export |
| [`backend/app/models/confirmation.py`](../samples/backend/app/models/confirmation.py) | 列 `changed_by_change_request_number` を足した |
| [`backend/alembic/versions/f3b7d9a2c514_add_confirmation_changed_by_change_request.py`](../samples/backend/alembic/versions/f3b7d9a2c514_add_confirmation_changed_by_change_request.py) | 新規。列を足すマイグレーション |
| [`backend/app/repositories/confirmation.py`](../samples/backend/app/repositories/confirmation.py) | 確認済みを未確認に戻す `reopen`。状態を決め直すと番号を消す |
| [`backend/app/schemas/confirmation.py`](../samples/backend/app/schemas/confirmation.py) | 一覧の行に `changed_by_change_request_number` を出す |
| [`backend/app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | CR の反映で `_reopen_confirmations` を呼ぶ |
| [`backend/tests/unit/test_confirmation_items.py`](../samples/backend/tests/unit/test_confirmation_items.py) | `changed_requirement_keys` のテストを足した |
| [`backend/tests/unit/test_confirmation_repository.py`](../samples/backend/tests/unit/test_confirmation_repository.py) | `reopen` のテストを足した |
| [`backend/tests/unit/test_confirmation_service.py`](../samples/backend/tests/unit/test_confirmation_service.py) | 一覧に CR の番号が出るテストを足した |
| [`backend/tests/unit/test_change_request_reflection.py`](../samples/backend/tests/unit/test_change_request_reflection.py) | 反映で戻る流れ(開発者の合意・共有リンクの合意)のテストを足した |

## 1. 文が変わった対象の要件 `changed_requirement_keys`

```python
# app/confirmations/items.py(抜粋)
def changed_requirement_keys(previous, new, requirement_ids) -> list[str]:
    before = {row.id: row.text for row in previous.rows} if previous else {}
    after = {row.id: row.text for row in new.rows} if new else {}
    return [requirement_item_key(i) for i in dict.fromkeys(requirement_ids)
            if i in before and i in after and before[i] != after[i]]
```

- 対象は CR の対象の要件だけ。反映で書き換えてよいのは対象の要件(と予測の画面・API)なので、他の行の文の揺れで確認を外さない。
- 新しい行は前の確認が無いので除く。消えた行も除く。消えた行の項目は一覧に出ないので、記録は確認済みのまま残す(戻すと一覧の外の未確認になって見えなくなり、採用率の数も変わるだけになる。実装中の判断)。

## 2. 戻すことと、戻した印 `reopen`

```python
# app/repositories/confirmation.py(抜粋)
async def reopen(self, project_id, keys, *, change_request_number: int) -> list[str]:
    ...  # status == "confirmed" の行だけ unconfirmed にし、番号を入れる(メモ・決める機会は残す)

# save(抜粋): 状態を渡したら印を消す
if status is not UNSET:
    record.status = status
    record.changed_by_change_request_number = None
```

- 戻すのは確認済みだけ。却下は、クライアントが要らないと決めたことで、文が変わっても決定は変わらない。
- 印(CR の番号)は表㉑の新しい列。利用者が状態を決め直したら消す(メモだけの保存では消さない)。
- マイグレーション `f3b7d9a2c514`(既存の行は NULL)。

## 3. 反映のときに呼ぶ `_reopen_confirmations`

```python
# app/services/doc_generator_service.py(generate の抜粋)
await AgreementService(self._session).record_change_request(...)
if "requirements" in designed:
    await self._reopen_confirmations(project, reflection.change_request,
                                     previous_models.get("requirements"), new_models.get("requirements"))
```

- CR を渡した要件定義書の再生成(反映)で、合意の更新と同じトランザクションで呼ぶ。生成が失敗すれば一緒に戻る。
- `ConfirmationService` からでなく `ConfirmationRepository` を直接使う。`ConfirmationService` は「採用にする」で `DocGeneratorService` を使うので、逆に呼ぶと循環 import になるからである(「採用にする」の `mark_confirmed` と同じ置き場)。
- 共有リンクで合意した CR でも同じに戻す(相談の決定)。再生成の文は案の文と同じとは限らず、確認事項は文書の行についての確認だからである。
- 時点は反映済み(検証済みでない)にした。文が変わるのは反映のときで、検証までの間に「確認済み」のまま出るのを避ける。

## テスト観点

- `test_confirmation_items.py`(足した1件)
  - SUT: `changed_requirement_keys`。ドライバ: テスト関数。スタブ不要 ── 純粋関数で、外部依存を呼ばないため。
  - 対象のうち文が変わった行だけ(対象の順・重複なし)。対象外・同じ文・新しい行・消えた行・前の版が無いときは含めない。
- `test_confirmation_repository.py`(足した1件)
  - SUT: `ConfirmationRepository.reopen`・`save`・`mark_confirmed` の印。ドライバ: テスト関数。スタブ不要 ── 永続化そのものが検証対象のため、テスト用の SQLite を使う。
  - 確認済みだけ戻り番号が残る(決める機会・メモは残る)。却下・行の無いキーは何もしない。メモだけの保存では印は残り、状態を決め直すと消える。
- `test_confirmation_service.py`(足した1件)
  - SUT: `ConfirmationService.view`・`update` とスキーマ `confirmation_list_read`。ドライバ: テスト関数。スタブ不要 ── LLM を呼ばず、DB はテスト用の SQLite。
  - 戻した項目は一覧で番号を出し、決め直すと出さない。
- `test_change_request_reflection.py`(足した2件)
  - SUT: `DocGeneratorService.generate` の CR の反映と `_reopen_confirmations`。ドライバ: テスト関数。スタブ: DB はインメモリ SQLite、文書の生成の LLM は FakeLLM(FR-001 を案の文で書く)。
  - 対象の FR-001 は未確認に戻り CR-1 が残る。対象でない FR-002 は確認済みのまま。共有リンク(`ShareLinkService.decide`)で合意した CR でも戻る。

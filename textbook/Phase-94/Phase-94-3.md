# Phase-94-3: 一覧と更新の API、「採用にする」との接続

## この章の目的

確認事項の一覧を返す API と、項目の欄を変える API を作る。推測の要件・推測の利用者を「確認済み」にしたら、「採用にする」と同じく行を採用にして合意を記録し、逆にプレビューの「採用にする」も一覧の項目を確認済みにする。2つの入口で状態がずれないようにするためである。

自動実装モード: on([introduction](./Phase-94-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `ConfirmationItemNotFoundError`(404) |
| [`app/schemas/confirmation.py`](../samples/backend/app/schemas/confirmation.py) | 新規 | 応答・更新の本文・`confirmation_list_read` |
| [`app/services/agreement_service.py`](../samples/backend/app/services/agreement_service.py) | 更新 | `record_adopt_users`(1.2 全体の合意) |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | `apply_adopt_requirement`・`apply_adopt_user`(commit しない)・採用で確認済みに |
| [`app/services/confirmation_service.py`](../samples/backend/app/services/confirmation_service.py) | 新規 | `view`・`update` |
| [`app/api/routes/confirmations.py`](../samples/backend/app/api/routes/confirmations.py) | 新規 | `GET`・`PATCH /projects/{id}/confirmations` |
| [`app/api/routes/__init__.py`](../samples/backend/app/api/routes/__init__.py) | 更新 | ルーターの登録 |
| [`tests/unit/test_confirmation_service.py`](../samples/backend/tests/unit/test_confirmation_service.py) | 新規 | 組み立てと欄・採用と合意・利用者・プレビューの採用・観点が決まる・404・簡易モード |
| [`tests/integration/test_confirmations_flow.py`](../samples/backend/tests/integration/test_confirmations_flow.py) | 新規 | 実 PostgreSQL で GET・PATCH・CASCADE・モードと所有者 |

## 1. 応答(`app/schemas/confirmation.py`)

```python
# app/schemas/confirmation.py(抜粋)
class ConfirmationItemRead(BaseModel):
    key: str; kind: ConfirmationKind; label: str; refs: list[str]; present: bool
    status: ConfirmationStatus; status_label: str
    opportunity: Opportunity | None; opportunity_label: str | None
    memo: str; updated_at: datetime | None

class ConfirmationListRead(BaseModel):
    items: list[ConfirmationItemRead]; adoption: AdoptionRead

def confirmation_list_read(items, records) -> ConfirmationListRead
```

- 今の一覧の項目に、保存した欄を重ねる(無ければ 未確認・未設定・空)。
- 今の一覧に無くても、状態を決めた行(確認済み・却下)は保存した表示名で後ろに並べる(`present: false`)。採用にした行は推測でなくなって一覧から消えるが、「確認済み」が見えないと採用率の分子が画面から追えないためである(Claude の判断)。未確認のまま消えた行は出さない。
- 更新の本文 `ConfirmationUpdate` は部分更新(`exclude_unset`)。決める機会は null で未設定に戻せ、状態・メモは null にできない(422)。メモの上限は 2000。

## 2. 採用との接続(`DocGeneratorService`・`AgreementService`)

```python
# app/services/doc_generator_service.py(抜粋)
async def adopt_requirement(self, project, req_id, *, recorded_by=None)   # apply + commit
async def apply_adopt_requirement(self, project, req_id, *, recorded_by=None)
async def apply_adopt_user(self, project, user, *, recorded_by=None)
```

- 既存の `adopt_requirement` の中身を、commit しない `apply_adopt_requirement` に移した。確認事項の更新(欄の保存)と採用を1つのトランザクションにするためである。ルートの「採用にする」は今までどおり `adopt_requirement`。
- 採用は、詳細設計モードなら一覧の項目を確認済みにする(`ConfirmationRepository.mark_confirmed`。ユーザー決定「入口をそろえる」)。簡易ドキュメントモードは書かない(合意と同じ)。
- `apply_adopt_user` は推測の利用者を採用にし、`AgreementService.record_adopt_users` で 1.2 **全体**を合意にする(Phase 91 の決定で 1.2 は1つの要素)。ほかの推測の利用者は、合意の中身の中でも推測のまま残り、一覧にも残る。
- 生成中・要件定義書が無いときの確かめは `_requirements_for_adopt` に寄せ、要件と利用者で共有した。

## 3. サービスとルート

```python
# app/services/confirmation_service.py(抜粋)
async def view(self, project) -> ConfirmationListRead
async def update(self, project, key, payload: ConfirmationUpdate, *, updated_by) -> ConfirmationListRead
```

- `view`: 今の要件定義書の model と観点の表から `confirmation_items`(94-1)を作り、保存した行を重ねる。LLM は呼ばない。
- `update`: キーが今の一覧にも保存した行にも無ければ 404 `CONFIRMATION_ITEM_NOT_FOUND`。今の一覧にある推測の要件・利用者を `confirmed` にしたときだけ採用にする。却下・観点・今の一覧に無い項目は欄だけ変える(ユーザー決定。観点の状態はチャットと観点の表で決める)。
- どちらも `require_detailed`(簡易ドキュメントモードは 409。全入口を断る、決定9)。
- ルート: `GET /projects/{id}/confirmations`、`PATCH /projects/{id}/confirmations/{key:path}`(キーに `:` を含むため path 変換子)。応答はどちらも一覧全体(観点の表の PUT と同じ型。画面は応答で置き換えるだけでよい)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_confirmation_service.py`(新規) | `ConfirmationService`・`DocGeneratorService` の採用・`AgreementService.record_adopt_users`・`confirmation_list_read`・`ConfirmationUpdate`・エラー・ルートの登録(アプリの OpenAPI) | pytest のテスト関数 | スタブ不要 ── LLM を呼ばない経路だけ。DB はインメモリ SQLite(`db_session`)を本物のリポジトリで使う |
| `test_confirmations_flow.py`(新規・統合) | `GET`・`PATCH` のルートから DB まで、プロジェクトの削除での CASCADE | httpx の AsyncClient | スタブ不要 ── LLM を呼ばない。利用者・プロジェクト・文書はセッションで直接作る |

- 統合スモーク: GET で項目が「推測の要件 → 推測の利用者 → 観点」に並び、欄はすべて未確認・未設定。
- 推測の要件を確認済みにすると、文書の行が採用になり、合意 `adopt` が1件でき、項目は `present: false`・確認済みで残る。採用率は 1.0。
- 推測の利用者を確認済みにすると、1.2 の行が採用になり、合意 `users` に 1.2 全体が入る。
- 観点の欄・却下は文書と観点の状態を変えない。観点が決まると、未確認のまま一覧から消える。
- プレビューの「採用にする」で項目が確認済みになる。簡易モードは一覧・更新とも 409 で、採用しても一覧に書かない。
- 既存の `test_agreement_recording.py`(「採用にする」の記録)が、採用を `apply_adopt_requirement` に分けたリファクタの番人。

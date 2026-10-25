# Phase-105-3: 推測の利用者に ID を振る

## この章の目的

確認事項の推測の利用者は、1.2 の行に ID が無いので、名前をキーにしていた(`user:<名前>`。Phase 94)。再生成で LLM が名前を言い換えると別の項目になり、前の名前の項目の決める機会・メモは未確認のまま一覧から消える。この章で、1.2 の行に ID(`U-001`)を振り、要件と同じく前の版の ID を引き継ぐ。確認事項のキーは `user:<ID>` にし、名前を言い換えても欄が残るようにする。md(1.2 の表)と合意の比べる値は変えない。

自動実装モード: on([introduction](./Phase-105-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/documents/requirements/model.py`](../samples/backend/app/documents/requirements/model.py) | `UserScene.id`・`USER_PREFIX`・ID の無い利用者に番号を振る `number_users` と validator |
| [`backend/app/documents/requirements/assemble.py`](../samples/backend/app/documents/requirements/assemble.py) | 利用者の ID の引き継ぎ `assign_user_ids`、`mark_user_adopted` を ID で指す |
| [`backend/app/documents/requirements/__init__.py`](../samples/backend/app/documents/requirements/__init__.py) | `USER_PREFIX`・`assign_user_ids`・`number_users` を re-export |
| [`backend/app/documents/requirements/drafting.py`](../samples/backend/app/documents/requirements/drafting.py) | 利用者の `prev_id`、プロンプトの「前の版の利用者」の節 |
| [`backend/app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | E2E の偽の LLM が、前の版の利用者の ID を `prev_id` で指す |
| [`backend/app/agreements/items.py`](../samples/backend/app/agreements/items.py) | 利用者の比べる値から `id` を除いた |
| [`backend/app/agreements/protection.py`](../samples/backend/app/agreements/protection.py) | 1.2 を合意の形に戻すときの ID |
| [`backend/app/confirmations/items.py`](../samples/backend/app/confirmations/items.py) | 推測の利用者のキーを ID に、`legacy_user_keys` |
| [`backend/app/confirmations/__init__.py`](../samples/backend/app/confirmations/__init__.py) | `legacy_user_keys` を re-export |
| [`backend/app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | `apply_adopt_user` を ID で指す |
| [`backend/app/services/confirmation_service.py`](../samples/backend/app/services/confirmation_service.py) | ID を振る前の記録のキーの付け直し |
| [`frontend/src/features/confirmations/api/confirmationsApi.ts`](../samples/frontend/src/features/confirmations/api/confirmationsApi.ts) | キーの形のコメントだけ直した(動作は同じ) |
| [`backend/tests/unit/test_requirements_doc.py`](../samples/backend/tests/unit/test_requirements_doc.py) | 次の番号に利用者の分(`U`)が入る |
| [`backend/tests/unit/test_agreement_protection.py`](../samples/backend/tests/unit/test_agreement_protection.py) | ID を比べない・ID の無い合意に戻すときの ID |
| [`backend/tests/unit/test_requirements_protection_flow.py`](../samples/backend/tests/unit/test_requirements_protection_flow.py) | 言い換えた 1.2 が、合意の形と前の版の ID に戻る流れ |
| [`backend/tests/unit/test_confirmation_items.py`](../samples/backend/tests/unit/test_confirmation_items.py) | ID の振り方・引き継ぎ・キー・言い換えでキーが変わらない |
| [`backend/tests/unit/test_confirmation_service.py`](../samples/backend/tests/unit/test_confirmation_service.py) | 名前が変わってもメモが残る・古いキーの付け直し |
| [`backend/tests/unit/test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py) | 偽の LLM が前の版の利用者の ID を指す |

## 1. 利用者の ID `model.py`

```python
# app/documents/requirements/model.py(抜粋)
USER_PREFIX = "U"


class UserScene(BaseModel):
    id: str = ""          # U-001(空 = まだ振っていない)
    user: str
    scene: str
    source: RequirementSource


class RequirementsModel(BaseModel):
    ...
    @model_validator(mode="after")
    def _number_users(self) -> Self:
        if all(u.id for u in self.users):
            return self
        self.users, self.next_seq = number_users(self.users, self.next_seq)
        return self


def number_users(users, next_seq, known=()) -> tuple[list[UserScene], dict[str, int]]: ...
```

- 相談の決定3。名前の照合の規則(敬称・括弧を除くなど)では、LLM の言い換えの幅に追いつけない。要件と同じく ID を振り、LLM には前の版の ID を指させる方が、照合の規則が1つで済む。
- ID の形は要件・画面と同じ `seq_id`(`U-001`)。次の番号は要件と同じ `next_seq` に `U` で持つ(消えた番号を使い回さない)。計画では `U-01` と書いたが、既存の採番の関数にそろえた。
- ID は DB の列ではなく、文書の model の JSON の中にある。ID を振る前に保存した版には ID が無いので、`RequirementsModel` の validator が読むときに並び順で振る。同じ版は読むたびに同じ ID になる。そのため DB のマイグレーションは要らない。
- md(1.2 の表)には ID を出さない。クライアントが読む文書に、照合のための番号を足さないため。開発 DB のすべての版の md が変わらないことを確かめた(introduction の検証結果)。

## 2. ID の引き継ぎ `assign_user_ids` と、プロンプト `drafting.py`

```python
# app/documents/requirements/assemble.py(抜粋)
def assign_user_ids(drafts, previous) -> tuple[list[str], int]:
    # 1段目: prev_id が前の版に在り、まだ使われていなければ引き継ぐ
    # 2段目: 当たらなかった行は、前の版の使われていない行のうち、同じ名前の行、
    #        無ければ同じ場面の文の行が1つだけのとき引き継ぐ
    # 残り: 次の番号
```

```python
# app/documents/requirements/drafting.py(抜粋)
class GeneratedUserScene(BaseModel):
    prev_id: str = Field(default="", description="【前の版の利用者】に同じ利用者がいれば、その ID ...")
    ...

def previous_users_text(previous) -> str:   # U-001|利用者: 場面 の行
```

- AI には ID を書かせず、前の版の ID を指させる(要件の `prev_id` と同じ契約)。プロンプトに「前の版の利用者」の節を足し、規則にも1文足した(`REVISION` の前の版の節にも入れた)。
- AI が指さなかったときの2段目は、段階1 の API でない処理の引き継ぎ(Phase 99 の調整)と同じ考え方。名前で当たればその行、言い換えて当たらなければ場面の文で当たる行が1つだけのときに引き継ぐ。候補が2つ以上なら、取り違えを避けて新しい ID にする。
- 1段目をすべて決めてから2段目に入る(2段目が、後の行の `prev_id` で引き継ぐはずの行を先に取らないように。`merge_draft` と同じ)。
- E2E の偽の LLM は、前の版の利用者の節を読み、言い換えの語を外した名前で ID を指す(`_previous_user_ids`)。実 LLM に頼む「言い直しただけの利用者も同じ利用者」と同じ動きにした。

## 3. 合意の比べる値と保護 `items.py`・`protection.py`

```python
# app/agreements/items.py(抜粋)
if kind == "users":
    users = [
        UserScene.model_validate(u).model_dump(mode="json", exclude={"id"})
        for u in content["users"]
    ]
```

```python
# app/agreements/protection.py(抜粋)
users, next_user_seq = number_users(
    [UserScene.model_validate(u) for u in agreed_users["users"]],
    model.next_seq,
    [*model.users, *(previous.users if previous else [])],
)
```

- 1.2 は全体で1つの合意の要素(`users`。Phase 91)。比べる値に `id` を入れると、ID を振る前の合意(`id` の無い中身)が、すべて「合意と違う」になる。ID は照合のための番号で、クライアントと合意した中身ではないので除いた。
- 合意の形に戻すとき、合意の中身に ID があればそれを使う。無ければ(ID を振る前の合意)、今の版・前の版の同じ名前の行の ID を引き継ぐ(`number_users` の `known`)。名前が合意の名前に戻るので、名前で当たる。

## 4. 確認事項のキー `confirmations/items.py`・`confirmation_service.py`

```python
# app/confirmations/items.py(抜粋)
def user_item_key(user_id: str) -> str: ...            # user:U-001
def user_item(scene: UserScene) -> ConfirmationItem:   # キーは ID、表示名は「名前: 場面」のまま
def legacy_user_keys(model) -> dict[str, str]: ...     # user:<名前> → user:<ID>
```

```python
# app/services/confirmation_service.py(抜粋)
async def view(self, project):
    model = await self._requirements_model(project)
    if await self._rekey_legacy_users(project, model):
        await self._session.commit()
    ...
```

- キーは `user:<ID>`。表示名は今までどおり「名前: 場面」で、名前が変われば表示名は新しい名前になり、決める機会・メモ・状態は同じ項目に残る。
- 推測の利用者を確認済みにすると採用にする経路(`apply_adopt_user`・`mark_user_adopted`)も ID で指す。
- ID を振る前の記録(`user:<名前>`)は、一覧を開いたとき(更新の前にも)、今の要件定義書の同じ名前の行の ID のキーに付け直す。付け直すのは1回だけで、その後は新しいキーで読む。一覧の GET で書き込むのは、付け直したときだけ(Claude の判断。マイグレーションで文書の JSON を読んで付け直すより、読む側の1か所で済む)。新しいキーの行が既にあれば付け直さない。今の一覧に無い名前の記録(確認済み・却下で一覧から消えたもの)は、そのまま後ろに並ぶ。
- 一覧の重複の除き方も、名前でなく ID にした(同じ名前の2行は2つの項目になる)。
- devex-ui は、キーを符号化して URL に入れるだけなので、コードは変えていない。キーの形を書いたコメントだけを直した。

## テスト観点

- `test_confirmation_items.py`
  - SUT: 確認事項の項目とキー、`legacy_user_keys`、利用者の ID(`UserScene.id`・`number_users`・`assign_user_ids`・`build_model`)、言い換えた出力(`paraphrase_requirements`)。ドライバ: テスト関数。スタブ不要 ── 純粋関数で、LLM・DB を呼ばないため。
  - ID の無い版は読むたびに並び順で同じ ID。`known` の同じ名前の ID を引き継ぎ、次の番号は越える。
  - 引き継ぎは `prev_id` → 名前 → 場面の順で、場面の候補が2つなら引き継がない。
  - 言い換えた再生成の出力(`prev_id` を書かない)でも、確認事項のキーは変わらない。
- `test_confirmation_service.py`(足した2件・直した2件)
  - SUT: `ConfirmationService`(付け直しを含む)と `apply_adopt_user`。ドライバ: テスト関数。スタブ不要 ── LLM を呼ばない経路で、DB はテスト用の SQLite を本物のリポジトリで使う。
  - 新しい版で名前が変わっても(ID は同じ)、メモが同じ項目に残り、表示名は新しい名前。
  - `user:<名前>` の記録は、一覧を開くと `user:U-002` に付け直され、メモが今の項目に出る。
- `test_agreement_protection.py`(足した1件・直した1件)
  - SUT: `protect_requirements` の利用者と `body_of`。ドライバ: テスト関数。スタブ不要 ── 純粋関数のため。
  - ID の無い合意は、ID のある今の版と「違う」にならない。名前の変わった 1.2 を ID の無い合意に戻すと、前の版の同じ名前の ID になる。
- `test_requirements_protection_flow.py`(足した1件)
  - SUT: `DocGeneratorService.generate` の要件定義書の生成(ID の引き継ぎ・保護・プロンプト)。ドライバ: テスト関数。スタブ: DB はインメモリ SQLite、LLM は FakeLLM(利用者を言い換えた見本を返し、プロンプトを記録する)。
  - 束で合意した後に言い換えた出力で作り直しても、1.2 は合意の名前と前の版の ID に戻る。プロンプトに前の版の利用者が ID 付きで入る。
- `test_requirements_doc.py`(直した1件): 組み立ての次の番号に `U` が入る。
- `test_fake_llm_e2e.py`(直した1件): 印の無いプロジェクトの作り直しで、偽の LLM が前の版の利用者の ID を `prev_id` で指す。
- `confirmationsApi.ts` はコメントだけの変更で、動作が変わらないのでテストは足していない(#15 の例外。introduction に記す)。

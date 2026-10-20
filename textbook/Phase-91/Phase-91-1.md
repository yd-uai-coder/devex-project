# Phase-91-1: 合意の対象の要素(純粋関数)

## この章の目的

合意の記録が「何を単位に、何を写すか」を、DB に触らない純粋関数で決める。要件定義書・外部設計書の model から、合意の対象の要素(要件・利用者と使う場面・画面・API・外部連携)を作り、キー・表示名・中身をそろえる。キーは変更影響分析の要素のキーと同じにし、CR の予測・印・比較と照合できるようにする([90-1](../Phase-90/Phase-90-1.md) の Claude の判断)。出どころの名前(`B-1`・`採用にする`・`CR-1`)もここで決める。

自動実装モード: on([introduction](./Phase-91-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/agreements/items.py`](../samples/backend/app/agreements/items.py) | 新規 | `AgreedItem`・`agreement_items`・`body_of`・`integration_key`・`removed_keys` |
| [`app/agreements/origins.py`](../samples/backend/app/agreements/origins.py) | 新規 | `AgreementOrigin`・`origin_label` |
| [`app/agreements/__init__.py`](../samples/backend/app/agreements/__init__.py) | 新規 | 2つのモジュールの re-export |
| [`tests/unit/test_agreement_items.py`](../samples/backend/tests/unit/test_agreement_items.py) | 新規 | 並び順・変更影響分析とのキーと比べる値の一致・既定値・外れたキー・出どころの名前 |

## 1. パッケージの形

```python
# app/agreements/__init__.py(抜粋)
from app.agreements.items import (AGREED_KINDS, USERS_KEY, USERS_LABEL, AgreedItem, AgreedKind,
                                  agreement_items, body_of, integration_key, removed_keys)
from app.agreements.origins import ADOPT_LABEL, AGREEMENT_ORIGINS, AgreementOrigin, origin_label
```

- `app/change_requests`・`app/detailed_design/impact` と同じく、ドメインの純粋関数の置き場にした(devex-api の [CLAUDE.md](../../devex-api/CLAUDE.md) のレイヤー構成)。サービス・リポジトリはここを読む。
- 依存の向き: `items` → `app.documents.*.model`・`app.detailed_design.api_list.endpoint_key`。`origins` は何も読まない。

## 2. 要素とキー

```python
# app/agreements/items.py(抜粋)
AgreedKind = Literal["requirement", "users", "screen", "api", "integration"]
USERS_KEY = "users"

@dataclass(frozen=True)
class AgreedItem:
    key: str; kind: AgreedKind; label: str
    content: dict[str, Any]          # 行の model の写し(users は {"users": [...]})

def agreement_items(requirements: RequirementsModel | None,
                    external_design: ExternalDesignModel | None) -> list[AgreedItem]
```

| 要素 | キー | 表示名 |
|---|---|---|
| 要件(FR / NFR / CON) | `req:FR-001` | `FR-001 本文` |
| 利用者と使う場面(1.2) | `users`(全体で1つ) | `利用者と使う場面` |
| 画面 | `screen:SCR-001` | `SCR-001 画面名` |
| API | `api:GET /api/v1/x/{}`(`endpoint_key`) | `GET /api/v1/x/{id}` |
| 外部連携(2.4) | `integration:<サービス名>` | サービス名 |

- **要件・画面・API は変更影響分析の要素のキー**(`app/detailed_design/impact/elements.py` の `add_document_elements`)。テストで `build_elements` のキーと突き合わせる。
- **利用者と使う場面は1つのキー**(ユーザー決定): 行に ID が無く、要件とも結ばないので、1.2 全体を1つとして合意する。
- **外部連携は行ごと**(ユーザー決定): `req_ids` で要件と結ぶので、行ごとにして CR の予測と照合しやすくする。サービス名の前後の空白は除き、空の名前は要素にしない。
- **並び順は文書の順**(要件 → 利用者 → 画面 → API → 外部連携)。同じキーが2回出たら最初のものを残す(変更影響分析の `ElementBuilder.add` と同じ)。
- **中身は写す**: 版を指すだけにしないのは、版が巡回で消えうるため(束が写しを持つのと同じ考え)。

## 3. 比べる値と、外れたキー

```python
def body_of(kind: AgreedKind, content: dict[str, Any]) -> str      # 既定値をそろえ、キーの欄を除いた JSON
def removed_keys(agreed_keys: Iterable[str], items: Iterable[AgreedItem]) -> list[str]
```

- **`body_of` は行の model で読み直してから比べる**: 保存した形(移行で写した行など)は既定値の欄が欠けていることがある。読み直して既定値をそろえ、キーの欄(要件・画面は `id`、API は `method`・`path`、外部連携は `service`)を除く。変更影響分析の要素の `body`(`row_body`)と同じ形なので、Phase 92 以降の「合意と今の比較」・予測との照合に使える。この Phase では、移行の突き合わせ([91-5](./Phase-91-5.md))が使う。
- **`removed_keys`**: 今の合意にあって、新しく合意する要素に無いキー。束を作るとき、束に入らなかった要素を「外れた」と記録するために使う([91-3](./Phase-91-3.md))。

## 4. 出どころ

```python
# app/agreements/origins.py(抜粋)
AgreementOrigin = Literal["baseline", "adopt", "change_request"]
def origin_label(origin, *, baseline_number=None, cr_number=None) -> str   # "B-2" / "採用にする" / "CR-3"
```

- `change_request` は Phase 93(CR の反映での合意の更新)で書く。この Phase では型と名前だけを用意した。

## テスト観点

この Phase の最初の章なので、用語を1行で定義する。SUT はテストの対象、ドライバはテストの対象を呼ぶもの、スタブ(テストダブル)は対象が呼ぶ外部依存の代わり。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_agreement_items.py`(新規) | `agreement_items`・`body_of`・`integration_key`・`removed_keys`・`origin_label` と2つの表 | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |

- 文書の並び順のキー・表示名・中身 / 要件・画面・API のキーと比べる値が、変更影響分析の要素(`build_elements`)と一致 / 文書が無ければ空 / 欠けた欄は既定値でそろい、キーの欄は比べない / 外部連携のキーと外れたキー / 出どころの名前。
- 題材は既存の `tests/fixtures/change_impact.py` の `impact_documents`(予約の設計)に、利用者と外部連携を足したもの。

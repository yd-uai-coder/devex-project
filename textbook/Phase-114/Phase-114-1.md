# Phase-114-1: 違いの取り出しの純粋関数(一覧・入力・検査・やり直し)

## この章の目的

資料1件と最新の束を比べて違いを拾う処理のうち、DB にも LLM にも触らない部分を純粋関数にする。束の合意の要素を LLM に渡す一覧の形、LLM に返させる構造化出力の形、返った違いの決定的な検査(引用・対象のキー・種類と対象の組み合わせ)、取り出しをやり直したときの重なりの除き方を決める。ベースライン([111-2](../Phase-111/Phase-111-2.md))で分かった「対象が自由文」「根拠を確かめられない」の2つを、この章の検査で埋める(残る「回ごとに揺れる」は Phase 117 で測る)。

自動実装モード: on([introduction](./Phase-114-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/materials/differences.py`](../samples/backend/app/materials/differences.py) | 新規 | 種類・状態・一覧・入力・構造化出力・検査・やり直し |
| [`app/materials/__init__.py`](../samples/backend/app/materials/__init__.py) | 新規 | パッケージの re-export |
| [`tests/unit/test_material_differences.py`](../samples/backend/tests/unit/test_material_differences.py) | 新規 | 純粋関数のテスト |

パッケージと依存の向き:

```
app/materials/__init__.py ──re-export──▶ app/materials/differences.py
app/materials/differences.py ──▶ app/agreements/items.py(agreement_items・AgreedItem)
                             ──▶ app/detailed_design/impact/elements.py(parse_model)
                             ──▶ app/documents/{requirements,external_design}/model.py
```

`app/materials/` は資料の取り込みのドメインの新しいパッケージ(`app/change_requests/` と同じく、純粋関数だけを置く)。CR の側(`app/change_requests/`)には依存しない ── CR へのつなぎは Phase 115 で、こちらから CR を呼ぶのではなく、サービスが違いを CR の入口に渡す。

## 1. 種類と状態

```python
# app/materials/differences.py(抜粋)
DifferenceKind = Literal["add", "change", "delete", "question"]          # 追加・変更・削除・確かめる点
DifferenceStatus = Literal["unconfirmed", "rejected", "converted", "dismissed"]
REPLACED_STATUSES = ("unconfirmed", "rejected")    # やり直しで置き換える(人が判断していないもの)
```

- **確かめる点**(着手時の決定3): 未決・資料どうしの食い違い。CR にはしない。確かめた後に「捨てた」と同じ状態で閉じる(画面の表示は Phase 116 で「閉じた」)。
- **CR にした**(`converted`)は Phase 115 が使う。この Phase では、やり直しで残す状態として決めておく。

## 2. 束の合意の要素の一覧(LLM に渡す形)

```python
# app/materials/differences.py(抜粋)
@dataclass(frozen=True)
class AgreedListing:
    text: str                 # 「キー | 名前 | 中身」の行と、参考(目的・範囲)
    keys: frozenset[str]      # 対象・起点に選べるキー

def agreed_listing(snapshots: Mapping[str, Mapping[str, Any] | None]) -> AgreedListing
```

```
# 合意済みの要素(キー | 名前 | 中身)

- req:FR-001 | 要件 FR・Must | 予約を登録できる
- users | 利用者と使う場面 | 利用者: 席を予約する
- screen:SCR-001 | 画面 予約画面 | 要件: FR-001, FR-002
- api:POST /api/v1/reservations | API | 画面: SCR-001 / 要件: FR-001
- integration:SendGrid | 外部連携 SendGrid | 目的: メール

# 参考(キーは無い。対象にしない)

- 目的: 予約を受け付ける
- 範囲の外: 決済
```

- **合意の要素だけを対象に**(着手時の決定1): 要素は Phase 91 の合意の記録と同じ `agreement_items`(要件・利用者と使う場面・画面・API・外部連携)で、キーも同じ。行ごとにキーを書かせるので、LLM の出力をキーで検査できる(md をそのまま渡すと、LLM にキーを正しく書かせにくい)。
- **範囲と目的は参考**: 1.3 の In / Out of Scope は合意の要素ではない(キーが無い)が、「範囲の外だった過去の閲覧を入れたい」(セット A の G8)を追加として拾うために添える。
- **段階は渡さない**: 処理・データはクライアントの言葉に出ず、CR の対象も要件なので。
- 写しの model は `parse_model` で読む(読めない文書は無いものとして扱う。反映の前 → 後と同じ)。

## 3. 入力と構造化出力

```python
# app/materials/differences.py(抜粋)
class DifferenceItemOut(BaseModel):
    kind: DifferenceKind
    target_key: str = ""     # 変更・削除の対象(一覧のキー)
    origin_key: str = ""     # 追加の起点(つながる合意の要素のキー)
    content: str             # 何がどう違うか
    quote: str               # 資料の連続した1か所をそのまま

class DifferenceListOut(BaseModel):
    differences: list[DifferenceItemOut] = []

@dataclass(frozen=True)
class MaterialFacts:         # 資料の種類のラベル・題・日付・本文
    ...

def build_difference_messages(listing: AgreedListing, material: MaterialFacts) -> list[BaseMessage]
```

- プロンプト(`DIFFERENCE_SYSTEM_PROMPT`)は、ベースラインで揺れた点を名指しで書く: 撤回・済み・言い換え・日程・合意済みの内容どうしの食い違いを挙げない、結論が出ていない話は question にする、引用は「…」で省かずそのまま。
- 生成の用途の LLM を1回(111-1 の決定8)。呼ぶのは 114-2 のサービス。

## 4. 決定的な検査

```python
# app/materials/differences.py(抜粋)
@dataclass(frozen=True)
class CheckedDifference:
    kind; target_key; origin_key; content; quote
    reasons: tuple[str, ...] = ()        # 空なら通った
    status -> DifferenceStatus           # reasons があれば rejected、無ければ unconfirmed
    identity -> tuple[str, str, str]     # 種類・対象・正規化した引用(やり直しの重なり)

def normalize_quote(text: str) -> str          # NFKC・空白と改行・md の記号を除く
def quote_found(quote: str, body: str) -> bool
def resolve_key(raw: str, keys: Iterable[str]) -> str
def check_difference(item, listing, body) -> CheckedDifference
def check_differences(out, listing, body) -> list[CheckedDifference]   # 上限50件、出てきた順
```

| 検査 | 弾く理由(`reasons`) |
|---|---|
| 内容 | `内容が空` |
| 引用(着手時の決定2) | `引用が無い` / `引用が資料に無い` / `引用を省略でつないでいる`(「…」「...」を含み、本文に無い)/ `引用が短すぎる`(正規化後6文字未満) |
| 対象 | `変更に対象が無い`・`削除に対象が無い` / `追加に対象がある(新しいものは起点で示す)` / `対象 X が束に無い` |
| 起点 | `起点 X が束に無い` |

- **引用の正規化**: 引用と本文の両方を NFKC で全角・半角をそろえ、空白・改行と md の記号(`*` `_` `~` `` ` `` `#` `>`)を除いて、部分一致を見る。ベースラインで LLM が「**6時間ごと**」の `**` を落としたこと、メールの引用(`>`)や改行をまたぐ引用を想定した。前後に付けた「」も外して見る。実 LLM でも、`**` を残した引用・落とした引用のどちらも通った(introduction の検証結果)。
- **対象のキーの補い**(Claude の判断): LLM が `FR-001` と接頭辞を落とすことがある。`req:`・`screen:`・`api:`・`integration:` を補って一つに決まればそのキーにする(二つに当たれば決めず、そのまま弾く)。
- **起点**は追加のときだけ持ち(ほかの種類の起点は捨てる)、束の合意の要素のどれでもよい。当初は CR の起点に合わせて要件・画面・API に限ったが、実 LLM が「海外の取引先も使う → 英語の切り替え」の追加を `users` に結び、それが弾かれた。違いとしては正しいので、合意の要素ならどれでも通すことにした(Claude の判断。CR の起点へのつなぎは Phase 115 の未確定事項に足した)。
- 文は上限で切る(内容・引用は1,000文字、キーは300文字)。表の列に収めるため。

## 5. やり直しの重なり

```python
# app/materials/differences.py(抜粋)
def fresh_differences(new: Sequence[CheckedDifference], kept: Iterable[CheckedDifference]) -> list[CheckedDifference]
```

- 着手時の決定4: やり直すと、未確認と弾いたは新しい結果に置き換え、CR にした・捨てたは残す。新しい結果のうち、残した違いと**種類・対象・正規化した引用**が同じものは足さない(捨てた違いが毎回戻らないように)。同じ回の中の重なりも除く。
- 内容(`content`)は同じかを見る値に入れない ── LLM は回ごとに言い回しを変えるが、根拠と対象が同じなら同じ違いとみなす。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_material_differences.py`(新規)の10本 | `agreed_listing`・`build_difference_messages`・`normalize_quote`・`quote_found`・`resolve_key`・`check_difference`・`check_differences`・`fresh_differences`(`app.materials` の re-export から) | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で、DB にも LLM にも触らないため。束の写しは dict(`impact_documents` に範囲・利用者・外部連携を足したもの)、LLM の出力は `DifferenceListOut` で直接渡す |

- 一覧: 5種類の要素の行の形・参考の範囲・選べるキー(利用者と外部連携も)・文書の無い束は空。
- 入力: system に種類の説明、human は一覧 → 資料の見出し(種類・題・日付)→ 本文。
- 引用: 全角・空白・改行・`**`・`>` をまたいでも当たる。前後の「」を外す。違う文・空は当たらない。弾く4つの理由。
- キー: 接頭辞の補いは一つに決まるときだけ。
- 種類と対象: 変更 / 削除の対象なし・束に無い対象・対象つきの追加・起点(画面・利用者は通る、束に無いものは弾く)・確かめる点は対象なしで通る・起点は追加だけに残る。
- やり直し: 捨てた違いと同じもの(`**` の有無だけ違う引用)・同じ回の前の方と同じもの(空白だけ違う)を除き、種類が違えば残す。

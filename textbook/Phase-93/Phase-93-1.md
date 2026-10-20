# Phase-93-1: 外部設計書の要素を合意の形へ戻す純粋関数

## この章の目的

再生成で作った外部設計書の model を合意の記録に照らし、合意済みの画面・API・外部連携を合意の形に戻す。[92-1](../Phase-92/Phase-92-1.md) の要件の行と同じ規則にそろえ、その中身(置き換え・重複の除去・前の版の位置への戻し)は、一覧の種類によらない形にして共有する(#17)。DB にも LLM にも触らない純粋関数なので、規則は素のテストで確かめる。

自動実装モード: on([introduction](./Phase-93-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/agreements/protection.py`](../samples/backend/app/agreements/protection.py) | 更新 | `protect_external_design`・`agreed_external_ids`(`AgreedExternalIds`)・共有の `_protect_rows` |
| [`app/agreements/__init__.py`](../samples/backend/app/agreements/__init__.py) | 更新 | 上の3つの re-export |
| [`tests/unit/test_external_design_protection.py`](../samples/backend/tests/unit/test_external_design_protection.py) | 新規 | 書き換え・脱落の位置・同じ名前の重複・免除・外部連携・次の番号・素通し |

## 1. 戻す関数

```python
# app/agreements/protection.py(抜粋)
def protect_external_design(model: ExternalDesignModel, previous: ExternalDesignModel | None,
                            agreed: Mapping[str, dict[str, Any]], *,
                            exempt: frozenset[str] = frozenset()
                            ) -> tuple[ExternalDesignModel, list[Restored]]

class AgreedExternalIds(NamedTuple):
    screen_ids: frozenset[str]; endpoints: frozenset[str]; services: frozenset[str]

def agreed_external_ids(agreed: Mapping[str, Any], exempt: frozenset[str]) -> AgreedExternalIds
```

- **要素の同一性はキーで決める**(Claude の判断): 画面は画面 ID(`screen:SCR-001`)、API は `endpoint_key`(`api:GET /api/v1/x/{}`。変更影響分析と同じキーで、パスの引数名を問わない)、外部連携はサービス名(`integration:<サービス名>`)。Phase 91 の合意のキーと同じである。
- **戻す範囲は要素のすべての欄**: 比べるのは Phase 91 の `body_of`(キーになる欄を除いた正規化した JSON)。92-1 と同じ理由で、戻した要素は変更影響分析でも「変わっていない」になる。
- **戻さないもの**: システム構成概要・画面遷移・データ入出力は合意の対象ではないので、LLM が書いたまま。
- **ID の付け直しの重複**(90-4 の Phase 93 の未確定事項「ID の付け直しの照合」): 合意済みの画面と同じ名前(前後の空白を除く)の、合意の無い新しい画面を除く。合意済みの画面は ID で戻すので、付け直した側を落とせば元の ID に戻る。要件の行の「同じ文」と同じ扱いである。API はキーがメソッドとパスなので付け直しが起きない。外部連携は、サービス名の言い換えは決定的に見分けられないので残し、93-2 のプロンプトの節で起きにくくする。
- **落ちた要素の位置**: 前の版で直前にあった要素(今もあるもの)の後。画面・API・外部連携は、要件の FR / NFR / CON のような種別を持たないので、一覧全体を1つの種別とみなす。
- **次の番号**: 戻した画面の ID を、画面の `next_seq`(`SCR`)が越えるようにする。
- **`AgreedExternalIds`**: 93-2 のプロンプトの印に使う。文書の側(`app/documents`)は合意のキーの形を知らないので、行の値(画面 ID・`endpoint_key`・サービス名)で渡す。`app/documents` から `app/agreements` への逆向きの依存は作らない(92-1 と同じ)。

## 2. 共有した部品

```python
# app/agreements/protection.py(抜粋)
def _protect_rows[Row: BaseModel](rows, previous, agreed_rows, kind, *, key_of,
                                  group_of=lambda _: "", duplicate_of=None
                                  ) -> tuple[list[Row], list[Restored], list[Row]]
```

- 92-1 の `protect_requirements` の中身(置き換え → 重複の除去 → 前の版の位置へ戻す)を、行の型・キー・種別・重複の値を引数にとる形に寄せた。消費者は `protect_requirements` と `protect_external_design`(要件・画面・API・外部連携の4つの一覧)。
- `_in_previous_order`・`_insert_at`・`_next_seq` も、キーと種別を引数にとるように直した。要件定義書の挙動は変えていない(92-1 のテストがそのまま通る)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_external_design_protection.py`(新規) | `protect_external_design`・`agreed_external_ids`(`AgreedExternalIds`) | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため。合意は `agreement_items`(Phase 91)で束の作成と同じ形に作る |

- 統合スモーク: 合意と同じ model はそのまま返る(同じオブジェクト・戻したものなし)。
- 画面と API の書き換え → 置き換え(`changed`)。概要は書いたまま。
- 真ん中の画面・先頭の API・先頭の外部連携の脱落 → 前の版の位置に戻る(`dropped`)。
- 画面 ID だけを付け直した画面(同じ名前)→ 除いて、合意の ID に戻る。
- 戻した画面の ID を `next_seq` が越える。
- 免除(保存した予測の画面・API)は戻さない。外部連携は免除に入らないので戻る。
- 合意の無い新しい API・外部連携は残る。
- API のパスの引数名だけの違いは、同じ要素として扱う。
- `agreed_external_ids` は要件・利用者・免除のキーを除く。
- 既存の `test_agreement_protection.py`(92-1)が、共有にした部品の番人(要件定義書の挙動を変えていないこと)。

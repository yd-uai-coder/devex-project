# Phase-115-1: 違いから CR の下書きを組み立てる純粋関数

## この章の目的

資料から取り出した違い(Phase 114)を、開発者が選んで1つの CR の下書きにするとき、DB にも LLM にも触らずに決まる部分を純粋関数にする。違いの対象(合意の要素のキー)から CR の対象(要件の行)をどう選ぶか、追加の起点を CR の起点にどう写すか、題・内容・背景をどう組み立てるかを決める。

自動実装モード: on([introduction](./Phase-115-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/materials/drafting.py`](../samples/backend/app/materials/drafting.py) | 新規 | つながる要件・対象の候補・起点の写し・下書きの組み立て |
| [`app/materials/__init__.py`](../samples/backend/app/materials/__init__.py) | 更新 | drafting の re-export |
| [`tests/unit/test_material_drafting.py`](../samples/backend/tests/unit/test_material_drafting.py) | 新規 | 純粋関数のテスト |

パッケージと依存の向き:

```
app/materials/__init__.py ──re-export──▶ app/materials/differences.py(Phase 114)
                          ──re-export──▶ app/materials/drafting.py
app/materials/drafting.py ──▶ app/materials/differences.py(DIFFERENCE_KIND_LABEL・DifferenceKind)
                          ──▶ app/agreements/items.py(agreement_items)
                          ──▶ app/change_requests/targets.py(Target・normalize_targets)
                          ──▶ app/change_requests/states.py(BackgroundSource)
                          ──▶ app/detailed_design/impact/elements.py(parse_model)
                          ──▶ app/documents/{requirements,external_design}/model.py
```

`app/materials/` は CR の側の**値の型**(`Target`・`BackgroundSource`)だけを使い、CR のサービスは呼ばない。CR を作るのは 115-2 のサービスで、ここが組み立てた下書きを CR の今の入口(`ChangeRequestCreate` と `checked_targets`・`checked_origins`)に渡す ── 束にある要件か・起点に選べるかの確かめは、手で作る CR と同じ規則のまま。

## 1. つながる要件と対象の候補(着手時の決定2)

```python
# app/materials/drafting.py(抜粋)
def requirement_links(snapshots) -> dict[str, tuple[str, ...]]
    # 合意の要素のキー → つながる要件 ID(束の要件定義書にあるものだけ。行の並び・重複なし)
def requirement_candidates(kind: str, target_key: str, links) -> tuple[str, ...]
    # 変更・削除の対象につながる要件(追加・確かめる点は空)
```

| 違いの対象 | 候補(つながる要件) |
|---|---|
| `req:FR-001` | `FR-001`(その要件) |
| `screen:SCR-001` / `api:…` / `integration:…` | 行の `req_ids` のうち束にあるもの |
| `users`(利用者と使う場面) | なし(要件を持たない) |

- 要素は Phase 114 の一覧と同じ `agreement_items` で、キーも同じ(違いの `target_key` をそのまま引ける)。
- 束に無い要件 ID(外部設計書の `req_ids` に残った古い ID など)は候補に入れない ── CR の入口の `checked_targets` で弾かれるため。
- 候補は違いの一覧の応答に出す(115-2)。開発者は選べ、選ばなければ候補すべてが対象になる。

## 2. 起点の写し(着手時の決定3)

```python
# app/materials/drafting.py(抜粋)
def origin_keys(origin_key: str, links) -> tuple[str, ...]
```

| 追加の起点 | CR の起点 |
|---|---|
| 要件・画面・API(`req:`・`screen:`・`api:`) | そのまま(束に無ければ起点なし) |
| 外部連携(`integration:`) | つながる要件(`req:FR-…`) |
| 利用者と使う場面(`users`) | なし |

- CR の起点に選べるのは要件・画面・API・段階1 の処理(Phase 96・106)。Phase 114 で違いの起点を合意の要素のどれでもよいにしたので、ここで CR の起点に写す。
- 利用者の起点は写す先が無い。規模は「新しい要件のつながりの起点が無い」で数えられない(115-3 の「数えられない」)ので、開発者が CR の編集で起点を足す。

## 3. 下書きの組み立て(着手時の決定4)

```python
# app/materials/drafting.py(抜粋)
@dataclass(frozen=True)
class DraftDifference:      # kind・target_key・origin_key・content・quote
@dataclass(frozen=True)
class DraftMaterial:        # kind(minutes / email / document)・title・material_date
@dataclass(frozen=True)
class ChangeRequestDraft:   # title・content・background_*・targets・adds_requirement・origins

DRAFTABLE_KINDS = ("add", "change", "delete")
BACKGROUND_SOURCE_OF_MATERIAL = {"minutes": "meeting", "email": "email", "document": "document"}

def draft_change_request(differences, material, links, chosen_requirement_ids=None) -> ChangeRequestDraft
```

| 違い | CR |
|---|---|
| 要件の変更 / 削除 | その要件の内容の変更 / 削除 |
| 画面・API・外部連携の変更・削除 | 候補(選べば選んだもの)の要件の**内容の変更** |
| 候補の無い要素の変更・削除 | 新しい要件を足す CR(起点 = その要素。写せなければ起点なし) |
| 追加 | 新しい要件を足す CR(起点は 2 の写し) |

- **要素を消す違いは要件の削除にしない**(Claude の判断): 画面を消しても要件が消えるとは限らない。要件の削除は、要件の違いのときだけ。
- **変更後の案は空**(Claude の判断): 違いの内容は「何がどう違うか」で、要件の新しい文ではない。案は開発者が書くか、案の下書き(Phase 105)を使う。
- 対象は `normalize_targets`(Phase 82)でまとめる。同じ要件が内容の変更と削除の両方になれば ValueError(115-2 で 422)。
- 題: 1件ならその違いの内容、複数なら「<資料の題>」の変更(n件)。200字で切る。
- 内容: 違いごとに「- 種類 対象: 内容」と「- 根拠: 「引用」」の箇条書き。CR の内容の上限(20,000字)を超えたら、引用を200字に切り詰め、それでも超えれば末尾を切る(違いは最大50件 × 内容・引用 各1,000字なので、超えうる)。
- 背景: 出どころは資料の種類(議事録 → 打ち合わせ)、日付は資料の日付、メモは「資料「題」(日付)の違い n件から作った下書き」。
- 確かめる点・空の選択は ValueError。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_material_drafting.py`(新規)の12本 | `requirement_links`・`requirement_candidates`・`origin_keys`・`draft_change_request` と `ChangeRequestDraft`・`DraftDifference`・`DraftMaterial`・`DRAFTABLE_KINDS`・`BACKGROUND_SOURCE_OF_MATERIAL`(`app.materials` の re-export から) | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で、DB にも LLM にも触らないため。束の写しは fixture の dict |

- つながる要件: 要件・画面・API・外部連携・利用者の行。束に無い要件(`FR-999`)を除く。
- 候補: 変更・削除だけ。
- 起点: 画面・API はそのまま、外部連携は要件へ、利用者・空・束に無いものは無し。
- 組み立て: 要件の違い → 対象、要素の違い → 候補すべて / 選んだもの、候補に無い要件は ValueError、追加の起点の重なりを除く、候補の無い要素は新しい要件、確かめる点・空は ValueError、内容の変更と削除の衝突は ValueError。
- 文: 1件と複数の題、背景の3つ、内容の行、上限での切り詰め(引用を先に)。

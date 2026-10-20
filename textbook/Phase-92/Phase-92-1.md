# Phase-92-1: 合意の形へ戻す純粋関数

## この章の目的

再生成で作った要件定義書の model を、合意の記録([Phase 91](../Phase-91/Phase-91-introduction.md))に照らして、合意済みの行と利用者と使う場面(1.2)を合意の形に戻す。LLM に「変えない」と頼むだけでは揺れを止められない([90-2](../Phase-90/Phase-90-2.md) の利用者の行)ので、組み立ての後にコードで戻す([90-1](../Phase-90/Phase-90-1.md) の決定2)。DB にも LLM にも触らない純粋関数にして、規則を素のテストで確かめる。

自動実装モード: on([introduction](./Phase-92-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/agreements/protection.py`](../samples/backend/app/agreements/protection.py) | 新規 | `Restored`・`protect_requirements`・`agreed_requirement_ids`・`requirement_key` |
| [`app/agreements/__init__.py`](../samples/backend/app/agreements/__init__.py) | 更新 | `protection` の re-export |
| [`tests/unit/test_agreement_protection.py`](../samples/backend/tests/unit/test_agreement_protection.py) | 新規 | 書き換え・脱落・位置・免除・重複・利用者・次の番号 |

## 1. パッケージの形

```python
# app/agreements/__init__.py(抜粋)
from app.agreements.protection import (RESTORE_REASONS, Restored, RestoreReason,
                                       agreed_requirement_ids, protect_requirements,
                                       requirement_key)
```

- 置き場は `app/agreements`(合意のキーと `body_of` に依存するため)。`app/agreements` は既に `app.documents.*.model` を読んでいるので、依存の向きは `protection` → `items`・`app.documents.ids`・`app.documents.requirements.model`。`app/documents` から `app/agreements` への逆向きの依存は作らない。

## 2. 戻す関数

```python
# app/agreements/protection.py(抜粋)
RestoreReason = Literal["changed", "dropped"]

@dataclass(frozen=True)
class Restored:
    key: str; reason: RestoreReason

def protect_requirements(model: RequirementsModel, previous: RequirementsModel | None,
                         agreed: Mapping[str, dict[str, Any]], *,
                         exempt: frozenset[str] = frozenset()
                         ) -> tuple[RequirementsModel, list[Restored]]
def agreed_requirement_ids(agreed: Mapping[str, Any], exempt: frozenset[str]) -> frozenset[str]
```

- **`agreed`** は今の合意(キー → 合意した中身)。要件(`req:<ID>`)と利用者(`users`)のキーだけを読み、画面・API・外部連携は Phase 93 で扱う。
- **戻す範囲は行のすべての欄**(ユーザー決定): 文・出どころ・根拠の観点・優先度・種類。比べるのは `body_of`(Phase 91 の、変更影響分析の `row_body` と同じ形)なので、戻した行は変更影響分析でも「変わっていない」になり、関係の無い印が付かない。
- **落ちた行の位置**(ユーザー決定): 前の版で同じ種別の直前にあった行(今もあるもの)の後。前の版で同じ種別の先頭なら、今の同じ種別の先頭。前の版に無ければ同じ種別の末尾。続けて落ちた行は前の版の順に戻すので、つながって並ぶ。md は種別ごとの表なので、種別をまたぐ位置は見た目に効かない。
- **言い換えの重複**(ユーザー決定): 合意に無い新しい行のうち、合意済みの行と文が同じ(前後の空白を除く)ものを除く。言い換えは決定的に見分けられないので残し、差分で新しい行として見える。
- **利用者と使う場面**: 1.2 全体を1つの要素として比べ(Phase 91 のキー)、違えば合意の形に置き換える(空になっていれば `dropped`)。
- **`exempt`**: 書き換えてよい要素(反映する CR の対象)。戻さない。
- **次の番号**: 戻した行の番号を `next_seq` が越えるようにする(消えた ID を使い回さない。`app/documents/ids.py` の規則)。
- **推測の行**: 束に入った推測の行も合意済み(Phase 91 で束の全行を記録した)。出どころは合意のまま(推測)で、上限を上げも下げもしない。
- 戻すものが無ければ model をそのまま返す(同じオブジェクト)。

## テスト観点

この Phase の最初の章なので、用語を1行で定義する。SUT はテストの対象、ドライバはテストの対象を呼ぶもの、スタブ(テストダブル)は対象が呼ぶ外部依存の代わり。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_agreement_protection.py`(新規) | `protect_requirements`・`agreed_requirement_ids`・`requirement_key`・`RESTORE_REASONS` | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |

- 統合スモーク: 合意と同じ model は素通し(同じオブジェクト)。
- 書き換え(出どころの上限のかけ直しも)は、すべての欄を合意に戻す / 推測の合意は推測のまま / 落ちた行は前の版の隣の後ろ・種別の先頭・前の版に無ければ末尾 / 免除の行は戻さない / 同じ文の新しい行を除く / 利用者は全体で戻す(書き換え・脱落)/ 次の番号が戻した ID を越える / 合意が無ければ何もしない。
- 合意は、束の作成と同じ形(`agreement_items` の中身)で作る。

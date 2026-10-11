# Phase-35-1: カードの純粋関数と列(BE)

## この章の目的

選択肢カードの規則を純粋関数として置く。どの観点をカードにしてよいか、LLM が返したカードのうち使えるものはどれか、利用者の回答がどのカードに当たるか、選んだ内容をどんな発言にし、観点の表にどう記録するか(「AI の提案を採用」)を決める。カードは AI の発言に付くので、`chat_histories` に JSON の列 `cards` を足す。

自動実装モード: on([introduction](./Phase-35-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/hearing/cards.py`](../samples/backend/app/hearing/cards.py) | 新規 | カードの型と純粋関数(候補の観点・確かめ・回答の当て方・発言の本文・採用の記録・規模のカード・保存の形) |
| [`app/hearing/__init__.py`](../samples/backend/app/hearing/__init__.py) | 更新 | `cards.py` の re-export |
| [`app/models/chat_history.py`](../samples/backend/app/models/chat_history.py) | 更新 | 列 `cards`(JSON、NULL 可) |
| [`app/repositories/chat_history.py`](../samples/backend/app/repositories/chat_history.py) | 更新 | `add(..., cards=None)` |
| [`alembic/versions/b2c3d4e5f6a8_add_chat_history_cards.py`](../samples/backend/alembic/versions/b2c3d4e5f6a8_add_chat_history_cards.py) | 新規 | `chat_histories.cards` を足す(既存の行は NULL のまま) |
| ── ここからテスト ── | | |
| [`tests/unit/test_hearing_cards.py`](../samples/backend/tests/unit/test_hearing_cards.py) | 新規 | `cards.py` の純粋関数 |
| [`tests/unit/test_chat_history_repository.py`](../samples/backend/tests/unit/test_chat_history_repository.py) | 更新 | AI の発言にカードを保存できる |

BE のパスは `devex-api/backend/` 基準。

## 要点の抜粋

```python
# app/hearing/cards.py
@dataclass(frozen=True)
class Card:
    id: str
    point_key: str
    question: str
    options: tuple[CardOption, ...]  # CardOption(label, result)
    recommended: int
    reason: str
    selected: int | None = None  # 選ばれた選択肢(未回答なら None)

def card_targets(states, scale, *, limit=CARD_LIMIT) -> list[PointDef]:
    """規模が未決なら規模だけ。決まっていれば未決の必須を定義の順に最大 limit 件。"""
    targets = open_required(states, scale)
    if any(d.key == "scale" for d in targets):
        return [point_def("scale")]
    return targets[:limit]

def resolve_answers(cards, answers: Mapping[str, int]) -> list[tuple[Card, int]]:
    """選べるのは cards(最新の AI の発言のカード)のうち未回答のものだけ。違反は CardAnswerError。"""

def apply_card_answers(states, answered, message_id) -> dict[str, PointState]:
    for card, option in answered:
        merged[key] = PointState(key, "adopted", card.options[option].label, (message_id,))
```

```python
# app/hearing/__init__.py(re-export の形)
from app.hearing.cards import (CARD_LIMIT, SCALE_CARD_OPTIONS, Card, CardAnswerError, CardOption,
                               apply_card_answers, card_targets, compose_answer_message,
                               resolve_answers, sanitize_cards, scale_card, scale_of_answer, ...)
from app.hearing.points import (...)  # Phase 34 のまま
__all__ = [...]
```

依存の向き: `app/hearing/cards.py` → `app/hearing/points.py`(`PointDef`・`PointState`・`Scale`・`open_required`・`point_def`・`is_point_key`)と標準ライブラリだけ。サービス([35-2](./Phase-35-2.md))が `app.hearing` 経由で読む。モデル・リポジトリは `app.hearing` を読まない(カードは JSON の値のまま持つ)。

## 設計判断

### カードにしてよい観点はコードが決める

規模が未決なら、規模のカード1枚だけを出す。規模は後の必須を切り替えるので、ほかの観点とまとめて聞くと、答えの後で必須が変わる([33-2](../Phase-33/Phase-33-2.md) 決定5の補足「規模は単独で先に」)。規模が決まった後は、未決の必須を定義の順に3つまで候補にする(返信の LLM に渡す「まだ確認できていない観点」と同じ上限)。定義の順は機能面が先なので、候補が互いに独立した観点になりやすい。

### LLM のカードは確かめてから使う

LLM の構造化出力は形こそそろうが、中身は崩れうる。`sanitize_cards` が、候補の外の観点・同じ観点の2枚目・空の問い・選択肢の数が2〜4の外・空の選択肢・おすすめの番号が範囲の外を捨てる。プロンプトの指示だけに頼らない(Phase 34 の「根拠の無い決定は取り込まない」と同じ考え方)。

### 規模のカードはコードが作る

規模の値(`personal`/`internal`/`public`)は必須の切り替えに使うので、選ばれた選択肢を値に結べないと困る。LLM に作らせると選択肢の言い方が毎回変わり、値に結べない。そこで規模のカードは選択肢をコードで固定し(`SCALE_CARD_OPTIONS`。結果には「選ぶと次に何を決めることになるか」を書く)、選ばれたら `scale_of_answer` で値を返す。おすすめは「自分と数人だけ」(小さく始めて、後で選び直せるため)。

### 回答は送信の時点で記録する

「選択はその場で記録し、AI は呼ばない」([外部設計書](../../docs/external_design.md) 2.9節)を、送信の時点でコードが記録する、と読んだ。観点の表の根拠は利用者の発言の id なので、選んだ内容を発言として保存してからでないと根拠を付けられない。`compose_answer_message` は「【可用性】半日止まってよい」を並べ、自由な文があれば空行の後に続ける。`apply_card_answers` はその発言を根拠に `adopted`(決めたこと = 選んだ選択肢の名前)にする。

### カードは AI の発言の行に持つ

カードは AI の発言の一部なので、新しいテーブルでなく `chat_histories.cards`(JSON)に持つ。履歴の API がそのまま返すので、画面を開き直しても最新のカードが出る。選ばれた選択肢も同じ JSON の `selected` に書く(回答済みのカードに二度答えさせないため)。観点の名前(`label`)も保存し、画面が観点の定義を持たずに済むようにした。JSON の列は中身の書き換えを検知しないので、書き換えるときは新しいリストを代入する([35-2](./Phase-35-2.md))。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `app/hearing/cards.py` と `app/hearing/__init__.py` の re-export | pytest(`test_hearing_cards.py`) | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため | 第一テスト(統合スモーク): 規模が未決なら候補は規模だけ。決まった後は未決の必須を3つまで、壊れたカード・候補の外を捨てる、回答の当て方と3種類の違反、発言の本文、採用の記録、選択の書き込み、LLM に見せる文、保存の形の往復、規模のカードと規模の値 |
| `ChatHistoryRepository.add`・`ChatHistory.cards` | pytest(`test_chat_history_repository.py`) | スタブ不要 ── 永続化そのものが対象なので、インメモリ SQLite の `db_session` を使う | AI の発言はカードを持ち、利用者の発言は NULL |

マイグレーションは、開発用 DB で `upgrade head` → `downgrade -1` → `upgrade head` の往復で確かめた。

```sh
cd devex-api/backend && uv run pytest tests/unit/test_hearing_cards.py tests/unit/test_chat_history_repository.py
```

# Phase-92-2: 組み立てとプロンプト

## この章の目的

「採用にする」で採用にした行が、次の再生成で「推測」に戻る決定的な経路([90-2](../Phase-90/Phase-90-2.md))を、組み立て(`build_model`)の側でも閉じる。合意済みの行には出どころの上限をかけ直さない([90-1](../Phase-90/Phase-90-1.md) の決定3)。あわせて、プロンプトで合意済みの行を「変えない行」として LLM に渡す。

自動実装モード: on([introduction](./Phase-92-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/documents/requirements/assemble.py`](../samples/backend/app/documents/requirements/assemble.py) | 更新 | `build_model` の `agreed_ids`(写す合意済みの行に `cap_source` を当てない) |
| [`app/documents/requirements/drafting.py`](../samples/backend/app/documents/requirements/drafting.py) | 更新 | `AGREED_MARK`・`previous_rows_text` の印と利用者の行・規則の1文・`build_requirements_messages` の引数 |
| [`tests/unit/test_document_revision.py`](../samples/backend/tests/unit/test_document_revision.py) | 更新 | 合意済みの行は出どころを保つ・プロンプトの印 |

## 1. 組み立て

```python
# app/documents/requirements/assemble.py(抜粋)
def build_model(draft, previous, states, scale, *,
                agreed_ids: frozenset[str] = frozenset()) -> RequirementsModel:
    ...
        if r.unchanged and same is not None and same.kind == kind:
            if req_id in agreed_ids:
                rows.append(same)          # 合意済み: 上限をかけ直さない
                continue
            source = cap_source(same.source, same.points, states, kind=kind)
```

- 合意の根拠は観点ではなく合意そのもの。観点を採用にする案は、同じ観点を根拠にする別の行の出どころまで上げてしまう(決定3の理由)。
- 生成の後に [92-1](./Phase-92-1.md) の関数が合意の形へ戻すので、出力は同じになる。それでもここに置くのは、意図をコードに残すためと、CR の対象(免除)になった行を `agreed_ids` から外して、上限を今までどおりかけるため。
- `agreed_ids` は要件 ID(キーでなく)。`app/documents` は合意のキーを知らない。

## 2. プロンプト

```python
# app/documents/requirements/drafting.py(抜粋)
AGREED_MARK = "合意済み"

def previous_rows_text(previous, agreed_ids=frozenset(), agreed_users=()) -> str
    # FR-001|予約を登録できる|合意済み
    # 利用者と使う場面(合意済み): 利用者: スマホで予約する / ...
def build_requirements_messages(transcript, states, scale, previous, instruction="", *,
                                agreed_ids=frozenset(), agreed_users=()) -> list[BaseMessage]
```

- **新しい節は作らない**: 【前の版の要件】の行に印を付け、合意済みの利用者を末尾に1行足す。新しい `##` の節は、再生成の節の分け方(`REVISION`)のテスト(すべての節が前の版・きっかけ・読むだけのどれかに分かれる)の対象になり、分け方を1つ増やすことになるため。
- **規則に1文**: 「合意済み」の印の行は、【修正指示】がその ID を指していなければ unchanged にして必ず残す(書き直さない・落とさない・同じ中身を別の要件として書かない)。合意済みの利用者と使う場面もそのまま書く。
- プロンプトは約束で、守るのはコード(92-1)。プロンプトは、LLM が落とした行を新しい ID で書き直す(92-1 で除く重複)のを減らす分の効き目。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_document_revision.py`(追記) | `build_model` の `agreed_ids`・`build_requirements_messages` の印・`SYSTEM_PROMPT` の1文 | pytest のテスト関数 | スタブ不要 ── どれも純粋関数で、DB や LLM を呼ばないため |

- 写す行が合意済みなら、観点が未決でも「採用」のまま(合意が無ければ今までどおり「推測」に下がる)。
- プロンプト: 合意済みの行だけに印・合意済みの利用者の行・規則の1文。印の無い呼び方は今までと同じ文(既存のテストが番人)。
- 既存の「写した行も上限をかけ直す」テストは、合意の無い行の挙動として残した。

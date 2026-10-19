# Phase-85-1: CR の修正指示と遷移の表

## この章の目的

合意した CR の内容を、再生成のプロンプトの【修正指示】に入れる文にする純粋関数を作る。設計レビューの採用した指摘の指示([`app/review/sendback.py`](../samples/backend/app/review/sendback.py) の `build_instruction`。Phase 54)と同じ型で、2つの指示を並べられるようにする。あわせて、CR の遷移の表で「反映(apply)」をやり直せるようにし、再生成に渡せる状態を表に置く。

自動実装モード: on([introduction](./Phase-85-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/instruction.py`](../samples/backend/app/change_requests/instruction.py) | 新規 | `build_cr_instruction`(CR の値 → 指示の文)・`join_instructions`(指示を空行で並べる) |
| [`app/change_requests/states.py`](../samples/backend/app/change_requests/states.py) | 更新 | `apply` に `applied → applied`(やり直し)、`DOCUMENT_REFLECTABLE_STATUSES`・`STAGE_REFLECTABLE_STATUSES` |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | 上の4つの re-export |
| [`tests/unit/test_change_request_instruction.py`](../samples/backend/tests/unit/test_change_request_instruction.py) | 新規 | 種類ごとの対象の行・新しい要件だけの CR・空の指示を飛ばす |
| [`tests/unit/test_change_request_states.py`](../samples/backend/tests/unit/test_change_request_states.py) | 更新 | やり直しの遷移・合意の前は反映しない・反映済みでできる操作・渡せる状態 |

依存の向き: `instruction.py` → `explanation.ChangeRequestFacts`(84-2)・`targets.TARGET_KIND_LABEL`(83-1)。どちらも純粋層の中で、DB にも LLM にも触らない。

## 1. 指示の文

```python
# app/change_requests/instruction.py(抜粋)
CR_INSTRUCTION_HEAD = (
    "次の合意済みの変更要求(CR-{number})を反映して書き直す。対象の要件と、それに合わせて変える"
    "必要のある行だけを書き直し、変更要求に関係しない行は変えない(unchanged にする)。"
)

def build_cr_instruction(facts: ChangeRequestFacts) -> str
    # 頭の1文 / タイトル: … / 内容: …(空なら —)/ 対象の要件:
    # - FR-005(内容の変更): 変更後の案「…」   ← 案があるとき
    # - FR-007(内容の変更): 上の「内容」のとおりに変える   ← 案が無いとき
    # - FR-009(削除): この要件を消す
    # - 新しい要件を足す(…)   ← adds_requirement のとき

def join_instructions(instructions: Iterable[str]) -> str   # 空の指示は飛ばし、空行で並べる
```

- **CR の値は説明書と同じ `ChangeRequestFacts`**: 説明書の1節・2節に載る値([84-2](../Phase-84/Phase-84-2.md))と同じものから作る。サービスの `facts_of`(84-3)で DB の行から写す。説明書と指示で、CR の見え方がずれない。
- **頭の1文は指摘と同じ考え方**: 「関係しない行は unchanged」を書くのは、文書の再生成が前の版の差分にとどまる仕組み([`app/documents/revision.py`](../samples/backend/app/documents/revision.py)。Phase 70)に合わせるため。指摘の `INSTRUCTION_HEAD` と同じ言い回しにした。
- **文書・段階ごとに絞らない**: 指摘は関連文書(`documents`)で絞る(`findings_for`)が、CR は要件が起点で、要件定義書・外部設計書・段階のどれにも同じ指示を渡す。どこまで書き換わるかは、前の版との差分と印で見る(85-2・85-4)。
- **並べ方**: 指摘と CR を同時に渡すと、`join_instructions([指摘の指示, CR の指示])` で空行をはさんで並べる。どちらかが空なら、もう一方だけになる(空の【修正指示】の扱いは今までどおり)。

## 2. 遷移の表

```python
# app/change_requests/states.py(抜粋)
"apply": {"agreed": "applied", "applied": "applied"},     # やり直しも apply の行
DOCUMENT_REFLECTABLE_STATUSES = frozenset({"agreed", "applied"})
STAGE_REFLECTABLE_STATUSES = frozenset({"applied"})       # 文書へ反映した後だけ
```

- **やり直しを表に入れる**: 着手時の相談で「反映済みの間もやり直せ、そのたびに時系列に1行」と決めた。`applied → applied` を表に置くと、時系列の行(`add_event`)を他の遷移と同じ道で足せる(`_next` が 409 にしない)。
- **段階は反映済みだけ**: 印は文書の再生成から生まれる(段階の印の出どころは文書の版の切り替え。Phase 43)。文書へ反映する前に段階へ CR を渡すと、段階の書き換えの起点が無いまま進むので、段階は反映済みの CR だけにした(Claude の判断)。
- `allowed_actions("applied")` は `["apply", "verify"]` になる。`apply` は画面のボタンでなく、CR を渡した再生成で起きる(画面の出し分けは Phase 87 で決める)。

## テスト観点

用語(初出の章で定義済み): SUT = テスト対象、ドライバ = SUT を呼ぶ側、スタブ = SUT が呼ぶ外部の代わり。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_instruction.py`(新規) | `build_cr_instruction`・`join_instructions` | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |
| `test_change_request_states.py`(更新) | `next_status`・`allowed_actions` と渡せる状態の表 | pytest のテスト関数 | スタブ不要 ── 同上 |

- 指示: 頭の1文に CR の番号と unchanged / 案あり・案なし・削除の3つの行の形 / 新しい要件だけの CR は「対象の要件:」を出さず最後に1行 / 内容が空白だけなら「—」。
- 並べ方: 空の指示を飛ばし、空行で並べる / どれも空なら空。
- 遷移: `applied → applied` が通る / 説明済みからは反映しない / 検証済みからも反映しない。

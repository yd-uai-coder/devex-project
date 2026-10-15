# Phase-59-2: ヒアリングで判断を委ねられたとき

## この章の目的

ヒアリングの指摘で聞き直したときに、利用者が「おすすめでよい」と答えても具体的な値にならない問題を直す([58-2](../Phase-58/Phase-58-2.md))。これまでは、AI が値を出さないまま、要件が「推奨される標準仕様を適用する」になり、再レビューで同じ指摘が出た。原因は2つある。聞き直しの問いかけの「改善案」に値が無いこと、そして判定の LLM がその案への同意を `adopted`(決まった)にしたことである。着手時の相談で、**判定では open に残し、次のカードで具体的な値を選ばせる**と決めた。

自動実装モード: on([introduction](./Phase-59-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | 判定の規則・カードの指示・委ねる発言への注記(`_DELEGATION`・`_DELEGATED_NOTE`) |
| [`app/documents/requirements/drafting.py`](../samples/backend/app/documents/requirements/drafting.py) | 更新 | 観点の表の変化も、再生成の変更のきっかけにする |
| [`tests/unit/test_chat_service.py`](../samples/backend/tests/unit/test_chat_service.py) | 更新 | 判定・返信の指示の文言、委ねる発言への注記 |
| [`tests/unit/test_document_revision.py`](../samples/backend/tests/unit/test_document_revision.py) | 更新 | 要件定義書の指示の文言 |

## 1. 判定で open に残す(`_POINTS_JUDGE_PROMPT`)

責務(`ChatService`): ヒアリングの対話・観点の判定・返信を行う(Phase 2・34・35)。

```python
# app/services/chat_service.py(_POINTS_JUDGE_PROMPT の抜粋)
"・ユーザーが「おすすめでよい」「おまかせ」のように判断を委ねたとき、直前のAIの提案に"
"具体的な値・方式(回数・時間・方式の名前など)が無ければopenにする"
"(値の無い方針に同意しただけでは決まっていない)。\n"
"・summaryは、…。adoptedなら、同意した提案の具体的な値・方式を書く。…"
```

- 非自明な判断: 「委ねた」こと自体は `adopted` で正しい(AI の提案への同意)。問題は、**同意した中身に値が無い**こと。そのため、規則の条件は「委ねたか」ではなく「直前の提案に値・方式があるか」にした。カードの具体的な選択肢を選んだときは、今までどおりコードが `adopted` にする(LLM は呼ばない)。

## 2. 次の返信で値のカードを出す(`_DELEGATION`・`_DELEGATED_NOTE`)

```python
# app/services/chat_service.py
_DELEGATION = re.compile(r"おすすめ|お勧め|おまかせ|お任せ|任せ|推奨")
_DELEGATED_NOTE = (
    "利用者は直前の問いの判断を AI に委ねました。{label}を、必ず選択肢カード(cards)1枚で"
    "聞いてください。選択肢の名前は具体的な値・方式(…)で書き、おすすめを1つ付けます。…"
)
# stream_reply の中
delegated = (
    not carried and bool(targets) and targets[0].key != "scale"
    and bool(_DELEGATION.search(user_message))
)
message, cards = await self._compose_reply(..., extra_prompt=_DELEGATED_NOTE.format(...) if delegated else None)
```

- open に残った観点は、既存の `card_targets` が次に聞く。そのため、流れ(どの観点を聞くか)は変えていない。
- 非自明な判断: **指示の文言だけでは足りず、コードが注記を足した**。最初は `_CARD_INSTRUCTIONS` に「委ねた観点は具体的な値の選択肢カードにする」の1行を足しただけだった。実際の対話([59-6](./Phase-59-6.md))では2回とも、返信の AI はカードを出さず、本文で「おすすめの標準仕様を適用して要件を確定いたします」と書いた。返信の LLM は、利用者が委ねたかどうかを毎回自分で読み取る必要があり、システムプロンプトの奥の1行を取りこぼす。そこで、コードが委ねる発言を見つけ、プロンプトの最後に観点を名指しした指示を置いた。Phase 34 の `_LATEST_QUESTION_NOTE`(判定に、直前の問いの観点を名指しする)と同じ考え方である。注記を足した後は、値の選択肢カードが出た(「パスワード8文字以上、メール確認あり、JWT(30分/14日・HttpOnly Cookie)」)。
- 規模の観点と、前の返信のカードを付け直すとき(`carried`)は、システムがカードを出すので注記を足さない。
- 正規表現は広め(「推奨」も拾う)にした。誤って拾っても、カードで聞き直すだけで害が小さいため。

## 3. 再生成で観点の変化を写す(`app/documents/requirements/drafting.py`)

責務: 要件定義書の下書きの入力と指示を組み立てる(純粋関数。Phase 36)。

```python
# app/documents/requirements/drafting.py(SYSTEM_PROMPT の最後)
f"{REVISION_RULE}(【前の版】は【前の版の要件】)\n"
"- 【観点の表】の決めたことが、前の版の要件と食い違う(値・方式が具体になった、変わった)なら、"
"それも変更のきっかけ。その観点を points に持つ要件は unchanged にせず、決めたことの値・方式を"
"そのまま書き直す(聞き直しで観点を決め直した後の再生成)"
```

- 非自明な判断: ヒアリングで値が決まっても、再生成した要件定義書は前の版の文(「推奨されるおすすめの回数制限」)のまま写された。再生成は前の版の行を変えないのが基本(Phase 49 の `REVISION_RULE`)で、変更のきっかけは「会話の新しい依頼・上流の変わった行・修正指示」の3つだった。カードで選んだ答えは「会話の依頼」にも見えず、観点の表の変化はきっかけに入っていなかった。そこで4つ目のきっかけとして足した。足した後は FR-011・FR-012 に値が入った([59-6](./Phase-59-6.md))。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_judge_points_shows_numbered_messages_and_current_table`(更新) | `ChatService.judge_points` | pytest(非同期) | `_RecordingLLM`(判定に渡した messages を記録する偽 LLM)── 判定の LLM を注入できるため。DB はインメモリの SQLite。open に残す規則と summary の規則が判定のプロンプトに入ることを足した |
| `test_stream_reply_keeps_only_cards_for_targets_and_yields_them_after_text`(更新) | `ChatService.stream_reply` | pytest(非同期) | `_RecordingLLM`。返信のシステムプロンプトに、委ねた観点をカードにする規則が入ることを足した |
| `test_stream_reply_asks_delegated_point_with_value_card`(新規) | `ChatService.stream_reply` | pytest(非同期) | `_RecordingLLM`。「おすすめでよいです」の後の返信の最後のメッセージが `_DELEGATED_NOTE`(次の観点の名前入り)で、委ねていない発言には付かない |
| `test_requirements_prompt_rewrites_rows_whose_point_was_decided_again`(新規) | `SYSTEM_PROMPT`(要件定義書) | pytest | スタブ不要 ── 定数の中身 |

- LLM が実際にカードを出すか・要件に値が入るかは、偽 LLM では確かめられない。[59-6](./Phase-59-6.md) の実際の対話で確かめた。
- 更新した2つの本体のファイルは、それぞれのテストが import している(#15)。この章で足した import は、テストの `_DELEGATED_NOTE`(この章で作成)だけで、前方 import は無い。

# Phase-70-1: 聞き直しの答えを判定に通す

## この章の目的

設計レビューの指摘で観点を聞き直し、利用者がカードで答えると、観点の要約がカードの選択肢の文で置き換わった(Phase 59 で、security の「自分のデータは自分だけ」が消えた)。また、1枚の値のカードが指摘の論点の一部しか値にしなかった(abuse の「チャット50回/時間など」)。この章では、聞き直しでも要約を残し、聞き直している観点へのカードの答えは判定の LLM に回して、前の要約と合わせた決めたことを書かせる。あわせて、聞き直している観点をカードで聞くときに、指摘を名指しして対象ごとの値を求める。

自動実装モード: on([introduction](./Phase-70-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/review/rehearing.py`](../samples/backend/app/review/rehearing.py) | 更新 | `rehearing_findings_text`(聞き直しの発言から観点1つの指摘を取り出す) |
| [`app/review/__init__.py`](../samples/backend/app/review/__init__.py) | 更新 | `rehearing_findings_text` の re-export |
| [`app/hearing/points.py`](../samples/backend/app/hearing/points.py) | 更新 | `merge_judgement` は、聞き直し中の観点が open のまま要約が空で返っても前の要約を残す |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | 聞き直しで要約を残す・聞き直し中のカードの答えを判定に回す・2つの注記・`decided` を `adopted` に直す |
| [`tests/unit/test_review_rehearing.py`](../samples/backend/tests/unit/test_review_rehearing.py) | 更新 | 取り出し・要約を残す |
| [`tests/unit/test_chat_service.py`](../samples/backend/tests/unit/test_chat_service.py) | 更新 | 聞き直し中のカードの答え(判定に回す・open のまま・判定の失敗・`decided`)と返信の注記 |

## 1. 原因

```
聞き直し(reopen_points)          → 観点を open に、要約を ""(前の要約が消える)
「おすすめでよい」→ 値のカード    → 1枚・選択肢2〜4。指摘は履歴の AI の発言にあるだけ
カードの答え(apply_card_answers) → LLM を呼ばずに adopted、要約 = 選択肢の文(上書き)
```

- カードの答えをコードが記録するのは Phase 35 の決定(読むべき新しい文が無いので判定を呼ばない)。ふつうの問いではこれで足りる。聞き直しでは、前の要約に「カードが聞いていないこと」が入っているので、上書きで消える。

## 2. 聞き直しでも要約を残す(`reopen_points`・`merge_judgement`)

```python
# app/services/chat_service.py(reopen_points の抜粋)
states[key] = PointState(
    point_def(key).key, "open", states[key].summary, reopened_after=str(entry.id)
)

# app/hearing/points.py(merge_judgement の抜粋)
if state.status == "open":
    summary = state.summary or merged[state.key].summary
    state = replace(state, summary=summary, reopened_after=reopened)
```

- 非自明な判断: 要約を残すだけでは足りない。聞き直しの後に利用者が文で答えると判定が走り、判定の規則は「open なら要約は空でよい」なので、空で返して消してしまう。そこで、聞き直し中(`reopened_after` がある)で open のまま返った観点は、空の要約を前の要約で補う。マイグレーションは要らない(列は今の `summary` のまま)。

## 3. 聞き直し中のカードの答えを判定に回す(`_record_user_turn`・`stream_reply`)

```python
# app/services/chat_service.py(_record_user_turn の抜粋)
reheard = [(card, option) for card, option in answered
           if previous[point_def(card.point_key).key].reopened_after is not None]
recorded = [answer for answer in answered if answer not in reheard]
if recorded:
    states = apply_card_answers(previous, recorded, str(entry.id))
...
return cards, answered, reheard

# stream_reply
needs_judge = needs_judge or bool(reheard)
try:
    states = await self.judge_points(project, llm=llm, reheard=reheard)
except GenerationFailedError:
    ...
    if reheard:
        await self._record_card_answers(project, reheard)  # 答えは失わない
```

- 責務(`ChatService`): ヒアリングの対話・観点の判定・返信(Phase 2・34・35)。この章で、聞き直しの答えの扱いが増えた。
- 判定のプロンプトの最後に、観点を名指しした注記を足す(Phase 34 の `_LATEST_QUESTION_NOTE`、Phase 59 の `_DELEGATED_NOTE` と同じ「コードが名指しする」考え方)。

```python
# app/services/chat_service.py
_REHEARING_ANSWER_NOTE = (
    "\n観点 {key}({label})は、設計レビューの指摘で聞き直している観点で、最新のユーザーの発言は"
    "そのカードの答え(「{answer}」)です。\n指摘: {findings}\n聞き直しの前の要約: {summary}\n"
    "この観点を必ず判定する。まず、指摘が挙げた対象(例: ログイン失敗・登録・チャット・生成)を"
    "1つずつ見て、答えにも聞き直しの前の要約にも具体的な値・方式が無いものが1つでもあれば open に"
    "する。すべてに値・方式があれば adopted にする(カードの選択なので decided にしない)。…"
)
```

- 指摘の本文は、聞き直しの発言(`reopened_after` の id のチャットの行)から `rehearing_findings_text` で取り出す。発言は `rehearing_message` がコードで組み立てたもの(`・「観点」` の下に `- 問題`・`改善案:`)なので、決まった形で逆に読める。指摘の行を別に保存しない(マイグレーションを避けた)。
- 非自明な判断(効果の確認で直した。[70-4](./Phase-70-4.md)): 判定がカードの選択を `decided`(利用者が自分の言葉で決めた)と書いた。出どころの上限(`cap_source`)が「ユーザー」に上がってしまうので、カードの答えだけを根拠にした `decided` はコードが `adopted` に直す(`_adopted_when_only_card`)。また、最初の注記(「指摘の論点がすべて値で決まったら adopted」)では、登録の値の無い答えを adopted にしたので、「指摘が挙げた対象を1つずつ見る」に具体化した。

## 4. 聞き直している観点をカードで聞くとき(`_REHEARING_CARD_NOTE`)

```python
# app/services/chat_service.py
_REHEARING_CARD_NOTE = (
    "{label}は、設計レビューの次の指摘で聞き直している観点です。\n{findings}\n"
    "選択肢カード(cards)で聞くなら、どの選択肢の名前にも、指摘が挙げた対象(例: ログイン失敗・"
    "登録・チャット・生成)それぞれの具体的な値・方式を書いてください(「など」で省かない。…)"
)
# stream_reply: 次に聞く観点が聞き直し中なら、委ねたときの注記の後に足す
notes = [_DELEGATED_NOTE.format(label=targets[0].label)] if delegated else []
rehearing = await self._rehearing_note(project, states, targets[0]) if targets and not carried else None
```

- 委ねたかどうかによらず足す(聞き直しの問いに、利用者が自分で答える場合も、対象ごとに聞けるように)。前の返信のカードを付け直すとき(`carried`)は、カードをシステムが出すので足さない。
- 非自明な判断: 1枚のカードに複数の問いを持たせる案(相談の選択肢3)は取らなかった。カードの形(`CARD_LIMIT=1`・1問)と画面の送信(1回に1枚)を変えずに済み、足りない対象は open に残して次のカードで聞ける。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_review_rehearing.py` | `rehearing_findings_text`・`merge_judgement`(純粋関数)・`ReviewService.rehearing` | pytest の関数 | 純粋関数はスタブ不要 ── 文字列と状態の表だけから決まるため。聞き直しは DB をテスト用の SQLite | 観点の塊の取り出し(2観点・無い観点・ほかの発言)/ open のまま要約が空でも前の要約を残す / 聞き直しで要約を残す |
| `test_chat_service.py`(新規6件) | `ChatService.reopen_points`・`stream_reply`・`judge_points` | pytest(非同期) | `_RecordingLLM`(判定と返信に渡した messages を記録し、決めた判定を返す偽 LLM)── LLM を注入できるため。判定の失敗は `judge_points` を差し替える。DB はテスト用の SQLite | 要約を残す / 聞き直し中のカードは記録せず判定へ(注記の全文)・判定の要約を記録 / open のまま返れば印と前の要約が残り、次の返信に指摘の注記 / 判定の失敗で選択肢を記録 / 委ねた発言なら2つの注記を続ける / カードだけを根拠にした `decided` は `adopted` |

- LLM が前の要約と合わせて書くか・対象ごとの値のカードを出すかは、偽 LLM では確かめられない。[70-4](./Phase-70-4.md) の実際の対話で確かめた。
- この章で更新した本体のファイルは、テストが import している(`points.py` は `merge_judgement`、`rehearing.py`・`__init__.py` は `rehearing_findings_text` を `app.review` から、`chat_service.py` は `ChatService` と2つの注記)。テストが新しく import するのは、この章で作った注記と `rehearing_findings_text`、既存の `PointStatus`・`SendbackFinding`・`rehearing_message`・`rehearing_points` で、前方 import は無い。

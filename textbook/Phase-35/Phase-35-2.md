# Phase-35-2: 返信の構造化とカードの送受信(BE)

## この章の目的

ヒアリングの返信を、本文と選択肢カードの構造化出力の1回で作る。送信ではカードへの回答も受け取り、[35-1](./Phase-35-1.md) の純粋関数で確かめて、選んだ観点を「AI の提案を採用」と記録してから、判定と返信を回す。カードは SSE の `event: cards` で本文の後に送る。E2E 用の偽 LLM も返信のスキーマに合わせる。

自動実装モード: on([introduction](./Phase-35-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/schemas/hearing.py`](../samples/backend/app/schemas/hearing.py) | 更新 | 返信の構造化出力(`HearingReplyOut`・`CardOut`)、送信の本文(`card_answers`)、履歴のカード(`CardRead`) |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `InvalidCardAnswerError`(400、`INVALID_CARD_ANSWER`) |
| [`app/services/llm_retry.py`](../samples/backend/app/services/llm_retry.py) | 更新 | 呼び出し元の無くなった `as_llm_error` を削除 |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | 回答の記録(`_record_user_turn`)・返信の構造化(`_compose_reply`)・`ReplyCards`・プロンプト |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | `event: cards` の送信と、回答の受け渡し |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 偽 LLM の返信(固定の本文 + 候補の先頭の観点のカード1枚) |
| ── ここからテスト ── | | |
| [`tests/fixtures/fake_llm.py`](../samples/backend/tests/fixtures/fake_llm.py) | 更新 | `structured_by_schema`(判定と返信で別の構造化出力を返す) |
| [`tests/unit/test_chat_service.py`](../samples/backend/tests/unit/test_chat_service.py) | 更新 | 回答の記録・拒否、カードの確かめ、規模のカード、プロンプト、空の返信 |
| [`tests/unit/test_chat_stream_errors.py`](../samples/backend/tests/unit/test_chat_stream_errors.py) | 更新 | 本文 → カード → `[DONE]` の順、返信の失敗と回答の誤りの `event: error` |
| [`tests/unit/test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py) | 更新 | 偽 LLM が本物のプロンプトからカードを作る契約 |
| [`tests/integration/test_projects_flow.py`](../samples/backend/tests/integration/test_projects_flow.py) | 更新 | 規模のカードを選んで送る往復(実 PostgreSQL) |

BE のパスは `devex-api/backend/` 基準。

## 要点の抜粋

```python
# app/schemas/hearing.py
class HearingReplyOut(BaseModel):  # 返信の LLM の構造化出力
    message: str
    cards: list[CardOut] = []  # point_key・question・options(label, result)・recommended・reason

class HearingMessageRequest(BaseModel):
    message: str = ""
    card_answers: list[CardAnswer] = []  # card_id・option。message とどちらか一方は要る
```

```python
# app/services/chat_service.py(stream_reply の流れ)
await self._record_user_turn(project, user_message, card_answers)  # 確かめ → 発言 → adopted
states = await self.judge_points(project, llm=llm)  # 表には採用が入った状態で渡る
...  # 十分ならまとめ(Phase 34 のまま)
message, cards = await self._compose_reply(
    project,
    questions=questions_for_reply(states, scale),
    targets=card_targets(states, scale),  # 規模が未決なら規模だけ
    llm=llm,
)
await self._chat_histories.add(..., message=message, cards=[card_to_dict(c) for c in cards] or None)
await self._session.commit()
yield message
if cards:
    yield ReplyCards(cards=[card_to_dict(c) for c in cards])
```

```python
# app/api/routes/projects.py(send_hearing_message)
if isinstance(item, ReplyCards):
    yield f"event: cards\ndata: {json.dumps({'cards': item.cards}, ensure_ascii=False)}\n\n"
else:
    yield f"data: {json.dumps({'delta': item}, ensure_ascii=False)}\n\n"
```

依存の向き: `chat_service.py` → `app.hearing`(35-1 のカードの関数)・`app.schemas.hearing`・`app.services.errors`。`projects.py` → `chat_service.ReplyCards`。`fake.py` → `app.hearing.is_point_key`・`app.schemas.hearing`。テストの `test_fake_llm_e2e.py` → `chat_service._build_messages`(偽物と本物のプロンプトの契約)。

## 設計判断

### 返信は構造化出力の1回(トークンごとに流さない)

カードは構造化したデータなので、構造化出力で受けるのが確か。返信の文を今までどおり流して、カードだけ別の呼び出しで作ると、1回の送信で LLM が3回(判定・返信・カード)になり、無料枠と待ち時間が増える。本文とカードを1回の構造化出力で作れば、LLM は今と同じ2回(判定・返信)で済む(着手時の決定)。代わりに、構造化出力は全体がそろってから返るので、文は流れずにまとめて表示される。SSE の形は変えず、本文を1回の `delta` で送る。部分 JSON を流す案は、仕組みが複雑で壊れやすいので採らなかった。

### 返信も `invoke_with_retry` を通る

流さなくなったので、返信を送る前に失敗を再試行できる。今までの「ストリームの途中の失敗を共通の例外に揃える」`as_llm_error`([Phase 15-3](../Phase-15/Phase-15-3.md))は呼び出し元が無くなったので消した(#17 の「駆動する消費者がいない」ではなく、この変更で使われなくなったものの片付け)。DEBUG ログも `invoke_with_retry` が記録する(1回の送信で attempt 付きのログが2件)。

### 回答の確かめと記録は判定の前

回答は、最新の AI の発言のカードに当てる(`resolve_answers`)。古い画面から送られた回答・回答済みのカード・範囲の外の番号は `InvalidCardAnswerError` にする。確かめは発言を保存する前に行うので、拒んだときは何も残らない(SSE の `event: error` で `INVALID_CARD_ANSWER` を伝え、ルートが rollback する)。通ったら、選んだ内容と文を1つの発言として保存し、カードに `selected` を書き、選んだ観点を `adopted` にして表に保存する。規模のカードなら `projects.hearing_scale` も入れる。その後に判定の LLM を呼ぶので、判定のプロンプトの表には採用が入っている。判定の規則「open 以外は言い直したときだけ変える」([Phase 34-2](../Phase-34/Phase-34-2.md))がそのまま効く。

### プロンプトにカードの書き方と候補を足す

返信のシステムプロンプトに「[選択肢カード]」の節を足す。場面で聞く・専門用語で聞かない・選択肢は2〜4・結果はコストと手間と後から変えられるか・おすすめは1つで理由は対話に結びつける・自由回答向きの観点は本文で聞く・カードの問いを本文に繰り返さない、の指示と、候補の観点(`- キー: 名前(例: 問い)`)。規模が候補のときは、規模はシステムがカードで聞くので本文で聞かないように伝える。本文が空でカードがあれば決まった文(「次の点を、カードから選ぶか…」)にし、本文もカードも無ければ失敗にする。

### LLM に見せる AI の発言にカードを足す

AI の発言の行にカードがあれば、問いと選択肢(おすすめの印つき)を文にして発言の後ろに足す(`card_as_text`)。判定の LLM と次の返信の LLM が「何を聞いたか」を読めるようにするため。利用者の回答は「【可用性】…」の文で発言に入っている。

### 偽 LLM

E2E の偽 LLM は、返信のスキーマに対して固定の本文と、システムプロンプトの候補の先頭の観点のカードを1枚返す(規模のカードはサービスが出すので作らない)。候補の行の書式を正規表現で読むので、本物の `_build_messages` で作ったプロンプトから読めることを契約テストで固定した。判定の偽物(発話3回で全観点が決まる)は変えていない。

### Phase 完了後の調整

- **会話の順**: `chat_histories.created_at` を、アプリが行ごとに入れるようにした(DB の `now()` はトランザクションの開始時刻で、同じ送信の2行が同じ時刻になり、カードの選択の更新で順が入れ替わった)。
- **未決の観点を画面から対象外にする**: `mark_point_not_applicable(project, key)` が、未決の観点だけを `not_applicable`(決めたこと「後で決める(画面で対象外にした)」、根拠なし)にし、`_completion_from` で完了判定を作り直す(LLM は呼ばない)。ルートは `PUT /projects/{id}/hearing-points/{key}`(本文 `{status: "not_applicable"}`)。知らないキーは `HearingPointNotFoundError`(404)、未決でない観点は `HearingPointNotOpenError`(409)、生成中は `DocGenerationInProgressError`(409)。根拠の無い状態を許すのは、利用者の画面の操作がそれ自体利用者の決定だから(LLM の出力への取り込み規則は変えない)。
- **最初の発話の規模のカード**: `generate_opening_reply` が規模のカードを付け、「まず、下のカードで…」の文をコードが足す。最初の発話のプロンプトからは「まず、…と質問する」を外した。
- **完了を書かせない**: 「まだ確認できていない観点」の節に `_MISSING_POINTS_NOTE` を足した。

- **(2回目)答えなかったカードの付け直し**: `_record_user_turn` が(最新の AI の発言のカード、今回の回答)を返し、`carry_over_cards(previous, answered, states, new_id)` が、答えず観点がまだ未決のカードを id を振り直して返す。返信では付け直すカードを先に置き、その観点は LLM のカードの候補から外す。
- **(2回目)問いの保証**: `_ensure_question(message, cards, targets)` は、カードが無く、本文に「？」「?」が無く、聞くべき観点が残っているとき、先頭の観点の問い(`_NEXT_QUESTION_TEMPLATE`)を足す。
- **(2回目)任意の観点**: `HearingMessageRequest.continue_optional`。必須がそろった後、`continue_optional` か任意の観点のカードへの回答があり、`open_optional` が残っていれば、未決の任意の先頭3つ(`describe_points` で形を作る)を候補に返信を作る。それ以外はまとめ。

- **(3回目)問いを1つに**: `CARD_LIMIT = 1`。`_next_targets(states, scale)` が次に聞く観点を1つ選ぶ。答えなかったカードは `carry_over_cards(...)[:1]` で付け直し、`_compose_reply(code_card=...)` で LLM にはカードを作らせない(`_CODE_CARD_NOTE`)。`_CARD_INSTRUCTIONS` は「問いを1つだけ。カードがあるときは本文で質問しない」。
- **(3回目)カードだけの回は判定を呼ばない**: `stream_reply` は、送信の `message` が空で、判定が済んでいる(`hearing_check` があり、観点の表の行がある)ときは `judge_points` を呼ばない。済んでいない(作成時の判定の失敗・直近の判定の失敗・以前の判定のプロジェクト)ときは呼ぶ。`continue_optional` だけの送信は、`_CONTINUE_OPTIONAL_MESSAGE` を利用者の発言として残す。
- **(3回目)作成時の判定**: `generate_opening_reply` が先に `judge_points` を呼び(失敗しても続ける)、判定後の表で次の観点の問いを付ける。最初の発話も `_compose_reply`(構造化出力)で作る。判定でプロジェクトの列が変わるので、commit の後に `refresh` する(作成のルートがそのまま応答に詰めるため)。

テスト: `test_chat_history_repository.py`(同じトランザクションでも足した順)、`test_chat_service.py`(対象外にすると完了判定を作り直す・3種類の拒否・completed は revising に・最初の発話のカード・プロンプト)、統合テスト(最初の発話のカードと PUT の 200/409/404/422)。2回目: `test_hearing_cards.py`(付け直し)、`test_hearing_points.py`(`open_optional`・`describe_points`)、`test_chat_service.py`(付け直し・決まった観点は付け直さない・問いの保証・任意を続ける・任意のカードで続く・自由な文ならまとめ)。3回目: `test_hearing_cards.py`(既定1件・1枚)、`test_chat_service.py`(問いは1つ・2枚目を捨てる・作成時の判定・書いてある観点を聞き直さない・判定の失敗でも最初の発話・カードだけで判定を呼ばない・文があれば呼ぶ・未判定や失敗の後は呼ぶ・続けるだけは呼ばない・付け直しのカード)、統合テスト(作成時の判定の分)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ChatService.stream_reply`(`_record_user_turn`・`_compose_reply`)と `_build_messages`・`HearingMessageRequest` | pytest(`test_chat_service.py`) | `FakeLLM`(`structured_by_schema` で判定と返信に別の値)と `_RecordingLLM`(判定と返信の `messages` を記録し、返信は指定したカードを返す)── LLM は外部の API なので差し替える。DB はインメモリ SQLite | 第一テスト(統合スモーク): 1回の送信で判定と返信の2回の構造化出力を呼ぶ。回答 → 発言の本文・`selected`・`adopted` と根拠・判定に渡る表、規模のカードの回答で規模が入る、3種類の違反と古い発言のカードは拒んで何も残さない、候補の外のカードを捨てる、規模が未決ならコードの規模のカード、空の返信の扱い、カードを文にして AI の発言に足す、本文の検証 |
| `send_hearing_message`(ルート) | pytest(`test_chat_stream_errors.py`) | `FakeLLM` と `_FailingReplyLLM`(判定は通り、返信の構造化出力だけが失敗し続ける)。再試行の待ちは 0 秒に差し替える | 本文 → `event: cards` → `[DONE]` の順、返信の失敗は `LLM_API_ERROR` で発言を残さない、回答の誤りは `INVALID_CARD_ANSWER` |
| `E2eFakeLLM` の返信 | pytest(`test_fake_llm_e2e.py`) | なし ── 偽 LLM は検証される側。プロンプトは本物の `_build_messages` で作る | 候補の先頭の観点のカード1枚、規模をコードに任せるときはカード無し |
| ルーティングと DI の配線 | pytest `-m integration`(`test_projects_flow.py`、実 PostgreSQL) | `FakeLLM`(判定の列は Phase 34 のまま、返信は本文だけ) | 1往復目の応答に `event: cards`、2往復目で規模のカードを選ぶと規模が「社内」・規模の観点が採用、履歴に「【規模】社内の人が使う」と `selected` |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_chat_service.py tests/unit/test_chat_stream_errors.py tests/unit/test_fake_llm_e2e.py
```

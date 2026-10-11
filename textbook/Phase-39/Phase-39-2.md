# Phase-39-2: 判定の直し ── 決まったと言える条件・利用者の発言だけが決める観点・認証

## この章の目的

[39-1](./Phase-39-1.md) で見つけた原因(技術スタック・規模を初期入力から推し量る、環境に技術スタックが入る、認証を聞かない、最新の答えの取りこぼし、自由回答が「採用」になる、完了の誤宣言)を、観点の定義と判定・返信・要件定義書の生成で直す。直しの範囲はユーザーが選んだ4つ。再測定の途中で見つけた2つ(文で聞いた問いの取りこぼし、技術スタックの要約の縮み)も、同じ直しの範囲として足した([39-3](./Phase-39-3.md))。

自動実装モード: on([introduction](./Phase-39-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/hearing/points.py`](../samples/backend/app/hearing/points.py) | 更新 | `PointDef.done_when`(決まったと言える条件)・`confirm_in_chat`(規模・技術スタック)。セキュリティの問いにログイン。`merge_judgement(..., user_messages=)` が採用とチャットで確かめる観点を利用者の発言からだけ取り込む |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | 判定のプロンプトの規則(条件・自由回答・技術スタックの要約)と表の「決まったと言える条件」列、直前の問いの観点を添える(`_LATEST_QUESTION_NOTE`)、`user_messages` を渡す、カードの指示に条件、完了の宣言を除く(`_drop_completion_claims`) |
| [`app/documents/requirements/drafting.py`](../samples/backend/app/documents/requirements/drafting.py) | 更新 | 生成の規則に「技術・外部サービスは会話の原文から落とさず」「ログインが要るなら認証の機能要件を Must」 |
| ── ここからテスト ── | | |
| [`tests/unit/test_hearing_points.py`](../samples/backend/tests/unit/test_hearing_points.py) | 更新 | `user_messages` の規則、チャットで確かめる観点は規模と技術スタックだけ |
| [`tests/unit/test_chat_service.py`](../samples/backend/tests/unit/test_chat_service.py) | 更新 | 作成時の判定で規模・採用を取り込まない、表の条件列、直前の問いの観点(カード・文)、完了の宣言を除く、カードの指示の条件 |
| [`tests/unit/test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py) | 更新 | `merge_judgement` の新しい引数 |

## 要点の抜粋

観点の定義に、決まったと言える条件と、チャットで確かめる印を持たせる。

```python
# app/hearing/points.py
@dataclass(frozen=True)
class PointDef:
    ...
    done_when: str
    confirm_in_chat: bool = False

PointDef(
    key="tech",
    ...
    done_when=(
        "サーバー側(または全体)の言語・フレームワークと、置き場所(クラウド・VPS・"
        "社内サーバーなど)が分かる。AI を使うシステムなら、使う AI(LLM)も。"
        "DB やライブラリの名前だけでは決まっていない"
    ),
    confirm_in_chat=True,
),
```

取り込みの規則。根拠の無い決定を捨てる(Phase 34)に、利用者の発言の条件を足した。

```python
# app/hearing/points.py
def merge_judgement(previous, judged, *, user_messages: Collection[str]) -> dict[str, PointState]:
    ...
        needs_user = state.status == "adopted" or (
            point_def(state.key).confirm_in_chat and state.status != "open"
        )
        if needs_user and not any(e in user_messages for e in state.evidence):
            continue
```

判定には、直前の AI の問いの観点を添える。カードが無い問い(文の問い)は記録していないが、返信と同じ計算で前の表から分かる。

```python
# app/services/chat_service.py(judge_points)
latest_ai = next((e for e in reversed(history) if e.sender == "ai"), None)
asked = [card.point_key for card in cards_from_json(latest_ai.cards if latest_ai else None)]
if latest_ai is not None and not asked:
    asked = [d.key for d in _next_targets(previous, as_scale(project.hearing_scale))]
if asked:
    prompt += _LATEST_QUESTION_NOTE.format(points=...)
```

未決の必須が残る間は、返信から完了を宣言する文を除く(プロンプトの `_MISSING_POINTS_NOTE` だけでは止まらなかった)。

```python
# app/services/chat_service.py(stream_reply)
if not is_sufficient(states, as_scale(project.hearing_scale)):
    message = _drop_completion_claims(message)  # 「揃いました」「準備が整い」「ボタンを押」などの文
message = _ensure_question(message, cards, targets)
```

## 設計判断

### 条件はプロンプトに渡し、規模と技術スタックはコードで守る

「決まったと言える条件」は判定の LLM に渡すだけで、守るかは LLM 次第になる。実際、2回目の簡易モードの作成時に、判定は条件(DB の名前だけでは未決)を無視して、技術スタックを「決定」にした。そこで、推測で埋まると影響が大きい2つ(規模は後の必須を切り替え、技術スタックは設計の全体が創作になる)は、コードの規則で「利用者の発言が根拠のときだけ」決まるようにした(`confirm_in_chat`)。[Phase 33-1](../Phase-33/Phase-33-1.md) の所見3「技術スタックは、簡易モードでも必ず聞く観点にする」を、コードで保証した形。初期入力の開発環境のフォームを埋めた利用者にも、技術スタックはチャットで一度確かめる(カードのおすすめにフォームの値が出るので、選ぶだけで済む)。

### 「採用」は初期入力からは生まれない

「採用」は「AI の提案に利用者が同意した」の意味なので、根拠は利用者の発言でなければならない。初期入力・添付だけを根拠にした採用は、AI の推測と同じなので捨てる。決定(利用者が自分の言葉で書いた)は初期入力からでもよい(目的・コア機能は初期入力で決まってよい)。

### 直前の問いの観点を添える

判定の LLM は16観点を一度に見るため、最新の答えを取りこぼすことがあった(再現で4回中2回)。直前の問いの観点を添えると6回中6回取り込んだ。問いを1回に1つにした(Phase 35 完了後の調整3回目)ので、直前の問いの観点は1つに決まる。文で聞いた問いも、返信と同じ `_next_targets` の計算で前の表から分かるので、新しい列は要らない。

### 技術スタックの要約は名前を落とさない

要件定義書の生成は会話と観点の表を読むが、表の要約(「Next.jsとFastAPIを用いVPSにDockerでデプロイする」)を優先し、会話にある Gemini・PostgreSQL・Redis を落とした。生成のプロンプトに「会話の原文から拾う」を足しても落ちたので、判定の段階で技術スタックの要約に名前をすべて残させた(再現で3回とも残り、その表で要件定義書の CON に Gemini を含む全部が載った)。

### 認証はヒアリングと生成の両方で

セキュリティの問いと条件に「ログインの要否・方法」を足した(ヒアリング)。生成のプロンプトにも「ログインが要る・本人以外に見せないなら、認証の機能要件を Must で書く。方法を言っていなければ推測」を足した(要件定義書)。片方だけだと、聞いても要件に落ちない、または聞かないまま要件だけ推測で増える。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `merge_judgement`・`POINT_DEFS` | pytest(`test_hearing_points.py`) | スタブ不要 ── 対象が純粋(副作用なし)で、LLM・DB を呼ばないため | 初期入力だけを根拠にした採用・規模・技術スタックは取り込まず、目的の決定は取り込む。利用者の発言が根拠に混ざれば採用を取り込む。チャットで確かめる観点は規模と技術スタックだけ |
| `ChatService.judge_points`・`generate_opening_reply` | pytest(`test_chat_service.py`) | LLM は記録するスタブ(`_RecordingLLM`)、DB はインメモリ SQLite | 作成時に規模・技術スタックの採用を取り込まず、最初の問いは規模のカード。判定の表に「決まったと言える条件」。直前の AI の発言のカードの観点、カードが無ければ次に聞く観点を添える |
| `ChatService.stream_reply`・`_drop_completion_claims`・`_build_messages` | pytest(`test_chat_service.py`) | LLM は決まった応答を返すスタブ(`FakeLLM`) | 未決の必須が残る間は「揃いました」「準備が整い」「生成してください」の文が返信に残らない。ほかの文と改行は残る。カードにする観点に条件が渡る |
| 偽 LLM の判定 + `merge_judgement` | pytest(`test_fake_llm_e2e.py`) | スタブ不要 ── 偽 LLM(`E2eFakeLLM`)そのものが対象 | 新しい引数でも、偽 LLM の判定で十分になる(根拠は利用者の発言) |
| 要件定義書のプロンプト(`drafting.py`) | pytest(`test_doc_generator_service.py`、既存) | LLM はスタブ | 規則の文を足しただけ。既存のテストが `build_requirements_messages` を通す(#15 の import) |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_hearing_points.py tests/unit/test_chat_service.py tests/unit/test_fake_llm_e2e.py tests/unit/test_doc_generator_service.py
```

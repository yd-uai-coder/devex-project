# 作成：Phase-2-3｜更新：Phase-2-5,6-3,6-5,6-6,8-5,15-3,24(ゴール3後の調整),34-2,35-2,35(完了後の調整),36-2,39-1,40-1
# 写経レベル: コア ── MVPコアループ(ヒアリングフロー)そのもの。LangGraphを使わない設計判断も含む。
# Phase-2-5:追記 ── app.services.llm_retry.invoke_with_retry
# Phase-6-3:追記 ── app.models.prompt_template.PromptTemplate,
#   app.repositories.prompt_template.PromptTemplateRepository
# Phase-6-5:追記 ── time, structlog, app.services.llm_retry.prompt_char_count
# Phase-15-3:追記 ── app.services.llm_retry.as_llm_error
# Phase-8-5:追記 ── uuid
# Phase-24:追記 ── collections.abc.Sequence, app.services.errors.GenerationFailedError
# Phase-34-2:追記 ── collections.abc.Mapping,
#   app.hearing(POINT_DEFS, JudgedPoint, PointState, Scale, build_summary, initial_states,
#   is_required, is_sufficient, merge_judgement, missing_labels, number_messages,
#   questions_for_reply, scale_after, to_state), app.models.hearing_point.HearingPoint,
#   app.repositories.hearing_point.HearingPointRepository,
#   app.schemas.hearing(EvidenceRead, HearingPointRead, HearingPointsJudgement, HearingPointsRead)
# Phase-35-2:追記 ── dataclasses.dataclass,
#   app.hearing(Card, CardAnswerError, CardOption, PointDef, apply_card_answers, card_as_text,
#   card_targets, card_to_dict, cards_from_json, compose_answer_message, mark_selected,
#   resolve_answers, sanitize_cards, scale_card, scale_of_answer),
#   app.schemas.hearing(CardAnswer, HearingReplyOut), app.services.errors.InvalidCardAnswerError
# Phase-35(完了後の調整):追記 ── app.hearing(is_point_key, point_def),
#   app.services.errors(DocGenerationInProgressError, HearingPointNotFoundError, HearingPointNotOpenError)
#   app.hearing(CARD_LIMIT, carry_over_cards, describe_points, open_optional)
# Phase-35(完了後の調整):追記 ── app.services.errors.LLMQuotaExceededError
# Phase-35(完了後の調整)：削除 ── app.ai.llm.gemini.extract_text_content, app.hearing.questions_for_reply
#   (最初の発話も構造化出力にし、聞く観点の形は describe_points で作る)
# Phase-35-2：削除 ── time, app.services.llm_retry(as_llm_error, prompt_char_count)
#   (返信をストリーミングせず、invoke_with_retry を通すようにした)
# Phase-36-2:追記 ── app.hearing.as_scale, app.repositories.hearing_point.states_from_rows
# Phase-36-2：削除 ── app.hearing(initial_states, to_state), app.models.hearing_point.HearingPoint(states_from_rows とともにリポジトリへ移した)
# Phase-39-1:追記 ── re(返信の完了の宣言を除く)
import json
import re
import uuid
from collections.abc import AsyncIterator, Mapping, Sequence
from dataclasses import dataclass

import structlog
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm.gemini import get_gemini_llm
from app.hearing import (
    CARD_LIMIT,
    POINT_DEFS,
    Card,
    CardAnswerError,
    CardOption,
    JudgedPoint,
    PointDef,
    PointState,
    Scale,
    apply_card_answers,
    as_scale,
    build_summary,
    card_as_text,
    card_targets,
    card_to_dict,
    cards_from_json,
    carry_over_cards,
    compose_answer_message,
    describe_points,
    is_point_key,
    is_required,
    is_sufficient,
    mark_selected,
    merge_judgement,
    missing_labels,
    number_messages,
    open_optional,
    point_def,
    resolve_answers,
    sanitize_cards,
    scale_after,
    scale_card,
    scale_of_answer,
)
from app.models.chat_history import ChatHistory
from app.models.project import Project
from app.models.prompt_template import PromptTemplate
from app.repositories.chat_history import ChatHistoryRepository
from app.repositories.hearing_point import HearingPointRepository, states_from_rows
from app.repositories.prompt_template import PromptTemplateRepository
from app.schemas.generation import HearingCompletionCheck
from app.schemas.hearing import (
    CardAnswer,
    EvidenceRead,
    HearingPointRead,
    HearingPointsJudgement,
    HearingPointsRead,
    HearingReplyOut,
)
from app.services.errors import (
    DocGenerationInProgressError,
    GenerationFailedError,
    HearingPointNotFoundError,
    HearingPointNotOpenError,
    InvalidCardAnswerError,
    LLMQuotaExceededError,
)
from app.services.llm_retry import invoke_with_retry

logger = structlog.get_logger(__name__)

_HEARING_SYSTEM_PROMPT = (
    "あなたはシステム開発の要件定義を支援するAIアシスタントです。"
    "ユーザーが最初に入力した概要・実現したいこと・補足(および添付資料の内容)を踏まえ、"
    "目的や課題、コア機能、想定ユーザー、MVPスコープを対話の中で明確にしてください。"
    "初期入力の段階で箇条書きへの分解や機能の構造化は行われていないため、必要に応じて"
    "あなたが提案し、ユーザーの同意・修正を得てください。"
    "返信の際は、ユーザーが確認を求めていない限り、ユーザーが既に提示した内容をそのまま"
    "要約・反復しないでください。要件を確定するために今何が不足しているかを吟味した上で、"
    "その不足点を埋めるための問いかけに絞って簡潔に返信してください"
    "(シンプルな質問、選択肢の提示など)。"
    # Phase-24:追記
    "要件の確定の確認、ヒアリング内容のまとめ(サマリ)、設計書(要件定義書など)の本文は"
    "チャットに書かないでください。要件がそろったかどうかの判定とまとめの提示はシステムが行い、"
    "設計書は画面のボタンから生成します。"
)

# Phase-6-6：更新(ヒアリング完了バナーが、まだ確認事項が残っている段階で早期に表示される不具合が
# あった。LLMが根拠の乏しい条件も「満たした」と楽観判定していたため、判定を厳格化する)
# _COMPLETION_CHECK_PROMPT = (
#     "これまでの対話を読み、要件ヒアリングとして次の5条件を満たしているか判定してください。\n"
#     "(1) 目的・課題が明確である\n"
#     "(2) コア機能が最低1つ以上「誰が・何を・なぜ」のレベルで具体化されている\n"
#     "(3) 想定ユーザー像が把握できている\n"
#     "(4) MVPスコープ(今回作る/作らない)の認識合わせができている\n"
#     "(5) 技術的な強い制約・希望の有無を確認できている(環境設定が未入力の場合のみ必須)\n"
#     "十分だと判断した場合は、ユーザーへ提示するための構造化された要約(summary)を書いてください。"
#     "不十分な場合は、summaryは簡潔な現状整理とし、missing_pointsに不足している観点を具体的に列挙してください。"
# )
# ↓↓
# Phase-34-2：更新
# _COMPLETION_CHECK_PROMPT = (
#     "これまでの対話を読み、要件ヒアリングとして次の5条件を満たしているか厳格に判定してください。\n"
#     "(1) 目的・課題が明確である\n"
#     "(2) コア機能が最低1つ以上「誰が・何を・なぜ」のレベルで具体化されている\n"
#     "(3) 想定ユーザー像が把握できている\n"
#     "(4) MVPスコープ(今回作る/作らない)の認識合わせができている\n"
#     "(5) 技術的な強い制約・希望の有無を確認できている(環境設定が未入力の場合のみ必須)\n"
#     "判定ルール:\n"
#     "・各条件は、対話中の【ユーザーの発言】に明確な根拠がある場合にのみ「満たした」とみなす。"
#     "AIが提案・推測しただけの内容や、ユーザーが未回答の内容は根拠として認めない。\n"
#     "・AIの直近の発言がユーザーへの質問を含み、ユーザーがまだ回答していない場合は、"
#     "その質問に関わる条件は未達とする。\n"
#     "・「【確認したい事】」としてAIが挙げた項目のうち、ユーザーの回答が得られていないものが"
#     "1つでも残っている場合は未達とする。\n"
#     "・1つでも判断に迷う条件があれば、is_sufficientはfalseとする(早すぎる完了判定は、"
#     "ユーザーに不十分な内容で設計書を生成させてしまうため、遅すぎる判定より不利益が大きい)。\n"
#     "5条件をすべて満たした場合のみis_sufficient=trueとし、ユーザーへ提示するための構造化された要約"
#     "(summary)を書いてください。"
#     "不十分な場合は、summaryは簡潔な現状整理とし、missing_pointsに不足している観点を必ず具体的に列挙してください。"
# ↓↓
_POINTS_JUDGE_PROMPT = (
    "これまでの対話を読み、下の観点の表の各観点について、状態・決めたこと・根拠を判定してください。"
    "ユーザー側の発言の先頭にある[#n]が、その発言の番号です。\n"
    "状態:\n"
    "・decided: ユーザーが自分の言葉で決めた\n"
    "・adopted: AIが出した提案・選択肢に、ユーザーが同意した\n"
    "・not_applicable: この観点はこのシステムには要らない、とユーザーが答えた\n"
    "・open: まだ決まっていない(聞いていない、答えていない、「決めていない」と答えた)\n"
    "判定の規則:\n"
    "・根拠(evidence)は、その観点を決めたユーザー側の発言の番号だけを挙げる。AIの発言は根拠にしない。\n"
    "・AIが提案・推測しただけで、ユーザーが答えていない観点はopenにする。\n"
    # Phase-39-1:追記
    "・decided・adoptedにするのは、その観点の「決まったと言える条件」を満たすときだけ。"
    "一部しか分からない(例: 技術スタックでDBの名前だけ)ならopenにする。"
    "ほかの観点のことを書いた発言を、この観点の根拠にしない。\n"
    "・ユーザーが自分の言葉で内容を書いたら、AIの例や選択肢と似ていてもdecidedにする。"
    "adoptedは、選択肢を選んだ・AIの提案に「それでよい」などと同意しただけの場合。\n"
    "・今の状態がopen以外の観点は、ユーザーが言い直した場合だけ変える。\n"
    # Phase-39-1：更新
    # "・summaryは、決めたことを1文で簡潔に書く(openなら空でよい)。\n"
    # ↓↓
    "・summaryは、決めたことを1文で簡潔に書く(openなら空でよい)。ただし技術スタック(tech)は、"
    "ユーザーが挙げた言語・フレームワーク・DB・使うAI(LLM)・置き場所などの名前を1つも落とさずに書く"
    "(設計書の生成はこの要約を読むため)。\n"
    "・scaleは、規模の観点が決まったときだけ、personal(自分と数人)/internal(社内)/"
    "public(誰でも登録できるサービス)のどれかにする。\n"
    # Phase-39-1：更新
    # "観点の表(キー|観点|場面で聞く問いの例|今の状態|決めたこと):\n"
    # ↓↓
    "観点の表(キー|観点|場面で聞く問いの例|決まったと言える条件|今の状態|決めたこと):\n"
    "{table}"
# Phase-39-1:追記
)

# 直前のAIの問いの観点を、判定のプロンプトに添える。判定のLLMは16観点を一度に見るので、
# 最新の答えを取りこぼして未決のまま残すことがある(同じカードが付け直され、利用者が同じことを
# 二度答える)。どの観点への答えかをコードが示す
_LATEST_QUESTION_NOTE = (
    "\n直前のAIの問いは、観点 {points} についてのもの。最新のユーザーの発言がその答えなら、"
    "その観点を必ず判定する。"
)

# Phase-6-6:追記 ── check_completionの決定論的ガード。LLMが楽観的にtrueを返しても、
# ユーザーの実発話(sender='user'、intake/attachment/aiは含めない)がこの件数に満たなければ
# 完了とみなさない。プロンプトだけに頼らず、コード側で下限を保証する。
# Phase-34-2：更新
# _MIN_USER_TURNS_FOR_COMPLETION = 3
#
# # ユーザー発話の回数が足りないときに完了判定へ足す不足点。対話の観点ではないので、
# # 返信の生成に渡す「まだ確認できていない観点」には含めない
# _TOO_FEW_TURNS_POINT = "対話がまだ十分に進んでいません"
#
# # 完了判定が十分になったときの返信。LLMで書かせず、判定のsummaryをそのまま見せることで、
# ↓↓
# Phase-35(完了後の調整):追記
# 観点の表の画面から「対象外」にした観点の、決めたことの文
_SKIPPED_BY_USER_SUMMARY = "後で決める(画面で対象外にした)"

# Phase-35(完了後の調整):追記
# 「任意項目についてヒアリングを続ける」で、利用者の発言として残す文(判定のLLMは呼ばない)
_CONTINUE_OPTIONAL_MESSAGE = "任意の項目についてもヒアリングを続けてください"

# 最初の発話の後ろにコードが足す文。規模は後の必須を切り替えるので、最初にカードで聞く
_OPENING_SCALE_CARD_LINE = "まず、下のカードで、使う人の規模を選んでください。"

# 完了判定が十分になったときの返信。LLMで書かせず、観点の表から組み立てたまとめを見せることで、
# チャットのまとめと画面の生成ボタンが同じ判定から同時に出るようにする
# Phase-35-2:追記
# 返信のLLMに、選択肢カードの書き方と、カードにしてよい観点を伝える(返信の生成のときだけ足す)
# Phase-35(完了後の調整)：更新(問いを1つにする指示。システムがカードを出すときの指示を、規模以外にも使う形にした)
# _CARD_INSTRUCTIONS = (
#     "\n\n[選択肢カード]\n"
#     "下の観点のうち、選択肢で答えやすいものは、本文ではなく選択肢カード(cards)で聞いてください。\n"
#     "・問いは場面で聞く(例: 「夜中や休日に止まっていたら、どのくらいで困りますか」)。"
#     "専門用語(可用性・RTO など)で聞かない。\n"
#     "・選択肢は2〜4個。各選択肢の結果(result)には、選んだときのコスト・手間・後から変えられるかを"
#     "1文で書く。\n"
#     "・おすすめ(recommended)は1つだけ選び、その理由(reason)を、これまでの対話の内容に結びつけて"
#     "1文で書く。\n"
#     "・目的やコア機能のように自由に答える方がよい観点は、カードにせず本文で聞く。\n"
#     "・カードで聞く問いを本文に繰り返さない。本文は短くする。\n"
#     "カードにしてよい観点(キー: 観点(問いの例)):\n"
#     "{targets}"
# )
# _SCALE_CARD_NOTE = (
#     "\n\n[選択肢カード]\n規模は、システムが選択肢カードで聞きます。本文では規模を聞かず、"
#     "カード(cards)も返さないでください。本文は短くしてください。"
# )
# ↓↓
_CARD_INSTRUCTIONS = (
    "\n\n[選択肢カード]\n"
    "下の観点について、問いを1つだけ聞いてください。ほかの観点の質問はしないでください。\n"
    "・選択肢で答えやすい観点なら、選択肢カード(cards)を1枚だけ返し、本文では質問せず、"
    "短い前置きだけを書く。\n"
    "・目的やコア機能のように自由に答える方がよい観点なら、カードは返さず、本文でその観点の"
    "質問を1つだけ書く。\n"
    "・問いは場面で聞く(例: 「夜中や休日に止まっていたら、どのくらいで困りますか」)。"
    "専門用語(可用性・RTO など)で聞かない。\n"
    "・選択肢は2〜4個。各選択肢の結果(result)には、選んだときのコスト・手間・後から変えられるかを"
    "1文で書く。\n"
    "・おすすめ(recommended)は1つだけ選び、その理由(reason)を、これまでの対話の内容に結びつけて"
    "1文で書く。\n"
    "聞く観点(キー: 観点(問いの例)):\n"
    "{targets}"
)
# 規模のカードと、前の返信で答えなかったカードの付け直しは、システムがカードを出す。そのときの指示
_CODE_CARD_NOTE = (
    "\n\n[選択肢カード]\n{label}は、システムが選択肢カードで聞きます。本文では質問せず、"
    "カード(cards)も返さず、短い前置きだけを書いてください。"
)
# Phase-35(完了後の調整):追記
# 未決の必須の観点が残っている間、返信のAIが完了を宣言しないようにする(完了はシステムが観点の
# 表から判定し、そろえばまとめと生成ボタンを出す。AIが先に「そろった」と書くと、画面と食い違う)
_MISSING_POINTS_NOTE = (
    "この一覧が残っている間は、要件がそろった・設計書を生成できる・生成ボタンを押す、などとは"
    "書かないでください。一覧の観点を聞いてください。"
# Phase-39-1:追記
)
# それでも返信のAIが完了を宣言した文(_drop_completion_claimsが除く)
_COMPLETION_CLAIM = re.compile(
    r"(揃|そろ)(いました|った)|すべて.*(確認|把握)(でき|し)ました|準備が(整|ととの)い"
    r"|設計書を生成(して|でき|する)|生成(の)?ボタン|ボタンを押"
)
# Phase-35(完了後の調整):追記 ── 返信に問いもカードも無いときに、コードが足す次の問い
_NEXT_QUESTION_TEMPLATE = "次に、{label}について教えてください。(例: {question})"
# Phase-40-1:追記 ── 「？」が無くても、利用者に答えを求める文(依頼・問いの言い切り)なら問いとみなす
_QUESTION_ENDING = re.compile(
    r"(ください|ますか|ませんか|ですか|でしょうか)(?=[。．.!！」)）]|\s|$)"
)
_EMPTY_REPLY_WITH_CARDS = "次の点を、カードから選ぶか、チャットで答えてください。"

_SUMMARY_REPLY_TEMPLATE = (
    "ヒアリングの内容をまとめました。\n\n{summary}\n\n"
    "この内容でよければ「この内容で設計書を生成する」を押してください。"
    "直したい点があれば、チャットで伝えてください。"
)

_OPENING_TURN_PROMPT = (
    "これはこのプロジェクトのヒアリング対話における、あなたの最初の返信です。"
    "ユーザーから提示された内容をそのまま繰り返さず、次の形式で日本語で回答してください。\n"
    "1. 1行目:「以上を元に詳細のヒアリングを進めていきます。」という一文だけを書く\n"
    "2. 次の行に見出し「【確認したい事】」を書く\n"
    "3. これから対話の中で確認していきたい点を3つ、「・」で始まる箇条書きで簡潔に列挙する\n"
    # Phase-35(完了後の調整)：更新(最初の質問は規模の選択肢カードで行う)
    # "4. 1行空けて、「まず、」に続けて箇条書きの1つ目について具体的な質問を1つだけ書く\n"
    # "この形式以外の前置きや締めの言葉は書かないでください。"
    # ↓↓
    # Phase-35(完了後の調整)：更新(最初の問いは判定後の次の観点。聞き方は[選択肢カード]の指示に従う)
    # "この形式以外の前置きや締めの言葉、質問は書かないでください"
    # "(最初の質問はシステムが選択肢カードで行います)。"
    # ↓↓
    "この形式以外の前置きや締めの言葉は書かないでください。"
    "最初の問いの聞き方は、システムプロンプトの[選択肢カード]の指示に従ってください。"
)


class ChatService:
    """プロジェクトのヒアリングチャット(対話生成・完了判定)を担当するサービス。

    既存の汎用デモ(app/ai/graph/)とは異なりLangGraphを使わない: ヒアリングフローは
    「毎回LLM応答生成→完了判定」という一本道の処理であり、真の分岐を持つLangGraphの
    StateGraphを導入するのは過剰なため、素のLangChainメッセージで組み立てる。
    """

    def __init__(self, session: AsyncSession) -> None:
        # session: DB操作用の非同期セッション
        self._session = session
        self._chat_histories = ChatHistoryRepository(session)
        # Phase-6-3:追記
        self._prompt_templates = PromptTemplateRepository(session)
        # Phase-34-2:追記
        self._hearing_points = HearingPointRepository(session)

    # Phase-8-5:追記 ── ルーターがRepositoryを直接参照しない方針への統一(get_hearing_history用)
    async def list_history(self, project_id: uuid.UUID) -> list[ChatHistory]:
        """プロジェクトのチャット履歴を送信日時の昇順(発生順)で取得する。"""
        return await self._chat_histories.list_for_project(project_id)

    # Phase-24：更新(docstring: 先に完了判定を行い、その結果で返信を決める)
    async def stream_reply(
        self,
        project: Project,
        *,
        user_message: str,
        card_answers: Sequence[CardAnswer] = (),
        # Phase-35(完了後の調整):追記
        continue_optional: bool = False,
        llm=None,
    ) -> AsyncIterator["str | ReplyCards"]:
        """ユーザーメッセージ(と選択肢カードへの回答)を永続化し、先に観点の表の判定を行ってから、
        その結果に応じたAI応答を返す。返信の本文(str)を返した後、選択肢カードがあれば
        `ReplyCards`を返す。AI応答はchat_historiesへ、観点の状態はhearing_pointsへ、完了判定の
        結果はprojects.hearing_checkへ保存する。

        - カードへの回答は、LLMを呼ばずにコードが「AIの提案を採用」と記録する。選んだ内容と
          文は1つの発言にまとめ、その発言を根拠にする(app/hearing/cards.py)。
        - 完了は、必須の観点がすべて未決以外かどうかをコードが決める(app/hearing/points.py)。
        - 十分なら、LLMで返信を作らず、観点の表から組み立てたまとめを決まった形で返す(まとめと
          生成ボタンを同じ判定から同時に出すため)。
        - 足りなければ、未決の必須の観点とカードにしてよい観点を渡し、本文とカードを構造化出力で
          1回で作る(本文はまとめて1回で返す。トークンごとには流さない)。
        - 前の発言のカードのうち答えなかったもの(観点がまだ未決)は、次の返信にコードが付け直す。
          カードが1枚も無く、聞くべき観点が残っているときは、次の問いをコードが本文に足す
          (設問の取りこぼしと、問いの無い返信で止まったように見えるのを防ぐ)。
        - 必須がそろった後は、利用者が任意の観点を続けると選んだとき(continue_optional、または
          任意の観点のカードに答えたとき)だけ、未決の任意の観点を聞く。それ以外はまとめを返す。
        - 判定に失敗したら、観点の表は前のまま残し、保存済みの完了判定は消す(古い判定で生成ボタンが
          残らないように。表があって完了判定が無い状態を、画面は「表が直近の発言を反映していない」と
          読む)。チャット自体は止めない。

        completed(生成済み)のプロジェクトへ新規メッセージが送られた場合はrevising(修正中)へ
        遷移させる(ユーザーがヒアリング内容を修正し、再生成する意思を示したものとみなす)。
        """
        # Phase-35(完了後の調整)：更新(カードだけの回は判定を呼ばない。次に聞く問いは1つ)
        # if project.status == "completed":
        #     project.status = "revising"
        # previous_cards, answered = await self._record_user_turn(
        #     project, user_message, card_answers
        # )
        #
        # llm = llm or get_gemini_llm()
        # try:
        #     states = await self.judge_points(project, llm=llm)
        # except GenerationFailedError:
        #     logger.warning("hearing_check_failed")
        #     states = None
        # if states is None:
        #     project.hearing_check = None
        #     states = await self._load_states(project)
        # else:
        #     check = _completion_from(states, project.hearing_scale)
        #     project.hearing_check = check.model_dump()
        #     if check.is_sufficient:
        #         scale = _as_scale(project.hearing_scale)
        #         optional = open_optional(states, scale)
        #         wants_optional = continue_optional or any(
        #             not is_required(card.point_key, scale) for card, _ in answered
        #         )
        #         if not (wants_optional and optional):
        #             reply = _SUMMARY_REPLY_TEMPLATE.format(summary=check.summary.strip())
        #             await self._chat_histories.add(
        #                 project_id=project.id, sender="ai", message=reply
        #             )
        #             await self._session.commit()
        #             yield reply
        #             return
        #
        # scale = _as_scale(project.hearing_scale)
        # if is_sufficient(states, scale):
        #     targets = open_optional(states, scale)[:CARD_LIMIT]
        #     questions = describe_points(targets)
        # else:
        #     targets = card_targets(states, scale)
        #     questions = questions_for_reply(states, scale)
        # carried = carry_over_cards(previous_cards, answered, states, lambda: str(uuid.uuid4()))
        # carried_keys = {card.point_key for card in carried}
        # message, new_cards = await self._compose_reply(
        #     project,
        #     questions=questions,
        #     targets=[d for d in targets if d.key not in carried_keys],
        #     llm=llm,
        # )
        # cards = [*carried, *(c for c in new_cards if c.point_key not in carried_keys)]
        # message = _ensure_question(message, cards, targets)
        # ↓↓
        if project.status == "completed":
            project.status = "revising"
        # 判定のLLMを呼ぶか: 利用者が文を書いたとき、またはまだ判定が済んでいないとき(作成時の
        # 判定の失敗・直近の判定の失敗・以前の判定のプロジェクト)。カードの回答だけ・「任意を
        # 続ける」だけの送信は、読むべき新しい文が無いので呼ばない(選んだ観点はコードが記録する)
        judged = project.hearing_check is not None and bool(
            await self._hearing_points.list_for_project(project.id)
        )
        needs_judge = bool(user_message.strip()) or not judged
        previous_cards, answered = await self._record_user_turn(
            project, user_message, card_answers, continue_optional=continue_optional
        )

        # 「or」の理由：テスト時に本物のGemini APIを叩かせないための差し替え(DI)
        llm = llm or get_gemini_llm()
        states: dict[str, PointState] | None
        if needs_judge:
            try:
                states = await self.judge_points(project, llm=llm)
            except GenerationFailedError:
                logger.warning("hearing_check_failed")
                states = None
        else:
            states = await self._load_states(project)
        if states is None:
            project.hearing_check = None
            states = await self._load_states(project)
        else:
            check = _completion_from(states, project.hearing_scale)
            project.hearing_check = check.model_dump()
            if check.is_sufficient:
                # Phase-36-2：更新
                # scale = _as_scale(project.hearing_scale)
                # ↓↓
                scale = as_scale(project.hearing_scale)
                optional = open_optional(states, scale)
                wants_optional = continue_optional or any(
                    not is_required(card.point_key, scale) for card, _ in answered
                )
                if not (wants_optional and optional):
                    reply = _SUMMARY_REPLY_TEMPLATE.format(summary=check.summary.strip())
                    await self._chat_histories.add(
                        project_id=project.id, sender="ai", message=reply
                    )
                    await self._session.commit()
                    yield reply
                    return

        # 次に聞く問いは1つ。前の返信で答えなかったカード(観点がまだ未決)があれば、それを付け直す
        carried = carry_over_cards(previous_cards, answered, states, lambda: str(uuid.uuid4()))[:1]
        # Phase-36-2：更新
        # targets = _next_targets(states, _as_scale(project.hearing_scale))
        # ↓↓
        targets = _next_targets(states, as_scale(project.hearing_scale))
        if carried:
            targets = [point_def(carried[0].point_key)]
        message, cards = await self._compose_reply(
            project,
            questions=describe_points(targets),
            targets=targets,
            code_card=carried[0] if carried else None,
            llm=llm,
        )
        # Phase-39-1:追記
        if not is_sufficient(states, as_scale(project.hearing_scale)):
            message = _drop_completion_claims(message)
        message = _ensure_question(message, cards, targets)
        await self._chat_histories.add(
            project_id=project.id,
            sender="ai",
            message=message,
            cards=[card_to_dict(card) for card in cards] or None,
        )
        await self._session.commit()
        yield message
        if cards:
            yield ReplyCards(cards=[card_to_dict(card) for card in cards])

    # Phase-35-2:追記
    # Phase-35(完了後の調整)：更新(返り値: 最新のAIの発言のカードと今回の回答。continue_optional)
    async def _record_user_turn(
        self,
        project: Project,
        user_message: str,
        card_answers: Sequence[CardAnswer],
        *,
        continue_optional: bool = False,
    ) -> tuple[list[Card], list[tuple[Card, int]]]:
        """利用者の発言を保存する。カードへの回答があれば、選んだ内容を発言の本文に足し、カードに
        選択を書き込み、選ばれた観点を「AIの提案を採用」にする(根拠はこの発言)。

        選べるのは最新のAIの発言のカードのうち未回答のものだけ(古い画面から送られた回答は拒む)。
        返り値は(最新のAIの発言のカード、今回の回答)。答えなかったカードの付け直しに使う。
        「任意を続ける」だけの送信は、決まった文を利用者の発言として残す。
        """
        answered: list[tuple[Card, int]] = []
        # Phase-35(完了後の調整)：更新(回答が無くても前のカードを読む)
        # latest_ai: ChatHistory | None = None
        # cards: list[Card] = []
        # if card_answers:
        #     history = await self._chat_histories.list_for_project(project.id)
        #     latest_ai = next((e for e in reversed(history) if e.sender == "ai"), None)
        #     cards = cards_from_json(latest_ai.cards) if latest_ai is not None else []
        # ↓↓
        history = await self._chat_histories.list_for_project(project.id)
        latest_ai = next((e for e in reversed(history) if e.sender == "ai"), None)
        cards = cards_from_json(latest_ai.cards) if latest_ai is not None else []
        if card_answers:
            try:
                answered = resolve_answers(cards, {a.card_id: a.option for a in card_answers})
            except CardAnswerError as exc:
                raise InvalidCardAnswerError(str(exc)) from exc

        # Phase-35(完了後の調整)：更新(「任意を続ける」だけの送信は決まった文を残す)
        # entry = await self._chat_histories.add(
        #     project_id=project.id,
        #     sender="user",
        #     message=compose_answer_message(answered, user_message),
        # )
        # ↓↓
        text = compose_answer_message(answered, user_message)
        if not text and continue_optional:
            text = _CONTINUE_OPTIONAL_MESSAGE
        entry = await self._chat_histories.add(project_id=project.id, sender="user", message=text)
        if not answered or latest_ai is None:
            # Phase-35(完了後の調整)：更新
            # return
            # ↓↓
            return cards, answered
        # JSONの列は中身の書き換えを検知しないため、新しいリストを代入する
        latest_ai.cards = [card_to_dict(card) for card in mark_selected(cards, answered)]
        states = apply_card_answers(await self._load_states(project), answered, str(entry.id))
        await self._hearing_points.save_states(project.id, states.values())
        if (scale := scale_of_answer(answered)) is not None:
            project.hearing_scale = scale
        # Phase-35(完了後の調整):追記
        return cards, answered

    # Phase-35-2:追記 ── 返信の生成を stream_reply から切り出し、構造化出力の1回にした。
    # 以下の履歴・テンプレートの読み込みと _build_messages は、stream_reply にあったもの
    # Phase-35(完了後の調整)：更新(カードは最大1枚。付け直しのカードもシステムが出す。最初の発話からも使う)
    # async def _compose_reply(
    #     self,
    #     project: Project,
    #     *,
    #     questions: Sequence[str],
    #     targets: Sequence[PointDef],
    #     llm,
    # ) -> tuple[str, list[Card]]:
    #     """返信の本文と選択肢カードを、構造化出力の1回で作る。規模のカードはコードが出す。
    #
    #     LLMのカードは、カードにしてよい観点のものだけを確かめてから使う(sanitize_cards)。
    #     単発呼び出しのため、一時的な失敗はinvoke_with_retryでリトライする。
    #     """
    #     asks_scale = any(d.key == "scale" for d in targets)
    #     llm_targets = [] if asks_scale else list(targets)
    #     history = await self._chat_histories.list_for_project(project.id)
    #     template = await self._load_template(project)
    #     messages = _build_messages(
    #         history,
    #         project,
    #         template,
    #         missing_points=questions,
    #         card_targets=llm_targets,
    #         scale_card=asks_scale,
    #     )
    #     structured_llm = llm.with_structured_output(HearingReplyOut)
    #
    #     async def _call() -> HearingReplyOut:
    #         result = await structured_llm.ainvoke(messages)
    #         assert isinstance(result, HearingReplyOut)
    #         return result
    #     result = await invoke_with_retry(_call, messages=messages)
    #     if asks_scale:
    #         cards = [scale_card(str(uuid.uuid4()))]
    #     else:
    #         cards = sanitize_cards(
    #             (
    #                 Card(
    #                     id=str(uuid.uuid4()),
    #                     point_key=card.point_key,
    #                     question=card.question,
    #                     options=tuple(CardOption(o.label, o.result) for o in card.options),
    #                     recommended=card.recommended,
    #                     reason=card.reason,
    #                 )
    #                 for card in result.cards
    #             ),
    #             [d.key for d in llm_targets],
    #         )
    #     message = result.message.strip()
    #     if not message:
    #         if not cards:
    #             raise GenerationFailedError("ヒアリングの返信が空でした")
    #         message = _EMPTY_REPLY_WITH_CARDS
    #     return message, cards
    # ↓↓
    async def _compose_reply(
        self,
        project: Project,
        *,
        questions: Sequence[str],
        targets: Sequence[PointDef],
        code_card: Card | None = None,
        extra_prompt: str | None = None,
        llm,
    ) -> tuple[str, list[Card]]:
        """返信の本文と選択肢カード(最大1枚)を、構造化出力の1回で作る。

        カードをシステムが出すとき(前の返信のカードの付け直し`code_card`、規模のカード)は、LLMには
        前置きの本文だけを書かせる。LLMのカードは、聞く観点のものだけを確かめてから使う
        (sanitize_cards)。単発呼び出しのため、一時的な失敗はinvoke_with_retryでリトライする。
        """
        if code_card is None and any(d.key == "scale" for d in targets):
            code_card = scale_card(str(uuid.uuid4()))
        llm_targets = [] if code_card is not None else list(targets)
        history = await self._chat_histories.list_for_project(project.id)
        template = await self._load_template(project)
        messages = _build_messages(
            history,
            project,
            template,
            missing_points=questions,
            card_targets=llm_targets,
            code_card_label=code_card.label if code_card is not None else None,
        )
        if extra_prompt is not None:
            messages.append(HumanMessage(content=extra_prompt))
        structured_llm = llm.with_structured_output(HearingReplyOut)

        async def _call() -> HearingReplyOut:
            result = await structured_llm.ainvoke(messages)
            assert isinstance(result, HearingReplyOut)
            return result

        result = await invoke_with_retry(_call, messages=messages)
        if code_card is not None:
            cards = [code_card]
        else:
            cards = sanitize_cards(
                (
                    Card(
                        id=str(uuid.uuid4()),
                        point_key=card.point_key,
                        question=card.question,
                        options=tuple(CardOption(o.label, o.result) for o in card.options),
                        recommended=card.recommended,
                        reason=card.reason,
                    )
                    for card in result.cards
                ),
                [d.key for d in llm_targets],
            )
        message = result.message.strip()
        if not message:
            if not cards:
                raise GenerationFailedError("ヒアリングの返信が空でした")
            message = _EMPTY_REPLY_WITH_CARDS
        return message, cards

    # Phase-34-2:追記
    async def judge_points(self, project: Project, *, llm=None) -> dict[str, PointState]:
        """これまでの対話から、観点ごとの状態と根拠をLLMに判定させ、観点の表に取り込んで保存する
        (hearing_points・projects.hearing_scale。commitは呼び出し側)。取り込んだ後の表を返す。

        LLMには利用者側の発言に番号を付けて見せ、返った番号をchat_historiesのidに直す。根拠の
        無い「決定」は取り込まない(merge_judgement)。完了かどうかはLLMに聞かない。

        単発呼び出し(ストリーミングではない)のため、一時的な失敗はinvoke_with_retryでリトライする
        """
        history = await self._chat_histories.list_for_project(project.id)
        template = await self._load_template(project)
        previous = await self._load_states(project)
        numbered = number_messages([(str(entry.id), entry.sender) for entry in history])
        numbers = {message_id: number for message_id, number, _ in numbered}
        # Phase-39-1:追記
        prompt = _POINTS_JUDGE_PROMPT.format(table=_points_table(previous))
        latest_ai = next((e for e in reversed(history) if e.sender == "ai"), None)
        asked = [card.point_key for card in cards_from_json(latest_ai.cards if latest_ai else None)]
        if latest_ai is not None and not asked:
            # 文で聞いた問いは記録していないが、返信と同じ計算で、前の表から聞いた観点が分かる
            asked = [d.key for d in _next_targets(previous, as_scale(project.hearing_scale))]
        if asked:
            points = "・".join(f"{key}({point_def(key).label})" for key in asked)
            prompt += _LATEST_QUESTION_NOTE.format(points=points)
        messages = [
            *_build_messages(history, project, template, numbers=numbers),
            # Phase-39-1：更新
            # HumanMessage(content=_POINTS_JUDGE_PROMPT.format(table=_points_table(previous))),
            # ↓↓
            HumanMessage(content=prompt),
        ]

        llm = llm or get_gemini_llm()
        structured_llm = llm.with_structured_output(HearingPointsJudgement)

        async def _call() -> HearingPointsJudgement:
            result = await structured_llm.ainvoke(messages)
            assert isinstance(result, HearingPointsJudgement)
            return result

        result = await invoke_with_retry(_call, messages=messages)
        ids_by_number = {number: message_id for message_id, number in numbers.items()}
        # Phase-39-1:追記
        user_messages = {str(entry.id) for entry in history if entry.sender == "user"}
        judged = [
            JudgedPoint(
                key=point.key,
                status=point.status,
                summary=point.summary,
                evidence=tuple(
                    dict.fromkeys(ids_by_number[n] for n in point.evidence if n in ids_by_number)
                ),
            )
            for point in result.points
        ]
        # Phase-39-1：更新
        # states = merge_judgement(previous, judged)
        # ↓↓
        states = merge_judgement(previous, judged, user_messages=user_messages)
        project.hearing_scale = scale_after(
            # Phase-36-2：更新
            # states, _as_scale(project.hearing_scale), result.scale
            # ↓↓
            states, as_scale(project.hearing_scale), result.scale
        )
        await self._hearing_points.save_states(project.id, states.values())
        return states

    async def points_view(self, project: Project) -> HearingPointsRead:
        """チャット画面の観点の表(LLMは呼ばない)。表がまだ無いプロジェクトは、全観点を未決で返す。"""
        rows = await self._hearing_points.list_for_project(project.id)
        # Phase-36-2：更新
        # states = _states_from_rows(rows)
        # scale = _as_scale(project.hearing_scale)
        # ↓↓
        states = states_from_rows(rows)
        scale = as_scale(project.hearing_scale)
        history = await self._chat_histories.list_for_project(project.id)
        labels = {
            message_id: label
            for message_id, _, label in number_messages(
                [(str(entry.id), entry.sender) for entry in history]
            )
        }
        stale = bool(rows) and project.hearing_check is None
        return HearingPointsRead(
            scale=scale,
            legacy=not rows and project.hearing_check is not None,
            stale=stale,
            is_sufficient=bool(rows) and not stale and is_sufficient(states, scale),
            points=[
                HearingPointRead(
                    key=d.key,
                    kind=d.kind,
                    label=d.label,
                    question=d.question,
                    required=is_required(d.key, scale),
                    status=states[d.key].status,
                    summary=states[d.key].summary,
                    evidence=[
                        EvidenceRead(message_id=uuid.UUID(message_id), label=labels[message_id])
                        for message_id in states[d.key].evidence
                        if message_id in labels
                    ],
                )
                for d in POINT_DEFS
            ],
        )

    # Phase-35(完了後の調整):追記
    async def mark_point_not_applicable(self, project: Project, key: str) -> HearingPointsRead:
        """観点の表の画面から、未決の観点を「対象外(後で決める)」にする(LLMは呼ばない)。

        判定のAIが決められない観点で、ヒアリングが先へ進めなくなるのを避けるための利用者の操作。
        根拠の発言は持たない(利用者が画面で決めたため)。後でチャットで答えれば、判定のAIが
        言い直しとして上書きできる。完了判定はその場で表から作り直すので、必須がそろえば
        生成のボタンが出る。
        """
        if not is_point_key(key):
            raise HearingPointNotFoundError("観点が見つかりません")
        if project.status == "generating":
            raise DocGenerationInProgressError("設計書の生成中は観点を変えられません")
        states = await self._load_states(project)
        if states[key].status != "open":
            raise HearingPointNotOpenError("未決の観点だけを対象外にできます")
        states[key] = PointState(point_def(key).key, "not_applicable", _SKIPPED_BY_USER_SUMMARY)
        await self._hearing_points.save_states(project.id, states.values())
        if key == "scale":
            project.hearing_scale = None  # 規模を対象外にしたら、個人・小規模の列で数える
        if project.status == "completed":
            project.status = "revising"
        project.hearing_check = _completion_from(states, project.hearing_scale).model_dump()
        await self._session.commit()
        return await self.points_view(project)

    async def _load_states(self, project: Project) -> dict[str, PointState]:
        # Phase-36-2：更新
        # return _states_from_rows(await self._hearing_points.list_for_project(project.id))
        # ↓↓
        return states_from_rows(await self._hearing_points.list_for_project(project.id))

    # Phase-24:追記
    def stored_completion(self, project: Project) -> HearingCompletionCheck:
        """直近の発言で行ったヒアリング完了判定の結果を返す(LLMは呼ばない)。まだ判定していない、
        または直近の判定に失敗したプロジェクトは「十分でない」とする。観点の表を持たない以前の
        プロジェクトは、保存してある5条件の判定をそのまま返す。"""
        if project.hearing_check is None:
            return HearingCompletionCheck(is_sufficient=False, summary="", missing_points=[])
        return HearingCompletionCheck.model_validate(project.hearing_check)

    # Phase-35(完了後の調整)：更新(作成時に初期入力を判定し、判定後の表で次に聞く観点の問いを付ける)
    # async def generate_opening_reply(self, project: Project, *, llm=None) -> str:
    #     """ヒアリング開始直後、ユーザー発話を待たずにAIの最初の発話を生成し永続化する。発話には
    #     規模の選択肢カードを付ける(最初の質問はカードで行う。規模は後の必須を切り替えるため)
    #     (docs/external_design.md SCR-004 2.3節: 「AIの最初の発話は初期ヒアリング入力の
    #     内容を踏まえた理解の要約と確認質問から始まる」)。プロジェクト作成直後に一度だけ
    #     呼ばれる想定。失敗時は例外を伝播させる(致命的でない扱いは呼び出し側=ルート層で行う)。
    #
    #     単発呼び出し(ストリーミングではない)のため、check_completionと同様
    #     invoke_with_retryでリトライする。"""
    #     history = await self._chat_histories.list_for_project(project.id)
    #     template = await self._load_template(project)
    #     messages = [
    #         *_build_messages(history, project, template),
    #         HumanMessage(content=_OPENING_TURN_PROMPT),
    #     ]
    #
    #     llm = llm or get_gemini_llm()
    #
    #     async def _call() -> str:
    #         result = await llm.ainvoke(messages)
    #         return extract_text_content(result.content)
    #
    #     reply = await invoke_with_retry(_call, messages=messages)
    #     reply = f"{reply.rstrip()}\n\n{_OPENING_SCALE_CARD_LINE}"
    #     card = scale_card(str(uuid.uuid4()))
    #     await self._chat_histories.add(
    #         project_id=project.id, sender="ai", message=reply, cards=[card_to_dict(card)]
    #     )
    #     await self._session.commit()
    #     return reply
    # ↓↓
    async def generate_opening_reply(self, project: Project, *, llm=None) -> str:
        """ヒアリング開始直後、ユーザー発話を待たずにAIの最初の発話を生成し永続化する
        (docs/external_design.md SCR-004 2.3節: 「AIの最初の発話は初期ヒアリング入力の
        内容を踏まえた理解の要約と確認質問から始まる」)。プロジェクト作成直後に一度だけ
        呼ばれる想定。失敗時は例外を伝播させる(致命的でない扱いは呼び出し側=ルート層で行う)。

        先に、初期入力・添付資料・開発環境の希望を観点の判定にかけ、書いてある観点を表に埋める
        (書いてあることを聞き直さないため)。判定に失敗しても最初の発話は作る(最初の送信で
        判定し直す)。最初の発話には、判定後の表で次に聞く観点の問いを1つ付ける(規模が未決なら
        規模のカード)。単発呼び出しのため、invoke_with_retryでリトライする。"""
        llm = llm or get_gemini_llm()
        try:
            states = await self.judge_points(project, llm=llm)
            project.hearing_check = _completion_from(states, project.hearing_scale).model_dump()
        except (GenerationFailedError, LLMQuotaExceededError):
            logger.warning("opening_hearing_check_failed")
            states = await self._load_states(project)
        # Phase-36-2：更新
        # targets = _next_targets(states, _as_scale(project.hearing_scale))
        # ↓↓
        targets = _next_targets(states, as_scale(project.hearing_scale))
        reply, cards = await self._compose_reply(
            project,
            questions=describe_points(targets),
            targets=targets,
            extra_prompt=_OPENING_TURN_PROMPT,
            llm=llm,
        )
        if any(card.point_key == "scale" for card in cards):
            reply = f"{reply.rstrip()}\n\n{_OPENING_SCALE_CARD_LINE}"
        reply = _ensure_question(reply, cards, targets)
        await self._chat_histories.add(
            project_id=project.id,
            sender="ai",
            message=reply,
            cards=[card_to_dict(card) for card in cards] or None,
        )
        await self._session.commit()
        # 判定でプロジェクトの列(規模・完了判定)を更新したので、commit で失効した属性を読み直す
        # (呼び出し側がそのまま応答のスキーマに詰めるため)
        await self._session.refresh(project)
        return reply

    # Phase-6-3:追記
    async def _load_template(self, project: Project) -> PromptTemplate | None:
        """project.template_idが設定されている場合、対応するPromptTemplateを取得する
        (未設定、または存在しないIDの場合はNoneを返し、通常のヒアリングプロンプトのみを使う)。"""
        if project.template_id is None:
            return None
        return await self._prompt_templates.get_by_id(project.template_id)


# Phase-24：更新(docstring: missing_points の説明を追記)
def _build_messages(
    history: list[ChatHistory],
    project: Project,
    # Phase-6-3:追記 ── SCR-003で選択したテンプレート(未選択ならNone)
    template: PromptTemplate | None = None,
    # Phase-24:追記 ── 直前の完了判定で足りなかった観点(返信の生成のときだけ渡す)
    *,
    missing_points: Sequence[str] = (),
    # Phase-35-2:追記
    card_targets: Sequence[PointDef] = (),
    # Phase-35(完了後の調整)：更新
    # scale_card: bool = False,
    # ↓↓
    code_card_label: str | None = None,
    # Phase-34-2:追記
    numbers: Mapping[str, int] | None = None,
) -> list[BaseMessage]:
    """chat_historiesの行(sender+message)を、LangChainのメッセージ列に変換する。

    sender='user'/'intake'/'attachment'(初期ヒアリング入力・添付ファイル抽出結果)はHumanMessage、
    sender='ai'はAIMessageとして扱う。sender='others'(生成後の自己診断結果)はヒアリング中の
    対話には含めない(生成完了後にのみ現れるため、通常この時点では存在しない)。

    environment(開発環境の希望)は`chat_histories`には保存されない(チャット画面には表示
    しない、docs/external_design.md参照)ため、`project.intake`から直接読み取ってHumanMessage
    として注入する。ヒアリング完了判定の5条件目「技術的な制約・希望の確認」の材料として、
    表示の有無に関わらずLLMには常に渡す。

    templateが指定されている場合、その`system_prompt`を基本のヒアリングシステムプロンプトに
    合流させる(内部設計書3.2節⑤: 合流先は4文書生成ではなくヒアリングチャット側)。

    missing_points(観点の表で未決の必須の観点)は、返信の生成のときだけシステムプロンプトに
    足す。AIが次に何を聞くべきかを、完了判定と同じ基準にそろえるため。

    card_targets(聞く観点)・code_card_label(システムがカードを出す観点の名前)も、返信の生成の
    ときだけ渡す。AIの発言に選択肢カードがあれば、その問いと選択肢を文にして発言の後ろに足す
    (何を聞いたかを、判定・返信のLLMが読めるように)。

    numbers(発言のid→番号)は、観点の判定のときだけ渡す。利用者側の発言の先頭に`[#n]`を付け、
    LLMが根拠を番号で返せるようにする。開発環境の希望は初期入力の番号で見せる(初期入力の一部のため)。
    """
    system_prompt = _HEARING_SYSTEM_PROMPT
    if template is not None:
        system_prompt += f"\n\n[選択されたテンプレート: {template.name}]\n{template.system_prompt}"
    # Phase-24:追記
    if missing_points:
        lines = "\n".join(f"- {point}" for point in missing_points)
        # Phase-35(完了後の調整)：更新
        # system_prompt += f"\n\n[まだ確認できていない観点]\n{lines}"
        # ↓↓
        system_prompt += (
            f"\n\n[まだ確認できていない観点]\n{lines}\n{_MISSING_POINTS_NOTE}"
        )
    # Phase-35-2:追記
    if card_targets:
        # Phase-39-1：更新
        # targets = "\n".join(f"- {d.key}: {d.label}(例: {d.question})" for d in card_targets)
        # ↓↓
        targets = "\n".join(
            f"- {d.key}: {d.label}(例: {d.question})。決まったと言える条件: {d.done_when}"
            for d in card_targets
        )
        system_prompt += _CARD_INSTRUCTIONS.format(targets=targets)
    # Phase-35(完了後の調整)：更新
    # if scale_card:
    #     system_prompt += _SCALE_CARD_NOTE
    # ↓↓
    if code_card_label is not None:
        system_prompt += _CODE_CARD_NOTE.format(label=code_card_label)
    messages: list[BaseMessage] = [SystemMessage(content=system_prompt)]
    # Phase-34-2:追記
    numbers = numbers or {}

    def _prefix(entry_id: str | None) -> str:
        number = numbers.get(entry_id) if entry_id is not None else None
        return f"[#{number}] " if number is not None else ""

    environment = (project.intake or {}).get("environment")
    if environment:
        # Phase-34-2:追記
        intake_id = next((str(e.id) for e in history if e.sender == "intake"), None)
        messages.append(
            # Phase-34-2：更新
            # HumanMessage(content=f"[開発環境の希望]\n{json.dumps(environment, ensure_ascii=False)}")
            # ↓↓
            HumanMessage(
                content=f"{_prefix(intake_id)}[開発環境の希望]\n"
                f"{json.dumps(environment, ensure_ascii=False)}"
            )
        )
    for entry in history:
        if entry.sender == "ai":
            # Phase-35-2：更新
            # messages.append(AIMessage(content=entry.message))
            # ↓↓
            cards = cards_from_json(entry.cards)
            content = "\n\n".join([entry.message, *(card_as_text(card) for card in cards)])
            messages.append(AIMessage(content=content))
        elif entry.sender in ("user", "intake", "attachment"):
            # Phase-34-2：更新
            # messages.append(HumanMessage(content=entry.message))
            # ↓↓
            messages.append(HumanMessage(content=_prefix(str(entry.id)) + entry.message))
    return messages


# Phase-35(完了後の調整):追記
def _next_targets(states: Mapping[str, PointState], scale: Scale | None) -> list[PointDef]:
    """次に聞く観点(1つ)。必須が未決なら必須から(規模が未決なら規模)、必須がそろっていれば
    未決の任意から(任意を続けるときだけここに来る)。"""
    if not is_sufficient(states, scale):
        return card_targets(states, scale)
    return open_optional(states, scale)[:CARD_LIMIT]


# Phase-35(完了後の調整):追記
# Phase-39-1:追記
def _drop_completion_claims(message: str) -> str:
    """未決の必須が残っているのに、返信の AI が「そろった」「生成できる」と書いた文を除く。
    プロンプトで止めても書くことがあり、画面(生成ボタンが出ない)と食い違うため。"""
    sentences = re.findall(r"[^。！!\n]*(?:[。！!]|\n|$)", message)
    kept = [s for s in sentences if not _COMPLETION_CLAIM.search(s)]
    return "".join(kept).strip()


def _ensure_question(message: str, cards: Sequence[Card], targets: Sequence[PointDef]) -> str:
    """カードが無く、聞くべき観点が残っているのに、返信の本文に問いが無いときは、次の問いを足す。
    返信のAIが問いを書き忘れると、利用者には次に何を答えるかが見えず、止まったように見えるため。"""
    # Phase-40-1：更新
    # if cards or not targets or "？" in message or "?" in message:
    # ↓↓
    if cards or not targets or _has_question(message):
        return message
    point = targets[0]
    question = _NEXT_QUESTION_TEMPLATE.format(label=point.label, question=point.question)
    return f"{message}\n\n{question}"


# Phase-40-1:追記
def _has_question(message: str) -> bool:
    """返信の本文に、利用者へ答えを求める文があるか(「？」、または依頼・問いの言い切り)。"""
    return "？" in message or "?" in message or _QUESTION_ENDING.search(message) is not None


# Phase-35-2:追記
@dataclass(frozen=True)
class ReplyCards:
    """stream_replyが返信の本文の後に返す、選択肢カード(`card_to_dict`の形)。ルートはSSEの
    `event: cards`で送る。"""

    cards: list[dict]


# Phase-34-2:追記
# Phase-36-2：削除
# def _as_scale(value: str | None) -> Scale | None:
#     return value if value in ("personal", "internal", "public") else None  # type: ignore[return-value]
#
#
# def _states_from_rows(rows: Sequence[HearingPoint]) -> dict[str, PointState]:
#     """hearing_pointsの行を観点の表に直す(行の無い観点・知らないキーの行は除いて、未決で埋める)。"""
#     states = initial_states()
#     for row in rows:
#         state = to_state(row.point_key, row.status, row.summary, row.evidence or ())
#         if state is not None:
#             states[state.key] = state
#     return states
#
#
def _points_table(states: Mapping[str, PointState]) -> str:
    """判定のプロンプトに埋める観点の表(1行1観点)。"""
    return "\n".join(
        # Phase-39-1：更新
        # f"{d.key}|{d.label}|{d.question}|{states[d.key].status}|{states[d.key].summary}"
        # ↓↓
        f"{d.key}|{d.label}|{d.question}|{d.done_when}|{states[d.key].status}|"
        f"{states[d.key].summary}"
        for d in POINT_DEFS
    )


def _completion_from(states: Mapping[str, PointState], scale: str | None) -> HearingCompletionCheck:
    """観点の表から完了判定を作る(LLMは呼ばない)。十分ならまとめを付ける。"""
    # Phase-36-2：更新
    # sufficient = is_sufficient(states, _as_scale(scale))
    # ↓↓
    sufficient = is_sufficient(states, as_scale(scale))
    return HearingCompletionCheck(
        is_sufficient=sufficient,
        # Phase-36-2：更新
        # summary=build_summary(states, _as_scale(scale)) if sufficient else "",
        # missing_points=missing_labels(states, _as_scale(scale)),
        # ↓↓
        summary=build_summary(states, as_scale(scale)) if sufficient else "",
        missing_points=missing_labels(states, as_scale(scale)),
    )

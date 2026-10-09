# 作成：Phase-2-3｜更新：Phase-2-5,6-3,6-5,6-6,8-5,15-3,24(ゴール3後の調整),34-2
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
import json
import time
import uuid
from collections.abc import AsyncIterator, Mapping, Sequence

import structlog
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm.gemini import extract_text_content, get_gemini_llm
from app.hearing import (
    POINT_DEFS,
    JudgedPoint,
    PointState,
    Scale,
    build_summary,
    initial_states,
    is_required,
    is_sufficient,
    merge_judgement,
    missing_labels,
    number_messages,
    questions_for_reply,
    scale_after,
    to_state,
)
from app.models.chat_history import ChatHistory
from app.models.hearing_point import HearingPoint
from app.models.project import Project
from app.models.prompt_template import PromptTemplate
from app.repositories.chat_history import ChatHistoryRepository
from app.repositories.hearing_point import HearingPointRepository
from app.repositories.prompt_template import PromptTemplateRepository
from app.schemas.generation import HearingCompletionCheck
from app.schemas.hearing import (
    EvidenceRead,
    HearingPointRead,
    HearingPointsJudgement,
    HearingPointsRead,
)
from app.services.errors import GenerationFailedError
from app.services.llm_retry import as_llm_error, invoke_with_retry, prompt_char_count

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
    "・今の状態がopen以外の観点は、ユーザーが言い直した場合だけ変える。\n"
    "・summaryは、決めたことを1文で簡潔に書く(openなら空でよい)。\n"
    "・scaleは、規模の観点が決まったときだけ、personal(自分と数人)/internal(社内)/"
    "public(誰でも登録できるサービス)のどれかにする。\n"
    "観点の表(キー|観点|場面で聞く問いの例|今の状態|決めたこと):\n"
    "{table}"
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
# 完了判定が十分になったときの返信。LLMで書かせず、観点の表から組み立てたまとめを見せることで、
# チャットのまとめと画面の生成ボタンが同じ判定から同時に出るようにする
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
    "4. 1行空けて、「まず、」に続けて箇条書きの1つ目について具体的な質問を1つだけ書く\n"
    "この形式以外の前置きや締めの言葉は書かないでください。"
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
        self, project: Project, *, user_message: str, llm=None
    ) -> AsyncIterator[str]:
        """ユーザーメッセージを永続化し、先に観点の表の判定を行ってから、その結果に応じたAI応答を
        ストリーミングで返す。応答本文の断片を順次yieldし、完了後にAI応答全体をchat_historiesへ、
        観点の状態をhearing_pointsへ、完了判定の結果をprojects.hearing_checkへ保存する。

        - 完了は、必須の観点がすべて未決以外かどうかをコードが決める(app/hearing/points.py)。
        - 十分なら、LLMで返信を作らず、観点の表から組み立てたまとめを決まった形で返す(まとめと
          生成ボタンを同じ判定から同時に出すため)。
        - 足りなければ、未決の必須の観点を渡して通常の返信を作る(AIがそこを聞くように)。
        - 判定に失敗したら、観点の表は前のまま残し、保存済みの完了判定は消す(古い判定で生成ボタンが
          残らないように。表があって完了判定が無い状態を、画面は「表が直近の発言を反映していない」と
          読む)。チャット自体は止めない。

        completed(生成済み)のプロジェクトへ新規メッセージが送られた場合はrevising(修正中)へ
        遷移させる(ユーザーがヒアリング内容を修正し、再生成する意思を示したものとみなす)。
        """
        if project.status == "completed":
            project.status = "revising"
        await self._chat_histories.add(project_id=project.id, sender="user", message=user_message)
        # Phase-24：削除
        # history = await self._chat_histories.list_for_project(project.id)
        # template = await self._load_template(project)
        # messages = _build_messages(history, project, template)

        llm = llm or get_gemini_llm()
        # Phase-24:追記
        try:
            # Phase-34-2：更新
            # check: HearingCompletionCheck | None = await self.check_completion(project, llm=llm)
            # ↓↓
            states = await self.judge_points(project, llm=llm)
        except GenerationFailedError:
            logger.warning("hearing_check_failed")
            # Phase-34-2：更新
            # check = None
            # ↓↓
            states = None
        # Phase-34-2：更新
        # project.hearing_check = check.model_dump() if check is not None else None
        #
        # if check is not None and check.is_sufficient:
        #     reply = _SUMMARY_REPLY_TEMPLATE.format(summary=check.summary.strip())
        #     yield reply
        #     await self._chat_histories.add(project_id=project.id, sender="ai", message=reply)
        #     await self._session.commit()
        #     return
        # ↓↓
        if states is None:
            project.hearing_check = None
            questions = questions_for_reply(
                await self._load_states(project), _as_scale(project.hearing_scale)
            )
        else:
            check = _completion_from(states, project.hearing_scale)
            project.hearing_check = check.model_dump()
            if check.is_sufficient:
                reply = _SUMMARY_REPLY_TEMPLATE.format(summary=check.summary.strip())
                yield reply
                await self._chat_histories.add(project_id=project.id, sender="ai", message=reply)
                await self._session.commit()
                return
            questions = questions_for_reply(states, _as_scale(project.hearing_scale))

        history = await self._chat_histories.list_for_project(project.id)
        template = await self._load_template(project)
        # Phase-34-2：更新
        # points = check.missing_points if check is not None else []
        # missing_points = [point for point in points if point != _TOO_FEW_TURNS_POINT]
        # messages = _build_messages(history, project, template, missing_points=missing_points)
        # ↓↓
        messages = _build_messages(history, project, template, missing_points=questions)

        # Phase-6-5:追記 ── ストリーミングはinvoke_with_retryを経由しない([`stream_reply`]の
        # docstring参照)ため、DEBUGログ(レイテンシ・プロンプト文字数)はここで個別に記録する。
        started = time.monotonic()
        chunks: list[str] = []
        # Phase-15-3：更新(気づき#2: 途中の失敗を共通の例外に揃える)
        # async for chunk in llm.astream(messages):
        #     piece = extract_text_content(chunk.content)
        #     if not piece:
        #         continue
        #     chunks.append(piece)
        #     yield piece
        # ↓↓
        try:
            async for chunk in llm.astream(messages):
                piece = extract_text_content(chunk.content)
                if not piece:
                    continue
                chunks.append(piece)
                yield piece
        except Exception as exc:
            # 再試行はしない(送信済みの断片があるため。llm_retry.pyのdocstring参照)。
            # 失敗の種類だけを共通の例外に揃え、ルートがSSEの`event: error`で伝える
            raise as_llm_error(exc) from exc
        logger.debug(
            "llm_call_succeeded",
            prompt_chars=prompt_char_count(messages),
            latency_ms=round((time.monotonic() - started) * 1000, 1),
        )

        full_reply = "".join(chunks)
        await self._chat_histories.add(project_id=project.id, sender="ai", message=full_reply)
        await self._session.commit()

    # Phase-34-2：削除 ── 5条件の判定と発言の回数の下限を、観点の表の判定(judge_points)に置き換えた
    # async def check_completion(self, project: Project, *, llm=None) -> HearingCompletionCheck:
    #     # Phase-2-5：更新
    #     # """これまでの対話履歴から、ヒアリングが完了条件(5条件)を満たしたかどうかを判定する。
    #     # 十分と判定した場合でも、呼び出し側(ルート層)が構造化サマリを提示し、ユーザーの明示的な
    #     # 承認を得てから設計書生成(doc_generator_service)へ進める(即座には生成しない)。"""
    #     # history = await self._chat_histories.list_for_project(project.id)
    #     # messages = [*_build_messages(history), HumanMessage(content=_COMPLETION_CHECK_PROMPT)]
    #     #
    #     # llm = llm or get_gemini_llm()
    #     # structured_llm = llm.with_structured_output(HearingCompletionCheck)
    #     # result = await structured_llm.ainvoke(messages)
    #     # assert isinstance(result, HearingCompletionCheck)
    #     # return result
    #     # ↓↓
    #     """これまでの対話履歴から、ヒアリングが完了条件(5条件)を満たしたかどうかを判定する。
    #     十分と判定した場合でも、呼び出し側(ルート層)が構造化サマリを提示し、ユーザーの明示的な
    #     承認を得てから設計書生成(doc_generator_service)へ進める(即座には生成しない)。
    #
    #     単発呼び出し(ストリーミングではない)のため、一時的な失敗はinvoke_with_retryでリトライする
    #     (docs/implementation_plan.md 4.4節リスク1)。"""
    #     history = await self._chat_histories.list_for_project(project.id)
    #     # Phase-6-3:追記
    #     template = await self._load_template(project)
    #     messages = [
    #         *_build_messages(history, project, template),
    #         HumanMessage(content=_COMPLETION_CHECK_PROMPT),
    #     ]
    #
    #     llm = llm or get_gemini_llm()
    #     structured_llm = llm.with_structured_output(HearingCompletionCheck)
    #
    #     async def _call() -> HearingCompletionCheck:
    #         result = await structured_llm.ainvoke(messages)
    #         assert isinstance(result, HearingCompletionCheck)
    #         return result
    #
    #     # Phase-6-6：更新
    #     # return await invoke_with_retry(_call, messages=messages)
    #     # ↓↓
    #     result = await invoke_with_retry(_call, messages=messages)
    #     user_turns = sum(1 for entry in history if entry.sender == "user")
    #     if result.is_sufficient and user_turns < _MIN_USER_TURNS_FOR_COMPLETION:
    #         # LLMが早期にtrueと判定しても、実発話が少なすぎる間は完了させない
    #         return HearingCompletionCheck(
    #             is_sufficient=False,
    #             summary=result.summary,
    #             # Phase-24：更新
    #             # missing_points=[*result.missing_points, "対話がまだ十分に進んでいません"],
    #             # ↓↓
    #             missing_points=[*result.missing_points, _TOO_FEW_TURNS_POINT],
    #         )
    #     return result

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
        messages = [
            *_build_messages(history, project, template, numbers=numbers),
            HumanMessage(content=_POINTS_JUDGE_PROMPT.format(table=_points_table(previous))),
        ]

        llm = llm or get_gemini_llm()
        structured_llm = llm.with_structured_output(HearingPointsJudgement)

        async def _call() -> HearingPointsJudgement:
            result = await structured_llm.ainvoke(messages)
            assert isinstance(result, HearingPointsJudgement)
            return result

        result = await invoke_with_retry(_call, messages=messages)
        ids_by_number = {number: message_id for message_id, number in numbers.items()}
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
        states = merge_judgement(previous, judged)
        project.hearing_scale = scale_after(
            states, _as_scale(project.hearing_scale), result.scale
        )
        await self._hearing_points.save_states(project.id, states.values())
        return states

    async def points_view(self, project: Project) -> HearingPointsRead:
        """チャット画面の観点の表(LLMは呼ばない)。表がまだ無いプロジェクトは、全観点を未決で返す。"""
        rows = await self._hearing_points.list_for_project(project.id)
        states = _states_from_rows(rows)
        scale = _as_scale(project.hearing_scale)
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

    async def _load_states(self, project: Project) -> dict[str, PointState]:
        return _states_from_rows(await self._hearing_points.list_for_project(project.id))

    # Phase-24:追記
    def stored_completion(self, project: Project) -> HearingCompletionCheck:
        """直近の発言で行ったヒアリング完了判定の結果を返す(LLMは呼ばない)。まだ判定していない、
        または直近の判定に失敗したプロジェクトは「十分でない」とする。観点の表を持たない以前の
        プロジェクトは、保存してある5条件の判定をそのまま返す。"""
        if project.hearing_check is None:
            return HearingCompletionCheck(is_sufficient=False, summary="", missing_points=[])
        return HearingCompletionCheck.model_validate(project.hearing_check)

    async def generate_opening_reply(self, project: Project, *, llm=None) -> str:
        """ヒアリング開始直後、ユーザー発話を待たずにAIの最初の発話を生成し永続化する
        (docs/external_design.md SCR-004 2.3節: 「AIの最初の発話は初期ヒアリング入力の
        内容を踏まえた理解の要約と確認質問から始まる」)。プロジェクト作成直後に一度だけ
        呼ばれる想定。失敗時は例外を伝播させる(致命的でない扱いは呼び出し側=ルート層で行う)。

        単発呼び出し(ストリーミングではない)のため、check_completionと同様
        invoke_with_retryでリトライする。"""
        history = await self._chat_histories.list_for_project(project.id)
        # Phase-6-3:追記
        template = await self._load_template(project)
        messages = [
            *_build_messages(history, project, template),
            HumanMessage(content=_OPENING_TURN_PROMPT),
        ]

        llm = llm or get_gemini_llm()

        async def _call() -> str:
            result = await llm.ainvoke(messages)
            return extract_text_content(result.content)

        reply = await invoke_with_retry(_call, messages=messages)
        await self._chat_histories.add(project_id=project.id, sender="ai", message=reply)
        await self._session.commit()
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

    numbers(発言のid→番号)は、観点の判定のときだけ渡す。利用者側の発言の先頭に`[#n]`を付け、
    LLMが根拠を番号で返せるようにする。開発環境の希望は初期入力の番号で見せる(初期入力の一部のため)。
    """
    system_prompt = _HEARING_SYSTEM_PROMPT
    if template is not None:
        system_prompt += f"\n\n[選択されたテンプレート: {template.name}]\n{template.system_prompt}"
    # Phase-24:追記
    if missing_points:
        lines = "\n".join(f"- {point}" for point in missing_points)
        system_prompt += f"\n\n[まだ確認できていない観点]\n{lines}"
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
            messages.append(AIMessage(content=entry.message))
        elif entry.sender in ("user", "intake", "attachment"):
            # Phase-34-2：更新
            # messages.append(HumanMessage(content=entry.message))
            # ↓↓
            messages.append(HumanMessage(content=_prefix(str(entry.id)) + entry.message))
    return messages


# Phase-34-2:追記
def _as_scale(value: str | None) -> Scale | None:
    return value if value in ("personal", "internal", "public") else None  # type: ignore[return-value]


def _states_from_rows(rows: Sequence[HearingPoint]) -> dict[str, PointState]:
    """hearing_pointsの行を観点の表に直す(行の無い観点・知らないキーの行は除いて、未決で埋める)。"""
    states = initial_states()
    for row in rows:
        state = to_state(row.point_key, row.status, row.summary, row.evidence or ())
        if state is not None:
            states[state.key] = state
    return states


def _points_table(states: Mapping[str, PointState]) -> str:
    """判定のプロンプトに埋める観点の表(1行1観点)。"""
    return "\n".join(
        f"{d.key}|{d.label}|{d.question}|{states[d.key].status}|{states[d.key].summary}"
        for d in POINT_DEFS
    )


def _completion_from(states: Mapping[str, PointState], scale: str | None) -> HearingCompletionCheck:
    """観点の表から完了判定を作る(LLMは呼ばない)。十分ならまとめを付ける。"""
    sufficient = is_sufficient(states, _as_scale(scale))
    return HearingCompletionCheck(
        is_sufficient=sufficient,
        summary=build_summary(states, _as_scale(scale)) if sufficient else "",
        missing_points=missing_labels(states, _as_scale(scale)),
    )

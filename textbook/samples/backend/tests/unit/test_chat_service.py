# 作成：Phase-2-3｜更新：Phase-6-3,6-5,6-6,8-5,24(ゴール3後の調整),34-2
# Phase-6-6:追記 ── langchain_core.messages.AIMessageChunk, app.services.chat_service._COMPLETION_CHECK_PROMPT
# Phase-2-3:追記 ── pytest, app.api.routes.projects.get_hearing_completion
# Phase-6-3:追記 ── app.models.prompt_template.PromptTemplate
# Phase-6-5:追記 ── structlog.testing
# Phase-6-6:追記 ── app.services.chat_service._MIN_USER_TURNS_FOR_COMPLETION
# Phase-24:追記 ── app.services.chat_service._HEARING_SYSTEM_PROMPT, app.services.errors.GenerationFailedError
# Phase-34-2:追記 ── app.api.routes.projects.get_hearing_points,
#   app.hearing(POINT_DEFS, PointState, initial_states),
#   app.repositories.hearing_point.HearingPointRepository,
#   app.schemas.hearing(HearingPointsJudgement, JudgedPointOut),
#   app.services.chat_service._POINTS_JUDGE_PROMPT
# Phase-34-2：削除 ── app.services.chat_service(_COMPLETION_CHECK_PROMPT, _MIN_USER_TURNS_FOR_COMPLETION)
import pytest
import structlog.testing
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, SystemMessage
from sqlalchemy.ext.asyncio import AsyncSession
from tests.fixtures.fake_llm import FakeLLM

from app.api.routes.projects import create_project, get_hearing_completion, get_hearing_points
from app.hearing import POINT_DEFS, PointState, initial_states
from app.models.chat_history import ChatHistory
from app.models.project import Project
from app.models.prompt_template import PromptTemplate
from app.models.user import User
from app.repositories.chat_history import ChatHistoryRepository
from app.repositories.hearing_point import HearingPointRepository
from app.schemas.generation import HearingCompletionCheck
from app.schemas.hearing import HearingPointsJudgement, JudgedPointOut
from app.services.chat_service import (
    _HEARING_SYSTEM_PROMPT,
    _POINTS_JUDGE_PROMPT,
    ChatService,
    _build_messages,
)
from app.services.errors import GenerationFailedError

# Phase-24:追記
# Phase-34-2：更新
# # stream_replyは返信の前に完了判定を呼ぶ。返信の振る舞いを見るテストでは「足りない」を返させる
# _INSUFFICIENT = HearingCompletionCheck(is_sufficient=False, summary="現状整理", missing_points=[])
# ↓↓
# stream_replyは返信の前に観点の判定を呼ぶ。返信の振る舞いを見るテストでは、何も決まらない
# (必須が未決のまま = 足りない)結果を返させる
_INSUFFICIENT = HearingPointsJudgement()


def _all_decided(evidence: int, *, scale: str = "personal") -> HearingPointsJudgement:
    """全観点を、番号evidenceの発言を根拠に「ユーザーが決定」とする判定の結果。"""
    return HearingPointsJudgement(
        scale=scale,  # type: ignore[arg-type]
        points=[
            JudgedPointOut(
                key=d.key, status="decided", summary=f"{d.label}の決定", evidence=[evidence]
            )
            for d in POINT_DEFS
        ],
    )


async def _create_project(session: AsyncSession) -> Project:
    user = User(email="owner@example.com", hashed_password="x")
    session.add(user)
    await session.flush()
    project = Project(user_id=user.id, title="p")
    session.add(project)
    await session.flush()
    return project


# Phase-8-5:追記 ── ルーターがRepositoryを直接参照しない方針へ統一した際に新設したメソッドのテスト
async def test_list_history_returns_entries_in_chronological_order(
    db_session: AsyncSession,
) -> None:
    project = await _create_project(db_session)
    repo = ChatHistoryRepository(db_session)
    await repo.add(project_id=project.id, sender="user", message="1件目")
    await repo.add(project_id=project.id, sender="ai", message="2件目")
    service = ChatService(db_session)

    history = await service.list_history(project.id)

    assert [h.message for h in history] == ["1件目", "2件目"]


# Phase-6-5:追記
async def test_stream_reply_logs_debug_with_latency_and_prompt_chars(
    db_session: AsyncSession,
) -> None:
    """ストリーミングはinvoke_with_retryを経由しないため、DEBUGログをstream_reply内で
    個別に記録することを確認する(本文自体はログに含めない、内部設計書3.4節)。"""
    project = await _create_project(db_session)
    # Phase-24：更新
    # fake_llm = FakeLLM(stream_chunks=["こんにちは"])
    # ↓↓
    fake_llm = FakeLLM(structured=_INSUFFICIENT, stream_chunks=["こんにちは"])
    service = ChatService(db_session)

    with structlog.testing.capture_logs() as logs:
        async for _ in service.stream_reply(project, user_message="はじめまして", llm=fake_llm):
            pass

    # Phase-24：更新
    # debug_logs = [log for log in logs if log["log_level"] == "debug"]
    # assert len(debug_logs) == 1
    # assert debug_logs[0]["event"] == "llm_call_succeeded"
    # assert "latency_ms" in debug_logs[0]
    # assert "はじめまして" not in str(debug_logs[0])
    # ↓↓
    # 完了判定(invoke_with_retry経由。attemptを持つ)とは別に、返信のストリームのログが1件ある
    stream_logs = [
        log for log in logs if log["log_level"] == "debug" and "attempt" not in log
    ]
    assert len(stream_logs) == 1
    assert stream_logs[0]["event"] == "llm_call_succeeded"
    assert "latency_ms" in stream_logs[0]
    assert "はじめまして" not in str(stream_logs[0])


async def test_stream_reply_persists_user_and_ai_messages(db_session: AsyncSession) -> None:
    project = await _create_project(db_session)
    # Phase-24：更新
    # fake_llm = FakeLLM(stream_chunks=["こん", "にちは"])
    # ↓↓
    fake_llm = FakeLLM(structured=_INSUFFICIENT, stream_chunks=["こん", "にちは"])
    service = ChatService(db_session)

    chunks = [
        chunk
        async for chunk in service.stream_reply(project, user_message="はじめまして", llm=fake_llm)
    ]

    assert chunks == ["こん", "にちは"]
    history = await ChatHistoryRepository(db_session).list_for_project(project.id)
    assert [(h.sender, h.message) for h in history] == [
        ("user", "はじめまして"),
        ("ai", "こんにちは"),
    ]


# Phase-6-6:追記 ── stream_replyに完了判定プロンプトを混ぜない(写経時のコピーミス由来の不具合の回帰テスト)
class _RecordingLLM:
    """astream()に渡されたmessagesを記録するだけのスタブ(FakeLLMはmessagesを無視するため)。"""

    # Phase-24：更新
    # def __init__(self) -> None:
    # ↓↓
    # Phase-34-2：更新
    # def __init__(self, check: HearingCompletionCheck = _INSUFFICIENT) -> None:
    # ↓↓
    def __init__(self, judgement: HearingPointsJudgement = _INSUFFICIENT) -> None:
        self.stream_messages: list[list] = []
        # Phase-24:追記
        # Phase-34-2：更新
        # self._check = check
        # ↓↓
        self.judge_messages: list[list] = []
        self._judgement = judgement

    async def astream(self, messages):
        self.stream_messages.append(messages)
        yield AIMessageChunk(content="こんにちは")

    # Phase-24:追記
    # Phase-34-2：更新
    # def with_structured_output(self, _schema):
    #     return FakeLLM(structured=self._check).with_structured_output(HearingCompletionCheck)
    # ↓↓
    def with_structured_output(self, schema):
        recorder = self

        class _Structured:
            async def ainvoke(self, messages):
                recorder.judge_messages.append(messages)
                return FakeLLM(structured=recorder._judgement).with_structured_output(
                    schema
                ).invoke(messages)

        return _Structured()


# Phase-34-2：更新
# async def test_stream_reply_does_not_send_completion_check_prompt(
# ↓↓
async def test_stream_reply_does_not_send_points_judge_prompt(
    db_session: AsyncSession,
) -> None:
    # Phase-34-2：更新
    # """チャット応答の生成に完了判定プロンプトを混ぜない(混ぜるとLLMが判定JSONを返してしまう)。"""
    # ↓↓
    """チャット応答の生成に観点の判定のプロンプトを混ぜない(混ぜるとLLMが判定JSONを返してしまう)。"""
    project = await _create_project(db_session)
    llm = _RecordingLLM()

    async for _ in ChatService(db_session).stream_reply(
        project, user_message="はじめまして", llm=llm
    ):
        pass

    sent = llm.stream_messages[0]
    # Phase-34-2：更新
    # assert all(m.content != _COMPLETION_CHECK_PROMPT for m in sent)
    # ↓↓
    assert all("観点の表(キー|観点" not in str(m.content) for m in sent)
    assert isinstance(sent[-1], HumanMessage)
    assert sent[-1].content == "はじめまして"


async def test_stream_reply_transitions_completed_project_to_revising(
    db_session: AsyncSession,
) -> None:
    user = User(email="owner-revise@example.com", hashed_password="x")
    db_session.add(user)
    await db_session.flush()
    project = Project(user_id=user.id, title="p", status="completed")
    db_session.add(project)
    await db_session.flush()
    # Phase-24：更新
    # fake_llm = FakeLLM(stream_chunks=["承知しました"])
    # ↓↓
    fake_llm = FakeLLM(structured=_INSUFFICIENT, stream_chunks=["承知しました"])
    service = ChatService(db_session)

    async for _ in service.stream_reply(project, user_message="ここを直したい", llm=fake_llm):
        pass

    assert project.status == "revising"


async def test_stream_reply_does_not_change_status_when_already_interviewing_or_revising(
    db_session: AsyncSession,
) -> None:
    for status in ("interviewing", "revising"):
        user = User(email=f"owner-{status}@example.com", hashed_password="x")
        db_session.add(user)
        await db_session.flush()
        project = Project(user_id=user.id, title="p", status=status)
        db_session.add(project)
        await db_session.flush()
        # Phase-24：更新
        # fake_llm = FakeLLM(stream_chunks=["了解"])
        # ↓↓
        fake_llm = FakeLLM(structured=_INSUFFICIENT, stream_chunks=["了解"])
        service = ChatService(db_session)

        async for _ in service.stream_reply(project, user_message="続き", llm=fake_llm):
            pass

        assert project.status == status


async def test_stream_reply_extracts_text_from_thought_signature_content(
    db_session: AsyncSession,
) -> None:
    """Geminiがthought signature付きの応答(contentが辞書のリスト)を返しても、
    text以外のメタデータ(extras/signature)を含めずプレーンテキストとして
    ストリーミング・永続化されることを確認する。"""
    project = await _create_project(db_session)
    fake_llm = FakeLLM(
        # Phase-24:追記
        structured=_INSUFFICIENT,
        stream_chunks=[
            "通常の",
            [{"type": "text", "text": "テキスト", "extras": {"signature": "sig"}}],
        ]
    )
    service = ChatService(db_session)

    chunks = [
        chunk
        async for chunk in service.stream_reply(project, user_message="こんにちは", llm=fake_llm)
    ]

    assert chunks == ["通常の", "テキスト"]
    history = await ChatHistoryRepository(db_session).list_for_project(project.id)
    assert [(h.sender, h.message) for h in history] == [
        ("user", "こんにちは"),
        ("ai", "通常のテキスト"),
    ]


async def test_stream_reply_skips_signature_only_chunks(db_session: AsyncSession) -> None:
    """textを持たずsignatureのみのチャンク(空文字列に変換される)はyieldされないことを確認する。"""
    project = await _create_project(db_session)
    fake_llm = FakeLLM(
        # Phase-24:追記
        structured=_INSUFFICIENT,
        stream_chunks=[
            [{"type": "text", "text": "", "extras": {"signature": "sig"}}],
            "本文",
        ]
    )
    service = ChatService(db_session)

    chunks = [
        chunk
        async for chunk in service.stream_reply(project, user_message="こんにちは", llm=fake_llm)
    ]

    assert chunks == ["本文"]


# Phase-34-2：削除 ── 5条件の判定(check_completion)と発言の回数の下限のテスト
# async def _add_user_turns(session: AsyncSession, project: Project, count: int) -> None:
#     repo = ChatHistoryRepository(session)
#     for i in range(count):
#         await repo.add(project_id=project.id, sender="user", message=f"発話{i}")
#
#
# # Phase-6-6：更新(最低発話数ガードの導入に伴い、完了判定を尊重させるテストは
# # ユーザー発話が_MIN_USER_TURNS_FOR_COMPLETION件以上ある履歴を用意する)
# # async def test_check_completion_returns_structured_result(db_session: AsyncSession) -> None:
# #     project = await _create_project(db_session)
# #     await ChatHistoryRepository(db_session).add(
# #         project_id=project.id, sender="user", message="備品予約システムを作りたい"
# #     )
# # ↓↓
# async def test_check_completion_returns_structured_result(db_session: AsyncSession) -> None:
#     project = await _create_project(db_session)
#     await _add_user_turns(db_session, project, _MIN_USER_TURNS_FOR_COMPLETION)
#     expected = HearingCompletionCheck(
#         is_sufficient=True, summary="備品予約システムの要件が整理できました。", missing_points=[]
#     )
#     fake_llm = FakeLLM(structured=expected)
#     service = ChatService(db_session)
#
#     result = await service.check_completion(project, llm=fake_llm)
#
#     assert result == expected
#     assert fake_llm.structured_output_calls == [HearingCompletionCheck]
#
#
# # Phase-6-6:追記
# async def test_check_completion_overrides_to_insufficient_when_too_few_user_turns(
#     db_session: AsyncSession,
# ) -> None:
#     """LLMが楽観的にis_sufficient=Trueを返しても、ユーザー発話が下限に満たなければFalseに上書きされる。"""
#     project = await _create_project(db_session)
#     await _add_user_turns(db_session, project, _MIN_USER_TURNS_FOR_COMPLETION - 1)
#     fake_llm = FakeLLM(
#         structured=HearingCompletionCheck(is_sufficient=True, summary="要約", missing_points=[])
#     )
#     service = ChatService(db_session)
#
#     result = await service.check_completion(project, llm=fake_llm)
#
#     assert result.is_sufficient is False
#     assert result.summary == "要約"
#     assert "対話がまだ十分に進んでいません" in result.missing_points
#
#
# # Phase-6-6:追記
# async def test_check_completion_does_not_count_non_user_senders(db_session: AsyncSession) -> None:
#     """intake/attachment/aiはユーザーの実発話ではないため、ガードの件数には含めない。"""
#     project = await _create_project(db_session)
#     repo = ChatHistoryRepository(db_session)
#     for sender in ("intake", "attachment", "ai", "ai", "ai"):
#         await repo.add(project_id=project.id, sender=sender, message="x")
#     fake_llm = FakeLLM(
#         structured=HearingCompletionCheck(is_sufficient=True, summary="要約", missing_points=[])
#     )
#
#     result = await ChatService(db_session).check_completion(project, llm=fake_llm)
#
#     assert result.is_sufficient is False
#
#
# # Phase-6-6:追記
# async def test_check_completion_keeps_llm_insufficient_verdict(db_session: AsyncSession) -> None:
#     """ガードは「trueをfalseにする」一方向のみ。LLM自身のfalse判定・missing_pointsはそのまま返す。"""
#     project = await _create_project(db_session)
#     await _add_user_turns(db_session, project, _MIN_USER_TURNS_FOR_COMPLETION)
#     expected = HearingCompletionCheck(
#         is_sufficient=False, summary="現状整理", missing_points=["想定ユーザー"]
#     )
#
#     result = await ChatService(db_session).check_completion(
#         project, llm=FakeLLM(structured=expected)
#     )
#
#     assert result == expected


# Phase-34-2:追記 ── 観点の判定(judge_points)のテスト
async def _add_history(session: AsyncSession, project: Project, *senders: str) -> list[ChatHistory]:
    repo = ChatHistoryRepository(session)
    return [
        await repo.add(project_id=project.id, sender=sender, message=f"{sender}{i}")
        for i, sender in enumerate(senders)
    ]


async def test_judge_points_saves_states_with_message_ids(db_session: AsyncSession) -> None:
    """LLMが返した発言の番号を、chat_historiesのidに直して保存する(結べない番号は捨てる)。"""
    project = await _create_project(db_session)
    intake, _, user1 = await _add_history(db_session, project, "intake", "ai", "user")
    judgement = HearingPointsJudgement(
        points=[
            JudgedPointOut(key="purpose", status="decided", summary="工数を減らす", evidence=[1]),
            JudgedPointOut(key="users", status="decided", summary="SE", evidence=[2, 2, 9]),
            JudgedPointOut(key="tech", status="decided", summary="推測", evidence=[9]),
        ]
    )
    fake_llm = FakeLLM(structured=judgement)

    states = await ChatService(db_session).judge_points(project, llm=fake_llm)

    assert fake_llm.structured_output_calls == [HearingPointsJudgement]
    assert states["purpose"] == PointState("purpose", "decided", "工数を減らす", (str(intake.id),))
    assert states["users"].evidence == (str(user1.id),)
    # 根拠が利用者側の発言に結べない決定は取り込まない
    assert states["tech"].status == "open"
    rows = {
        r.point_key: r
        for r in await HearingPointRepository(db_session).list_for_project(project.id)
    }
    assert len(rows) == len(POINT_DEFS)
    assert rows["purpose"].evidence == [str(intake.id)]


async def test_judge_points_shows_numbered_messages_and_current_table(
    db_session: AsyncSession,
) -> None:
    project = await _create_project(db_session)
    project.intake = {"environment": {"backend": "FastAPI"}}
    await _add_history(db_session, project, "intake", "ai", "user")
    llm = _RecordingLLM()

    await ChatService(db_session).judge_points(project, llm=llm)

    sent = llm.judge_messages[0]
    human = [str(m.content) for m in sent if isinstance(m, HumanMessage)]
    assert human[0].startswith("[#1] [開発環境の希望]")  # 開発環境の希望は初期入力の番号で見せる
    assert human[1] == "[#1] intake0"
    assert human[2] == "[#2] user2"
    assert all(not str(m.content).startswith("[#") for m in sent if isinstance(m, AIMessage))
    assert human[-1].startswith(_POINTS_JUDGE_PROMPT.split("{table}")[0][:20])
    assert "purpose|目的・課題|" in human[-1]


async def test_judge_points_sets_scale_only_when_scale_point_is_settled(
    db_session: AsyncSession,
) -> None:
    project = await _create_project(db_session)
    await _add_history(db_session, project, "user")
    service = ChatService(db_session)

    await service.judge_points(
        project, llm=FakeLLM(structured=HearingPointsJudgement(scale="public"))
    )
    assert project.hearing_scale is None

    await service.judge_points(
        project,
        llm=FakeLLM(
            structured=HearingPointsJudgement(
                scale="internal",
                points=[
                    JudgedPointOut(key="scale", status="decided", summary="社内", evidence=[1])
                ],
            )
        ),
    )
    assert project.hearing_scale == "internal"


# Phase-2-3:追記
# Phase-24：更新(旧 test_get_hearing_completion_route_delegates_to_chat_service。GET は保存した判定を返す)
async def test_get_hearing_completion_route_returns_stored_check(db_session: AsyncSession) -> None:
    """GET /projects/{id}/hearing-completion は、チャットの送信時に保存した判定をそのまま返す
    (LLMを呼ばないので、get_gemini_llmを差し替えなくてよい。観点の表を持たない以前の
    プロジェクトの5条件の判定も、同じくそのまま返す)。"""
    project = await _create_project(db_session)
    # Phase-6-6：更新(最低発話数ガードを満たす履歴を用意する)
    # await ChatHistoryRepository(db_session).add(
    #     project_id=project.id, sender="user", message="備品予約システムを作りたい"
    # )
    # ↓↓
    # Phase-24：削除
    # await _add_user_turns(db_session, project, _MIN_USER_TURNS_FOR_COMPLETION)
    expected = HearingCompletionCheck(
        is_sufficient=True, summary="備品予約システムの要件が整理できました。", missing_points=[]
    )
    # Phase-24：更新
    # monkeypatch.setattr(
    #     "app.services.chat_service.get_gemini_llm", lambda: FakeLLM(structured=expected)
    # )
    # ↓↓
    project.hearing_check = expected.model_dump()

    result = await get_hearing_completion(db_session, project)

    assert result == expected


# Phase-24:追記
async def test_get_hearing_completion_route_is_insufficient_before_any_check(
    db_session: AsyncSession,
) -> None:
    project = await _create_project(db_session)

    result = await get_hearing_completion(db_session, project)

    assert result.is_sufficient is False


# Phase-34-2：削除 ── 5条件の判定の結果で返信を分けるテスト(観点の表の版に置き換えた)
# async def test_stream_reply_presents_summary_without_llm_reply_when_sufficient(
#     db_session: AsyncSession,
# ) -> None:
#     """判定が十分なら、LLMで返信を作らず、判定のsummaryを決まった形で返して判定を保存する。"""
#     project = await _create_project(db_session)
#     await _add_user_turns(db_session, project, _MIN_USER_TURNS_FOR_COMPLETION - 1)
#     check = HearingCompletionCheck(is_sufficient=True, summary="備品予約の要件です。")
#     llm = _RecordingLLM(check)
#
#     chunks = [
#         chunk
#         async for chunk in ChatService(db_session).stream_reply(
#             project, user_message="以上です", llm=llm
#         )
#     ]
#
#     assert llm.stream_messages == []
#     assert len(chunks) == 1
#     assert "備品予約の要件です。" in chunks[0]
#     assert "この内容で設計書を生成する" in chunks[0]
#     assert project.hearing_check == check.model_dump()
#     history = await ChatHistoryRepository(db_session).list_for_project(project.id)
#     assert (history[-1].sender, history[-1].message) == ("ai", chunks[0])
#
#
# async def test_stream_reply_passes_missing_points_to_reply_when_insufficient(
#     db_session: AsyncSession,
# ) -> None:
#     """足りなければ通常の返信を作り、判定の不足点をシステムプロンプトに足す
#     (発話の回数が足りないことを示す点は、対話の観点ではないので渡さない)。"""
#     project = await _create_project(db_session)
#     check = HearingCompletionCheck(
#         is_sufficient=True, summary="要約", missing_points=["想定ユーザー"]
#     )
#     llm = _RecordingLLM(check)
#
#     async for _ in ChatService(db_session).stream_reply(
#         project, user_message="はじめまして", llm=llm
#     ):
#         pass
#
#     system_prompt = llm.stream_messages[0][0].content
#     assert "[まだ確認できていない観点]\n- 想定ユーザー" in system_prompt
#     assert "対話がまだ十分に進んでいません" not in system_prompt
#     assert project.hearing_check is not None
#     assert project.hearing_check["is_sufficient"] is False
#
#
# async def test_stream_reply_continues_and_clears_check_when_check_fails(
#     db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
# ) -> None:
#     """判定に失敗しても返信は続け、古い判定で生成ボタンが残らないよう保存済みの判定を消す。"""
#     project = await _create_project(db_session)
#     project.hearing_check = HearingCompletionCheck(is_sufficient=True, summary="古い").model_dump()
#
#     async def _failing_check(self, project, *, llm=None):  # noqa: ANN001
#         raise GenerationFailedError("失敗")
#
#     monkeypatch.setattr(ChatService, "check_completion", _failing_check)
#     fake_llm = FakeLLM(stream_chunks=["続けます"])
#
#     chunks = [
#         chunk
#         async for chunk in ChatService(db_session).stream_reply(
#             project, user_message="はじめまして", llm=fake_llm
#         )
#     ]
#
#     assert chunks == ["続けます"]
#     assert project.hearing_check is None


# Phase-34-2:追記 ── 観点の表で返信を分けるテストと、観点の表の表示(points_view)のテスト
async def test_stream_reply_presents_summary_without_llm_reply_when_sufficient(
    db_session: AsyncSession,
) -> None:
    """必須の観点がそろったら、LLMで返信を作らず、観点の表から組み立てたまとめを返して判定を
    保存する(発言の回数の下限は無い。1回目の発言でも、必須がそろえば十分)。"""
    project = await _create_project(db_session)
    llm = _RecordingLLM(_all_decided(1, scale="internal"))

    chunks = [
        chunk
        async for chunk in ChatService(db_session).stream_reply(
            project, user_message="以上です", llm=llm
        )
    ]

    assert llm.stream_messages == []
    assert len(chunks) == 1
    assert "- 規模: 社内" in chunks[0]
    assert "- 可用性: 可用性の決定" in chunks[0]
    assert "この内容で設計書を生成する" in chunks[0]
    assert project.hearing_check is not None
    assert project.hearing_check["is_sufficient"] is True
    assert project.hearing_check["missing_points"] == []
    history = await ChatHistoryRepository(db_session).list_for_project(project.id)
    assert (history[-1].sender, history[-1].message) == ("ai", chunks[0])


async def test_stream_reply_passes_open_required_points_to_reply_when_insufficient(
    db_session: AsyncSession,
) -> None:
    """足りなければ通常の返信を作り、未決の必須の観点を(規模から順に)システムプロンプトに足す。"""
    project = await _create_project(db_session)
    llm = _RecordingLLM()

    async for _ in ChatService(db_session).stream_reply(
        project, user_message="はじめまして", llm=llm
    ):
        pass

    system_prompt = llm.stream_messages[0][0].content
    assert "[まだ確認できていない観点]\n- 規模(例: " in system_prompt
    assert project.hearing_check is not None
    assert project.hearing_check["is_sufficient"] is False
    assert project.hearing_check["missing_points"][0] == "規模"


async def test_stream_reply_keeps_table_and_clears_check_when_judgement_fails(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """判定に失敗しても返信は続ける。観点の表は前のまま残し、古い判定で生成ボタンが残らないよう
    保存済みの完了判定は消す。返信には、残した表の未決の必須を渡す。"""
    project = await _create_project(db_session)
    states = initial_states()
    states["scale"] = PointState("scale", "decided", "個人", ("x",))
    await HearingPointRepository(db_session).save_states(project.id, states.values())
    project.hearing_check = HearingCompletionCheck(is_sufficient=True, summary="古い").model_dump()

    async def _failing_judge(self, project, *, llm=None):  # noqa: ANN001
        raise GenerationFailedError("失敗")

    monkeypatch.setattr(ChatService, "judge_points", _failing_judge)
    llm = _RecordingLLM()

    chunks = [
        chunk
        async for chunk in ChatService(db_session).stream_reply(
            project, user_message="はじめまして", llm=llm
        )
    ]

    assert chunks == ["こんにちは"]
    assert project.hearing_check is None
    assert "- 目的・課題(例: " in llm.stream_messages[0][0].content
    view = await ChatService(db_session).points_view(project)
    assert view.stale is True
    assert view.is_sufficient is False
    assert view.points[0].status == "decided"


async def test_points_view_of_new_project_lists_all_points_as_open(
    db_session: AsyncSession,
) -> None:
    project = await _create_project(db_session)

    view = await get_hearing_points(db_session, project)

    assert (view.legacy, view.stale, view.is_sufficient, view.scale) == (False, False, False, None)
    assert [p.key for p in view.points] == [d.key for d in POINT_DEFS]
    assert all(p.status == "open" for p in view.points)
    # 規模が未決の間は「個人・小規模」の列で必須を示す
    assert {p.key for p in view.points if p.required} >= {"scale", "tech", "security"}
    assert not next(p for p in view.points if p.key == "daily_flow").required


async def test_points_view_marks_project_with_only_old_check_as_legacy(
    db_session: AsyncSession,
) -> None:
    project = await _create_project(db_session)
    project.hearing_check = HearingCompletionCheck(is_sufficient=True, summary="5条件").model_dump()

    view = await ChatService(db_session).points_view(project)

    assert view.legacy is True
    assert view.is_sufficient is False


async def test_points_view_after_judgement_labels_evidence(db_session: AsyncSession) -> None:
    project = await _create_project(db_session)
    await _add_history(db_session, project, "intake", "ai")
    llm = _RecordingLLM(_all_decided(2))

    async for _ in ChatService(db_session).stream_reply(project, user_message="以上", llm=llm):
        pass
    view = await ChatService(db_session).points_view(project)

    assert (view.legacy, view.stale, view.is_sufficient, view.scale) == (
        False,
        False,
        True,
        "personal",
    )
    assert [e.label for e in view.points[0].evidence] == ["発言1"]


def test_hearing_prompt_leaves_summary_and_documents_to_the_system() -> None:
    """ヒアリングのAIは、確定の確認・まとめ・設計書の本文をチャットに書かない(判定とまとめは
    システムが行い、生成は画面のボタンで行う)。"""
    assert "まとめ(サマリ)" in _HEARING_SYSTEM_PROMPT
    assert "設計書(要件定義書など)の本文" in _HEARING_SYSTEM_PROMPT
    assert "画面のボタン" in _HEARING_SYSTEM_PROMPT


async def test_create_project_route_generates_opening_ai_reply(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """POST /projects (create_project)が、intake保存後にChatService.generate_opening_replyを
    呼び、AIの最初の発話がchat_historiesに保存されることを確認する。"""
    user = User(email="owner2@example.com", hashed_password="x")
    db_session.add(user)
    await db_session.flush()
    monkeypatch.setattr(
        "app.services.chat_service.get_gemini_llm",
        lambda: FakeLLM(content="【確認したい事】\n・想定ユーザー\n\nまず、対象ユーザーを教えてください。"),
    )

    project_read = await create_project(
        session=db_session,
        current_user=user,
        # Phase-24:追記
        name="トレンド調査",
        system_overview="トレンド情報を調べたい",
        goals_raw="効率的に把握したい",
        files=[],
    )

    history = await ChatHistoryRepository(db_session).list_for_project(project_read.id)
    assert [h.sender for h in history] == ["intake", "ai"]
    assert "確認したい事" in history[1].message


async def test_create_project_route_succeeds_even_if_opening_reply_fails(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AIの最初の発話生成がクォータ超過等で失敗しても、プロジェクト作成自体は成功することを確認する。"""
    user = User(email="owner3@example.com", hashed_password="x")
    db_session.add(user)
    await db_session.flush()

    # _is_quota_errorをTrueに固定し、invoke_with_retryがリトライせず即座に
    # LLMQuotaExceededErrorを送出するようにする(test_llm_retry.pyと同じ手法)。
    import app.services.llm_retry as llm_retry_module

    monkeypatch.setattr(llm_retry_module, "_is_quota_error", lambda _exc: True)

    class _FailingLLM(FakeLLM):
        async def ainvoke(self, messages):  # noqa: ANN001
            raise RuntimeError("quota exceeded")

    monkeypatch.setattr("app.services.chat_service.get_gemini_llm", lambda: _FailingLLM())

    project_read = await create_project(
        session=db_session,
        current_user=user,
        # Phase-24:追記
        name="トレンド調査",
        system_overview="トレンド情報を調べたい",
        goals_raw="効率的に把握したい",
        files=[],
    )

    history = await ChatHistoryRepository(db_session).list_for_project(project_read.id)
    assert [h.sender for h in history] == ["intake"]


def _entry(sender: str, message: str) -> ChatHistory:
    return ChatHistory(sender=sender, message=message)


def _project(intake: dict | None = None) -> Project:
    return Project(intake=intake)


def test_build_messages_maps_user_and_intake_to_human_message() -> None:
    history = [_entry("intake", "概要: 備品予約"), _entry("user", "予約の重複を防ぎたい")]

    messages = _build_messages(history, _project())

    assert isinstance(messages[0], SystemMessage)
    assert messages[1:] == [
        HumanMessage(content="概要: 備品予約"),
        HumanMessage(content="予約の重複を防ぎたい"),
    ]


def test_build_messages_maps_attachment_to_human_message() -> None:
    # sender='attachment'(添付ファイル抽出結果)はチャット画面には表示しないが、
    # ヒアリング対話のLLMコンテキストには'user'/'intake'と同様に含める
    history = [_entry("attachment", "[添付ファイル: spec.pdf]\n本文")]

    messages = _build_messages(history, _project())

    assert messages[1:] == [HumanMessage(content="[添付ファイル: spec.pdf]\n本文")]


def test_build_messages_maps_ai_to_ai_message() -> None:
    history = [_entry("ai", "承知しました")]

    messages = _build_messages(history, _project())

    assert messages[1:] == [AIMessage(content="承知しました")]


def test_build_messages_excludes_others_sender() -> None:
    # sender='others'(自己診断結果)はヒアリング中の対話文脈には含めない
    history = [_entry("user", "こんにちは"), _entry("others", "自己診断: 不足あり")]

    messages = _build_messages(history, _project())

    assert messages[1:] == [HumanMessage(content="こんにちは")]


def test_build_messages_injects_environment_from_project_intake() -> None:
    # environmentはchat_historiesには保存されない(表示対象外)ため、project.intakeから
    # 直接読み取ってHumanMessageとして注入されることを確認する。
    project = _project(intake={"environment": {"languages": ["Python"]}})

    messages = _build_messages([], project)

    assert len(messages) == 2
    assert isinstance(messages[1], HumanMessage)
    assert "Python" in messages[1].content


def test_build_messages_omits_environment_message_when_not_provided() -> None:
    project = _project(intake={"system_overview": "s"})

    messages = _build_messages([], project)

    assert len(messages) == 1
    assert isinstance(messages[0], SystemMessage)


# Phase-6-3:追記
def test_build_messages_merges_template_system_prompt() -> None:
    template = PromptTemplate(
        name="Webアプリケーション標準", target_type="Web", system_prompt="Web案件向けの追加指示"
    )

    messages = _build_messages([], _project(), template)

    assert isinstance(messages[0], SystemMessage)
    assert "Web案件向けの追加指示" in messages[0].content


def test_build_messages_omits_template_section_when_none() -> None:
    messages = _build_messages([], _project(), None)

    assert isinstance(messages[0], SystemMessage)
    assert "選択されたテンプレート" not in messages[0].content


async def test_generate_opening_reply_persists_ai_message(db_session: AsyncSession) -> None:
    project = await _create_project(db_session)
    fake_llm = FakeLLM(content="以上を元に詳細のヒアリングを進めていきます。")
    service = ChatService(db_session)

    reply = await service.generate_opening_reply(project, llm=fake_llm)

    assert reply == "以上を元に詳細のヒアリングを進めていきます。"
    history = await ChatHistoryRepository(db_session).list_for_project(project.id)
    assert [(h.sender, h.message) for h in history] == [("ai", reply)]


# Phase-6-3:追記
async def test_generate_opening_reply_merges_template_system_prompt(
    db_session: AsyncSession,
) -> None:
    user = User(email="owner-template@example.com", hashed_password="x")
    db_session.add(user)
    await db_session.flush()
    template = PromptTemplate(
        name="API向け", target_type="API", system_prompt="API設計の観点を優先する"
    )
    db_session.add(template)
    await db_session.flush()
    project = Project(user_id=user.id, title="p", template_id=template.id)
    db_session.add(project)
    await db_session.flush()
    fake_llm = FakeLLM(content="開始します")
    service = ChatService(db_session)

    await service.generate_opening_reply(project, llm=fake_llm)

    sent_system_message = fake_llm.invoke_messages[0][0]
    assert "API設計の観点を優先する" in sent_system_message.content

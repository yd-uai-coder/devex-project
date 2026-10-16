# 作成：Phase-15-3｜更新：Phase-24(ゴール3後の調整),34-2,35-2,68-3
# 写経レベル: コア ── 200を返した後の失敗がSSEのイベントで届くことを確かめる。
"""ヒアリングチャットのSSE(本文・選択肢カードのイベントと、途中の失敗の`event: error`)のテスト。

SUT: send_hearing_message(ルート)
ドライバ: 各テスト関数(StreamingResponseの本体を最後まで読む)
スタブ: FakeLLM ── 観点の判定には何も決まっていない結果、返信には本文を返す。
_FailingReplyLLM ── 判定は通り、返信の構造化出力だけが失敗し続けるLLM。
"""

# Phase-35-2：更新(返信を構造化出力の1回にしたので、途中で切れるストリームの代わりに、返信の
# 構造化出力が失敗し続ける場合を確かめる。本文 → カード → [DONE] の順と、カードの回答の誤りも足した。
# as_llm_error は削除した)。以下は Phase 34-2 までの本体:
# # Phase-24:追記 ── tests.fixtures.fake_llm.FakeLLM, app.schemas.generation.HearingCompletionCheck
# # Phase-34-2:追記 ── app.schemas.hearing.HearingPointsJudgement
# # Phase-34-2：削除 ── app.schemas.generation.HearingCompletionCheck
# import json
# from collections.abc import AsyncIterator
# from typing import Any
#
# import pytest
# from sqlalchemy.ext.asyncio import AsyncSession
# from tests.fixtures.fake_llm import FakeLLM
# from tests.fixtures.uml import create_project
#
# from app.api.routes.projects import send_hearing_message
# from app.repositories.chat_history import ChatHistoryRepository
# from app.schemas.hearing import HearingMessageRequest, HearingPointsJudgement
# from app.services import chat_service
# from app.services.errors import GenerationFailedError, LLMQuotaExceededError
# from app.services.llm_retry import as_llm_error
#
#
# class _Chunk:
#     def __init__(self, content: str) -> None:
#         self.content = content
#
#
# class _FailingStreamLLM:
#     async def astream(self, _messages: Any) -> AsyncIterator[_Chunk]:
#         yield _Chunk("途中まで")
#         raise RuntimeError("connection reset")
#
#     # Phase-24:追記
#     def with_structured_output(self, schema: Any) -> Any:
#         # Phase-34-2：更新
#         # insufficient = HearingCompletionCheck(is_sufficient=False, summary="", missing_points=[])
#         # return FakeLLM(structured=insufficient).with_structured_output(schema)
#         # ↓↓
#         return FakeLLM(structured=HearingPointsJudgement()).with_structured_output(schema)
#
#
# async def _read_body(response: Any) -> str:
#     parts = [
#         part if isinstance(part, str) else part.decode() async for part in response.body_iterator
#     ]
#     return "".join(parts)
#
#
# async def test_stream_failure_is_sent_as_error_event(
#     db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
# ) -> None:
#     monkeypatch.setattr(chat_service, "get_gemini_llm", lambda: _FailingStreamLLM())
#     project = await create_project(db_session)
#     await db_session.commit()
#     project_id = project.id  # rollbackで失効した後に読まないよう、先に取り出す
#
#     response = await send_hearing_message(
#         HearingMessageRequest(message="こんにちは"), db_session, project
#     )
#     body = await _read_body(response)
#
#     assert "途中まで" in body
#     assert "[DONE]" not in body
#     event = body.split("\n\n")[-2]
#     assert event.startswith("event: error\n")
#     payload = json.loads(event.split("data: ", 1)[1])
#     assert payload["code"] == "LLM_API_ERROR"
#     # 失敗した発言は残さない(rollback)
#     assert await ChatHistoryRepository(db_session).list_for_project(project_id) == []
#
#
# def test_as_llm_error_keeps_app_errors_and_wraps_others() -> None:
#     quota = LLMQuotaExceededError("上限")
#
#     assert as_llm_error(quota) is quota
#     assert isinstance(as_llm_error(RuntimeError("x")), GenerationFailedError)
# ↓↓

# Phase-68-3：削除 ── app.services.chat_service
# Phase-68-3:追記 ── tests.fixtures.llm_resolver.stub_llm_resolver
import json
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from tests.fixtures.fake_llm import FakeLLM
from tests.fixtures.llm_resolver import stub_llm_resolver
from tests.fixtures.uml import create_project

from app.api.routes.projects import send_hearing_message
from app.repositories.chat_history import ChatHistoryRepository
from app.schemas.hearing import (
    CardAnswer,
    HearingMessageRequest,
    HearingPointsJudgement,
    HearingReplyOut,
)
from app.services import llm_retry


class _FailingReplyLLM:
    # Phase-68-3：更新
    # def with_structured_output(self, schema: Any) -> Any:
    # ↓↓
    def with_structured_output(self, schema: Any, **_kwargs: Any) -> Any:
        if schema is HearingReplyOut:
            return FakeLLM(structured_sequence=[RuntimeError("reset")] * 5).with_structured_output(
                schema
            )
        return FakeLLM(structured=HearingPointsJudgement()).with_structured_output(schema)


async def _read_body(response: Any) -> str:
    parts = [
        part if isinstance(part, str) else part.decode() async for part in response.body_iterator
    ]
    return "".join(parts)


def _events(body: str) -> list[str]:
    return [event for event in body.split("\n\n") if event]


async def test_reply_text_then_cards_then_done(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    llm = FakeLLM(
        structured=HearingPointsJudgement(),
        structured_by_schema={HearingReplyOut: HearingReplyOut(message="教えてください")},
    )
    # Phase-68-3：更新
    # monkeypatch.setattr(chat_service, "get_gemini_llm", lambda: llm)
    # ↓↓
    stub_llm_resolver(monkeypatch, llm)
    project = await create_project(db_session)
    await db_session.commit()

    response = await send_hearing_message(
        HearingMessageRequest(message="こんにちは"), db_session, project
    )
    events = _events(await _read_body(response))

    assert json.loads(events[0].removeprefix("data: ")) == {"delta": "教えてください"}
    assert events[1].startswith("event: cards\ndata: ")
    cards = json.loads(events[1].split("data: ", 1)[1])["cards"]
    assert [card["point_key"] for card in cards] == ["scale"]  # 規模が未決なので規模のカード
    assert events[2] == "data: [DONE]"


async def test_reply_failure_is_sent_as_error_event(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Phase-68-3：更新
    # monkeypatch.setattr(chat_service, "get_gemini_llm", lambda: _FailingReplyLLM())
    # ↓↓
    stub_llm_resolver(monkeypatch, _FailingReplyLLM())
    monkeypatch.setattr(llm_retry, "RETRY_DELAY_SECONDS", 0)
    project = await create_project(db_session)
    await db_session.commit()
    project_id = project.id  # rollbackで失効した後に読まないよう、先に取り出す

    response = await send_hearing_message(
        HearingMessageRequest(message="こんにちは"), db_session, project
    )
    body = await _read_body(response)

    assert "[DONE]" not in body
    event = _events(body)[-1]
    assert event.startswith("event: error\n")
    payload = json.loads(event.split("data: ", 1)[1])
    assert payload["code"] == "LLM_API_ERROR"
    # 失敗した発言は残さない(rollback)
    assert await ChatHistoryRepository(db_session).list_for_project(project_id) == []


async def test_invalid_card_answer_is_sent_as_error_event(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Phase-68-3：更新
    # monkeypatch.setattr(chat_service, "get_gemini_llm", lambda: FakeLLM())
    # ↓↓
    stub_llm_resolver(monkeypatch, FakeLLM())
    project = await create_project(db_session)
    await db_session.commit()

    response = await send_hearing_message(
        HearingMessageRequest(card_answers=[CardAnswer(card_id="none", option=0)]),
        db_session,
        project,
    )
    event = _events(await _read_body(response))[-1]

    assert event.startswith("event: error\n")
    assert json.loads(event.split("data: ", 1)[1])["code"] == "INVALID_CARD_ANSWER"


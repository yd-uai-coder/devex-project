# 更新：Phase-15-4
# CL開発以前のスターターテンプレート由来のファイル(CLAUDE.md #29)。今回が初めてのsamples反映
# (以下は差分のみでなく全文)。独自の再試行を共通の invoke_with_retry に寄せた(気づき#7)。
# 写経レベル: 定型
# Phase-15-4:追記 ── app.services.llm_retry.invoke_with_retry
# Phase-15-4：削除 ── asyncio, collections.abc(Awaitable, Callable), typing.Any,
#   app.services.errors(GenerationFailedError, RateLimitExceededError)
#   (importの並びをリンターが崩さないよう、#29の特則どおりタグはブロックの前にまとめた)
import uuid

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.graph.workflow import get_chat_workflow
from app.core.config import settings
from app.models.conversation import Conversation, Message
from app.repositories.conversation import ConversationRepository
from app.services.errors import ConversationNotFoundError
from app.services.llm_retry import invoke_with_retry
from app.services.rate_limit import RateLimit, RateLimiter

# Phase-15-4：削除(app/services/llm_retry.py の同名の定数を使う)
# MAX_GENERATION_ATTEMPTS = 3  # LLM呼び出しの一時的な失敗に対する最大リトライ回数
# RETRY_DELAY_SECONDS = 1.0  # リトライ間隔（秒）


class ChatService:
    """会話へのメッセージ送信、レート制限、LLMワークフロー呼び出しを取りまとめるサービス。"""

    def __init__(self, session: AsyncSession, redis: Redis) -> None:
        # session: DB操作用の非同期セッション
        # redis: レート制限カウンタの保存に使うRedisクライアント
        self._session = session
        self._conversations = ConversationRepository(session)
        self._rate_limiter = RateLimiter(
            redis,
            resource="chat_message",
            limits=[
                RateLimit(window_seconds=3600, max_requests=settings.CHAT_RATE_LIMIT_PER_HOUR),
                RateLimit(window_seconds=86400, max_requests=settings.CHAT_RATE_LIMIT_PER_DAY),
            ],
        )

    async def send_message(
        self,
        *,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID | None,
        message: str,
        bypass_rate_limit: bool = False,
    ) -> tuple[Conversation, Message]:
        """ユーザーからのメッセージを会話に追加し、LLMワークフローで応答を生成して保存する。"""
        if not bypass_rate_limit:
            # 管理者ユーザーなどは呼び出し元の判断でバイパスできるようにしている
            await self._rate_limiter.enforce(str(user_id))

        conversation = await self._get_or_create_conversation(
            user_id=user_id, conversation_id=conversation_id, first_message=message
        )
        await self._conversations.add_message(
            conversation_id=conversation.id, role="user", content=message
        )

        workflow = get_chat_workflow()
        # Phase-15-4：更新
        # result = await self._invoke_with_retry(
        #     workflow.ainvoke,
        #     {
        #         "question": message,
        #         "messages": [],
        #         "needs_search": False,
        #         "search_query": "",
        #         "search_results": [],
        #         "evaluation": "",
        #         "answer": "",
        #     },
        # )
        # ↓↓
        initial_state = {
            "question": message,
            "messages": [],
            "needs_search": False,
            "search_query": "",
            "search_results": [],
            "evaluation": "",
            "answer": "",
        }
        # 再試行とクォータ超過の判定は、Devexの他のLLM呼び出しと同じ共通の部品に寄せる
        # (クォータ超過はLLM_QUOTA_EXCEEDED、規定回数の失敗はLLM_API_ERRORになる)
        result = await invoke_with_retry(lambda: workflow.ainvoke(initial_state))

        assistant_message = await self._conversations.add_message(
            conversation_id=conversation.id, role="assistant", content=result["answer"]
        )
        await self._session.commit()
        return conversation, assistant_message

    async def _get_or_create_conversation(
        self, *, user_id: uuid.UUID, conversation_id: uuid.UUID | None, first_message: str
    ) -> Conversation:
        """conversation_id未指定なら新規会話を作り、指定済みなら所有者チェックの上で取得する。"""
        if conversation_id is None:
            # 新規会話のタイトルは最初のメッセージ冒頭80文字を流用する
            title = first_message[:80]
            return await self._conversations.create(user_id=user_id, title=title)

        conversation = await self._conversations.get_by_id(conversation_id, user_id=user_id)
        if conversation is None:
            raise ConversationNotFoundError(f"Conversation {conversation_id} not found")
        return conversation

    # Phase-15-4：削除(共通の llm_retry.invoke_with_retry・_is_quota_error へ寄せた)
    # async def _invoke_with_retry(
    #     self,
    #     invoke: Callable[[dict[str, Any]], Awaitable[dict[str, Any]]],
    #     initial_state: dict[str, Any],
    # ) -> dict[str, Any]:
    #     """LLMワークフローを呼び出し、クォータ超過は即失敗、それ以外は規定回数までリトライする。"""
    #     last_error: Exception | None = None
    #     # attempt: 1回目から最大MAX_GENERATION_ATTEMPTS回まで試行する
    #     for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
    #         try:
    #             return await invoke(initial_state)
    #         except Exception as exc:
    #             if _is_quota_error(exc):
    #                 # クォータ超過はリトライしても解消しないため即座に諦める
    #                 raise RateLimitExceededError(
    #                     "AI provider quota exceeded, please try again later"
    #                 ) from exc
    #             last_error = exc
    #             if attempt < MAX_GENERATION_ATTEMPTS:
    #                 await asyncio.sleep(RETRY_DELAY_SECONDS)
    #     raise GenerationFailedError(
    #         "Failed to generate a response after multiple attempts"
    #     ) from last_error
    #
    #
    # _is_quota_error(exc: Exception) -> bool:
    # """例外がGemini/Tavilyのクォータ超過（429相当）を示すものかどうかを判定する。"""
    # try:
    #     from google.genai.errors import APIError as GoogleAPIError
    # except ImportError:
    #     # google-genaiが未インストールの環境向けフォールバック
    #     GoogleAPIError = None
    # try:
    #     from tavily import UsageLimitExceededError as TavilyUsageLimitExceededError
    # except ImportError:
    #     # tavily-pythonが未インストールの環境向けフォールバック
    #     TavilyUsageLimitExceededError = None
    #
    # if (
    #     GoogleAPIError is not None
    #     and isinstance(exc, GoogleAPIError)
    #     and getattr(exc, "code", None) == 429
    # ):
    #     return True
    # return TavilyUsageLimitExceededError is not None and isinstance(
    #     exc, TavilyUsageLimitExceededError
    # )

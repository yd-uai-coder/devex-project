# 更新：Phase-2-2,2-3,2-5
# Phase-2-3:追記 ── app.core.errors.BadRequestError
# Phase-2-5:追記 ── typing.ClassVar
from typing import ClassVar

from app.core.errors import (
    BadGatewayError,
    BadRequestError,
    ConflictError,
    NotFoundError,
    TooManyRequestsError,
    UnauthorizedError,
)


class InvalidCredentialsError(UnauthorizedError):
    """メールアドレスまたはパスワードが誤っている、もしくは無効化済みユーザーの場合に送出する。"""


class InvalidTokenError(UnauthorizedError):
    """JWTが不正・期限切れ、またはRedis上で失効済みの場合に送出する。"""


class UserAlreadyExistsError(ConflictError):
    """登録しようとしたメールアドレスが既に別ユーザーで使用されている場合に送出する。"""


class ConversationNotFoundError(NotFoundError):
    """指定した会話IDが存在しない、または他ユーザーが所有する会話である場合に送出する。"""


# Phase-2-2:追記(codeフィールドはPhase-2-5で追記)
class ProjectNotFoundError(NotFoundError):
    """指定したプロジェクトIDが存在しない、または他ユーザーが所有するプロジェクトである場合に送出する。"""

    # Phase-2-5:追記
    code: ClassVar[str | None] = "RESOURCE_NOT_FOUND"


# Phase-2-5:追記
class DocumentNotFoundError(NotFoundError):
    """指定したドキュメントIDが存在しない、または他ユーザーが所有するプロジェクトのものである場合に送出する。"""

    code: ClassVar[str | None] = "RESOURCE_NOT_FOUND"


# Phase-2-3:追記(codeフィールドはPhase-2-5で追記)
class TooManyFilesError(BadRequestError):
    """初期ヒアリングの添付ファイルが上限(3件)を超えている場合に送出する。"""

    # Phase-2-5:追記
    code: ClassVar[str | None] = "TOO_MANY_FILES"


# Phase-2-3:追記(codeフィールドはPhase-2-5で追記)
class UnsupportedFileTypeError(BadRequestError):
    """添付ファイルがtxt/Markdown/PDF以外の形式である場合に送出する。"""

    # Phase-2-5:追記
    code: ClassVar[str | None] = "UNSUPPORTED_FILE_TYPE"


# Phase-2-3:追記(codeフィールドはPhase-2-5で追記)
class FileTooLargeError(BadRequestError):
    """添付ファイルが1ファイルあたりの上限(5MB)を超えている場合に送出する。"""

    # Phase-2-5:追記
    code: ClassVar[str | None] = "FILE_TOO_LARGE"


class RateLimitExceededError(TooManyRequestsError):
    """Redisで管理するレート制限の上限（時間/日単位など）を超過した場合に送出する。"""


# Phase-2-5:追記
class LLMQuotaExceededError(TooManyRequestsError):
    """外部LLMプロバイダー(Gemini Flash-Lite無料枠)のトークン上限超過等で呼び出しが失敗した場合に送出する。
    app/services/chat.pyの既存の_is_quota_error判定と同じ基準をapp/services/llm_retry.pyに集約し、
    chat_service.py/doc_generator_service.pyの双方から利用する。"""

    code: ClassVar[str | None] = "LLM_QUOTA_EXCEEDED"


class GenerationFailedError(BadGatewayError):
    """LLM呼び出しが規定回数のリトライ後も失敗し続けた場合に送出する。"""

    # Phase-2-5:追記
    code: ClassVar[str | None] = "LLM_API_ERROR"

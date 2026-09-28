# 更新：Phase-2-5,6-5
# 写経レベル: 定型 ── AppError.codeが設定されている場合のみレスポンスに追加する分岐。
# 未処理例外を拾うcatch-allハンドラも本Phaseで追加(docs/internal_design.md 3.4節INTERNAL_SERVER_ERROR)。
# Phase-2-5:追記
# Phase-6-5:追記 ── structlog, sentry_sdk(標準logging.getLoggerの置き換え)
import sentry_sdk
import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.errors import AppError

# Phase-2-5:追記
logger = structlog.get_logger(__name__)


def register_error_handlers(app: FastAPI) -> None:
    """AppErrorとそのサブクラス、および未処理の例外をまとめてJSONレスポンスに変換するハンドラを
    FastAPIへ登録する。"""

    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        # Phase-2-5：更新
        # """AppError発生時に、例外クラスに紐づくstatus_codeとdetailメッセージを持つJSONを返す。"""
        # # exc.status_code: 例外クラスごとに定義されたHTTPステータスコード
        # return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})
        # ↓↓
        """AppError発生時に、例外クラスに紐づくstatus_codeとdetailメッセージを持つJSONを返す。
        exc.codeが設定されている場合は`code`フィールドも追加する。"""
        # exc.status_code: 例外クラスごとに定義されたHTTPステータスコード
        content: dict[str, object] = {"detail": str(exc)}
        if exc.code is not None:
            content["code"] = exc.code
        return JSONResponse(status_code=exc.status_code, content=content)

    # Phase-2-5:追記
    @app.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
        # Phase-6-5：更新(structlogへの置き換え+Sentryへの送出を追加)
        # """AppErrorではない未処理の例外を拾う最終防衛ライン(docs/internal_design.md 3.4節
        # `INTERNAL_SERVER_ERROR`)。詳細(スタックトレース等)はレスポンスに含めず、サーバーログにのみ
        # 記録する ── クライアントへの情報漏洩を防ぐため。
        #
        # 既知の簡略化: ログ出力は標準`logging`のみで、docs/internal_design.md 3.4節が言及する
        # JSON構造化ログ(`structlog`等)への統一は未実施(今後のPhaseでの課題)。"""
        # logger.exception("Unhandled exception", exc_info=exc)
        # return JSONResponse(
        #     status_code=500,
        #     content={"detail": "Internal server error", "code": "INTERNAL_SERVER_ERROR"},
        # )
        # ↓↓
        """AppErrorではない未処理の例外を拾う最終防衛ライン(docs/internal_design.md 3.4節
        `INTERNAL_SERVER_ERROR`)。詳細(スタックトレース等)はレスポンスに含めず、サーバーログにのみ
        記録する ── クライアントへの情報漏洩を防ぐため。

        ERRORレベルでスタックトレース付きログを記録し(内部設計書3.4節)、あわせて
        `sentry_sdk.capture_exception`を呼ぶ。`SENTRY_DSN`未設定時は`sentry_sdk.init`自体を
        呼んでいないため、この呼び出しは完全にno-op(送信先クライアントが無く即座に戻るだけ)。"""
        logger.error("unhandled_exception", error_type=type(exc).__name__, exc_info=exc)
        sentry_sdk.capture_exception(exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "code": "INTERNAL_SERVER_ERROR"},
        )

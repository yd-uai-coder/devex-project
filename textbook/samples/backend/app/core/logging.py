# 作成：Phase-6-5
# 写経レベル: 定型 ── structlogの標準的なJSON構造化ログ設定(アプリ固有のドメイン判断は無い)。
import logging

import structlog

from app.core.config import settings


def configure_logging() -> None:
    """structlogをJSON構造化ログ出力に設定する(内部設計書3.4節)。app/main.pyの起動時に1度だけ呼ぶ。

    ログレベルのしきい値はsettings.DEBUGに従う(DEBUG=trueの開発環境のみDEBUGログを出力し、
    本番はINFO以上のみ)。standard libraryのlogging自体には一切手を加えない(uvicornの
    アクセスログ等、structlog経由ではないログの書式統一までは本Phaseのスコープ外)。
    """
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.DEBUG if settings.DEBUG else logging.INFO
        ),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

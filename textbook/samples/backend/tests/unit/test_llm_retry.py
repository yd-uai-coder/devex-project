# 作成：Phase-2-5｜更新：Phase-4-1,4-5
import asyncio

import pytest

from app.services import llm_retry
from app.services.errors import GenerationFailedError, LLMQuotaExceededError
from app.services.llm_retry import invoke_with_retry


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    """リトライ間隔(1秒)をテストで待たないようにする。"""

    async def _instant_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(llm_retry.asyncio, "sleep", _instant_sleep)


async def test_returns_result_on_first_success() -> None:
    async def _call() -> str:
        return "ok"

    result = await invoke_with_retry(_call)

    assert result == "ok"


async def test_retries_transient_failure_and_eventually_succeeds() -> None:
    calls = {"n": 0}

    async def _call() -> str:
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError("transient network error")
        return "recovered"

    result = await invoke_with_retry(_call)

    assert result == "recovered"
    assert calls["n"] == 3


async def test_raises_generation_failed_after_exhausting_attempts() -> None:
    calls = {"n": 0}

    async def _call() -> str:
        calls["n"] += 1
        raise RuntimeError("always fails")

    with pytest.raises(GenerationFailedError) as exc_info:
        await invoke_with_retry(_call)

    assert calls["n"] == llm_retry.MAX_GENERATION_ATTEMPTS
    # Phase-4-1:追記 ── このメッセージはAppErrorハンドラを経由してそのままHTTPレスポンスの
    # detailへ返る(他のエラーコードと違いcheck_completion/generate_opening_replyの呼び出し元は
    # 例外を握りつぶさないルートがあるため、英語のままだと日本語UIに英語エラーが表示されてしまう
    # ── Phase 4-1で発見・修正)。
    assert "時間をおいて再度お試しください" in str(exc_info.value)


async def test_fails_fast_on_quota_error_without_retrying(monkeypatch: pytest.MonkeyPatch) -> None:
    # _is_quota_errorの判定基準(google.genai.errors.APIErrorの構築)自体はapp/services/chat.pyの
    # 既存実装と同一のため、ここではその判定結果(True)に対するinvoke_with_retryの振る舞いを検証する。
    monkeypatch.setattr(llm_retry, "_is_quota_error", lambda _exc: True)
    calls = {"n": 0}

    async def _call() -> str:
        calls["n"] += 1
        raise RuntimeError("quota exceeded")

    with pytest.raises(LLMQuotaExceededError) as exc_info:
        await invoke_with_retry(_call)

    assert calls["n"] == 1  # リトライせず1回で諦める
    assert "本日の利用上限に達しました" in str(exc_info.value)  # Phase-4-1:追記(日本語化の固定)


# Phase-4-5:追記
async def test_treats_timeout_error_as_transient_retryable_failure() -> None:
    """`asyncio.TimeoutError`(get_gemini_llm()のtimeout設定超過時にlangchain-google-genaiが
    送出しうる例外)は、_is_quota_errorに該当しないため他の一時的失敗と同じ扱いになり、
    リトライを経て最終的にGenerationFailedErrorになることを確認する(docs/implementation_plan.md
    4.2節「LLM呼び出しタイムアウト時の挙動確認」に対応するテスト)。"""
    calls = {"n": 0}

    async def _call() -> str:
        calls["n"] += 1
        raise TimeoutError("Gemini呼び出しがタイムアウトしました")

    with pytest.raises(GenerationFailedError):
        await invoke_with_retry(_call)

    assert calls["n"] == llm_retry.MAX_GENERATION_ATTEMPTS


# Phase-4-5:追記
async def test_asyncio_timeout_error_is_treated_the_same_as_builtin_timeout_error() -> None:
    """Python 3.11以降`asyncio.TimeoutError`は`TimeoutError`のエイリアスであることを
    明示的に固定する(将来のPythonバージョンでこの関係が変わった場合に検知するための回帰テスト)。"""
    assert asyncio.TimeoutError is TimeoutError

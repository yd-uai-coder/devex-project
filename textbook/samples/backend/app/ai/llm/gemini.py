# 更新：Phase-2-3,4-3
from functools import lru_cache
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI

from app.ai.llm.fake import get_e2e_fake_llm
from app.core.config import settings

# Phase-4-3：更新(E2E_FAKE_LLM時はE2eFakeLLMを返す分岐+実クライアントへのtimeout指定を追加)
# @lru_cache
# def get_gemini_llm(*, temperature: float = 0.7) -> ChatGoogleGenerativeAI:
#     """設定値から構築したChatGoogleGenerativeAIクライアントを、温度パラメータ単位でキャッシュして返す。"""
#     return ChatGoogleGenerativeAI(
#         model=settings.GEMINI_MODEL,
#         api_key=settings.GOOGLE_API_KEY,
#         temperature=temperature,
#     )
# ↓↓
@lru_cache
def get_gemini_llm(*, temperature: float = 0.7) -> Any:
    """設定値から構築したLLMクライアントを、温度パラメータ単位でキャッシュして返す。

    `settings.E2E_FAKE_LLM`が有効な場合は実際のGemini APIを呼ばず、決定論的な
    `E2eFakeLLM`(app/ai/llm/fake.py)を返す(Phase 4-3: ブラウザE2Eテストを無料・
    決定論的に実行するため。本番では起動時にこのフラグ自体が拒否される、
    app/core/config.pyのSettings._reject_unsafe_production_settings参照)。

    戻り値の型をChatGoogleGenerativeAI固定からAnyに緩めたのは、E2eFakeLLMが
    LangChainのRunnableを継承しない軽量スタブ(必要なメソッドのみ実装)であり、
    共通の基底型が無いため(chat_service.py/doc_generator_service.py側の型注釈も
    元々`llm=None`のダックタイピングで、この変更による実質的な型安全性の後退は無い)。

    実クライアントには`timeout`(settings.LLM_TIMEOUT_SECONDS、既定60秒)を明示する。
    元々このパラメータを渡していなかったため、Gemini側の応答がハングした場合に
    クライアント側は無制限に待ち続ける(invoke_with_retryのリトライは例外発生時のみ
    働くため、ハングには無力)。Phase 4-5のパフォーマンス確認で発見した欠落。
    """
    if settings.E2E_FAKE_LLM:
        return get_e2e_fake_llm()
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        api_key=settings.GOOGLE_API_KEY,
        temperature=temperature,
        timeout=settings.LLM_TIMEOUT_SECONDS,
    )


def extract_text_content(content: str | list) -> str:
    """LangChainメッセージの`content`をプレーンな文字列に変換する。

    Geminiがthought signature(内部推論の継続性を保つためのメタデータ)を伴う応答を返すとき、
    `content`は`str`ではなく`[{"type": "text", "text": "...", "extras": {...}}]`のような
    辞書のリストになる(langchain-google-genaiの仕様)。素の`str()`はPythonのrepr(波括弧・
    引用符・エスケープされた改行)をそのまま出力してしまうため、`text`フィールドだけを
    取り出して連結する。chat_service.py(ヒアリング応答)・intake_file_processor.py(PDF
    テキスト化)・doc_generator_service.py(4文書生成+自己診断)の3箇所がGeminiの応答を
    テキスト化する際に共通で使う(CLAUDE.md #17: 実在の複数消費者による共通化)。
    """
    if isinstance(content, str):
        return content
    return "".join(
        str(block.get("text", "")) if isinstance(block, dict) else str(block) for block in content
    )

# 更新：Phase-2-3
from pydantic import BaseModel, Field


class FinalAnswer(BaseModel):
    """LLMに最終回答を構造化出力させるためのスキーマ。"""

    answer: str = Field(description="ユーザーの質問に対する最終的な回答本文")


# Phase-2-3:追記
# 写経レベル: コア ── ヒアリング完了判定5条件のドメインルールをスキーマ化した箇所。
class HearingCompletionCheck(BaseModel):
    """ヒアリング完了判定(docs/external_design.md 2.3節SCR-004の5条件)をLLMに構造化出力させるためのスキーマ。"""

    is_sufficient: bool = Field(description="5条件をすべて満たし、設計書生成に進める状態かどうか")
    summary: str = Field(description="ここまでのヒアリング内容を要約した文章。ユーザーへの確認提示に使う")
    missing_points: list[str] = Field(
        default_factory=list, description="is_sufficientがfalseの場合、まだ不足している観点の一覧"
    )

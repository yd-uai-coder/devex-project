# 作成：Phase-94-1｜更新：Phase-105-3,106-2
"""確認事項の一覧(ステージ12)の純粋関数。

docs/internal_design.md 3.3節「12. 合意の精度」。

- items: 確認事項(推測の要件・推測の利用者・根拠が未決の観点)の導出と、推測の採用率
"""

# Phase-105-3:追記 ── app.confirmations.items.legacy_user_keys
# Phase-106-2:追記 ── app.confirmations.items.changed_requirement_keys
from app.confirmations.items import (
    CONFIRMATION_KINDS,
    CONFIRMATION_STATUSES,
    OPPORTUNITIES,
    OPPORTUNITY_LABEL,
    RATED_KINDS,
    STATUS_LABEL,
    AdoptionCounts,
    ConfirmationItem,
    ConfirmationKind,
    ConfirmationStatus,
    Opportunity,
    adoption_counts,
    changed_requirement_keys,
    confirmation_items,
    confirmation_kind_of,
    item_target,
    legacy_user_keys,
    point_item_key,
    requirement_item,
    requirement_item_key,
    user_item,
    user_item_key,
)

__all__ = [
    "CONFIRMATION_KINDS",
    "CONFIRMATION_STATUSES",
    "OPPORTUNITIES",
    "OPPORTUNITY_LABEL",
    "RATED_KINDS",
    "STATUS_LABEL",
    "AdoptionCounts",
    "ConfirmationItem",
    "ConfirmationKind",
    "ConfirmationStatus",
    "Opportunity",
    "adoption_counts",
    # Phase-106-2:追記
    "changed_requirement_keys",
    "confirmation_items",
    "confirmation_kind_of",
    "item_target",
    # Phase-105-3:追記
    "legacy_user_keys",
    "point_item_key",
    "requirement_item",
    "requirement_item_key",
    "user_item",
    "user_item_key",
]

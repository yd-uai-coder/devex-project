# 作成：Phase-114-1｜更新：Phase-115-1
# Phase-115-1：更新(docstring: モジュールに、CR の下書きへの組み立てを足した)
"""資料(議事録・メール・資料)と合意済みの内容の違いの取り出しと、違いから CR の下書きへの
組み立て(純粋関数)。

docs/internal_design.md 3.3節「14. 変更の取り込み」。
"""

# Phase-115-1:追記 ── app.materials.drafting.BACKGROUND_SOURCE_OF_MATERIAL, app.materials.drafting.DRAFTABLE_KINDS, app.materials.drafting.ChangeRequestDraft, app.materials.drafting.DraftDifference, app.materials.drafting.DraftMaterial, app.materials.drafting.draft_change_request, app.materials.drafting.origin_keys, app.materials.drafting.requirement_candidates, app.materials.drafting.requirement_links
from app.materials.differences import (
    DIFFERENCE_KIND_LABEL,
    DIFFERENCE_STATUS_LABEL,
    DIFFERENCE_SYSTEM_PROMPT,
    MIN_QUOTE_CHARS,
    REPLACED_STATUSES,
    AgreedListing,
    CheckedDifference,
    DifferenceItemOut,
    DifferenceKind,
    DifferenceListOut,
    DifferenceStatus,
    MaterialFacts,
    agreed_listing,
    build_difference_messages,
    check_difference,
    check_differences,
    fresh_differences,
    normalize_quote,
    quote_found,
    resolve_key,
)
from app.materials.drafting import (
    BACKGROUND_SOURCE_OF_MATERIAL,
    DRAFTABLE_KINDS,
    ChangeRequestDraft,
    DraftDifference,
    DraftMaterial,
    draft_change_request,
    origin_keys,
    requirement_candidates,
    requirement_links,
)

__all__ = [
    # Phase-115-1:追記
    "BACKGROUND_SOURCE_OF_MATERIAL",
    "DIFFERENCE_KIND_LABEL",
    "DIFFERENCE_STATUS_LABEL",
    "DIFFERENCE_SYSTEM_PROMPT",
    # Phase-115-1:追記
    "DRAFTABLE_KINDS",
    "MIN_QUOTE_CHARS",
    "REPLACED_STATUSES",
    "AgreedListing",
    # Phase-115-1:追記
    "ChangeRequestDraft",
    "CheckedDifference",
    "DifferenceItemOut",
    "DifferenceKind",
    "DifferenceListOut",
    "DifferenceStatus",
    # Phase-115-1:追記
    "DraftDifference",
    "DraftMaterial",
    "MaterialFacts",
    "agreed_listing",
    "build_difference_messages",
    "check_difference",
    "check_differences",
    # Phase-115-1:追記
    "draft_change_request",
    "fresh_differences",
    "normalize_quote",
    # Phase-115-1:追記
    "origin_keys",
    "quote_found",
    # Phase-115-1:追記
    "requirement_candidates",
    "requirement_links",
    "resolve_key",
]

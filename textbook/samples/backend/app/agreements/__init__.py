# 作成：Phase-91-1｜更新：Phase-92-1,93-1,93-4,95-1
# Phase-95-1：更新(docstring: モジュールの一覧に history を足した)
# Phase-92-1：更新(docstring: モジュールの一覧に protection を足した)
"""合意の記録(ステージ12)の純粋関数。

docs/internal_design.md 3.3節「12. 合意の精度」。

- items: 合意の対象の要素(要件・利用者と使う場面・画面・API・外部連携)と比べる値
- origins: 合意の出どころと、画面に出す名前
- protection: 再生成の後に、合意済みの要素を合意の形へ戻す
- history: 要素1つの合意の履歴(合意の記録・戻した版・関わる CR)
"""

# Phase-92-1:追記 ── app.agreements.protection.RESTORE_REASONS, app.agreements.protection.Restored, app.agreements.protection.RestoreReason, app.agreements.protection.agreed_requirement_ids, app.agreements.protection.protect_requirements, app.agreements.protection.requirement_key
# Phase-93-1:追記 ── app.agreements.protection.AgreedExternalIds, app.agreements.protection.agreed_external_ids, app.agreements.protection.protect_external_design
# Phase-93-4:追記 ── app.agreements.items.change_request_items, app.agreements.items.kind_of
# Phase-95-1:追記 ── app.agreements.history.HISTORY_EVENT_LABEL, app.agreements.history.HISTORY_EVENTS, app.agreements.history.RESTORE_REASON_LABEL, app.agreements.history.ChangeRequestRef, app.agreements.history.ElementHistory, app.agreements.history.HistoryEntry, app.agreements.history.HistoryEvent, app.agreements.history.RecordFacts, app.agreements.history.RelatedChangeRequest, app.agreements.history.VersionFacts, app.agreements.history.element_history
from app.agreements.history import (
    HISTORY_EVENT_LABEL,
    HISTORY_EVENTS,
    RESTORE_REASON_LABEL,
    ChangeRequestRef,
    ElementHistory,
    HistoryEntry,
    HistoryEvent,
    RecordFacts,
    RelatedChangeRequest,
    VersionFacts,
    element_history,
)
from app.agreements.items import (
    AGREED_KINDS,
    USERS_KEY,
    USERS_LABEL,
    AgreedItem,
    AgreedKind,
    agreement_items,
    body_of,
    change_request_items,
    integration_key,
    kind_of,
    removed_keys,
)
from app.agreements.origins import (
    ADOPT_LABEL,
    AGREEMENT_ORIGINS,
    AgreementOrigin,
    origin_label,
)
from app.agreements.protection import (
    RESTORE_REASONS,
    AgreedExternalIds,
    Restored,
    RestoreReason,
    agreed_external_ids,
    agreed_requirement_ids,
    protect_external_design,
    protect_requirements,
    requirement_key,
)

__all__ = [
    "ADOPT_LABEL",
    "AGREED_KINDS",
    "AGREEMENT_ORIGINS",
    # Phase-92-1:追記
    # Phase-95-1:追記
    "HISTORY_EVENTS",
    "HISTORY_EVENT_LABEL",
    "RESTORE_REASONS",
    # Phase-95-1:追記
    "RESTORE_REASON_LABEL",
    "USERS_KEY",
    "USERS_LABEL",
    "AgreedItem",
    "AgreedKind",
    "AgreementOrigin",
    # Phase-92-1:追記
    # Phase-95-1:追記
    "ChangeRequestRef",
    "ElementHistory",
    "HistoryEntry",
    "HistoryEvent",
    "RecordFacts",
    "RelatedChangeRequest",
    "VersionFacts",
    "RestoreReason",
    # Phase-93-1:追記
    "AgreedExternalIds",
    "Restored",
    # Phase-93-1:追記
    "agreed_external_ids",
    "agreed_requirement_ids",
    "agreement_items",
    "body_of",
    # Phase-93-4:追記
    "change_request_items",
    # Phase-95-1:追記
    "element_history",
    "integration_key",
    # Phase-93-4:追記
    "kind_of",
    "origin_label",
    # Phase-93-1:追記
    "protect_external_design",
    # Phase-92-1:追記
    "protect_requirements",
    "removed_keys",
    # Phase-92-1:追記
    "requirement_key",
]

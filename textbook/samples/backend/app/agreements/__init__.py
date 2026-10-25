# 作成：Phase-91-1｜更新：Phase-92-1,93-1,93-4,95-1,97-1,105-2
# Phase-95-1：更新(docstring: モジュールの一覧に history を足した)
# Phase-97-1：更新(docstring: モジュールの一覧に status を足した)
# Phase-92-1：更新(docstring: モジュールの一覧に protection を足した)
"""合意の記録(ステージ12)の純粋関数。

docs/internal_design.md 3.3節「12. 合意の精度」。

- items: 合意の対象の要素(要件・利用者と使う場面・画面・API・外部連携)と比べる値
- origins: 合意の出どころと、画面に出す名前
- protection: 再生成の後に、合意済みの要素を合意の形へ戻す
- history: 要素1つの合意の履歴(合意の記録・戻した版・関わる CR)
- status: 表示中の版の要素ごとの合意の状態(合意済み・合意と違う・未合意・今の版に無い)
"""

# Phase-92-1:追記 ── app.agreements.protection.RESTORE_REASONS, app.agreements.protection.Restored, app.agreements.protection.RestoreReason, app.agreements.protection.agreed_requirement_ids, app.agreements.protection.protect_requirements, app.agreements.protection.requirement_key
# Phase-93-1:追記 ── app.agreements.protection.AgreedExternalIds, app.agreements.protection.agreed_external_ids, app.agreements.protection.protect_external_design
# Phase-93-4:追記 ── app.agreements.items.change_request_items, app.agreements.items.kind_of
# Phase-95-1:追記 ── app.agreements.history.HISTORY_EVENT_LABEL, app.agreements.history.HISTORY_EVENTS, app.agreements.history.RESTORE_REASON_LABEL, app.agreements.history.ChangeRequestRef, app.agreements.history.ElementHistory, app.agreements.history.HistoryEntry, app.agreements.history.HistoryEvent, app.agreements.history.RecordFacts, app.agreements.history.RelatedChangeRequest, app.agreements.history.VersionFacts, app.agreements.history.element_history
# Phase-97-1:追記 ── app.agreements.status.ELEMENT_STATE_LABEL, app.agreements.status.ELEMENT_STATES, app.agreements.status.CurrentAgreement, app.agreements.status.DocumentAgreementStatus, app.agreements.status.ElementState, app.agreements.status.ElementStatus, app.agreements.status.RestoredElement, app.agreements.status.element_states, app.agreements.status.restored_elements
# Phase-105-2:追記 ── app.agreements.items.service_match_key
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
    service_match_key,
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
from app.agreements.status import (
    ELEMENT_STATE_LABEL,
    ELEMENT_STATES,
    CurrentAgreement,
    DocumentAgreementStatus,
    ElementState,
    ElementStatus,
    RestoredElement,
    element_states,
    restored_elements,
)

__all__ = [
    "ADOPT_LABEL",
    "AGREED_KINDS",
    "AGREEMENT_ORIGINS",
    # Phase-92-1:追記
    # Phase-95-1:追記
    # Phase-97-1:追記
    "ELEMENT_STATES",
    "ELEMENT_STATE_LABEL",
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
    # Phase-97-1:追記
    "CurrentAgreement",
    "DocumentAgreementStatus",
    "ElementState",
    "ElementStatus",
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
    # Phase-97-1:追記
    "RestoredElement",
    "agreed_external_ids",
    "agreed_requirement_ids",
    "agreement_items",
    "body_of",
    # Phase-93-4:追記
    "change_request_items",
    # Phase-95-1:追記
    "element_history",
    # Phase-97-1:追記
    "element_states",
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
    # Phase-97-1:追記
    "restored_elements",
    # Phase-105-2:追記
    "service_match_key",
]

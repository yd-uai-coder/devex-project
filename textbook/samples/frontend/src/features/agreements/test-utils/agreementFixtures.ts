// 作成：Phase-97-2
import type {
  AgreementHistoryRead,
  AgreementStatusRead,
  ElementStatusRead,
} from "@/features/agreements/api/types";

// 行の合意の画面のテストで使う応答(devex-api の形。必要な項目だけ上書きする)。

export function makeElement(overrides: Partial<ElementStatusRead> = {}): ElementStatusRead {
  return {
    key: "req:FR-001",
    kind: "requirement",
    label: "FR-001 予約を登録できる",
    state: "agreed",
    state_label: "合意済み",
    origin_label: "B-1",
    baseline_number: 1,
    change_request_number: null,
    ...overrides,
  };
}

export function makeStatus(overrides: Partial<AgreementStatusRead> = {}): AgreementStatusRead {
  return {
    doc_type: "requirements",
    version: 2,
    change_request_number: null,
    elements: [
      makeElement(),
      makeElement({
        key: "req:FR-002",
        label: "FR-002 予約の一覧を見られる",
        origin_label: "CR-3",
        baseline_number: null,
        change_request_number: 3,
      }),
      makeElement({
        key: "req:FR-009",
        label: "FR-009 CSV で出力できる",
        state: "unagreed",
        state_label: "未合意",
        origin_label: null,
        baseline_number: null,
      }),
    ],
    restored: [],
    ...overrides,
  };
}

export function makeHistory(overrides: Partial<AgreementHistoryRead> = {}): AgreementHistoryRead {
  return {
    key: "req:FR-001",
    label: "FR-001 予約を登録できる",
    current: { id: "FR-001", text: "予約を登録できる" },
    entries: [
      {
        event: "agreed",
        event_label: "合意",
        occurred_at: "2026-10-19T01:00:00Z",
        origin_label: "B-1",
        label: "FR-001 予約を登録できる",
        doc_type: null,
        doc_label: null,
        version: null,
        restore_reason_label: null,
        change_request_number: null,
      },
      {
        event: "restored",
        event_label: "再生成の後に合意の形へ戻した",
        occurred_at: "2026-10-20T01:00:00Z",
        origin_label: null,
        label: null,
        doc_type: "requirements",
        doc_label: "要件定義書",
        version: 3,
        restore_reason_label: "書き換えを戻した",
        change_request_number: 2,
      },
    ],
    change_requests: [
      {
        number: 2,
        title: "確認メールを送る",
        status: "verified",
        status_label: "検証済み",
        target_kind_label: "内容の変更",
        predicted: false,
      },
    ],
    ...overrides,
  };
}

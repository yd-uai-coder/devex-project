// 作成：Phase-98-1
import type { ConfirmationItemRead, ConfirmationListRead } from "@/features/confirmations/api/types";

// 確認事項の一覧の画面のテストで使う応答(devex-api の形。必要な項目だけ上書きする)。

export function makeItem(overrides: Partial<ConfirmationItemRead> = {}): ConfirmationItemRead {
  return {
    key: "req:FR-004",
    kind: "requirement",
    label: "FR-004 期限の前に通知する",
    refs: [],
    present: true,
    status: "unconfirmed",
    status_label: "未確認",
    opportunity: null,
    opportunity_label: null,
    memo: "",
    updated_at: null,
    ...overrides,
  };
}

export function makeList(overrides: Partial<ConfirmationListRead> = {}): ConfirmationListRead {
  return {
    items: [
      makeItem(),
      makeItem({
        key: "user:管理者",
        kind: "user",
        label: "管理者: 月次で集計を見る",
        opportunity: "email",
        opportunity_label: "メール",
      }),
      makeItem({ key: "point:scale", kind: "point", label: "規模", refs: ["FR-002", "1.2"] }),
      makeItem({
        key: "req:FR-009",
        label: "FR-009 CSV で出力する",
        present: false,
        status: "confirmed",
        status_label: "確認済み",
        memo: "定例で確認",
      }),
    ],
    adoption: { confirmed: 1, rejected: 0, unconfirmed: 2, rate: 1 },
    ...overrides,
  };
}

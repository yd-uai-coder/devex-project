// 作成：Phase-87-2
"use client";

import type { ChangeRequestStatus } from "@/features/change-requests/api/types";
import { STATUS_TONE } from "@/features/change-requests/changeRequestOps";
import { BADGE } from "@/features/detailed-design/components/tableStyles";

// CR の状態のバッジ(一覧の行と詳細の見出しで使う)。文言はサーバーの status_label
export function StatusBadge({ status, label }: { status: ChangeRequestStatus; label: string }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      style={{
        ...BADGE,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        color: `var(--${tone}11)`,
        borderColor: `var(--${tone}8)`,
        background: `var(--${tone}2)`,
      }}
      aria-label={`状態: ${label}`}
    >
      {label}
    </span>
  );
}

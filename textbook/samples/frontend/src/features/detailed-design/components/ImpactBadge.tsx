// 作成：Phase-44-2
"use client";

import type { CSSProperties } from "react";
import type { ImpactMarkRead } from "@/features/detailed-design/api/types";
import { BADGE } from "@/features/detailed-design/components/tableStyles";
import {
  MARK_STATUS_LABELS,
  markStatus,
  type MarkStatus,
} from "@/features/detailed-design/impactOps";

const COLORS: Record<MarkStatus, CSSProperties> = {
  open: { color: "var(--red11)", borderColor: "var(--red8)", background: "var(--red2)" },
  reviewed: { color: "var(--green11)", borderColor: "var(--green8)", background: "var(--green2)" },
  pending: { color: "var(--color11)", borderColor: "var(--borderColor)", background: "transparent" },
};

// 変更の影響の印(見直し・確認済み・承認すると付く)。「変更の影響」パネルと各段階の表の行で使う。
// 印が無ければ何も出さない。title に理由を入れ、表の行でも理由を確かめられるようにする。
export function ImpactBadge({ mark }: { mark: ImpactMarkRead | undefined }) {
  if (mark === undefined) return null;
  const status = markStatus(mark);
  return (
    <span
      style={{ ...BADGE, fontFamily: "inherit", whiteSpace: "nowrap", ...COLORS[status] }}
      title={mark.reason}
      aria-label={`変更の影響: ${MARK_STATUS_LABELS[status]}`}
    >
      {MARK_STATUS_LABELS[status]}
    </span>
  );
}

// 作成：Phase-87-3
"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import type { ChangeRequestDecision } from "@/features/change-requests/api/types";
import { localInputToIso, nowLocalInput } from "@/features/change-requests/changeRequestOps";
import { INPUT } from "@/features/detailed-design/components/tableStyles";

const FIELD = { display: "block", marginTop: 8, fontSize: 13 } as const;

// 合意・却下の記録を入れるダイアログ(合意済みの版と同じ合意の記録。相手は空でもよく、理由は必須)。
// 日時は既定で今(手元の時刻)。合意すると、その時点の影響の予測が CR に保存される
export function DecisionDialog({
  open,
  decision,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  decision: ChangeRequestDecision["decision"];
  onConfirm: (body: ChangeRequestDecision) => void;
  onCancel: () => void;
}) {
  const [counterpart, setCounterpart] = useState("");
  const [decidedAt, setDecidedAt] = useState(() => nowLocalInput());
  const [memo, setMemo] = useState("");
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const agreed = decision === "agreed";

  const confirm = () => {
    const iso = localInputToIso(decidedAt);
    if (!reason.trim()) return setProblem("理由を入れてください");
    if (iso === null) return setProblem("日時を入れてください");
    setProblem(null);
    onConfirm({ decision, decided_at: iso, counterpart: counterpart.trim() || null, memo, reason: reason.trim() });
  };

  return (
    <ConfirmDialog
      open={open}
      title={agreed ? "合意を記録する" : "却下を記録する"}
      description={
        <>
          {agreed
            ? "合意すると、今の影響の予測を CR に保存します(反映の後の比較の基準になります)。"
            : "却下した CR はそのまま残ります。出し直すときは、写して新しい番号の下書きを作ります。"}
          <label style={FIELD}>
            相手(名前と役割。空でもよい)
            <input style={INPUT} value={counterpart} onChange={(e) => setCounterpart(e.target.value)} />
          </label>
          <label style={FIELD}>
            日時
            <input
              type="datetime-local"
              style={INPUT}
              value={decidedAt}
              onChange={(e) => setDecidedAt(e.target.value)}
            />
          </label>
          <label style={FIELD}>
            打ち合わせのメモ(任意)
            <textarea style={INPUT} rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>
          <label style={FIELD}>
            理由
            <textarea style={INPUT} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {problem ? (
            <span role="alert" style={{ display: "block", marginTop: 8, color: "var(--red10)" }}>
              {problem}
            </span>
          ) : null}
        </>
      }
      confirmLabel="記録する"
      onConfirm={confirm}
      onCancel={onCancel}
    />
  );
}

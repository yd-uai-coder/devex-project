// 作成：Phase-87-3｜更新：Phase-107-2
"use client";

// Phase-107-2:追記 ── @/features/change-requests/api/types.ChangeRequestOptionsRead
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import type { ChangeRequestDecision, ChangeRequestOptionsRead } from "@/features/change-requests/api/types";
import { localInputToIso, nowLocalInput } from "@/features/change-requests/changeRequestOps";
import { INPUT } from "@/features/detailed-design/components/tableStyles";

const FIELD = { display: "block", marginTop: 8, fontSize: 13 } as const;

// 合意・却下の記録を入れるダイアログ(合意済みの版と同じ合意の記録。相手は空でもよく、理由は必須)。
// Phase-107-2：更新
// // 日時は既定で今(手元の時刻)。合意すると、その時点の影響の予測が CR に保存される
// ↓↓
// 日時は既定で今(手元の時刻)。合意すると、その時点の影響の予測が CR に保存される。案のある CR の合意は
// 案を選ぶ(初めは選ばない。選ばないと記録できない)。選んだ案の対象が CR の対象になり、反映もその案で行う
export function DecisionDialog({
  open,
  decision,
  // Phase-107-2:追記
  options = null,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  decision: ChangeRequestDecision["decision"];
  // Phase-107-2:追記
  options?: ChangeRequestOptionsRead | null;
  onConfirm: (body: ChangeRequestDecision) => void;
  onCancel: () => void;
}) {
  const [counterpart, setCounterpart] = useState("");
  const [decidedAt, setDecidedAt] = useState(() => nowLocalInput());
  const [memo, setMemo] = useState("");
  const [reason, setReason] = useState("");
  // Phase-107-2:追記
  const [option, setOption] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const agreed = decision === "agreed";
  // Phase-107-2:追記
  const choices = agreed ? (options?.items ?? []) : [];

  const confirm = () => {
    const iso = localInputToIso(decidedAt);
    if (!reason.trim()) return setProblem("理由を入れてください");
    if (iso === null) return setProblem("日時を入れてください");
    // Phase-107-2:追記
    if (choices.length > 0 && option === null) return setProblem("合意した案を選んでください");
    setProblem(null);
    // Phase-107-2：更新
    // onConfirm({ decision, decided_at: iso, counterpart: counterpart.trim() || null, memo, reason: reason.trim() });
    // ↓↓
    onConfirm({
      decision,
      decided_at: iso,
      counterpart: counterpart.trim() || null,
      memo,
      reason: reason.trim(),
      ...(choices.length > 0 ? { option } : {}),
    });
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
          {/* Phase-107-2:追記 */}
          {choices.length > 0 ? (
            // 説明は <p> に入るので、<fieldset> でなく <span> の radiogroup にする
            <span role="radiogroup" aria-label="合意した案" style={{ display: "block", marginTop: 8 }}>
              <span style={{ display: "block", fontSize: 13 }}>合意した案</span>
              {choices.map((o) => (
                <label key={o.number} style={{ display: "block", fontSize: 13 }}>
                  <input
                    type="radio"
                    name="decision-option"
                    checked={option === o.number}
                    onChange={() => setOption(o.number)}
                  />{" "}
                  {`${o.label} ${o.name}${o.recommended ? "(おすすめ)" : ""}`}
                </label>
              ))}
            </span>
          ) : null}
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

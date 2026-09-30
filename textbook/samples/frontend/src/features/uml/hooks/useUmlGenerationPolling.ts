// 作成：Phase-11-4
// 写経レベル: コア ── 打ち切り(既知の制約への対策)と、active に同期した経過時間のリセット。
"use client";

import { useEffect, useState } from "react";
import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "@/hooks/useGenerationPolling";
import { useInterval } from "@/hooks/useInterval";
import { useUmlStore } from "@/features/uml/uml-store";

// POST /diagrams は 202 を返すだけでプッシュ通知が無いため、生成中の図がある間は
// 図の一覧と生成履歴を取り直して完了を検知する。
// 間隔と打ち切り時間は4文書生成のポーリング(useGenerationPolling)の値を再利用する。
// 打ち切り時間の3分は UML 生成向けに実測した値ではない(推奨値)。打ち切るのは、
// プロセスが落ちると generating のまま残り続けるという既知の制約(Phase 10)があるため。
export function useUmlGenerationPolling(
  projectId: string,
  active: boolean,
): { timedOut: boolean; resetTimeout: () => void } {
  const refresh = useUmlStore((s) => s.refresh);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timedOut = elapsedMs >= POLL_TIMEOUT_MS;

  useInterval(
    () => {
      setElapsedMs((current) => current + POLL_INTERVAL_MS);
      void refresh(projectId).catch(() => {
        // 一時的な取得失敗では止めない(次の間隔で取り直す)
      });
    },
    active && !timedOut ? POLL_INTERVAL_MS : null,
  );

  // 生成が終わったら(active が false に戻ったら)経過時間を戻し、次の生成に備える。
  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElapsedMs(0);
    }
  }, [active]);

  return { timedOut, resetTimeout: () => setElapsedMs(0) };
}

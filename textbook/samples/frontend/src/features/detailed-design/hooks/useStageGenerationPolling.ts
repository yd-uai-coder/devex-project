// 作成：Phase-16-6
// 写経レベル: 定型 ── UML図のポーリングと同じ形。
"use client";

import { useEffect, useState } from "react";
import {
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
} from "@/hooks/useGenerationPolling";
import { useInterval } from "@/hooks/useInterval";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";

// POST /design-stages/{stage}/generate は 202 を返すだけでプッシュ通知が無いため、生成中の段階が
// ある間は段階の一覧を取り直して完了を検知する(UML図の useUmlGenerationPolling と同じ形)。
// 間隔と打ち切り時間は4文書生成のポーリングの値を再利用する。バックエンドは15分を超えた
// 生成を一覧の取得時に失敗へ戻すので、打ち切った後も「再読み込み」で状態は正しくなる。
export function useStageGenerationPolling(
  projectId: string,
  active: boolean,
): { timedOut: boolean } {
  const fetchStages = useDetailedDesignStore((s) => s.fetchStages);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timedOut = elapsedMs >= POLL_TIMEOUT_MS;

  useInterval(
    () => {
      setElapsedMs((current) => current + POLL_INTERVAL_MS);
      void fetchStages(projectId);
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

  return { timedOut };
}

// 作成：Phase-3-6
"use client";

import { useEffect, useState } from "react";
import { getProject } from "@/features/hearing/api/hearingApi";
import { useInterval } from "@/hooks/useInterval";

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

// POST /generateは202のみ返しプッシュ通知が無いため、生成完了はGET /projects/{id}のstatusを
// ポーリングして検知する。チャット画面(ヒアリング完了承認後)とドキュメントプレビュー画面
// (再生成後)の両方で使う共通ロジック(元はChatPageContent.tsxに直接書かれていたが、
// ドキュメントプレビュー画面という2つ目の実消費者ができたためこのフックに切り出した)。
export function useGenerationPolling(
  projectId: string,
  active: boolean,
  onCompleted: () => void,
): { timedOut: boolean } {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  const polling = active && !timedOut;

  useInterval(
    () => {
      void (async () => {
        const project = await getProject(projectId);
        if (project.status === "completed") {
          onCompleted();
          return;
        }
        setElapsedMs((current) => current + POLL_INTERVAL_MS);
      })();
    },
    polling ? POLL_INTERVAL_MS : null,
  );

  useEffect(() => {
    if (elapsedMs >= POLL_TIMEOUT_MS) {
      setTimedOut(true);
    }
  }, [elapsedMs]);

  // activeがfalseに戻ったら(例: 新しいプロジェクトに切り替わった)状態をリセットする
  useEffect(() => {
    if (!active) {
      setElapsedMs(0);
      setTimedOut(false);
    }
  }, [active]);

  return { timedOut };
}

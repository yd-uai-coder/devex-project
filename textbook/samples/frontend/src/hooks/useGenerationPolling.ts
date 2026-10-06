// 作成：Phase-3-6｜更新：Phase-11-4,24(T2同期)
"use client";

import { useEffect, useState } from "react";
import { getProject } from "@/features/hearing/api/hearingApi";
import { useInterval } from "@/hooks/useInterval";

// Phase-11-4：更新(UML 生成のポーリング useUmlGenerationPolling が同じ値を再利用するため export する)
// const POLL_INTERVAL_MS = 5000;
// const POLL_TIMEOUT_MS = 3 * 60 * 1000;
// ↓↓
export const POLL_INTERVAL_MS = 5000;
export const POLL_TIMEOUT_MS = 3 * 60 * 1000;

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
  // Phase-24(T2同期)：更新(eslint の react-hooks/set-state-in-effect に合わせ、timedOut を state から算出値にした)
  // const [timedOut, setTimedOut] = useState(false);
  // ↓↓
  // timedOutはelapsedMsから導出できるため、別state+同期用useEffectは持たない
  // (レンダー中に計算するだけで済み、setStateを伴うeffectを1つ減らせる)。
  const timedOut = elapsedMs >= POLL_TIMEOUT_MS;

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

  // Phase-24(T2同期)：削除
  // useEffect(() => {
  //   if (elapsedMs >= POLL_TIMEOUT_MS) {
  //     setTimedOut(true);
  //   }
  // }, [elapsedMs]);

  // Phase-24(T2同期)：更新
  // // activeがfalseに戻ったら(例: 新しいプロジェクトに切り替わった)状態をリセットする
  // useEffect(() => {
  //   if (!active) {
  //     setElapsedMs(0);
  //     setTimedOut(false);
  //   }
  // }, [active]);
  // ↓↓
  // activeがfalseに戻ったら(例: 新しいプロジェクトに切り替わった)状態をリセットする。
  // elapsedMsは外部シグナル(active)に同期する内部stateであり、レンダー中に導出できる
  // 値ではないためeffectでのsetStateが妥当(eslint-disableはこの1箇所のみに限定する)。
  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElapsedMs(0);
    }
  }, [active]);

  return { timedOut };
}

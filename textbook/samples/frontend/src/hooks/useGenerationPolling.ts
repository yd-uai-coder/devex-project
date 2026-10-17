// 作成：Phase-3-6｜更新：Phase-11-4,24(T2同期),69-3
"use client";

import { useEffect, useState } from "react";
// Phase-69-3:追記
import type { ProjectRead } from "@/features/dashboard/api/projects";
import { getProject } from "@/features/hearing/api/hearingApi";
import { useInterval } from "@/hooks/useInterval";

// Phase-11-4：更新(UML 生成のポーリング useUmlGenerationPolling が同じ値を再利用するため export する)
// const POLL_INTERVAL_MS = 5000;
// const POLL_TIMEOUT_MS = 3 * 60 * 1000;
// ↓↓
export const POLL_INTERVAL_MS = 5000;
export const POLL_TIMEOUT_MS = 3 * 60 * 1000;

// POST /generateは202のみ返しプッシュ通知が無いため、生成完了はGET /projects/{id}のstatusを
// ポーリングして検知する。チャット画面(ヒアリング完了承認後)・ドキュメントプレビュー画面
// (再生成後)・詳細設計画面(テスト仕様書の作成後)で使う共通ロジック(元はChatPageContent.tsxに
// 直接書かれていたが、ドキュメントプレビュー画面という2つ目の実消費者ができたためこのフックに
// 切り出した)。
//
// Phase 69: 生成が終わったこと(`generating` でなくなったこと)を知らせ、読んだプロジェクトを渡す。
// 失敗するとサーバーは状態を生成の前(completed のこともある)に戻し、`generation_failure` に
// 記録するので、成功か失敗かは呼び出し元がそれで見分ける(`completed` だけを完了とみなすと、
// 失敗が成功に見える)。
export function useGenerationPolling(
  projectId: string,
  active: boolean,
  // Phase-69-3：更新
  // onCompleted: () => void,
  // ↓↓
  onFinished: (project: ProjectRead) => void,
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
        // Phase-69-3：更新
        // const project = await getProject(projectId);
        // if (project.status === "completed") {
        //   onCompleted();
        //   return;
        // ↓↓
        try {
          const project = await getProject(projectId);
          if (project.status !== "generating") {
            onFinished(project);
            return;
          }
        } catch {
          // 一時的に読めなくても待つのはやめない(次の回に読み直す)
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

// 作成：Phase-13-6
// 写経レベル: 定型 ── 取得・再取得・エラーを持つだけのフック。
"use client";

import { useCallback, useEffect, useState } from "react";
import { listEmbeds } from "@/features/uml/api/umlApi";
import type { UmlEmbedRead } from "@/features/uml/api/types";

type DiagramEmbeds = {
  embeds: UmlEmbedRead[];
  // 1回目の取得が終わったか(終わる前は「図が見つからない」と表示しない)
  loaded: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

// 内部設計書のプレビューに差し込む図と、図と文書の食い違いを取得する(GET .../uml/embeds)。
// 内部設計書のタブだけで使う(enabled=false のときは取得しない)。
// 図の状態はUMLの画面で変わるので、ストアにキャッシュせず、表示のたびに取り直す。
export function useDiagramEmbeds(projectId: string, enabled: boolean): DiagramEmbeds {
  const [embeds, setEmbeds] = useState<UmlEmbedRead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setEmbeds(await listEmbeds(projectId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "設計図の取得に失敗しました");
    } finally {
      setLoaded(true);
    }
  }, [projectId]);

  // 外部(API)から取ってきた値を state に入れるのはデータ取得そのもので、レンダー中に
  // 導出できる値ではないため、effect での取得が妥当(useGenerationPolling と同じ判断)。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (enabled) void reload();
  }, [enabled, reload]);

  return { embeds, loaded, error, reload };
}

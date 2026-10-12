// 作成：Phase-44-3
import { useCallback, useMemo, type CSSProperties } from "react";
import type { ImpactMarkRead } from "@/features/detailed-design/api/types";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { marksByKey } from "@/features/detailed-design/impactOps";

// 強調する行の背景(段階5の手順の表の強調と同じ色)
export const HIGHLIGHT_ROW: CSSProperties = { background: "var(--yellow4)" };

export type RowHighlight = {
  ref?: (el: HTMLElement | null) => void;
  style?: CSSProperties;
  "aria-current"?: "true";
};

// 段階の表の行に付ける変更の影響の印と、「表で見る」「段階Nで直す」で強調する行。
// mark(key) はその要素の印(無ければ undefined)、row(key) は行(tr)に広げる props
// (強調する行なら背景・aria-current と、表示したときに行までスクロールする ref)。
export function useStageImpact(stage: number): {
  mark: (key: string) => ImpactMarkRead | undefined;
  row: (key: string) => RowHighlight;
  highlighted: string | null;
} {
  const impact = useDetailedDesignStore((s) => s.impact);
  const highlight = useDetailedDesignStore((s) => s.highlight);
  const marks = useMemo(() => marksByKey(impact, stage), [impact, stage]);
  const highlighted = highlight?.stage === stage ? highlight.key : null;
  // 同じ行の再描画のたびにスクロールしないよう、強調の行が変わったときだけ作り直す
  const scrollTo = useCallback(
    (el: HTMLElement | null) => {
      if (el && highlighted !== null) el.scrollIntoView({ block: "center" });
    },
    [highlighted],
  );
  const mark = useCallback((key: string) => marks.get(key), [marks]);
  const row = useCallback(
    (key: string): RowHighlight =>
      key === highlighted ? { ref: scrollTo, style: HIGHLIGHT_ROW, "aria-current": "true" } : {},
    [highlighted, scrollTo],
  );
  return { mark, row, highlighted };
}

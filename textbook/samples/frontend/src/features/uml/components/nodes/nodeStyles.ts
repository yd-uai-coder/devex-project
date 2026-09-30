// 作成：Phase-11-5
// 写経レベル: 定型 ── ノード共通の枠のスタイル。
import type { CSSProperties } from "react";

// カスタムノード共通の枠。サイズは React Flow の node.width/height(配置の w/h)で決まるため、
// ここでは 100% で広げる。色は Tamagui テーマの CSS 変数を使う(ライト・ダーク両対応)。
export function nodeBoxStyle(selected: boolean | undefined, extra: CSSProperties = {}): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
    fontSize: 13,
    textAlign: "center",
    color: "var(--color)",
    background: "var(--background)",
    border: `${selected ? 2 : 1}px solid ${selected ? "var(--blue10)" : "var(--borderColor)"}`,
    ...extra,
  };
}

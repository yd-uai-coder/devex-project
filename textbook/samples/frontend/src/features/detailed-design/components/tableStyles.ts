// 作成：Phase-17-6｜更新：Phase-21-6
// 写経レベル: 定型 ── FunctionListPanel から切り出した表の見た目。
import type { CSSProperties } from "react";

// 段階の作業領域の表の見た目(段階1の機能一覧・段階2の処理概要表とデータ辞書で共有する。Phase 17 で
// FunctionListPanel から切り出した)。表は列が多く横に長いので、Tamagui の部品ではなく素の table と
// 入力欄で詰めて並べる(Phase 14 のデモ demo/DetailedDesignDemoPageContent.tsx と同じ書き方)。
export const CELL: CSSProperties = {
  padding: "4px 6px",
  borderBottom: "1px solid var(--borderColor)",
  textAlign: "left",
  verticalAlign: "top",
};
export const HEAD: CSSProperties = { ...CELL, background: "var(--color3)", whiteSpace: "nowrap" };
export const TABLE: CSSProperties = {
  borderCollapse: "collapse",
  fontSize: 13,
  color: "var(--color)",
  width: "100%",
};
// 背景はテーマの色にする。transparent だと、セレクトの選択肢(ブラウザが描くポップアップ)が
// 既定の白になり、ダークモードでは文字と同じ色になって読めない(Phase 16 の修正)。
export const INPUT: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "2px 4px",
  font: "inherit",
  color: "var(--color)",
  background: "var(--background)",
  border: "1px solid var(--borderColor)",
  borderRadius: 4,
};
export const OPTION: CSSProperties = { background: "var(--background)", color: "var(--color)" };
export const MONO: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
  fontSize: 12,
};

// Phase-21-6:追記
// 05↔06 の紐づけのバッジ(06 の「呼ばれる手順」・05 の「詳細 L-02」。Phase 21)。押せるときは button に
// 付け、cursor を足す。
export const BADGE: CSSProperties = {
  display: "inline-block",
  padding: "0 6px",
  marginRight: 4,
  border: "1px solid var(--blue8)",
  borderRadius: 10,
  color: "var(--blue11)",
  background: "var(--blue2)",
  fontSize: 12,
  fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
};

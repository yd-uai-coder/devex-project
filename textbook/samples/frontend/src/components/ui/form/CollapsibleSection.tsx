// 作成：Phase-3-4
import type { ReactNode } from "react";

// ネイティブ<details><summary>で折りたたみセクションを実装する。開閉状態をJSで
// 管理する必要がなく、キーボード操作・スクリーンリーダー対応をブラウザに任せられる
// (docs/external_design.md 2.3節SCR-004: 環境設定はネイティブ<details>/<summary>を推奨)。
export function CollapsibleSection({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>{summary}</summary>
      <div style={{ marginTop: 12 }}>{children}</div>
    </details>
  );
}

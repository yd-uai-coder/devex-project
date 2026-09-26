// 作成：Phase-3-6
"use client";

import { useState } from "react";
import { LayoutTabs } from "@/components/ui/layout-blocks/LayoutTabs";
import { DocumentMarkdownView } from "@/features/documents/components/DocumentMarkdownView";
import type { DocType, GeneratedDocumentRead } from "@/features/documents/api/documentsApi";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  requirements: "要件定義",
  external_design: "外部設計",
  internal_design: "内部設計",
  implementation_plan: "実装計画",
};

const DOC_TYPE_ORDER: DocType[] = [
  "requirements",
  "external_design",
  "internal_design",
  "implementation_plan",
];

type DocumentTabsProps = {
  projectId: string;
  documents: GeneratedDocumentRead[];
};

export function DocumentTabs({ projectId, documents }: DocumentTabsProps) {
  const byType = new Map(documents.map((doc) => [doc.doc_type, doc]));
  const available = DOC_TYPE_ORDER.filter((type) => byType.has(type));
  const labels = available.map((type) => DOC_TYPE_LABELS[type]);
  const [activeLabel, setActiveLabel] = useState<string | undefined>(labels[0]);

  if (available.length === 0) return null;

  // LayoutTabs.contentはprops無しの関数コンポーネント配列を要求するため、
  // 対象ドキュメントをクロージャで束縛したコンポーネントを都度生成する。
  const content = available.map((type) => {
    const doc = byType.get(type) as GeneratedDocumentRead;
    return function DocumentTabContent() {
      return <DocumentMarkdownView projectId={projectId} document={doc} />;
    };
  });

  return (
    <LayoutTabs
      tabLabel={labels}
      content={content}
      value={activeLabel ?? labels[0]}
      onValueChange={setActiveLabel}
    />
  );
}

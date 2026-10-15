// 作成：Phase-3-6｜更新：Phase-53-4,56-2,57-2,57(完了後の調整)
"use client";

// Phase-57-2:追記 ── react.ComponentType
// Phase-57(完了後の調整):追記 ── @/features/documents/testSpecOps.TEST_SPEC_TITLE
import { useState, type ComponentType } from "react";
import { LayoutTabs } from "@/components/ui/layout-blocks/LayoutTabs";
import { DocumentMarkdownView } from "@/features/documents/components/DocumentMarkdownView";
import type { DocType, GeneratedDocumentRead } from "@/features/documents/api/documentsApi";
import { TEST_SPEC_TITLE } from "@/features/documents/testSpecOps";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  requirements: "要件定義",
  external_design: "外部設計",
  internal_design: "内部設計",
  implementation_plan: "実装計画",
  // Phase-56-2:追記
  // Phase-57(完了後の調整)：更新
  // test_spec: "テスト仕様",
  // ↓↓
  test_spec: TEST_SPEC_TITLE,
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
  // Phase-53-4:追記
  // 選んでいる文書を親が持つとき(レビューの指摘から文書のタブへ移るため)。無ければタブが自分で持つ
  activeType?: DocType | null;
  onActiveTypeChange?: (type: DocType) => void;
  // Phase-57-2:追記
  // テスト仕様書のタブの中身(簡易モードだけ。文書の一覧に無いので、親が別に取って渡す)。
  // 渡したときだけ、4文書の後ろに「テスト仕様書(結合・総合)」のタブを足す
  testSpecTab?: ComponentType;
};

// Phase-53-4：更新
// export function DocumentTabs({ projectId, documents }: DocumentTabsProps) {
// ↓↓
// Phase-57-2：更新
// export function DocumentTabs({ projectId, documents, activeType, onActiveTypeChange }: DocumentTabsProps) {
// ↓↓
export function DocumentTabs({
  projectId,
  documents,
  activeType,
  onActiveTypeChange,
  testSpecTab,
}: DocumentTabsProps) {
  const byType = new Map(documents.map((doc) => [doc.doc_type, doc]));
  // Phase-57-2：更新
  // const available = DOC_TYPE_ORDER.filter((type) => byType.has(type));
  // ↓↓
  const documentTypes = DOC_TYPE_ORDER.filter((type) => byType.has(type));
  const available: DocType[] =
    testSpecTab && documentTypes.length > 0 ? [...documentTypes, "test_spec"] : documentTypes;
  const labels = available.map((type) => DOC_TYPE_LABELS[type]);
  // Phase-53-4：更新
  // const [activeLabel, setActiveLabel] = useState<string | undefined>(labels[0]);
  // ↓↓
  const [ownLabel, setOwnLabel] = useState<string | undefined>(labels[0]);
  const controlled = onActiveTypeChange !== undefined;
  // Phase-57-2：更新
  // const activeLabel = controlled ? (activeType && byType.has(activeType) ? DOC_TYPE_LABELS[activeType] : labels[0]) : ownLabel;
  // ↓↓
  const activeLabel = controlled
    ? activeType && available.includes(activeType)
      ? DOC_TYPE_LABELS[activeType]
      : labels[0]
    : ownLabel;
  const setActiveLabel = (label: string) => {
    if (!controlled) return setOwnLabel(label);
    const type = available.find((t) => DOC_TYPE_LABELS[t] === label);
    if (type) onActiveTypeChange(type);
  };

  if (available.length === 0) return null;

  // LayoutTabs.contentはprops無しの関数コンポーネント配列を要求するため、
  // 対象ドキュメントをクロージャで束縛したコンポーネントを都度生成する。
  const content = available.map((type) => {
    // Phase-57-2:追記
    if (type === "test_spec" && testSpecTab) return testSpecTab;
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

// 作成：Phase-3-6｜更新：Phase-6-2,12-5,13-6,24(完了後の調整)
// Phase-6-2:追記 ── @/features/documents/components/VersionHistoryPanel
// Phase-12-5:追記 ── @/lib/api/download.saveFile
// Phase-13-6:追記 ── @/features/documents/anchors.splitByAnchors,
//   @/features/documents/components(DiagramEmbed, DiagramSyncBar),
//   @/features/documents/documents-store.useDocumentsStore,
//   @/features/documents/hooks/useDiagramEmbeds, @/features/uml/api/types.UmlEmbedRead
"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, H1, H2, H3, H4, Paragraph, Text, XStack, YStack } from "tamagui";
import { downloadDocument } from "@/features/documents/api/documentsApi";
import { saveFile } from "@/lib/api/download";
import type { GeneratedDocumentRead } from "@/features/documents/api/documentsApi";
import { VersionHistoryPanel } from "@/features/documents/components/VersionHistoryPanel";
// Phase-24：削除
// import { splitByAnchors } from "@/features/documents/anchors";
// import { DiagramEmbed } from "@/features/documents/components/DiagramEmbed";
// import { DiagramSyncBar } from "@/features/documents/components/DiagramSyncBar";
// import { useDocumentsStore } from "@/features/documents/documents-store";
// import { useDiagramEmbeds } from "@/features/documents/hooks/useDiagramEmbeds";
// import type { UmlEmbedRead } from "@/features/uml/api/types";
import type { Components } from "react-markdown";

type DocumentMarkdownViewProps = {
  projectId: string;
  // 引数名をdocumentにするとグローバルのwindow.documentを覆い隠すため、
  // ダウンロード処理内ではwindow.documentと明示して区別する。
  document: GeneratedDocumentRead;
};

// 見出し・段落・リスト・テーブルへの明示的なスタイル指定。react-markdownはデフォルトでは
// componentsを指定しないとブラウザのUAスタイルのみに依存し、見出し同士の余白が不足して
// 詰まって見える。TamaguiのYStack/Textはネイティブのul/ol/li/table/th/td相当のtag上書きに
// 対応していないため、リスト・テーブルは素のHTML要素+インラインstyleで組む(既存の`filter`
// prop対応と同じ「Tamagui未対応箇所は素のstyle propで補う」パターン、`var(--borderColor)`で
// テーマ追従)。
const markdownComponents: Components = {
  h1: ({ children }) => (
    <H1 marginTop="$2" marginBottom="$4">
      {children}
    </H1>
  ),
  h2: ({ children }) => (
    <H2 marginTop="$5" marginBottom="$3">
      {children}
    </H2>
  ),
  h3: ({ children }) => (
    <H3 marginTop="$4" marginBottom="$2">
      {children}
    </H3>
  ),
  h4: ({ children }) => (
    <H4 marginTop="$3" marginBottom="$2">
      {children}
    </H4>
  ),
  p: ({ children }) => <Paragraph marginBottom="$3">{children}</Paragraph>,
  ul: ({ children }) => <ul style={{ marginBottom: "1em", paddingLeft: "1.5em" }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ marginBottom: "1em", paddingLeft: "1.5em" }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: "4px" }}>{children}</li>,
  table: ({ children }) => (
    <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: "1em" }}>{children}</table>
  ),
  th: ({ children }) => (
    <th style={{ border: "1px solid var(--borderColor)", padding: "6px 10px", textAlign: "left" }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ border: "1px solid var(--borderColor)", padding: "6px 10px" }}>{children}</td>
  ),
};

// Phase-13-6:追記
// Phase-24：削除
// // 内部設計書の本文を、UML 図のアンカーを境に分けて描く(アンカーの位置に図を差し込む。M9a・D8)。
// function renderWithDiagrams(content: string, embeds: UmlEmbedRead[], loaded: boolean) {
//   const byId = new Map(embeds.map((embed) => [embed.diagram_id, embed]));
//   return splitByAnchors(content).map((segment, index) =>
//     segment.kind === "markdown" ? (
//       <ReactMarkdown key={index} remarkPlugins={[remarkGfm]} components={markdownComponents}>
//         {segment.text}
//       </ReactMarkdown>
//     ) : (
//       <DiagramEmbed key={index} embed={byId.get(segment.diagramId)} loaded={loaded}>
//         <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
//           {segment.body}
//         </ReactMarkdown>
//       </DiagramEmbed>
//     ),
//   );
// }
//
// ── ここから Phase-3-6 の作成分 ──
export function DocumentMarkdownView({ projectId, document }: DocumentMarkdownViewProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Phase-13-6:追記
  // Phase-24：削除
  // // 図を差し込むのは内部設計書だけ(図と文書の対応は docs/internal_design.md 3.3節、D5)
  // const isInternalDesign = document.doc_type === "internal_design";
  // const { embeds, loaded, error: embedsError, reload } = useDiagramEmbeds(
  //   projectId,
  //   isInternalDesign,
  // );
  // const fetchDocuments = useDocumentsStore((s) => s.fetchDocuments);
  //
  // // 再反映・zip の後: 文書の本文(アンカーの範囲)と図の状態(exported)が変わるので両方を取り直す
  // async function handleDiagramsChanged() {
  //   await fetchDocuments(projectId, { force: true });
  //   await reload();
  // }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(document.content);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("error");
    }
  }

  async function handleDownload() {
    setDownloadError(null);
    try {
      const { filename, content } = await downloadDocument(projectId, document.id);
      // Phase-12-5：更新(UML 図の出力と共有するため @/lib/api/download.ts の saveFile へ移した)
      // const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
      // const url = URL.createObjectURL(blob);
      // const link = window.document.createElement("a");
      // link.href = url;
      // link.download = filename;
      // window.document.body.appendChild(link);
      // link.click();
      // window.document.body.removeChild(link);
      // URL.revokeObjectURL(url);
      // ↓↓
      saveFile(filename, content, "text/markdown;charset=utf-8");
    } catch {
      setDownloadError("ダウンロードに失敗しました");
    }
  }

  return (
    <YStack gap="$3">
      <XStack gap="$2">
        <Button size="$3" onPress={handleCopy}>
          {copyStatus === "copied" ? "コピーしました" : "クリップボードにコピー"}
        </Button>
        <Button size="$3" onPress={handleDownload}>
          ダウンロード(.md)
        </Button>
      </XStack>
      {copyStatus === "error" ? (
        <Text role="alert" color="$color9">
          コピーに失敗しました
        </Text>
      ) : null}
      {downloadError ? (
        <Text role="alert" color="$color9">
          {downloadError}
        </Text>
      ) : null}
      <VersionHistoryPanel projectId={projectId} docType={document.doc_type} />
      {/* Phase-13-6:追記 */}
      {/* Phase-24：削除
      {isInternalDesign ? (
        <DiagramSyncBar projectId={projectId} embeds={embeds} onChanged={handleDiagramsChanged} />
      ) : null}
      {embedsError ? (
        <Text role="alert" color="$color9">
          {`設計図を取得できませんでした: ${embedsError}`}
        </Text>
      ) : null} */}
      {/* Phase-13-6：更新(内部設計書はアンカーで分けて図を差し込む) */}
      {/* <YStack borderWidth={1} borderColor="$borderColor" borderRadius="$4" padding="$4">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {document.content}
        </ReactMarkdown>
      </YStack> */}
      {/* ↓↓ */}
      <YStack borderWidth={1} borderColor="$borderColor" borderRadius="$4" padding="$4">
        {/* Phase-24：更新
        {isInternalDesign ? (
          renderWithDiagrams(document.content, embeds, loaded)
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {document.content}
          </ReactMarkdown>
        )}
        ↓↓ */}
        {/* 生の HTML は描かない(skipHtml)。以前に簡易モードの設計図を反映した内部設計書には、
            図のアンカー(HTML コメント)が残っており、そのままだと文字として出てしまうため */}
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents} skipHtml>
          {document.content}
        </ReactMarkdown>
      </YStack>
    </YStack>
  );
}

// 作成：Phase-3-6
"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, H1, H2, H3, H4, Paragraph, Text, XStack, YStack } from "tamagui";
import { downloadDocument } from "@/features/documents/api/documentsApi";
import type { GeneratedDocumentRead } from "@/features/documents/api/documentsApi";
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

export function DocumentMarkdownView({ projectId, document }: DocumentMarkdownViewProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [downloadError, setDownloadError] = useState<string | null>(null);

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
      const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = filename;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
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
      <YStack borderWidth={1} borderColor="$borderColor" borderRadius="$4" padding="$4">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {document.content}
        </ReactMarkdown>
      </YStack>
    </YStack>
  );
}

"use client";
// 作成：Phase-88-3

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { H1, H2, H3, H4, Paragraph, YStack } from "tamagui";
import type { Components } from "react-markdown";

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

// md の本文を枠の中に描く(生成した文書・合意済みの版の写し・変更の説明書のプレビューで共通)。
export function MarkdownBody({ content, label }: { content: string; label?: string }) {
  return (
    <YStack
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$4"
      padding="$4"
      role={label ? "region" : undefined}
      aria-label={label}
    >
      {/* 生の HTML は描かない(skipHtml)。以前に簡易モードの設計図を反映した内部設計書には、
          図のアンカー(HTML コメント)が残っており、そのままだと文字として出てしまうため */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents} skipHtml>
        {content}
      </ReactMarkdown>
    </YStack>
  );
}

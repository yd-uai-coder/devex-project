// 作成：Phase-13-6
// 写経レベル: コア ── 図と文書の食い違い(doc_state・source_outdated)を、利用者が次に何をすれば
//   よいかの言葉に置き換える箇所。SVG は img の data URI でしか表示しない。
"use client";

import type { ReactNode } from "react";
import { Text, YStack } from "tamagui";
import { svgDataUri } from "@/features/documents/anchors";
import type { UmlEmbedRead } from "@/features/uml/api/types";

type DiagramEmbedProps = {
  // アンカーの図に対応する埋め込み(見つからなければ undefined)
  embed: UmlEmbedRead | undefined;
  // 埋め込みの1回目の取得が終わったか(終わる前は「見つからない」と出さない)
  loaded: boolean;
  // アンカーの範囲の本文(要素表)を描いたもの
  children: ReactNode;
};

const APPROVED = new Set(["approved", "exported"]);

// 図と文書の食い違いを、利用者が次にすることの言葉にする。
export function embedNotices(embed: UmlEmbedRead | undefined, loaded: boolean): string[] {
  if (!embed) {
    return loaded ? ["この範囲の設計図が見つかりません(削除された可能性があります)。"] : [];
  }
  const notices: string[] = [];
  if (embed.doc_state === "outdated") {
    notices.push(
      APPROVED.has(embed.status)
        ? "設計図は、この要素表を反映した後に更新されています。「図を再反映」で最新にしてください。"
        : "設計図はレビュー中です。この要素表は前回承認した内容です(再承認すると反映されます)。",
    );
  }
  if (embed.source_outdated) {
    notices.push(
      "この設計図は内部設計書の古い版から生成されています。設計図を再生成して確認してください。",
    );
  }
  return notices;
}

export function DiagramEmbed({ embed, loaded, children }: DiagramEmbedProps) {
  const notices = embedNotices(embed, loaded);
  return (
    <YStack
      gap="$2"
      marginBottom="$3"
      padding="$3"
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$4"
      data-testid="diagram-embed"
    >
      {embed?.svg ? (
        // img で読み込んだ SVG はスクリプトを実行しない(dangerouslySetInnerHTML は使わない)。
        // data URI は next/image の最適化の対象外なので、素の img を使う(/uml-demo と同じ)。
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={svgDataUri(embed.svg)}
          alt={embed.title}
          style={{ maxWidth: "100%", height: "auto", alignSelf: "flex-start" }}
        />
      ) : null}
      {notices.map((notice) => (
        <Text key={notice} role="status" color="$orange10" fontSize="$2">
          {notice}
        </Text>
      ))}
      {children}
    </YStack>
  );
}

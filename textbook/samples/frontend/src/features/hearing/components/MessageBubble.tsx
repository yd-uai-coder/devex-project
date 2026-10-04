// 作成：Phase-3-5｜更新：Phase-24(完了後の UI 調整)
// Phase-24:追記(完了後の UI 調整) ── react-markdown.Components
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { Text, XStack, YStack } from "tamagui";
import type { ChatHistoryEntry } from "@/features/hearing/api/hearingApi";

// AI/intakeメッセージはMarkdown(GFMテーブル等)を含みうるため
// react-markdown+remark-gfmでレンダリングする。react-markdownはrehype-rawを使わない限り
// 生HTMLをそのまま描画しないため、LLM生成テキストをそのまま渡してもXSSの経路にならない。
// remark-breaksはCommonMark標準の「単一改行は無視(段落内の空白扱い)」を上書きし、
// 単一の"\n"もハード改行として描画する(intake要約やAIの箇条書きが1行に潰れるのを防ぐ)。
// sender='others'(自己診断結果)・sender='attachment'はChatPanel側で表示自体を除外しており、
// このコンポーネントに渡ってこない(渡された場合もAI同様の描画にフォールバックする)。
// Phase-24:追記(完了後の UI 調整)
// globals.css の`* { padding: 0 }`がリストの左余白も消すため、マーカー(外側に描かれる)が
// 吹き出しの枠の外へはみ出る。文書の画面(DocumentMarkdownView)と同じく、リストに左余白を戻す。
const MARKDOWN_COMPONENTS: Components = {
  ul: ({ children }) => <ul style={{ paddingLeft: "1.5em" }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: "1.5em" }}>{children}</ol>,
};

export function MessageBubble({ message }: { message: ChatHistoryEntry }) {
  const isUser = message.sender === "user";

  return (
    <XStack justifyContent={isUser ? "flex-end" : "flex-start"}>
      <YStack
        maxWidth="80%"
        padding="$3"
        borderRadius="$4"
        backgroundColor={isUser ? "$color9" : "$background"}
        borderWidth={isUser ? 0 : 1}
        borderColor="$borderColor"
      >
        {isUser ? (
          <Text color="white">{message.message}</Text>
        ) : (
          // Phase-24：更新(完了後の UI 調整)
          // <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{message.message}</ReactMarkdown>
          // ↓↓
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MARKDOWN_COMPONENTS}>
            {message.message}
          </ReactMarkdown>
        )}
      </YStack>
    </XStack>
  );
}

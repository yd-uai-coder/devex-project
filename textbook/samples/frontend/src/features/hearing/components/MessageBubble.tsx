// 作成：Phase-3-5
import ReactMarkdown from "react-markdown";
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
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{message.message}</ReactMarkdown>
        )}
      </YStack>
    </XStack>
  );
}

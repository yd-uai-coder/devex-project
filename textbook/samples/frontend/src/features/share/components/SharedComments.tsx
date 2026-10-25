// 作成：Phase-108-2
"use client";

import { useState } from "react";
import { Button, H3, Paragraph, Text, YStack } from "tamagui";
import type { SharedChangeRequestRead, SharedCommentRead } from "@/features/share/api/types";
import { useShareStore } from "@/features/share/share-store";
import { formatDateTime, isWritable, nameProblem } from "@/features/share/shareOps";
import { COMMENT_BODY_MAX } from "@/features/change-requests/changeRequestOps";
import { INPUT } from "@/features/detailed-design/components/tableStyles";

// 共有リンクの画面の「コメント」。コメントごとに開発者の返信(書き手は「開発者」)をまとめて古い順に出し、
// 開いているリンクではコメントを書ける(返信は開発者だけ)。送れなかったときは書いた本文を残す
export function SharedComments({ shared }: { shared: SharedChangeRequestRead }) {
  const writable = isWritable(shared);
  return (
    <YStack gap="$3" aria-label="コメント">
      <H3 fontSize="$6">コメント</H3>
      {shared.comments.length === 0 ? <Text color="$color11">まだコメントはありません。</Text> : null}
      {shared.comments.map((comment, i) => (
        <YStack key={`${comment.created_at}-${i}`} gap="$2" aria-label={`${comment.author}のコメント`}>
          <CommentBody comment={comment} />
          {comment.replies.map((reply, j) => (
            <YStack key={`${reply.created_at}-${j}`} paddingLeft="$5">
              <CommentBody comment={reply} />
            </YStack>
          ))}
        </YStack>
      ))}
      {writable ? <CommentForm /> : null}
    </YStack>
  );
}

function CommentBody({ comment }: { comment: SharedCommentRead }) {
  return (
    <YStack
      gap="$1"
      borderLeftWidth={3}
      borderColor={comment.from_developer ? "$green8" : "$borderColor"}
      paddingLeft="$3"
    >
      <Text fontSize="$2" color="$color11">{`${comment.author} ・${formatDateTime(comment.created_at)}`}</Text>
      <Paragraph whiteSpace="pre-wrap">{comment.body}</Paragraph>
    </YStack>
  );
}

function CommentForm() {
  const name = useShareStore((s) => s.name);
  const commenting = useShareStore((s) => s.commenting);
  const commentError = useShareStore((s) => s.commentError);
  const comment = useShareStore((s) => s.comment);
  const [body, setBody] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const text = body.trim();

  const send = async () => {
    const nameIssue = nameProblem(name);
    if (nameIssue) return setProblem(nameIssue);
    setProblem(null);
    if (await comment(text)) setBody("");
  };

  return (
    <YStack gap="$2">
      <textarea
        style={{ ...INPUT, width: "100%" }}
        rows={3}
        maxLength={COMMENT_BODY_MAX}
        aria-label="コメントの本文"
        placeholder="分からない点・気になる点を書いてください"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <YStack alignItems="flex-start">
        <Button size="$3" disabled={!text || commenting} onPress={() => void send()}>
          {commenting ? "送信中..." : "コメントを送る"}
        </Button>
      </YStack>
      {problem || commentError ? (
        <Text role="alert" color="$red10">
          {problem ?? commentError}
        </Text>
      ) : null}
    </YStack>
  );
}

// 作成：Phase-107-5
"use client";

import { useEffect, useState } from "react";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import type { ChangeRequestCommentRead, ChangeRequestRead } from "@/features/change-requests/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import {
  COMMENT_BODY_MAX,
  commentAuthor,
  commentedOnOlderVersion,
} from "@/features/change-requests/changeRequestOps";
import { INPUT } from "@/features/detailed-design/components/tableStyles";

// 共有タブの「コメント」。クライアントが共有リンクから書いたコメントごとに、開発者の返信をまとめて古い順に出し、
// コメントに返信する(1段。返信への返信と、開発者からの新しいコメントは無い。docs/external_design.md 2.16節)。
// 今より前の版の説明書を見て書かれたコメントには、その旨を添える
export function CommentThread({ projectId, cr }: { projectId: string; cr: ChangeRequestRead }) {
  const comments = useChangeRequestsStore((s) => s.views.comments);
  const error = useChangeRequestsStore((s) => s.viewErrors.comments);
  const fingerprint = useChangeRequestsStore((s) => s.views.explanation?.fingerprint ?? null);
  const fetchView = useChangeRequestsStore((s) => s.fetchView);
  const replyError = useChangeRequestsStore((s) => s.replyError);

  useEffect(() => {
    if (comments === null) void fetchView(projectId, cr.number, "comments");
  }, [comments, projectId, cr.number, fetchView]);

  if (error) {
    return (
      <Text role="alert" color="$red10">
        {error}
      </Text>
    );
  }
  if (comments === null) return <Text color="$color11">読み込み中...</Text>;

  return (
    <YStack gap="$3" aria-label="コメント">
      {comments.length === 0 ? (
        <Text color="$color11">まだコメントはありません(クライアントが共有リンクから書きます)。</Text>
      ) : null}
      {comments.map((comment) => (
        <YStack key={comment.id} gap="$2" aria-label={`${comment.author_name}のコメント`}>
          <CommentBody comment={comment} older={commentedOnOlderVersion(comment, fingerprint)} />
          {comment.replies.map((reply) => (
            <YStack key={reply.id} paddingLeft="$5">
              <CommentBody comment={reply} older={false} />
            </YStack>
          ))}
          {comment.can_reply ? <ReplyForm projectId={projectId} cr={cr} comment={comment} /> : null}
        </YStack>
      ))}
      {replyError ? (
        <Text role="alert" color="$red10">
          {replyError}
        </Text>
      ) : null}
    </YStack>
  );
}

function CommentBody({ comment, older }: { comment: ChangeRequestCommentRead; older: boolean }) {
  return (
    <YStack
      gap="$1"
      borderLeftWidth={3}
      borderColor={comment.from_developer ? "$green8" : "$borderColor"}
      paddingLeft="$3"
    >
      <Text fontSize="$2" color="$color11">
        {`${commentAuthor(comment)} ・${new Date(comment.created_at).toLocaleString("ja-JP")}${older ? " ・前の版の説明書を見て書かれました" : ""}`}
      </Text>
      <Paragraph whiteSpace="pre-wrap">{comment.body}</Paragraph>
    </YStack>
  );
}

function ReplyForm({
  projectId,
  cr,
  comment,
}: {
  projectId: string;
  cr: ChangeRequestRead;
  comment: ChangeRequestCommentRead;
}) {
  const replying = useChangeRequestsStore((s) => s.replying);
  const reply = useChangeRequestsStore((s) => s.reply);
  const [body, setBody] = useState("");
  const text = body.trim();

  return (
    <XStack gap="$2" alignItems="flex-end" paddingLeft="$5">
      <textarea
        style={{ ...INPUT, flex: 1 }}
        rows={2}
        maxLength={COMMENT_BODY_MAX}
        aria-label={`${comment.author_name}のコメントへの返信`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button
        size="$2"
        disabled={!text || replying !== null}
        onPress={async () => {
          if (await reply(projectId, cr.number, comment.id, text)) setBody("");
        }}
      >
        {replying === comment.id ? "送信中..." : "返信する"}
      </Button>
    </XStack>
  );
}

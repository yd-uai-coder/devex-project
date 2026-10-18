// 作成：Phase-78-1
"use client";

import Link from "next/link";
import { H2, Text, YStack } from "tamagui";

// プロジェクトの画面(チャット・文書・詳細設計)で、最初の読み込みが404だったときに本体の代わりに出す。
// 削除の後にブックマークや履歴から開くと当たるので、API の文(英語・ID 入り)でなく、理由と戻り先を出す。
export function ProjectNotFoundNotice() {
  return (
    <YStack paddingVertical="$4" gap="$3">
      <H2>このプロジェクトは見つかりません</H2>
      <Text color="$color11">削除された可能性があります。</Text>
      <Link href="/dashboard">
        <Text color="$blue10">ダッシュボードへ戻る →</Text>
      </Link>
    </YStack>
  );
}

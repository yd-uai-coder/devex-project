"use client";
// 作成：Phase-88(完了後の調整)

import Link from "next/link";
import { H2, Text, YStack } from "tamagui";

// 簡易ドキュメントモードのプロジェクトで、変更要求・合意済みの版の画面を開いたときに本体の代わりに出す
// (API が 409 DESIGN_STAGES_NOT_AVAILABLE で断る。メニューからは移れないが、URL を直接開くと当たる)。
export function DetailedModeOnlyNotice({ projectId, title }: { projectId: string; title: string }) {
  return (
    <YStack paddingVertical="$4" gap="$3">
      <H2>{title}</H2>
      <Text color="$color11">
        変更要求と合意済みの版は、詳細設計モードのプロジェクトだけで使えます。このプロジェクトは簡易ドキュメントモードです。
      </Text>
      <Link href={`/projects/${projectId}/documents`}>
        <Text color="$blue10">ドキュメントへ戻る →</Text>
      </Link>
    </YStack>
  );
}

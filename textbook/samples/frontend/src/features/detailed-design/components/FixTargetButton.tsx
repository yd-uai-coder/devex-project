// 作成：Phase-31-5
"use client";

import Link from "next/link";
import { Button, Text } from "tamagui";
import { DESIGN_DOCUMENT_LABELS } from "@/features/detailed-design/labels";
import type { FixTarget } from "@/features/detailed-design/procedureDocOps";

// 未定義・要決定の「直す」操作。段階なら「段階Nで直す」でその段階へ移り、文書(簡易モード)なら文書の
// 画面(SCR-005)へのリンクにする(簡易モードの文書は画面で編集できないので、再生成して直す)。
// 直す先が無ければ何も出さない。
export function FixTargetButton({
  projectId,
  target,
  onStage,
}: {
  projectId: string;
  target: FixTarget;
  onStage: (stage: number) => void;
}) {
  if (target === null) return null;
  if (target.kind === "document") {
    return (
      <Link href={`/projects/${projectId}/documents`}>
        <Text color="$blue10" fontSize="$2">
          {`${DESIGN_DOCUMENT_LABELS[target.document]}を直す(再生成)`}
        </Text>
      </Link>
    );
  }
  return (
    <Button size="$2" onPress={() => onStage(target.stage)}>
      {`段階${target.stage}で直す`}
    </Button>
  );
}

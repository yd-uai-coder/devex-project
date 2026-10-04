// 作成：Phase-21-7(画面確認後の修正)
// 写経レベル: 定型 ── 保存ボタンと未保存の案内。各パネルの上下に同じものを置く。
"use client";

import type { ReactNode } from "react";
import { Text, XStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";

// 段階の作業領域の保存の操作(保存ボタンと「保存していない編集があります。」)。各段階のパネルは、
// 作業領域の先頭(状態表示の直下)と最下部の2か所に同じものを置く(Phase 21 の画面確認後)。チェックや
// 選択を変えた直後に、スクロールせずに保存して生成へ進めるようにするため。leading・trailing には、
// 保存の前後に並べる段階ごとのボタン(段階1の「処理を追加」、段階6の「段階6を飛ばす」)を渡す。
export function StageSaveBar({
  label = "保存する",
  dirty,
  saving,
  disabled,
  onSave,
  leading,
  trailing,
}: {
  label?: string;
  dirty: boolean;
  saving: boolean;
  disabled: boolean; // 段階が閉じている・生成中など、保存できない理由があるとき
  onSave: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <XStack gap="$3" alignItems="center" flexWrap="wrap">
      {leading}
      <StyledButton disabled={!dirty || saving || disabled} onPress={onSave}>
        {saving ? "保存しています..." : label}
      </StyledButton>
      {trailing}
      {dirty ? (
        <Text color="$color11" fontSize="$2">
          保存していない編集があります。
        </Text>
      ) : null}
    </XStack>
  );
}

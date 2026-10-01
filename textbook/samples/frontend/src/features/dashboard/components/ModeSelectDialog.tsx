// 作成：Phase-15-7
// 写経レベル: コア ── 作成後に変えられないモードを、何が生成されるかの違いとともに選ばせる。
"use client";

import { useRouter } from "next/navigation";
import { Dialog, Paragraph, Text, XStack, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import type { ProjectMode } from "@/features/dashboard/api/projects";

// docs/external_design.md 2.7節「2つのモード」。選んだモードは作成後に変えられないため、
// 何が生成されるかの違いをここで言葉にしておく。
export const MODE_OPTIONS: { mode: ProjectMode; title: string; description: string }[] = [
  {
    mode: "simple",
    title: "簡易ドキュメントモード",
    description: "ヒアリングの後に、要件定義・外部設計・内部設計・実装計画の4文書をまとめて生成します。",
  },
  {
    mode: "detailed",
    title: "詳細設計モード",
    description:
      "ヒアリングの後に要件定義・外部設計を生成し、続けて機能一覧から処理の手順までを段階ごとに確認・承認しながら詳細設計書を組み立てます。",
  },
];

// SCR-002 の「新規プロジェクトを作成」で開くモード選択ダイアログ。選んだモードを
// クエリ(?mode=)で作成画面(/projects/new)へ渡す。
export function ModeSelectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  return (
    <Dialog modal open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          transition="quick"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Dialog.Content
          key="content"
          bordered
          elevate
          gap="$4"
          padding="$5"
          maxWidth={520}
          transition="quick"
          enterStyle={{ opacity: 0, scale: 0.95, y: 10 }}
          exitStyle={{ opacity: 0, scale: 0.95, y: 10 }}
        >
          <Dialog.Title>モードを選んでください</Dialog.Title>
          <Dialog.Description>モードはプロジェクトの作成後に変更できません。</Dialog.Description>
          <YStack gap="$3">
            {MODE_OPTIONS.map((option) => (
              <YStack
                key={option.mode}
                gap="$2"
                padding="$3"
                borderWidth={1}
                borderColor="$borderColor"
                borderRadius="$4"
              >
                <Text fontWeight="600">{option.title}</Text>
                <Paragraph size="$2" color="$color11">
                  {option.description}
                </Paragraph>
                <XStack justifyContent="flex-end">
                  <StyledButton
                    size="$3"
                    aria-label={`${option.title}で作成する`}
                    onPress={() => {
                      onClose();
                      router.push(`/projects/new?mode=${option.mode}`);
                    }}
                  >
                    このモードで作成する
                  </StyledButton>
                </XStack>
              </YStack>
            ))}
          </YStack>
          <XStack justifyContent="flex-end">
            <Dialog.Close asChild>
              <StyledButton theme="gray" size="$3">
                キャンセル
              </StyledButton>
            </Dialog.Close>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

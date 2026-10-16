// 作成：Phase-64-3
"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { AlertDialog, Button, Text, XStack } from "tamagui";
import { useToastController } from "@tamagui/toast";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import { deleteProject } from "@/features/dashboard/api/projects";
import { useDashboardStore } from "@/features/dashboard/dashboard-store";
import { ApiError } from "@/lib/api/client";

// プロジェクトの削除ボタン。どの画面から削除しても、アラートダイアログで確かめてから API を呼ぶ
// (確認を通らない削除の経路を作らないため、確認・API・完了の知らせをこの部品にまとめる)。
// variant: icon はゴミ箱のアイコンだけ(ダッシュボードのカード)、text は「削除」の文字(画面の操作の並び)。
// 削除できたら一覧から外し、トーストで知らせて onDeleted を呼ぶ(画面からはダッシュボードへ戻る)。
// すでに消えていた(404)ときも、削除できたときと同じに扱う。それ以外の失敗はダイアログの中に出す。
// title(プロジェクトの名前)を読み込んでいない画面では省き、文言は「このプロジェクト」にする。
export function DeleteProjectButton({
  projectId,
  title,
  variant = "text",
  onDeleted,
}: {
  projectId: string;
  title?: string | null;
  variant?: "icon" | "text";
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const removeProject = useDashboardStore((s) => s.removeProject);
  const toast = useToastController();
  const name = title ? `「${title}」` : "このプロジェクト";

  const close = () => {
    if (deleting) return;
    setOpen(false);
    setError(null);
  };

  const confirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteProject(projectId);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        setError(err instanceof Error ? err.message : "プロジェクトの削除に失敗しました");
        setDeleting(false);
        return;
      }
    }
    removeProject(projectId);
    setDeleting(false);
    setOpen(false);
    toast.show(`${name}を削除しました`);
    onDeleted?.();
  };

  return (
    <>
      {variant === "icon" ? (
        <Button
          circular
          chromeless
          size="$3"
          aria-label={`${name}を削除`}
          icon={<Trash2 size={18} />}
          onPress={() => setOpen(true)}
        />
      ) : (
        <Button size="$3" theme="red" onPress={() => setOpen(true)}>
          削除
        </Button>
      )}
      <AlertDialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay
            key="overlay"
            transition="quick"
            opacity={0.5}
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <AlertDialog.Content
            key="content"
            bordered
            elevate
            gap="$4"
            padding="$5"
            maxWidth={440}
            transition="quick"
            enterStyle={{ opacity: 0, scale: 0.95, y: 10 }}
            exitStyle={{ opacity: 0, scale: 0.95, y: 10 }}
          >
            <AlertDialog.Title size="$6">プロジェクトを削除しますか</AlertDialog.Title>
            <AlertDialog.Description>
              {`${name}と、そのチャット・文書・詳細設計・レビューをすべて削除します。元に戻せません。生成中の処理は止まり、結果は保存されません。`}
            </AlertDialog.Description>
            {error ? (
              <Text role="alert" color="$red10">
                {error}
              </Text>
            ) : null}
            <XStack gap="$3" justifyContent="flex-end">
              <StyledButton theme="gray" aria-label="キャンセル" disabled={deleting} onPress={close}>
                キャンセル
              </StyledButton>
              <StyledButton
                theme="red"
                aria-label="削除する"
                disabled={deleting}
                onPress={() => void confirm()}
              >
                {deleting ? "削除中..." : "削除する"}
              </StyledButton>
            </XStack>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog>
    </>
  );
}

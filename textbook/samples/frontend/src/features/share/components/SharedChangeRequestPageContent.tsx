// 作成：Phase-108-1｜更新：Phase-108-2,108-3
"use client";

// Phase-108-2:追記 ── @/features/share/components/ClientNameField.ClientNameField, @/features/share/components/SharedComments.SharedComments, @/features/share/shareOps.isWritable
// Phase-108-3:追記 ── @/features/share/components/SharedDecisionForm.SharedDecisionForm
import { useEffect } from "react";
import { Button, H2, Text, XStack, YStack } from "tamagui";
import { useShareStore } from "@/features/share/share-store";
import { SharedStateNotice } from "@/features/share/components/SharedStateNotice";
import { SectionChanges } from "@/features/share/components/SectionChanges";
import { ClientNameField } from "@/features/share/components/ClientNameField";
import { SharedComments } from "@/features/share/components/SharedComments";
import { SharedDecisionForm } from "@/features/share/components/SharedDecisionForm";
import { isWritable } from "@/features/share/shareOps";
import { MarkdownBody } from "@/features/documents/components/MarkdownBody";

// 共有リンクの画面(SCR-012。ログインの要らないクライアント向けのページ)。1列で上から、状態 → 前回から
// Phase-108-2：更新
// // 変わった点 → 説明書 の順に出す(読んでから判断する順)。直している・閉じた CR は説明書を出さない
// // (API も返さない)。リンクが無い・期限切れ・取り消しは、その旨だけを出す
// ↓↓
// Phase-108-3：更新
// // 変わった点 → 説明書 → お名前 → コメント の順に出す(読んでから判断する順)。直している・閉じた CR は
// ↓↓
// 変わった点 → 説明書 → お名前 → ご判断 → コメント の順に出す(読んでから判断する順)。直している・閉じた CR は
// 説明書とコメント欄を出さない(API も返さない)。リンクが無い・期限切れ・取り消しは、その旨だけを出す。
// Phase-108-3：更新
// // 開いた後に説明書が新しくなった(書き込みが409で返った)ら、読み直しを促す(書いた本文は消さない)
// ↓↓
// 開いた後に説明書が新しくなった(書き込みが409で返った)ら、読み直しを促す(書いた本文は消さない)。
// 判断を押したときにリンクが開いていなかったら、読み直した今の状態の上に断られた旨を出す
export function SharedChangeRequestPageContent({ token }: { token: string }) {
  const shared = useShareStore((s) => (s.token === token ? s.shared : null));
  const status = useShareStore((s) => s.status);
  const error = useShareStore((s) => s.error);
  const unavailable = useShareStore((s) => s.unavailable);
  // Phase-108-2:追記
  const explanationChanged = useShareStore((s) => s.explanationChanged);
  // Phase-108-3:追記
  const decisionError = useShareStore((s) => s.decisionError);
  const load = useShareStore((s) => s.load);
  // Phase-108-2:追記
  const restoreName = useShareStore((s) => s.restoreName);

  useEffect(() => {
    void load(token);
  }, [token, load]);

  // Phase-108-2:追記
  useEffect(() => {
    restoreName();
  }, [restoreName]);

  if (unavailable) {
    return (
      <YStack paddingVertical="$4" gap="$3" maxWidth={880} width="100%" alignSelf="center">
        <H2>変更のご相談</H2>
        <Text role="alert">{error}</Text>
      </YStack>
    );
  }

  return (
    <YStack paddingVertical="$4" gap="$4" maxWidth={880} width="100%" alignSelf="center">
      {status === "loading" && shared === null ? <Text color="$color11">読み込み中...</Text> : null}
      {status === "error" ? (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      ) : null}
      {shared ? (
        <>
          <SharedStateNotice shared={shared} />
          <XStack>
            <Button size="$2" disabled={status === "loading"} onPress={() => void load(token)}>
              {status === "loading" ? "読み込み中..." : "読み直す"}
            </Button>
          </XStack>
          <SectionChanges changes={shared.changes} changedSince={shared.changed_since} />
          {shared.markdown !== null ? <MarkdownBody content={shared.markdown} label="変更の説明書" /> : null}
          {/* Phase-108-2:追記 */}
          {explanationChanged ? (
            <YStack
              gap="$2"
              borderWidth={1}
              borderColor="$orange8"
              backgroundColor="$orange2"
              borderRadius="$3"
              padding="$3"
              role="alert"
            >
              <Text>説明書が新しくなりました。読み直してから、もう一度送ってください(書いた内容は残ります)。</Text>
              <XStack>
                <Button size="$2" onPress={() => void load(token)}>
                  説明書を読み直す
                </Button>
              </XStack>
            </YStack>
          ) : null}
          {/* Phase-108-3：更新 */}
          {/* {isWritable(shared) ? <ClientNameField /> : null} */}
          {/* ↓↓ */}
          {isWritable(shared) ? (
            <>
              <ClientNameField />
              <SharedDecisionForm shared={shared} />
            </>
          ) : decisionError ? (
            // 判断が断られ、読み直したら書き込めなくなっていた(先に開発者が判断したなど)
            <Text role="alert" color="$red10">
              {decisionError}
            </Text>
          ) : null}
          {shared.markdown !== null ? <SharedComments shared={shared} /> : null}
        </>
      ) : null}
    </YStack>
  );
}

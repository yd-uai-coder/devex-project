// 作成：Phase-107-4｜更新：Phase-116-4
"use client";

// Phase-116-4:追記 ── @/features/baselines/components/BaselineFreshnessNotice.BaselineFreshnessNotice
import { useEffect, useState } from "react";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { BaselineFreshnessNotice } from "@/features/baselines/components/BaselineFreshnessNotice";
import type { ChangeRequestRead, ShareLinkRead } from "@/features/change-requests/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import {
  SHARE_DEFAULT_DAYS,
  SHARE_MAX_DAYS,
  SHARE_STATE_TONE,
  activeShareLink,
  canShare,
  shareDaysProblem,
  shareUrl,
} from "@/features/change-requests/changeRequestOps";
import { CELL, HEAD, INPUT, TABLE } from "@/features/detailed-design/components/tableStyles";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ja-JP") : "―");

// 共有タブの「共有リンク」。クライアントがログインせずに説明書・選択肢・規模を読み、コメント・合意 / 却下を
// するためのリンクを作る(作ると下書きは説明済みになり、前のリンクは使えなくなる)。URL は作った直後に
// 1度だけ見せる。リンクの一覧で状態・期限・最後に見られた日時を出し、期限を延ばす・取り消す
// (docs/external_design.md 2.16節「共有リンク」)
export function ShareLinkPanel({ projectId, cr }: { projectId: string; cr: ChangeRequestRead }) {
  const links = useChangeRequestsStore((s) => s.views.shareLinks);
  const linksError = useChangeRequestsStore((s) => s.viewErrors.shareLinks);
  const explanation = useChangeRequestsStore((s) => s.views.explanation);
  const fetchView = useChangeRequestsStore((s) => s.fetchView);
  const created = useChangeRequestsStore((s) => (s.createdLink?.number === cr.number ? s.createdLink.link : null));
  const shareActing = useChangeRequestsStore((s) => s.shareActing);
  const shareError = useChangeRequestsStore((s) => s.shareError);
  const createShare = useChangeRequestsStore((s) => s.createShare);
  const revokeShare = useChangeRequestsStore((s) => s.revokeShare);
  const extendShare = useChangeRequestsStore((s) => s.extendShare);
  const dismissCreatedLink = useChangeRequestsStore((s) => s.dismissCreatedLink);
  const [days, setDays] = useState(String(SHARE_DEFAULT_DAYS));
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState<ShareLinkRead | null>(null);
  const [extending, setExtending] = useState<ShareLinkRead | null>(null);
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);

  useEffect(() => {
    if (links === null) void fetchView(projectId, cr.number, "shareLinks");
  }, [links, projectId, cr.number, fetchView]);
  // 古い要約の知らせのために、説明書の要約の状態を読む
  useEffect(() => {
    if (explanation === null) void fetchView(projectId, cr.number, "explanation");
  }, [explanation, projectId, cr.number, fetchView]);

  const active = links ? activeShareLink(links) : null;
  const daysProblem = shareDaysProblem(days);
  const staleSummary = explanation?.summary?.needs_reconfirm ?? false;
  const url = created && typeof window !== "undefined" ? shareUrl(created.path, window.location.origin) : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  };

  return (
    <YStack gap="$3" aria-label="共有リンク">
      <Paragraph color="$color11" size="$2">
        クライアントは、このリンクからログインせずに説明書・選択肢・規模を読み、名前を書いてコメントと合意 / 却下ができます。
      </Paragraph>

      {created && url ? (
        <YStack gap="$2" padding="$3" backgroundColor="$green2" borderRadius="$3" aria-label="作ったリンク">
          <Text color="$green11">
            リンクを作りました。この URL は今だけ表示します(画面を移ると見られません)。コピーしてクライアントに送ってください。
          </Text>
          <Text fontFamily="$mono" fontSize="$2" style={{ overflowWrap: "anywhere" }}>
            {url}
          </Text>
          <XStack gap="$2" alignItems="center">
            <Button size="$2" onPress={() => void copy()}>
              URL をコピー
            </Button>
            {copied === "done" ? <Text color="$green10">コピーしました</Text> : null}
            {copied === "failed" ? <Text color="$red10">コピーできませんでした。URL を選んでコピーしてください</Text> : null}
            <Button
              size="$2"
              chromeless
              onPress={() => {
                setCopied(null);
                dismissCreatedLink();
              }}
            >
              閉じる
            </Button>
          </XStack>
          {/* Phase-116-4:追記 */}
          <BaselineFreshnessNotice
            projectId={projectId}
            freshness={created.baseline_freshness}
            lead="クライアントに見せる説明書の規模は、この版の設計から数えています。"
          />
          {created.summary_needs_reconfirm ? (
            <Text color="$orange10">確認済みの要約が古くなっています。説明書のタブで確かめ直すまで、要約はクライアントに見えません。</Text>
          ) : null}
        </YStack>
      ) : null}

      <XStack gap="$2" alignItems="flex-end" flexWrap="wrap">
        <label style={{ fontSize: 13 }}>
          {`期限(日。1〜${SHARE_MAX_DAYS}。作る・延ばすで使う)`}
          <input
            style={{ ...INPUT, width: 100 }}
            type="number"
            min={1}
            max={SHARE_MAX_DAYS}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
        {canShare(cr.status) ? (
          <Button
            size="$3"
            theme="green"
            disabled={shareActing !== null || daysProblem !== null}
            onPress={() => setConfirming(true)}
          >
            {shareActing === "create" ? "作成中..." : active ? "リンクを作り直す" : "共有リンクを作る"}
          </Button>
        ) : (
          <Text color="$color11">リンクを作れるのは、下書きと説明済みの CR だけです。</Text>
        )}
        {daysProblem ? <Text color="$red10">{daysProblem}</Text> : null}
      </XStack>

      {shareError ? (
        <Text role="alert" color="$red10">
          {shareError}
        </Text>
      ) : null}
      {linksError ? (
        <Text role="alert" color="$red10">
          {linksError}
        </Text>
      ) : null}
      {links === null && !linksError ? <Text color="$color11">読み込み中...</Text> : null}
      {links && links.length === 0 ? <Text color="$color11">まだリンクはありません。</Text> : null}
      {links && links.length > 0 ? (
        <table style={TABLE} aria-label="共有リンクの一覧">
          <thead>
            <tr>
              <th style={HEAD}>作った日時</th>
              <th style={HEAD}>状態</th>
              <th style={HEAD}>期限</th>
              <th style={HEAD}>最後に見られた</th>
              <th style={HEAD}>操作</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.id}>
                <td style={CELL}>{when(link.created_at)}</td>
                <td style={{ ...CELL, color: `var(--${SHARE_STATE_TONE[link.state]}10)` }}>{link.state_label}</td>
                <td style={CELL}>{when(link.expires_at)}</td>
                <td style={CELL}>{when(link.last_viewed_at)}</td>
                <td style={CELL}>
                  {link.revoked_at === null ? (
                    <XStack gap="$2" flexWrap="wrap">
                      <Button size="$2" disabled={shareActing !== null || daysProblem !== null} onPress={() => setExtending(link)}>
                        期限を延ばす
                      </Button>
                      <Button size="$2" theme="red" disabled={shareActing !== null} onPress={() => setRevoking(link)}>
                        取り消す
                      </Button>
                    </XStack>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <Paragraph color="$color11" size="$2">
        CR を直すと下書きに戻り、リンクは「直しています」になります(取り消しにはなりません)。もう一度説明済みにすると、
        同じリンクで前回から変わった点を出して再開します。
      </Paragraph>

      <ConfirmDialog
        open={confirming}
        title={active ? "共有リンクを作り直す" : "共有リンクを作る"}
        description={
          <>
            {`期限は今から${days}日後です。`}
            {cr.status === "draft" ? "作ると、CR は説明済みになります。" : ""}
            {active ? "今のリンクは使えなくなります(クライアントには新しい URL を送ってください)。" : ""}
            {staleSummary ? (
              <span style={{ display: "block", marginTop: 8, color: "var(--orange10)" }}>
                確認済みの要約が、その後の説明書の変化で古くなっています。確かめ直すまで、要約はクライアントに見えません
                (説明書のタブで確かめ直せます。このまま作ることもできます)。
              </span>
            ) : null}
          </>
        }
        confirmLabel="作る"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          setCopied(null);
          void createShare(projectId, cr.number, Number(days));
        }}
      />
      <ConfirmDialog
        open={revoking !== null}
        title="共有リンクを取り消す"
        description="取り消すと、クライアントはこのリンクを開けなくなります(元に戻せません)。"
        confirmLabel="取り消す"
        onCancel={() => setRevoking(null)}
        onConfirm={() => {
          const link = revoking;
          setRevoking(null);
          if (link) void revokeShare(projectId, cr.number, link.id);
        }}
      />
      <ConfirmDialog
        open={extending !== null}
        title="期限を延ばす"
        description={`期限を今から${days}日後に置き直します(期限の日数は上の欄で変えられます)。`}
        confirmLabel="延ばす"
        onCancel={() => setExtending(null)}
        onConfirm={() => {
          const link = extending;
          setExtending(null);
          if (link) void extendShare(projectId, cr.number, link.id, Number(days));
        }}
      />
    </YStack>
  );
}

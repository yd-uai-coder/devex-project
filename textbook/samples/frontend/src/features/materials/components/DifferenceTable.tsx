// 作成：Phase-116-3｜更新：Phase-116-4
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Text, XStack, YStack } from "tamagui";
import { changeRequestHref, changeRequestLabel } from "@/features/change-requests/changeRequestOps";
import { CELL, HEAD, LINK, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import type { DifferenceKind, MaterialDifferenceRead, MaterialDifferencesRead } from "@/features/materials/api/types";
import { useMaterialsStore } from "@/features/materials/materials-store";
import {
  DIFFERENCE_KIND_LABEL,
  choosesRequirements,
  elementLabel,
  groupDifferences,
  isDraftable,
  isExtractionOutdated,
  requirementIdsFor,
  withoutRequirement,
  type UncheckedRequirements,
} from "@/features/materials/materialOps";
import { DismissForm } from "@/features/materials/components/DismissForm";

// 種類の印の色(追加・変更・削除・確かめる点)
const KIND_COLOR: Record<DifferenceKind, string> = {
  add: "green",
  change: "orange",
  delete: "red",
  question: "purple",
};

function KindChip({ kind }: { kind: DifferenceKind }) {
  const color = KIND_COLOR[kind];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0 8px",
        borderRadius: 10,
        whiteSpace: "nowrap",
        fontSize: 12,
        color: `var(--${color}11)`,
        background: `var(--${color}3)`,
        border: `1px solid var(--${color}7)`,
      }}
    >
      {DIFFERENCE_KIND_LABEL[kind]}
    </span>
  );
}

const DIM = { ...CELL, color: "var(--color10)" } as const;

// 資料の違いの一覧(SCR-013。docs/external_design.md 2.17節「違いの一覧」「CR の下書き」)。状態で群に分け、
// 未確認を上に(群の中は取り出しの順)。未確認の追加・変更・削除を選んで1つの CR の下書きにする。画面・API・
// 外部連携の違いは、つながる要件を候補に出し、既定は全部を対象にする(外すと、その要件は対象にしない)。
// 作ったら CR の詳細へ移る。確かめる点は CR にせず、理由をつけて閉じる。取り出した後に束を作り直していたら
// 作れない(取り出し直す)
export function DifferenceTable({
  projectId,
  materialId,
  view,
}: {
  projectId: string;
  materialId: string;
  view: MaterialDifferencesRead;
}) {
  const router = useRouter();
  const acting = useMaterialsStore((s) => s.acting);
  const extracting = useMaterialsStore((s) => s.extracting);
  const dismiss = useMaterialsStore((s) => s.dismiss);
  const restore = useMaterialsStore((s) => s.restore);
  const createChangeRequest = useMaterialsStore((s) => s.createChangeRequest);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [unchecked, setUnchecked] = useState<UncheckedRequirements>({});
  const [dismissing, setDismissing] = useState<MaterialDifferenceRead | null>(null);

  if (view.differences.length === 0) {
    return view.extraction ? <Text color="$color11">合意済みの内容と違う点は見つかりませんでした。</Text> : null;
  }

  // 取り出し直し・捨てた後に無くなった違いの選択は数えない
  const picked = view.differences.filter((d) => isDraftable(d) && selected.has(d.id));
  const missing = withoutRequirement(picked, unchecked);
  const outdated = isExtractionOutdated(view);
  // Phase-116-4:追記
  // CR にできる違いが残っていなければ、選んで作る操作は出さない
  const draftable = view.differences.some(isDraftable);
  const busy = acting || extracting;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const toggleRequirement = (difference: MaterialDifferenceRead, requirementId: string) => {
    const current = unchecked[difference.id] ?? [];
    setUnchecked({
      ...unchecked,
      [difference.id]: current.includes(requirementId)
        ? current.filter((id) => id !== requirementId)
        : [...current, requirementId],
    });
  };
  const create = async () => {
    const cr = await createChangeRequest(projectId, materialId, {
      difference_ids: picked.map((d) => d.id),
      requirement_ids: requirementIdsFor(picked, unchecked),
    });
    if (cr) router.push(changeRequestHref(projectId, cr.number));
  };

  const target = (d: MaterialDifferenceRead) => {
    if (d.kind === "add") {
      return (
        <>
          <span style={MONO}>新規</span>
          {d.origin_key ? (
            <Text fontSize="$2" color="$color11">
              {" 起点 "}
              <span style={MONO}>{elementLabel(d.origin_key)}</span>
            </Text>
          ) : null}
        </>
      );
    }
    if (!d.target_key) return <Text color="$color11">合意済みの内容に無い</Text>;
    return (
      <>
        <span style={MONO}>{elementLabel(d.target_key)}</span>
        {choosesRequirements(d) ? (
          <YStack marginTop="$1" aria-label={`${elementLabel(d.target_key)} の対象の要件`}>
            <Text fontSize="$2" color="$color11">
              対象にする要件
            </Text>
            {d.requirement_candidates.map((id) => (
              <label key={id} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 13 }}>
                <input
                  type="checkbox"
                  disabled={!selected.has(d.id)}
                  checked={!(unchecked[d.id] ?? []).includes(id)}
                  onChange={() => toggleRequirement(d, id)}
                />
                <span style={MONO}>{id}</span>
              </label>
            ))}
          </YStack>
        ) : null}
      </>
    );
  };

  const state = (d: MaterialDifferenceRead) => {
    switch (d.status) {
      case "converted":
        return d.change_request_number !== null ? (
          <Link href={changeRequestHref(projectId, d.change_request_number)} style={LINK}>
            {`${changeRequestLabel(d.change_request_number)} にした`}
          </Link>
        ) : (
          "CR にした"
        );
      case "dismissed":
        return (
          <YStack gap="$1" alignItems="flex-start">
            <span>{`${d.kind === "question" ? "閉じた" : "捨てた"}: ${d.dismiss_reason ?? ""}`}</span>
            <Button size="$2" disabled={busy} onPress={() => void restore(projectId, materialId, d.id)}>
              未確認に戻す
            </Button>
          </YStack>
        );
      case "rejected":
        return `弾いた(検査): ${d.reasons.join("・")}`;
      default:
        return (
          <Button size="$2" chromeless disabled={busy} onPress={() => setDismissing(d)}>
            {d.kind === "question" ? "閉じる(理由)" : "捨てる(理由)"}
          </Button>
        );
    }
  };

  return (
    <YStack gap="$3">
      {groupDifferences(view.differences).map((group) => {
        const open = group.status === "unconfirmed";
        const cell = open ? CELL : DIM;
        return (
          <YStack key={group.status} gap="$1">
            <Text fontWeight="bold">{`${group.label}(${group.items.length})`}</Text>
            <table style={TABLE} aria-label={`違い(${group.label})`}>
              <thead>
                <tr>
                  {open ? <th style={HEAD}>選ぶ</th> : null}
                  <th style={HEAD}>種類</th>
                  <th style={HEAD}>対象</th>
                  <th style={HEAD}>内容</th>
                  <th style={HEAD}>根拠(資料の文)</th>
                  <th style={HEAD}>{open ? "操作" : "状態"}</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((d) => (
                  <tr key={d.id}>
                    {open ? (
                      <td style={CELL}>
                        {isDraftable(d) ? (
                          <input
                            type="checkbox"
                            aria-label={`「${d.content}」を選ぶ`}
                            checked={selected.has(d.id)}
                            onChange={() => toggle(d.id)}
                          />
                        ) : null}
                      </td>
                    ) : null}
                    <td style={cell}>
                      <KindChip kind={d.kind} />
                    </td>
                    <td style={cell}>{target(d)}</td>
                    <td style={{ ...cell, whiteSpace: "pre-wrap" }}>{d.content}</td>
                    <td style={{ ...cell, whiteSpace: "pre-wrap" }}>{`「${d.quote}」`}</td>
                    <td style={cell}>{state(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </YStack>
        );
      })}

      {dismissing ? (
        <DismissForm
          key={dismissing.id}
          difference={dismissing}
          submitting={busy}
          onCancel={() => setDismissing(null)}
          onSubmit={async (reason) => {
            if (await dismiss(projectId, materialId, dismissing.id, reason)) setDismissing(null);
          }}
        />
      ) : null}

      {/* Phase-116-4：更新 */}
      {/* <XStack gap="$3" alignItems="center" flexWrap="wrap" justifyContent="space-between"> */}
      {/*   <Text color="$color11" fontSize="$3"> */}
      {/*     {`${picked.length} 件を選んでいます。選んだ違いを1つの変更要求(CR)の下書きにまとめます。`} */}
      {/*   </Text> */}
      {/*   <Button size="$3" theme="green" disabled={busy || outdated || picked.length === 0 || missing.length > 0} onPress={() => void create()}> */}
      {/*     {acting ? "作っています..." : "選んだ違いから CR の下書きを作る"} */}
      {/*   </Button> */}
      {/* </XStack> */}
      {/* ↓↓ */}
      {draftable ? (
        <XStack gap="$3" alignItems="center" flexWrap="wrap" justifyContent="space-between">
          <Text color="$color11" fontSize="$3">
            {`${picked.length} 件を選んでいます。選んだ違いを1つの変更要求(CR)の下書きにまとめます。`}
          </Text>
          <Button
            size="$3"
            theme="green"
            disabled={busy || outdated || picked.length === 0 || missing.length > 0}
            onPress={() => void create()}
          >
            {acting ? "作っています..." : "選んだ違いから CR の下書きを作る"}
          </Button>
        </XStack>
      ) : null}
      {missing.length > 0 ? (
        <Text color="$orange11">
          {`${missing.map((d) => elementLabel(d.target_key)).join("、")} の対象にする要件を1つ以上選んでください。`}
        </Text>
      ) : null}
      {outdated ? <Text color="$orange11">取り出し直してから CR にしてください。</Text> : null}
    </YStack>
  );
}

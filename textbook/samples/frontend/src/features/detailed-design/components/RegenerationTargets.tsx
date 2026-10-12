// 作成：Phase-44-4
"use client";

import { useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import type { RegenerationTargetRead } from "@/features/detailed-design/api/types";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { REGENERATION_LIMITS, regenerationGroups } from "@/features/detailed-design/impactOps";
import { STAGE_TITLES } from "@/features/detailed-design/labels";
import { toggleUnit } from "@/features/detailed-design/procedureDocOps";

// 「変更の影響」パネルの再生成の候補。部分再生成できる段階(5 手順・6 処理ロジック・8 単位の手順書)
// の、未確認の印の要素を段階ごとにチェックボックスで並べ(初めは上限まで全部選ぶ)、段階ごとに1回の
// 部分再生成を呼ぶ。自動では再生成しない。再生成しても印は確認済みにしない(生成は下書きのため)。
export function RegenerationTargets({
  projectId,
  targets,
}: {
  projectId: string;
  targets: RegenerationTargetRead[];
}) {
  const groups = regenerationGroups(targets);
  if (groups.length === 0) return null;
  return (
    <YStack gap="$2" aria-label="再生成の候補">
      <Text fontWeight="600">再生成の候補</Text>
      <Text fontSize="$2" color="$color11">
        印の付いた要素のうち、部分再生成できるもの(段階5 手順・段階6 処理ロジック・段階8 単位の手順書)です。
        再生成すると、その段階へ移って生成の完了を待ちます。生成した内容を確かめてから、印を確認済みにしてください。
      </Text>
      {groups.map((group) => (
        <StageTargets
          key={`${group.stage}:${group.targets.map((t) => t.key).join(",")}`}
          projectId={projectId}
          stage={group.stage}
          targets={group.targets}
        />
      ))}
    </YStack>
  );
}

function StageTargets({
  projectId,
  stage,
  targets,
}: {
  projectId: string;
  stage: number;
  targets: RegenerationTargetRead[];
}) {
  const view = useDetailedDesignStore((s) => s.stages.find((item) => item.stage === stage));
  const requesting = useDetailedDesignStore((s) => s.requestingGeneration);
  const regenerate = useDetailedDesignStore((s) => s.regenerate);
  const selectStage = useDetailedDesignStore((s) => s.selectStage);
  const limit = REGENERATION_LIMITS[stage] ?? targets.length;
  const [selected, setSelected] = useState<string[]>(() =>
    targets.slice(0, limit).map((t) => t.key),
  );
  const generating = view?.generation_status === "generating";
  const disabled = !view?.is_open || generating || requesting;

  const start = () => {
    // 生成の完了は段階のパネルが待つので、先にその段階へ移る(受け付けの失敗も作業領域に出る)
    selectStage(stage);
    void regenerate(projectId, stage, selected);
  };

  return (
    <YStack gap="$1" aria-label={`段階${stage}の再生成の候補`}>
      <Text fontSize="$2">{`段階${stage} ${STAGE_TITLES[stage] ?? ""}`}</Text>
      <XStack gap="$3" flexWrap="wrap">
        {targets.map((t) => (
          <label key={t.key} style={{ fontSize: 13, display: "inline-flex", gap: 4 }}>
            <input
              type="checkbox"
              checked={selected.includes(t.key)}
              disabled={disabled || (!selected.includes(t.key) && selected.length >= limit)}
              onChange={() => setSelected((current) => toggleUnit(current, t.key, limit))}
            />
            {t.label}
          </label>
        ))}
      </XStack>
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <Button size="$2" disabled={disabled || selected.length === 0} onPress={start}>
          {`選んだ候補を再生成する(${selected.length}件)`}
        </Button>
        {!view?.is_open ? (
          <Text fontSize="$1" color="$color11">
            この段階はまだ開いていません(前の段階を承認すると再生成できます)。
          </Text>
        ) : generating ? (
          <Text fontSize="$1" color="$color11">
            生成中です。
          </Text>
        ) : targets.length > limit ? (
          <Text fontSize="$1" color="$color11">
            {`1回に再生成できるのは ${limit} 件までです。`}
          </Text>
        ) : null}
      </XStack>
    </YStack>
  );
}

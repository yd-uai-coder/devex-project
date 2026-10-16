// 作成：Phase-65-3
"use client";

import { useId, useState } from "react";
import { Input, Label, RadioGroup, Text, XStack, YStack } from "tamagui";
import { CheckboxGroup } from "@/components/ui/form/CheckboxGroup";
import radioStyles from "@/components/ui/form/RadioGroupWithLabel.module.css";
import { RadioGroupItem } from "@/components/ui/primitives/RadioGroupItem";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import { toProjectMode } from "@/features/dashboard/api/projects";
import { STATUS_LABEL } from "@/features/dashboard/components/ProjectListItem";
import { DEFAULT_LIST_PARAMS, PROJECT_STATUSES, hasConditions } from "@/features/dashboard/list-params";
import type { ProjectListParams } from "@/features/dashboard/list-params";

const MODE_ITEMS = [
  { value: "all", label: "すべて" },
  { value: "simple", label: "簡易ドキュメント" },
  { value: "detailed", label: "詳細設計" },
];

const STATUS_ITEMS = PROJECT_STATUSES.map((status) => ({ value: status, label: STATUS_LABEL[status] }));

type ProjectListControlsProps = {
  value: ProjectListParams;
  // 条件を変えたときに呼ぶ(ページは1に戻して渡す)。URL への反映は呼び出し側が持つ
  onChange: (next: ProjectListParams) => void;
};

// 一覧の検索・絞込み。検索語は Enter か「検索」ボタンで確定し、入力の途中では一覧を変えない。
// モードと進行状態は選んだときにすぐ反映する(進行状態は複数を選べ、どれかに一致するものを出す)。
export function ProjectListControls({ value, onChange }: ProjectListControlsProps) {
  const radioId = useId();
  const [draft, setDraft] = useState(value.q);
  // 確定済みの検索語が外から変わったら(戻る・条件のクリア)、入力欄を合わせる
  // (effect でなく描画の中で合わせる、React の「props の変化で state を調整する」形)
  const [syncedQ, setSyncedQ] = useState(value.q);
  if (syncedQ !== value.q) {
    setSyncedQ(value.q);
    setDraft(value.q);
  }

  function change(patch: Partial<ProjectListParams>) {
    onChange({ ...value, ...patch, page: 1 });
  }

  function submitSearch() {
    const q = draft.trim();
    if (q !== value.q) change({ q });
  }

  return (
    <YStack gap="$2">
      <XStack gap="$2" alignItems="flex-start">
        {/* 1つの入力欄だけのフォームなので、Enter で送信(暗黙の送信)になる */}
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
        >
          <Input
            aria-label="タイトルで検索"
            placeholder="タイトルで検索"
            value={draft}
            onChangeText={setDraft}
            borderColor="$color7"
            width="100%"
            maxWidth="480px"
          />
        </form>
        <StyledButton onPress={submitSearch}>検索</StyledButton>
      </XStack>
      <YStack gap="$1" flexWrap="wrap">
        {/* RadioGroupWithLabel は幅が固定(既定300)で選択肢が折り返すため、進行状態の行と
            同じ並び(見出し + 選択肢を横に)をここで組む。狭い画面で折り返すよう、各段に
            flexShrink・minWidth を持たせ、RadioGroup の中の要素は RadioGroupWithLabel と同じ
            CSS で縮められるようにする(Tamagui の View は既定で flex-shrink: 0 のため) */}
        <XStack alignItems="center" gap="$3" flexWrap="wrap" flexShrink={1} minWidth={0}>
          <Text fontSize="$3" id={`${radioId}-label`}>
            モード
          </Text>
          <XStack className={radioStyles.radioGroupWrap} flexShrink={1} minWidth={0}>
            <RadioGroup
              aria-labelledby={`${radioId}-label`}
              minWidth={0}
              value={value.mode ?? "all"}
              // 「すべて」(all)は toProjectMode で null(絞らない)になる
              onValueChange={(next) => change({ mode: toProjectMode(next) })}
            >
              <XStack alignItems="center" gap="$4" flexWrap="wrap" flexShrink={1} minWidth={0}>
                {MODE_ITEMS.map((item) => (
                  <XStack key={item.value} alignItems="center" gap="$2">
                    <RadioGroupItem value={item.value} id={`${radioId}-${item.value}`} />
                    <Label htmlFor={`${radioId}-${item.value}`}>{item.label}</Label>
                  </XStack>
                ))}
              </XStack>
            </RadioGroup>
          </XStack>
        </XStack>
        <XStack
          role="group"
          aria-label="進行状態"
          alignItems="center"
          gap="$3"
          flexWrap="wrap"
          flexShrink={1}
          minWidth={0}
        >
          <Text fontSize="$3">進行状態</Text>
          <CheckboxGroup
            items={STATUS_ITEMS}
            value={value.statuses}
            onValueChange={(next) =>
              change({ statuses: PROJECT_STATUSES.filter((s) => next.includes(s)) })
            }
          />
        </XStack>
        {hasConditions(value) ? (
          <StyledButton size="$2" width="$10" chromeless onPress={() => onChange(DEFAULT_LIST_PARAMS)}>
            条件をクリア
          </StyledButton>
        ) : null}
      </YStack>
    </YStack>
  );
}

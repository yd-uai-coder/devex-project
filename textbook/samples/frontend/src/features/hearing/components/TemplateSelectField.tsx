// 作成：Phase-6-4
// 写経レベル: コア ── 選択解除時にenvironmentを消さない判断・default_environmentのマッピングが
// ドメイン判断そのもの。
"use client";

import { useEffect, useState } from "react";
import { Text } from "tamagui";
import RadioGroupWithLabel from "@/components/ui/form/RadioGroupWithLabel";
import { listPromptTemplates } from "@/features/hearing/api/templatesApi";
import type { PromptTemplateRead } from "@/features/hearing/api/templatesApi";
import type { EnvironmentValues } from "@/features/hearing/schemas";

// UUIDと衝突しない固定値。「テンプレートを使わない」選択を表す。
const NO_TEMPLATE_VALUE = "none";

type TemplateSelectFieldProps = {
  value: string | null;
  // environmentはテンプレート選択時のプリフィル用(選択解除時はnullを渡し、既存の入力値は変更しない)。
  onChange: (templateId: string | null, environment: EnvironmentValues | null) => void;
};

export function toEnvironmentValues(
  defaultEnvironment: PromptTemplateRead["default_environment"],
): EnvironmentValues | null {
  if (!defaultEnvironment) return null;
  return {
    languages: defaultEnvironment.languages,
    frameworks: defaultEnvironment.frameworks,
    databases: defaultEnvironment.databases,
    deployTargets: defaultEnvironment.deploy_targets,
  };
}

export function TemplateSelectField({ value, onChange }: TemplateSelectFieldProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [templates, setTemplates] = useState<PromptTemplateRead[]>([]);

  useEffect(() => {
    let cancelled = false;
    listPromptTemplates()
      .then((result) => {
        if (!cancelled) {
          setTemplates(result);
          setStatus("success");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Should have機能のため、取得失敗・0件時はテンプレートを使わずに進められることだけ示す
  // (フォーム全体を止めない)。
  if (status === "error") {
    return (
      <Text role="alert" color="$color9" fontSize="$2">
        テンプレート一覧の取得に失敗しました(テンプレートを使わずに進められます)
      </Text>
    );
  }
  if (status === "loading" || templates.length === 0) {
    return null;
  }

  const items = [
    { value: NO_TEMPLATE_VALUE, label: "テンプレートを使わない" },
    ...templates.map((t) => ({ value: t.id, label: `${t.name}(${t.target_type})` })),
  ];

  return (
    <RadioGroupWithLabel
      label="テンプレート(任意)"
      width="100%"
      orientation="vertical"
      items={items}
      value={value ?? NO_TEMPLATE_VALUE}
      onValueChange={(next) => {
        if (next === NO_TEMPLATE_VALUE) {
          onChange(null, null);
          return;
        }
        const template = templates.find((t) => t.id === next);
        onChange(next, template ? toEnvironmentValues(template.default_environment) : null);
      }}
    />
  );
}

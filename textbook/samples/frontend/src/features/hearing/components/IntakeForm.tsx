// 作成：Phase-3-4
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Text } from "tamagui";
import FormGeneral from "@/components/ui/form/FormGeneral";
import TextAreaWithLabel from "@/components/ui/form/TextAreaWithLabel";
import CheckboxGroupWithLabel from "@/components/ui/form/CheckboxGroupWithLabel";
import type { CheckboxGroupOption } from "@/components/ui/form/CheckboxGroup";
import { CheckboxGroup } from "@/components/ui/form/CheckboxGroup";
import { FieldsetGroup } from "@/components/ui/form/FieldsetGroup";
import { CollapsibleSection } from "@/components/ui/form/CollapsibleSection";
import { FileUploadField } from "@/features/hearing/components/FileUploadField";
import { createProject } from "@/features/hearing/api/createProject";
import { intakeSchema } from "@/features/hearing/schemas";
import type { IntakeValues } from "@/features/hearing/schemas";
import { ApiError } from "@/lib/api/client";

const LANGUAGE_OPTIONS: CheckboxGroupOption[] = [
  { value: "python", label: "Python" },
  { value: "typescript", label: "TypeScript" },
  { value: "go", label: "Go" },
  { value: "java", label: "Java" },
];

// フレームワークは言語ごとに<fieldset><legend>で静的グルーピングする(動的な絞り込み
// コンボボックスは採用しない、docs/external_design.md 2.3節SCR-004・Phase-0-3.md参照)。
// 選択結果自体は言語をまたいだ1つのフラットな配列(environment.frameworks)にまとめる。
const FRAMEWORK_OPTIONS_BY_LANGUAGE: { language: string; items: CheckboxGroupOption[] }[] = [
  {
    language: "Python",
    items: [
      { value: "fastapi", label: "FastAPI" },
      { value: "django", label: "Django" },
      { value: "flask", label: "Flask" },
    ],
  },
  {
    language: "TypeScript",
    items: [
      { value: "nextjs", label: "Next.js" },
      { value: "express", label: "Express" },
      { value: "nestjs", label: "NestJS" },
    ],
  },
  {
    language: "Go",
    items: [
      { value: "gin", label: "Gin" },
      { value: "echo", label: "Echo" },
    ],
  },
  {
    language: "Java",
    items: [{ value: "springboot", label: "Spring Boot" }],
  },
];

const DATABASE_OPTIONS: CheckboxGroupOption[] = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "mongodb", label: "MongoDB" },
  { value: "redis", label: "Redis" },
];

const DEPLOY_TARGET_OPTIONS: CheckboxGroupOption[] = [
  { value: "aws", label: "AWS" },
  { value: "gcp", label: "GCP" },
  { value: "azure", label: "Azure" },
  { value: "vercel", label: "Vercel" },
  { value: "docker", label: "Docker/自前サーバー" },
];

const DEFAULT_VALUES: IntakeValues = {
  systemOverview: "",
  goalsRaw: "",
  notesRaw: "",
  environment: { languages: [], frameworks: [], databases: [], deployTargets: [] },
  files: [],
};

export function IntakeForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  // FormGeneralのonSubmittedは引数を取らないため、作成後の遷移先(project.id)を
  // handleBeforeSubmit成功時にここへ保持しておく(LoginForm/RegisterFormと同じ設計)。
  const createdProjectIdRef = useRef<string | null>(null);

  const { control, handleSubmit } = useForm<IntakeValues>({
    resolver: zodResolver(intakeSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const handleBeforeSubmit = (): Promise<boolean> =>
    new Promise((resolve) => {
      void handleSubmit(
        async (values) => {
          setSubmitError(null);
          try {
            const project = await createProject(values);
            createdProjectIdRef.current = project.id;
            resolve(true);
          } catch (err) {
            setSubmitError(err instanceof ApiError ? err.message : "プロジェクトの作成に失敗しました");
            resolve(false);
          }
        },
        () => resolve(false),
      )();
    });

  const handleSubmitted = () => {
    if (createdProjectIdRef.current) {
      router.push(`/projects/${createdProjectIdRef.current}/chat`);
    }
  };

  return (
    <FormGeneral
      buttonName="ヒアリングを始める"
      onBeforeSubmit={handleBeforeSubmit}
      onSubmitted={handleSubmitted}
    >
      <Controller
        name="systemOverview"
        control={control}
        render={({ field, fieldState }) => (
          <TextAreaWithLabel
            label="システム概要"
            width="100%"
            name="systemOverview"
            placeholder="作りたいものを一言で教えてください"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="goalsRaw"
        control={control}
        render={({ field, fieldState }) => (
          <TextAreaWithLabel
            label="実現したいこと"
            width="100%"
            name="goalsRaw"
            placeholder="箇条書き推奨(改行区切りでOK)"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="notesRaw"
        control={control}
        render={({ field, fieldState }) => (
          <TextAreaWithLabel
            label="補足(任意)"
            width="100%"
            name="notesRaw"
            placeholder="欲しい機能・その他、自由に記入してください"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={fieldState.error?.message}
          />
        )}
      />

      <CollapsibleSection summary="環境設定(任意・未入力の場合はAIにおまかせします)">
        <Controller
          name="environment.languages"
          control={control}
          render={({ field }) => (
            <CheckboxGroupWithLabel
              label="言語"
              width="100%"
              items={LANGUAGE_OPTIONS}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />
        <Controller
          name="environment.frameworks"
          control={control}
          render={({ field }) => (
            <>
              {FRAMEWORK_OPTIONS_BY_LANGUAGE.map((group) => (
                <FieldsetGroup key={group.language} legend={group.language}>
                  <CheckboxGroup items={group.items} value={field.value} onValueChange={field.onChange} />
                </FieldsetGroup>
              ))}
            </>
          )}
        />
        <Controller
          name="environment.databases"
          control={control}
          render={({ field }) => (
            <CheckboxGroupWithLabel
              label="データベース"
              width="100%"
              items={DATABASE_OPTIONS}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />
        <Controller
          name="environment.deployTargets"
          control={control}
          render={({ field }) => (
            <CheckboxGroupWithLabel
              label="デプロイ環境"
              width="100%"
              items={DEPLOY_TARGET_OPTIONS}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />
      </CollapsibleSection>

      <Controller
        name="files"
        control={control}
        render={({ field }) => <FileUploadField value={field.value} onChange={field.onChange} />}
      />

      {submitError ? (
        <Text role="alert" color="$color9" fontSize="$2">
          {submitError}
        </Text>
      ) : null}
    </FormGeneral>
  );
}

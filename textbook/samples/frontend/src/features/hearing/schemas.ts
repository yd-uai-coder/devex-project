// 作成：Phase-3-4
import { z } from "zod";
import { applyRules, maxLength, requiredText } from "@/lib/schemas/validation-rules";

// docs/external_design.md 2.5節3項の文字数上限(Phase-0-5仕様診断3番)。
const SYSTEM_OVERVIEW_MAX_LENGTH = 200;
const GOALS_MAX_LENGTH = 80;
const NOTES_MAX_LENGTH = 400;
const MAX_FILES = 3;

export const environmentSchema = z.object({
  languages: z.array(z.string()),
  frameworks: z.array(z.string()),
  databases: z.array(z.string()),
  deployTargets: z.array(z.string()),
});
export type EnvironmentValues = z.infer<typeof environmentSchema>;

// バックエンドのバリデーション(pydantic、Formフィールドはstr、下限のみFastAPI側で必須制御)は
// システム概要・実現したいことの必須チェックのみを持つ。文字数上限はUXのための早期フィードバック。
export const intakeSchema = z.object({
  systemOverview: applyRules(
    z.string().trim(),
    requiredText("システム概要"),
    maxLength("システム概要", SYSTEM_OVERVIEW_MAX_LENGTH),
  ),
  goalsRaw: applyRules(
    z.string().trim(),
    requiredText("実現したいこと"),
    maxLength("実現したいこと", GOALS_MAX_LENGTH),
  ),
  notesRaw: applyRules(z.string().trim(), maxLength("補足", NOTES_MAX_LENGTH)),
  environment: environmentSchema,
  // ファイルごとの拡張子/サイズ検証はFileUploadField側(選択時点)で行うため、
  // ここでは件数のみをsubmit時の最終防御として確認する。
  files: z.array(z.instanceof(File)).max(MAX_FILES, `ファイルは${MAX_FILES}件までです`),
});
export type IntakeValues = z.infer<typeof intakeSchema>;

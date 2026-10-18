// 作成：Phase-66-3｜更新：Phase-77-1
import { z } from "zod";
import { EMAIL_MAX_LENGTH, USER_NAME_MAX_LENGTH, newPasswordSchema } from "@/features/auth/schemas";
import { applyRules, maxLength, requiredText, validEmail } from "@/lib/schemas/validation-rules";

// Phase-77-1：更新
// // マイページのアカウントの3つのフォーム。サーバーも同じ規則で確かめる(ここは早めの知らせ)。
// ↓↓
// マイページのアカウントのフォーム。サーバーも同じ規則で確かめる(ここは早めの知らせ)。
export const userNameSchema = z.object({
  userName: applyRules(
    z.string().trim(),
    requiredText("ユーザーネーム"),
    maxLength("ユーザーネーム", USER_NAME_MAX_LENGTH),
  ),
});
export type UserNameValues = z.infer<typeof userNameSchema>;

export const emailChangeSchema = z.object({
  newEmail: applyRules(
    z.string().trim(),
    requiredText("新しいメールアドレス"),
    maxLength("新しいメールアドレス", EMAIL_MAX_LENGTH),
    validEmail("新しいメールアドレス"),
  ),
  currentPassword: applyRules(z.string(), requiredText("今のパスワード")),
});
export type EmailChangeValues = z.infer<typeof emailChangeSchema>;

// 新しいパスワードは登録と同じ規則。打ち間違いで入れなくなるのを防ぐため、確認の欄と照らす
export const passwordChangeSchema = z
  .object({
    currentPassword: applyRules(z.string(), requiredText("今のパスワード")),
    newPassword: newPasswordSchema("新しいパスワード"),
    confirmPassword: applyRules(z.string(), requiredText("新しいパスワード(確認)")),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "新しいパスワードと一致しません",
  });
export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;

// Phase-77-1:追記
// パスワードの設定(Google だけの人)。今のパスワードが無いので、変更から今のパスワードの欄を除いた形
export const passwordSetSchema = z
  .object({
    newPassword: newPasswordSchema("新しいパスワード"),
    confirmPassword: applyRules(z.string(), requiredText("新しいパスワード(確認)")),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "新しいパスワードと一致しません",
  });
export type PasswordSetValues = z.infer<typeof passwordSetSchema>;

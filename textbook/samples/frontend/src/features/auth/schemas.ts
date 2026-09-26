// 作成：Phase-3-2
import { z } from "zod";
import {
  applyRules,
  digitRequired,
  lengthRange,
  lowercaseRequired,
  maxLength,
  requiredText,
  symbolRequired,
  uppercaseRequired,
  validEmail,
} from "@/lib/schemas/validation-rules";

const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const FULL_NAME_MAX_LENGTH = 255;

// バックエンドのバリデーションはpydantic(EmailStr + password: str、下限なし)側で改めて行われる。
// ここでのチェックはUXのための早期フィードバックであり、サーバー側の代替にはならない。
export const loginSchema = z.object({
  email: applyRules(
    z.string().trim(),
    requiredText("メールアドレス"),
    maxLength("メールアドレス", EMAIL_MAX_LENGTH),
    validEmail("メールアドレス"),
  ),
  password: applyRules(z.string(), requiredText("パスワード"), maxLength("パスワード", PASSWORD_MAX_LENGTH)),
});
export type LoginValues = z.infer<typeof loginSchema>;

// full_nameはバックエンド(UserCreate)でoptionalだが、登録画面では入力を必須にする
// (未入力を許すと表示名の無いユーザーができてしまい、ダッシュボード等での表示に困るため)。
export const registerSchema = z.object({
  fullName: applyRules(z.string().trim(), requiredText("氏名"), maxLength("氏名", FULL_NAME_MAX_LENGTH)),
  email: applyRules(
    z.string().trim(),
    requiredText("メールアドレス"),
    maxLength("メールアドレス", EMAIL_MAX_LENGTH),
    validEmail("メールアドレス"),
  ),
  // ログインのパスワード欄とは異なり、新規登録時のみ強度ルール(大文字・小文字・数字・記号を
  // 各1文字以上)を課す。既存アカウントに遡って適用されるわけではないため、
  // loginSchema側には課さない(既存パスワードが新ルールを満たすとは限らないため)。
  password: applyRules(
    z.string(),
    requiredText("パスワード"),
    lengthRange("パスワード", PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH),
    uppercaseRequired("パスワード"),
    lowercaseRequired("パスワード"),
    digitRequired("パスワード"),
    symbolRequired("パスワード"),
  ),
});
export type RegisterValues = z.infer<typeof registerSchema>;

// 作成：Phase-3-2｜更新：Phase-66-1,66-3
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

// Phase-66-3：更新(マイページのメールの変更でも使う)
// const EMAIL_MAX_LENGTH = 254;
// ↓↓
export const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
// Phase-66-1：更新
// const FULL_NAME_MAX_LENGTH = 255;
// ↓↓
export const USER_NAME_MAX_LENGTH = 255;

// Phase-66-3:追記
// 新しく決めるパスワードの規則(大文字・小文字・数字・記号を各1文字以上)。登録とマイページの
// パスワードの変更で同じ規則を使う(変更の API も同じ規則で確かめる ── devex-api の
// app/core/password_policy.py)。
export function newPasswordSchema(label = "パスワード") {
  return applyRules(
    z.string(),
    requiredText(label),
    lengthRange(label, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH),
    uppercaseRequired(label),
    lowercaseRequired(label),
    digitRequired(label),
    symbolRequired(label),
  );
}

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

// Phase-66-1：更新
// // full_nameはバックエンド(UserCreate)でoptionalだが、登録画面では入力を必須にする
// ↓↓
// user_nameはバックエンド(UserCreate)でoptionalだが、登録画面では入力を必須にする
// (未入力を許すと表示名の無いユーザーができてしまい、ダッシュボード等での表示に困るため)。
export const registerSchema = z.object({
  // Phase-66-1：更新
  // fullName: applyRules(z.string().trim(), requiredText("氏名"), maxLength("氏名", FULL_NAME_MAX_LENGTH)),
  // ↓↓
  userName: applyRules(
    z.string().trim(),
    requiredText("ユーザーネーム"),
    maxLength("ユーザーネーム", USER_NAME_MAX_LENGTH),
  ),
  email: applyRules(
    z.string().trim(),
    requiredText("メールアドレス"),
    maxLength("メールアドレス", EMAIL_MAX_LENGTH),
    validEmail("メールアドレス"),
  ),
  // ログインのパスワード欄とは異なり、新規登録時のみ強度ルール(大文字・小文字・数字・記号を
  // 各1文字以上)を課す。既存アカウントに遡って適用されるわけではないため、
  // loginSchema側には課さない(既存パスワードが新ルールを満たすとは限らないため)。
  // Phase-66-3：更新(規則を newPasswordSchema に抜き出し、マイページのパスワードの変更と共有する)
  // password: applyRules(
  //   z.string(),
  //   requiredText("パスワード"),
  //   lengthRange("パスワード", PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH),
  //   uppercaseRequired("パスワード"),
  //   lowercaseRequired("パスワード"),
  //   digitRequired("パスワード"),
  //   symbolRequired("パスワード"),
  // ),
  // ↓↓
  password: newPasswordSchema(),
});
export type RegisterValues = z.infer<typeof registerSchema>;

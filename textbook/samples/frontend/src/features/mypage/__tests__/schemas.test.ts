// 作成：Phase-66-3
// SUT: マイページのフォームのスキーマ(userNameSchema・emailChangeSchema・passwordChangeSchema)と、
// 登録と共有する newPasswordSchema
// ドライバ: 各テスト(safeParse を呼ぶ)
// スタブ不要 ── スキーマは純粋で、外部の依存を呼ばないため
import { describe, expect, it } from "vitest";
import { emailChangeSchema, passwordChangeSchema, userNameSchema } from "../schemas";

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : result.error?.issues[0]?.message;
}

describe("userNameSchema", () => {
  it("前後の空白を除き、空なら断る", () => {
    expect(userNameSchema.parse({ userName: "  ギル " })).toEqual({ userName: "ギル" });
    expect(firstMessage(userNameSchema.safeParse({ userName: "   " }))).toContain("ユーザーネーム");
  });
});

describe("emailChangeSchema", () => {
  it("新しいメールの形と、今のパスワードの入力を求める", () => {
    expect(emailChangeSchema.safeParse({ newEmail: "a@example.com", currentPassword: "x" }).success).toBe(true);
    expect(emailChangeSchema.safeParse({ newEmail: "not-mail", currentPassword: "x" }).success).toBe(false);
    expect(firstMessage(emailChangeSchema.safeParse({ newEmail: "a@example.com", currentPassword: "" }))).toContain(
      "今のパスワード",
    );
  });
});

describe("passwordChangeSchema", () => {
  const valid = { currentPassword: "old", newPassword: "New-pass-02", confirmPassword: "New-pass-02" };

  it("新しいパスワードに登録と同じ規則を課す(今のパスワードには課さない)", () => {
    expect(passwordChangeSchema.safeParse(valid).success).toBe(true);
    expect(
      firstMessage(passwordChangeSchema.safeParse({ ...valid, newPassword: "new-pass-02", confirmPassword: "new-pass-02" })),
    ).toBe("新しいパスワードは大文字を含めてください");
  });

  it("確認の欄が一致しなければ、確認の欄のエラーにする", () => {
    const result = passwordChangeSchema.safeParse({ ...valid, confirmPassword: "New-pass-03" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ["confirmPassword"], message: "新しいパスワードと一致しません" });
  });
});

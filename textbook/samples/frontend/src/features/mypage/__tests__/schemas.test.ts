// 作成：Phase-66-3｜更新：Phase-77-1
// Phase-77-1：更新
// // SUT: マイページのフォームのスキーマ(userNameSchema・emailChangeSchema・passwordChangeSchema)と、
// // 登録と共有する newPasswordSchema
// ↓↓
// SUT: マイページのフォームのスキーマ(userNameSchema・emailChangeSchema・passwordChangeSchema・
// passwordSetSchema)と、登録と共有する newPasswordSchema
// ドライバ: 各テスト(safeParse を呼ぶ)
// スタブ不要 ── スキーマは純粋で、外部の依存を呼ばないため
import { describe, expect, it } from "vitest";
// Phase-77-1：更新
// import { emailChangeSchema, passwordChangeSchema, userNameSchema } from "../schemas";
// ↓↓
import { emailChangeSchema, passwordChangeSchema, passwordSetSchema, userNameSchema } from "../schemas";

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

// Phase-77-1:追記
describe("passwordSetSchema", () => {
  it("今のパスワードを求めず、新しいパスワードの規則と確認の一致を求める", () => {
    expect(passwordSetSchema.safeParse({ newPassword: "New-pass-02", confirmPassword: "New-pass-02" }).success).toBe(true);
    expect(
      firstMessage(passwordSetSchema.safeParse({ newPassword: "new-pass-02", confirmPassword: "new-pass-02" })),
    ).toBe("新しいパスワードは大文字を含めてください");
    const result = passwordSetSchema.safeParse({ newPassword: "New-pass-02", confirmPassword: "New-pass-03" });
    expect(result.error?.issues[0]).toMatchObject({ path: ["confirmPassword"], message: "新しいパスワードと一致しません" });
  });
});

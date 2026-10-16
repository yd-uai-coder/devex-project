// 作成：Phase-63-2
import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "../redirect-path";

// SUT = safeRedirectPath、ドライバ = このテスト。スタブ不要 ── 純粋関数で外部依存を呼ばないため。
describe("safeRedirectPath", () => {
  it("同じオリジンの相対パスはそのまま返す", () => {
    expect(safeRedirectPath("/projects/3")).toBe("/projects/3");
    expect(safeRedirectPath("/projects/new?mode=detailed")).toBe("/projects/new?mode=detailed");
  });

  it("無い・空はnull", () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath("")).toBeNull();
  });

  it("絶対URLと、別のオリジンと読まれるパスはnull", () => {
    expect(safeRedirectPath("https://evil.example.com/")).toBeNull();
    expect(safeRedirectPath("//evil.example.com")).toBeNull();
    expect(safeRedirectPath("/\\evil.example.com")).toBeNull();
    expect(safeRedirectPath("dashboard")).toBeNull();
  });
});

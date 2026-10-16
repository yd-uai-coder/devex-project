// 作成：Phase-15-7｜更新：Phase-62-3
// 写経レベル: 定型
import { describe, expect, it } from "vitest";
import { toProjectMode } from "../projects";

describe("toProjectMode", () => {
  // Phase-62-3：更新
  // it("detailed だけを詳細設計モードにし、それ以外は簡易ドキュメントモードにする", () => {
  // ↓↓
  it("simple・detailed はそのモードにし、無い・不正な値は null にする", () => {
    expect(toProjectMode("detailed")).toBe("detailed");
    expect(toProjectMode("simple")).toBe("simple");
    // Phase-62-3：更新
    // expect(toProjectMode(undefined)).toBe("simple");
    // expect(toProjectMode(["detailed"])).toBe("simple");
    // expect(toProjectMode("unknown")).toBe("simple");
    // ↓↓
    expect(toProjectMode(undefined)).toBeNull();
    expect(toProjectMode(["detailed"])).toBeNull();
    expect(toProjectMode("unknown")).toBeNull();
  });
});

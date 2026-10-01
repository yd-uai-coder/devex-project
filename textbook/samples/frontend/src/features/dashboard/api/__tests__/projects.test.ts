// 作成：Phase-15-7
// 写経レベル: 定型
import { describe, expect, it } from "vitest";
import { toProjectMode } from "../projects";

describe("toProjectMode", () => {
  it("detailed だけを詳細設計モードにし、それ以外は簡易ドキュメントモードにする", () => {
    expect(toProjectMode("detailed")).toBe("detailed");
    expect(toProjectMode("simple")).toBe("simple");
    expect(toProjectMode(undefined)).toBe("simple");
    expect(toProjectMode(["detailed"])).toBe("simple");
    expect(toProjectMode("unknown")).toBe("simple");
  });
});

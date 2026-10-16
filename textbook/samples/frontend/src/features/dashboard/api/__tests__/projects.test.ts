// 作成：Phase-15-7｜更新：Phase-62-3,64-3
// 写経レベル: 定型
// Phase-64-3：更新
// import { describe, expect, it } from "vitest";
// import { toProjectMode } from "../projects";
// ↓↓
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteProject, toProjectMode } from "../projects";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

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

// Phase-64-3:追記
describe("deleteProject", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  // fetch のスタブは本文なしの 204 を作れないので、呼び出し先とメソッドだけを確かめる
  it("DELETE /api/v1/projects/{id} を呼ぶ", async () => {
    await deleteProject("p1");

    expect(stub.requests.map((r) => [r.init?.method, r.url.replace(/^.*(?=\/api\/)/, "")])).toEqual([
      ["DELETE", "/api/v1/projects/p1"],
    ]);
  });
});

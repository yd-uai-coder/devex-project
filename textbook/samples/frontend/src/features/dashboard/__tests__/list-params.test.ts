// 作成：Phase-65-2
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIST_PARAMS,
  hasConditions,
  listParamsKey,
  parseListParams,
  toSearchParams,
} from "../list-params";

describe("parseListParams", () => {
  it("URL のクエリを条件にし、status は定めた順に並べる", () => {
    const params = parseListParams(
      new URLSearchParams("q=%20予約%20&mode=detailed&status=completed&status=interviewing&page=3"),
    );

    expect(params).toEqual({
      q: "予約",
      mode: "detailed",
      statuses: ["interviewing", "completed"],
      page: 3,
    });
  });

  it("不正な値は捨てて既定値にする", () => {
    const params = parseListParams(new URLSearchParams("mode=other&status=archived&page=0"));

    expect(params).toEqual(DEFAULT_LIST_PARAMS);
    expect(parseListParams(new URLSearchParams("page=1.5")).page).toBe(1);
    expect(parseListParams(new URLSearchParams("page=abc")).page).toBe(1);
  });
});

describe("toSearchParams・listParamsKey", () => {
  it("既定値は省き、status は複数を繰り返す", () => {
    expect(toSearchParams(DEFAULT_LIST_PARAMS).toString()).toBe("");
    expect(
      toSearchParams({ q: " 予約 ", mode: "simple", statuses: ["revising", "generating"], page: 2 })
        .toString(),
    ).toBe("q=%E4%BA%88%E7%B4%84&mode=simple&status=generating&status=revising&page=2");
  });

  it("選んだ順によらず、同じ条件は同じ鍵になる", () => {
    const a = listParamsKey({ ...DEFAULT_LIST_PARAMS, statuses: ["completed", "interviewing"] });
    const b = listParamsKey({ ...DEFAULT_LIST_PARAMS, statuses: ["interviewing", "completed"] });

    expect(a).toBe(b);
  });

  it("URL に書いて読み直すと同じ条件に戻る", () => {
    const params = { q: "勤怠", mode: "detailed" as const, statuses: ["generating" as const], page: 4 };

    expect(parseListParams(toSearchParams(params))).toEqual(params);
  });
});

describe("hasConditions", () => {
  it("検索語・モード・進行状態のどれかがあれば true(ページは条件に含めない)", () => {
    expect(hasConditions({ ...DEFAULT_LIST_PARAMS, page: 2 })).toBe(false);
    expect(hasConditions({ ...DEFAULT_LIST_PARAMS, q: "  " })).toBe(false);
    expect(hasConditions({ ...DEFAULT_LIST_PARAMS, q: "a" })).toBe(true);
    expect(hasConditions({ ...DEFAULT_LIST_PARAMS, mode: "simple" })).toBe(true);
    expect(hasConditions({ ...DEFAULT_LIST_PARAMS, statuses: ["completed"] })).toBe(true);
  });
});

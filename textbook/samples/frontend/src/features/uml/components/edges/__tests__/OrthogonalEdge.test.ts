// 作成：Phase-11-5
import { describe, expect, it } from "vitest";
import { midpointOf } from "../OrthogonalEdge";

describe("midpointOf", () => {
  it("折れ線の中央の線分の中点を返す", () => {
    expect(
      midpointOf([
        [0, 0],
        [100, 0],
        [100, 50],
        [200, 50],
      ]),
    ).toEqual([100, 25]);
    expect(
      midpointOf([
        [0, 0],
        [100, 0],
      ]),
    ).toEqual([50, 0]);
  });

  it("点が無ければ原点を返す", () => {
    expect(midpointOf([])).toEqual([0, 0]);
  });
});

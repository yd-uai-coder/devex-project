// 作成：Phase-53(完了後の調整)
import { describe, expect, it } from "vitest";
import { reviewFindingsByKey } from "../reviewMarks";
import { makeFunctionList, makeModuleList, makeStages } from "../test-utils/stageFixtures";
import { finding, gate, run } from "@/features/design-review/test-utils/reviewFixtures";

// SUT は reviewFindingsByKey(純粋関数)、ドライバは vitest。スタブ不要 ── 対象が純粋(副作用なし)で
// 外部依存を呼ばないため。
describe("reviewFindingsByKey", () => {
  const stages = makeStages({
    1: { model: makeFunctionList() },
    4: { model: makeModuleList() },
    5: { model: {} },
  });

  it("対象を段階ごとの要素のキーに結び、却下は除き、重要度の順に並べる", () => {
    const gates = [
      gate({
        gate: "stage6",
        status: "reviewed",
        run: run({
          gate: "stage6",
          is_current: false,
          findings: [
            finding({ id: "minor", level: "minor", targets: ["F-01"] }),
            finding({ id: "critical", level: "critical", targets: ["F-01", "app/api/routes/reservations.py"] }),
            finding({ id: "rejected", level: "critical", targets: ["F-01"], decision: "rejected" }),
            finding({ id: "screen", targets: ["SCR-001"] }),
          ],
        }),
      }),
    ];

    const stage1 = reviewFindingsByKey(gates, stages, 1);
    expect([...stage1.keys()]).toEqual(["fn:F-01"]);
    expect(stage1.get("fn:F-01")?.map((i) => i.finding.id)).toEqual(["critical", "minor"]);
    expect(stage1.get("fn:F-01")?.[0]).toMatchObject({ gate: "stage6", isCurrent: false });
    // 1つの対象が複数の段階に当たれば、それぞれの段階に出す(段階5は手順)
    expect([...reviewFindingsByKey(gates, stages, 5).keys()]).toEqual(["proc:F-01"]);
    expect(reviewFindingsByKey(gates, stages, 4).get("module:app/api/routes/reservations.py")?.length).toBe(1);
  });

  it("成功していない回・回の無い区切りは出さない", () => {
    const gates = [gate({ status: "running", run: run({ status: "running", findings: [finding({ targets: ["F-01"] })] }) }), gate({ gate: "stage7" })];
    expect(reviewFindingsByKey(gates, stages, 1).size).toBe(0);
  });
});

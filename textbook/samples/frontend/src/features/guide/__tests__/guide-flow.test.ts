// 作成：Phase-118-1｜更新：Phase-118(完了後の調整2)
import { describe, expect, it } from "vitest";
import {
  GUIDE_BRANCH_FROM,
  GUIDE_FEATURES,
  GUIDE_FLOW,
  GUIDE_PAGES,
  PRODUCT_FLOW,
  flowPosition,
  guideHref,
  prevNext,
  type GuideSlug,
} from "../guide-flow";

const SLUGS = Object.keys(GUIDE_PAGES) as GuideSlug[];

describe("GUIDE_PAGES・GUIDE_FLOW", () => {
  it("ページの slug はキーと一致し、流れの段は重ならない", () => {
    for (const slug of SLUGS) expect(GUIDE_PAGES[slug].slug).toBe(slug);
    expect(new Set(GUIDE_FLOW).size).toBe(GUIDE_FLOW.length);
  });

  it("流れは はじめに → … → 資料 の順で、クライアントの方へ・用語集は流れの外", () => {
    expect(GUIDE_FLOW[0]).toBe("getting-started");
    expect(GUIDE_FLOW.at(-1)).toBe("materials");
    expect(GUIDE_FLOW).not.toContain("for-clients");
    expect(GUIDE_FLOW).not.toContain("glossary");
    expect(GUIDE_BRANCH_FROM["for-clients"]).toBe("agreement");
  });

  it("関係の深いページ・流れ図・機能カードは、定義のあるページだけを指す", () => {
    const pointed = [
      ...SLUGS.flatMap((slug) => GUIDE_PAGES[slug].related),
      ...PRODUCT_FLOW.map((step) => step.slug),
      ...GUIDE_FEATURES.map((feature) => feature.slug),
    ];
    for (const slug of pointed) expect(SLUGS).toContain(slug);
  });

  it("guideHref は /guide/<slug>", () => {
    expect(guideHref("hearing")).toBe("/guide/hearing");
  });
});

describe("flowPosition", () => {
  it("流れの中のページは 1 始まりの位置と段の数", () => {
    expect(flowPosition("getting-started")).toEqual({ index: 1, total: GUIDE_FLOW.length });
    // Phase-118(完了後の調整2)：更新
    // expect(flowPosition("agreement")).toEqual({ index: 8, total: GUIDE_FLOW.length });
    // ↓↓
    expect(flowPosition("modes")).toEqual({ index: 2, total: GUIDE_FLOW.length });
    expect(flowPosition("agreement")).toEqual({ index: 9, total: GUIDE_FLOW.length });
  });

  it("分岐のページは分岐元の位置、どちらでもないページは null", () => {
    expect(flowPosition("for-clients")).toEqual(flowPosition("agreement"));
    expect(flowPosition("glossary")).toBeNull();
  });
});

describe("prevNext", () => {
  it("最初の段は前が無く、最後の段は次が無い", () => {
    expect(prevNext("getting-started").prev).toBeNull();
    // Phase-118(完了後の調整2)：更新
    // expect(prevNext("getting-started").next?.slug).toBe("projects");
    // ↓↓
    expect(prevNext("getting-started").next?.slug).toBe("modes");
    expect(prevNext("projects").prev?.slug).toBe("modes");
    expect(prevNext("materials").next).toBeNull();
    expect(prevNext("materials").prev?.slug).toBe("agreement");
  });

  it("分岐のページは分岐元が前で次は無い。分岐元の無いページはどちらも無い", () => {
    expect(prevNext("for-clients")).toEqual({ prev: GUIDE_PAGES.agreement, next: null });
    expect(prevNext("glossary")).toEqual({ prev: null, next: null });
  });
});

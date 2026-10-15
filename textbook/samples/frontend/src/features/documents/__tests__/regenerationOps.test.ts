// 作成：Phase-53(完了後の調整)｜更新：Phase-56-2
// Phase-56-2:追記 ── @/features/documents/api/documentsApi.DocType, ../regenerationOps.DOC_LABEL
import { describe, expect, it } from "vitest";
import type { DocType } from "@/features/documents/api/documentsApi";
import {
  DOC_LABEL,
  modeDocTypes,
  progressStates,
  progressText,
  regenerationTargets,
  startLabel,
} from "../regenerationOps";

// SUT は再生成の起点と進み具合の純粋関数、ドライバは vitest。スタブ不要 ── 対象が純粋(副作用なし)で
// 外部依存を呼ばないため。
describe("regenerationOps", () => {
  const simple = modeDocTypes("simple");

  it("起点から下流を作り直す(内部設計からなら実装計画も)", () => {
    expect(regenerationTargets(simple, "requirements")).toEqual(simple);
    expect(regenerationTargets(simple, "internal_design")).toEqual(["internal_design", "implementation_plan"]);
    expect(regenerationTargets(modeDocTypes("detailed"), "external_design")).toEqual(["external_design"]);
  });

  it("起点の文言は 最初=から・間=以降・最後=だけ", () => {
    expect(startLabel(simple, "requirements")).toBe("要件定義から再生成");
    expect(startLabel(simple, "external_design")).toBe("外部設計以降を再生成");
    expect(startLabel(simple, "implementation_plan")).toBe("実装計画だけを再生成");
    expect(startLabel(modeDocTypes("detailed"), "external_design")).toBe("外部設計だけを再生成");
  });

  it("文書ごとの状態(できた・作っている・待ち・対象外)", () => {
    const progress = {
      targets: ["external_design", "internal_design", "implementation_plan"] as const,
      done: ["external_design"] as const,
      current: "internal_design" as const,
    };
    const read = { targets: [...progress.targets], done: [...progress.done], current: progress.current };
    expect(progressStates(simple, read).map((s) => s.state)).toEqual(["excluded", "done", "running", "waiting"]);
    expect(progressText(simple, read)).toBe("要件定義：対象外　外部設計：生成完了　内部設計：生成中　実装計画：待ち");
  });

  // Phase-56-2:追記
  it("テスト仕様書は進み具合の対象に出るが、プレビューの文書の並びには入れない", () => {
    const read = {
      targets: ["implementation_plan", "test_spec"] as DocType[],
      done: ["implementation_plan"] as DocType[],
      current: "test_spec" as const,
    };
    expect(simple).not.toContain("test_spec");
    expect(DOC_LABEL.test_spec).toBe("テスト仕様");
    expect(progressText(simple, read)).toBe("要件定義：対象外　外部設計：対象外　内部設計：対象外　実装計画：生成完了");
  });
});

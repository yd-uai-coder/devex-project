// 作成：Phase-34-3
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import type { HearingPoint, HearingPointsView } from "@/features/hearing/api/hearingApi";
import { HearingPointsPanel, openRequiredCount } from "../HearingPointsPanel";

function point(overrides: Partial<HearingPoint>): HearingPoint {
  return {
    key: "purpose",
    kind: "function",
    label: "目的・課題",
    question: "これが無いと、今は何に困っていますか",
    required: true,
    status: "open",
    summary: "",
    evidence: [],
    ...overrides,
  };
}

function view(overrides: Partial<HearingPointsView> = {}): HearingPointsView {
  return {
    scale: null,
    legacy: false,
    stale: false,
    is_sufficient: false,
    points: [
      point({ key: "scale", label: "規模", status: "decided", summary: "個人", evidence: [{ message_id: "m1", label: "発言1" }] }),
      point({ key: "purpose" }),
      point({ key: "schedule", label: "体制・期間", required: false, question: "何人で作りますか" }),
      point({
        key: "migration",
        label: "移行性",
        status: "not_applicable",
        summary: "新規",
        evidence: [
          { message_id: "m0", label: "初期入力" },
          { message_id: "m2", label: "発言2" },
        ],
      }),
    ],
    ...overrides,
  };
}

function renderPanel(v: HearingPointsView, defaultOpen = true) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <HearingPointsPanel view={v} defaultOpen={defaultOpen} />
    </TamaguiProvider>,
  );
}

describe("HearingPointsPanel", () => {
  it("未決の必須だけを数える(任意の未決・対象外は数えない)", () => {
    expect(openRequiredCount(view())).toBe(1);
  });

  it("見出しに未決の必須の件数、表に状態・決めたこと・根拠を出す", () => {
    renderPanel(view());

    expect(screen.getByText("観点の表 ── 未決の必須 1 件")).toBeInTheDocument();
    const rows = within(screen.getByRole("table", { name: "観点の表" })).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("規模○ユーザーが決定個人発言1");
    // 未決の観点は、決めたことの代わりに問いの例を出す
    expect(rows[2]).toHaveTextContent("目的・課題○未決これが無いと、今は何に困っていますか");
    expect(rows[3]).toHaveTextContent("体制・期間未決");
    expect(rows[4]).toHaveTextContent("移行性○対象外新規初期入力・発言2");
  });

  it("規模が未決なら、個人・小規模の列で数えていることを示す", () => {
    renderPanel(view());
    expect(screen.getByText(/規模: 未決\(個人・小規模の列で必須を数えています\)/)).toBeInTheDocument();
  });

  it("必須がそろったら、見出しで知らせる", () => {
    renderPanel(view({ is_sufficient: true, scale: "internal" }));

    expect(screen.getByText("観点の表 ── 必須はすべて決まりました")).toBeInTheDocument();
    expect(screen.getByText("規模: 社内")).toBeInTheDocument();
  });

  it("以前の判定のプロジェクト・表が古いときは、注記を出す", () => {
    renderPanel(view({ legacy: true }));
    expect(screen.getByRole("note")).toHaveTextContent("以前の判定(5条件)");

    renderPanel(view({ stale: true }));
    expect(screen.getAllByRole("note")[1]).toHaveTextContent("直近の発言は表に反映できていません");
  });

  it("defaultOpen で開閉の初期値を決める(畳める)", () => {
    const { container } = renderPanel(view(), false);

    expect(container.querySelector("details")?.open).toBe(false);
  });
});

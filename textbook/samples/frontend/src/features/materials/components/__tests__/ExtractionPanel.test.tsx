// 作成：Phase-116-3｜更新：Phase-116-4
// SUT: ExtractionPanel(違いの取り出しの回と、取り出し・取り出し直しのボタン)
// ドライバ: Testing Library(描画・クリック)
// スタブ: 資料のストアの取り出しの関数(vi.fn)── 束が無い・取り出す前・取り出した後に束が変わった、の出し分けと
// ボタンの配線だけを見るため
// Phase-116-4:追記 ── ../../test-utils/materialFixtures.makeFreshness
import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExtractionPanel } from "../ExtractionPanel";
import { useMaterialsStore } from "../../materials-store";
import { makeDifferences, makeFreshness } from "../../test-utils/materialFixtures";
import { resetMaterialsStore } from "../../test-utils/resetMaterialsStore";
import { renderWithTheme } from "@/features/change-requests/test-utils/renderWithStore";

describe("ExtractionPanel", () => {
  beforeEach(() => {
    resetMaterialsStore();
  });

  it("まだ取り出していなければ、最新の版と比べて取り出すボタンを出し、押すと取り出す", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ExtractionPanel projectId="p1" materialId="m1" view={makeDifferences({ extraction: null, differences: [] })} />);

    expect(screen.getByText("まだ違いを取り出していません。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "最新の版 B-2 と比べて違いを取り出す" }));
    expect(useMaterialsStore.getState().extract).toHaveBeenCalledWith("p1", "m1");
  });

  it("取り出した回を出し、その後に束が作られていれば取り出し直しを促す", () => {
    renderWithTheme(<ExtractionPanel projectId="p1" materialId="m1" view={makeDifferences({ latest_baseline_number: 3 })} />);

    expect(screen.getByText(/B-2 と比べて取り出しました/)).toHaveTextContent("gemini-3.5-flash-lite");
    expect(screen.getByText(/合意済みの版 B-3 が作られました/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最新の版 B-3 と比べて違いを取り出し直す" })).toBeInTheDocument();
  });

  it("束が無ければ取り出せず、合意済みの版へ案内する", () => {
    renderWithTheme(
      <ExtractionPanel projectId="p1" materialId="m1" view={makeDifferences({ extraction: null, latest_baseline_number: null, differences: [] })} />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "合意済みの版" })).toHaveAttribute("href", "/projects/p1/baselines");
  });

  it("取り出しの間はボタンを押せない", () => {
    useMaterialsStore.setState({ extracting: true });
    renderWithTheme(<ExtractionPanel projectId="p1" materialId="m1" view={makeDifferences()} />);
    expect(screen.getByRole("button", { name: "取り出しています..." })).toHaveAttribute("aria-disabled", "true");
  });

  // Phase-116-4:追記
  it("最新の束が古ければ取り出しの前に知らせる。取り出したときに古かったことは、今は新しいときだけ出す", () => {
    useMaterialsStore.setState({
      latestFreshness: makeFreshness({ fresh: false, applied_after: [{ number: 6, keys: ["req:FR-001"] }] }),
    });
    const view = makeDifferences();
    view.extraction!.freshness = makeFreshness({ fresh: false });
    const { unmount } = renderWithTheme(<ExtractionPanel projectId="p1" materialId="m1" view={view} />);

    expect(screen.getByLabelText("B-2 が古いことの知らせ")).toHaveTextContent("違いは最新の版 B-2 と比べて取り出します");
    expect(screen.queryByText("取り出したとき、B-2 は古い版でした。")).toBeNull();
    unmount();

    useMaterialsStore.setState({ latestFreshness: makeFreshness() });
    renderWithTheme(<ExtractionPanel projectId="p1" materialId="m1" view={view} />);
    expect(screen.queryByLabelText("B-2 が古いことの知らせ")).toBeNull();
    expect(screen.getByText("取り出したとき、B-2 は古い版でした。")).toBeInTheDocument();
  });
});

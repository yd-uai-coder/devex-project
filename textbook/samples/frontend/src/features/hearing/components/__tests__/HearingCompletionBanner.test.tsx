// 作成：Phase-3-5｜更新：Phase-6-6,15-8,24(ゴール3後の調整)
// Phase-6-6:追記 ── vitest.beforeEach, @/features/hearing/hearing-store.useHearingStore
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { useHearingStore } from "@/features/hearing/hearing-store";
import { HearingCompletionBanner } from "../HearingCompletionBanner";

function renderBanner(overrides: { approving?: boolean; onApprove?: () => void } = {}) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <HearingCompletionBanner
        completion={{ is_sufficient: true, summary: "要約テキスト", missing_points: [] }}
        onApprove={overrides.onApprove ?? vi.fn()}
        approving={overrides.approving ?? false}
      />
    </TamaguiProvider>,
  );
}

describe("HearingCompletionBanner", () => {
  // Phase-6-6:追記 ── バナーがstoreのprojectStatusを購読するため、テストごとに初期化する
  beforeEach(() => {
    useHearingStore.setState({ projectStatus: "interviewing" });
  });

  it("is_sufficient=falseなら何も表示しない", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <HearingCompletionBanner
          completion={{ is_sufficient: false, summary: "", missing_points: ["x"] }}
          onApprove={vi.fn()}
          approving={false}
        />
      </TamaguiProvider>,
    );

    expect(screen.queryByText("ヒアリング内容の確認")).not.toBeInTheDocument();
  });

  // Phase-24：更新
  // it("is_sufficient=trueなら要約とボタンを表示する", () => {
  // ↓↓
  it("is_sufficient=trueならボタンを表示し、要約は繰り返さない(チャットのまとめに出るため)", () => {
    renderBanner();

    // Phase-24：更新
    // expect(screen.getByText("要約テキスト")).toBeInTheDocument();
    // ↓↓
    expect(screen.queryByText("要約テキスト")).not.toBeInTheDocument();
    expect(screen.getByText("チャットのまとめの内容で、設計書を生成できます。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この内容で設計書を生成する" })).toBeInTheDocument();
  });

  // Phase-15-8：更新(押すと確認ダイアログを開き、「生成する」で onApprove を呼ぶ)
  // it("ボタン押下でonApproveを呼ぶ", async () => {
  //   const onApprove = vi.fn();
  //   const user = userEvent.setup();
  //   renderBanner({ onApprove });
  //
  //   await user.click(screen.getByRole("button", { name: "この内容で設計書を生成する" }));
  //
  //   expect(onApprove).toHaveBeenCalledTimes(1);
  // });
  // ↓↓
  it("ボタン押下で確認ダイアログを開き、「生成する」でonApproveを呼ぶ", async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    renderBanner({ onApprove });

    await user.click(screen.getByRole("button", { name: "この内容で設計書を生成する" }));
    expect(onApprove).not.toHaveBeenCalled();
    // ダイアログ内のボタンは jsdom ではロールのクエリで「隠れている」扱いになるため、aria-label で取る
    await user.click(screen.getByLabelText("生成する"));

    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("確認ダイアログでキャンセルするとonApproveを呼ばない", async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    renderBanner({ onApprove });

    await user.click(screen.getByRole("button", { name: "この内容で設計書を生成する" }));
    await user.click(screen.getByLabelText("キャンセル"));

    expect(onApprove).not.toHaveBeenCalled();
  });

  it("approving=trueならボタンが無効化され文言が変わる", () => {
    renderBanner({ approving: true });

    expect(screen.getByRole("button", { name: "生成を開始しています..." })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  // Phase-6-6:追記
  it("projectStatus==='completed'ならボタンが無効化され「設計書は生成済みです」と表示する", () => {
    useHearingStore.setState({ projectStatus: "completed" });
    renderBanner();

    expect(screen.getByRole("button", { name: "設計書は生成済みです" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  // Phase-6-6:追記 ── 生成後に再度チャットしてrevisingへ遷移したら、ボタンが再び押下可能になる
  it("projectStatusがcompleted→revisingに変わるとボタンが再描画され押下可能になる", async () => {
    useHearingStore.setState({ projectStatus: "completed" });
    renderBanner();
    expect(screen.getByRole("button", { name: "設計書は生成済みです" })).toBeInTheDocument();

    await act(async () => {
      useHearingStore.setState({ projectStatus: "revising" });
    });

    expect(screen.getByRole("button", { name: "この内容で設計書を生成する" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

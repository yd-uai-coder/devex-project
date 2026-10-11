// 作成：Phase-3-5｜更新：Phase-6-6,15-8,24(ゴール3後の調整),35(完了後の調整)
// Phase-6-6:追記 ── vitest.beforeEach, @/features/hearing/hearing-store.useHearingStore
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { useHearingStore } from "@/features/hearing/hearing-store";
// Phase-35(完了後の調整):追記 ── HearingPoint
import type { HearingPoint } from "@/features/hearing/api/hearingApi";
import { HearingCompletionBanner } from "../HearingCompletionBanner";

// Phase-35(完了後の調整)：更新(任意の観点の一覧と「続ける」を渡せるようにした)
// function renderBanner(overrides: { approving?: boolean; onApprove?: () => void } = {}) {
//   return render(
//     <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
//       <HearingCompletionBanner
//         completion={{ is_sufficient: true, summary: "要約テキスト", missing_points: [] }}
//         onApprove={overrides.onApprove ?? vi.fn()}
//         approving={overrides.approving ?? false}
//       />
//     </TamaguiProvider>,
//   );
// }
// ↓↓
const OPTIONAL_POINT: HearingPoint = {
  key: "schedule",
  kind: "function",
  label: "体制・期間",
  question: "何人で、いつまでに作りますか",
  required: false,
  status: "open",
  summary: "",
  evidence: [],
};

function renderBanner(
  overrides: {
    approving?: boolean;
    onApprove?: () => void;
    optionalPoints?: HearingPoint[];
    onContinueOptional?: () => void;
    sending?: boolean;
  } = {},
) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <HearingCompletionBanner
        completion={{ is_sufficient: true, summary: "要約テキスト", missing_points: [] }}
        onApprove={overrides.onApprove ?? vi.fn()}
        approving={overrides.approving ?? false}
        optionalPoints={overrides.optionalPoints}
        onContinueOptional={overrides.onContinueOptional}
        sending={overrides.sending}
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

    // Phase-35(完了後の調整)：更新
    // expect(screen.queryByText("ヒアリング内容の確認")).not.toBeInTheDocument();
    // ↓↓
    expect(screen.queryByText("必須項目の回答完了")).not.toBeInTheDocument();
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
    // Phase-35(完了後の調整)：更新
    // expect(screen.getByText("チャットのまとめの内容で、設計書を生成できます。")).toBeInTheDocument();
    // ↓↓
    expect(screen.getByText("必須項目の回答完了")).toBeInTheDocument();
    expect(screen.getByText("チャットの内容から設計書を生成できます。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この内容で設計書を生成する" })).toBeInTheDocument();
    // 未決の任意が無ければ、一覧も「続ける」も出さない
    expect(screen.queryByText("任意の確認事項")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "任意項目についてヒアリングを続ける" })).not.toBeInTheDocument();
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
  // Phase-35(完了後の調整):追記
  it("未決の任意があれば一覧と「任意項目についてヒアリングを続ける」を出し、生成のボタンも残す", async () => {
    const onContinueOptional = vi.fn();
    const user = userEvent.setup();
    renderBanner({ optionalPoints: [OPTIONAL_POINT], onContinueOptional });

    expect(screen.getByText("任意の確認事項")).toBeInTheDocument();
    expect(screen.getByText("・体制・期間(何人で、いつまでに作りますか)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この内容で設計書を生成する" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "任意項目についてヒアリングを続ける" }));

    expect(onContinueOptional).toHaveBeenCalledTimes(1);
  });

  it("送信中は「続ける」を押せない", () => {
    renderBanner({ optionalPoints: [OPTIONAL_POINT], onContinueOptional: vi.fn(), sending: true });

    expect(screen.getByRole("button", { name: "任意項目についてヒアリングを続ける" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

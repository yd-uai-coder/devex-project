// 作成：Phase-87-2｜更新：Phase-88-2,88(完了後の調整),98-2,109-2
// SUT: ChangeRequestForm(CR の作成・編集のフォーム)
// ドライバ: Testing Library(入力・クリック)
// スタブ不要 ── 部品は props の関数を呼ぶだけで外部を呼ばないため(onSubmit などは vi.fn で受ける)
// Phase-88-2：更新
// import type { BaselineRequirementRead } from "../../api/types";
// ↓↓
// Phase-98-2:追記 ── @/features/baselines/api/types.BaselineOriginRead
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ChangeRequestForm } from "../ChangeRequestForm";
import { emptyForm } from "../../changeRequestOps";
import type { BaselineOriginRead, BaselineRequirementRead } from "@/features/baselines/api/types";
// Phase-88(完了後の調整)：削除
// import { makeBaselineSummary } from "@/features/baselines/test-utils/baselineFixtures";

const REQUIREMENTS: BaselineRequirementRead[] = [
  { id: "FR-001", kind: "FR", priority: "Must", category: "", text: "ログインできる" },
  { id: "FR-005", kind: "FR", priority: "Must", category: "", text: "3件まで添付できる" },
];
// Phase-88(完了後の調整)：削除
// const BASELINES = [
//   makeBaselineSummary({ number: 2, label: "B-2", agreed_at: "2026-10-19T00:00:00Z" }),
//   makeBaselineSummary({ number: 1, label: "B-1", agreed_at: "2026-10-18T00:00:00Z" }),
// ];

// Phase-98-2:追記
const ORIGINS: BaselineOriginRead[] = [
  { key: "req:FR-001", kind: "requirement", label: "FR-001 ログインできる" },
  { key: "screen:SCR-004", kind: "screen", label: "SCR-004 チャットヒアリング画面" },
  // Phase-109-2:追記
  { key: "fn:F-07", kind: "function", label: "F-07 毎朝の集計" },
];

function renderForm(props: Partial<Parameters<typeof ChangeRequestForm>[0]> = {}) {
  const onSubmit = vi.fn();
  // Phase-88(完了後の調整)：削除
  // const onBaselineChange = vi.fn();
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ChangeRequestForm
        initial={emptyForm(2)}
        // Phase-88(完了後の調整)：削除
        // baselines={BASELINES}
        requirements={REQUIREMENTS}
        // Phase-88(完了後の調整)：削除
        // onBaselineChange={onBaselineChange}
        // Phase-98-2:追記
        origins={ORIGINS}
        submitting={false}
        submitLabel="下書きで作る"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        {...props}
      />
    </TamaguiProvider>,
  );
  // Phase-88(完了後の調整)：更新
  // return { onSubmit, onBaselineChange };
  // ↓↓
  return { onSubmit };
}

describe("ChangeRequestForm", () => {
  it("足りない項目があれば送らずに知らせる", async () => {
    const { onSubmit } = renderForm();

    await userEvent.click(screen.getByRole("button", { name: "下書きで作る" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("タイトルを入れてください");
  });

  it("要件を選んで対象に足し、種類と案を入れて送る", async () => {
    const { onSubmit } = renderForm();

    await userEvent.type(screen.getByLabelText("タイトル"), "上限を5件に");
    await userEvent.type(screen.getByLabelText("内容"), "参考資料の上限を変える");
    await userEvent.selectOptions(screen.getByLabelText("足す要件"), "FR-005");
    await userEvent.click(screen.getByRole("button", { name: "対象に足す" }));
    await userEvent.type(screen.getByLabelText("FR-005 の変更後の案"), "5件まで添付できる");
    await userEvent.click(screen.getByRole("button", { name: "下書きで作る" }));

    expect(screen.getByText("3件まで添付できる")).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "上限を5件に",
        baseline_number: 2,
        targets: [{ requirement_id: "FR-005", kind: "content", proposed_text: "5件まで添付できる" }],
      }),
    );
  });

  it("削除にすると案の欄を出さず、選んだ要件は足す候補から消える", async () => {
    renderForm();

    await userEvent.selectOptions(screen.getByLabelText("足す要件"), "FR-001");
    await userEvent.click(screen.getByRole("button", { name: "対象に足す" }));
    await userEvent.selectOptions(screen.getByLabelText("FR-001 の変更の種類"), "delete");

    expect(screen.queryByLabelText("FR-001 の変更後の案")).not.toBeInTheDocument();
    expect(screen.getByText("(削除)")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /FR-001/ })).not.toBeInTheDocument();
  });

  // Phase-88(完了後の調整)：更新
  // it("基準の束を変えると対象を空にして知らせる。編集では束を選べない", async () => {
  //   const { onBaselineChange } = renderForm();
  //
  //   await userEvent.selectOptions(screen.getByLabelText("基準の合意済みの版"), "1");
  //
  //   expect(onBaselineChange).toHaveBeenCalledWith(1);
  // });
  //
  // it("編集(束なし)では基準の束の欄を出さない", () => {
  //   renderForm({ baselines: undefined, submitLabel: "直す" });
  // ↓↓
  // Phase-98-2:追記
  it("「新しい要件を足す」にしたときだけ起点の欄を出し、選んだ起点を送る", async () => {
    const { onSubmit } = renderForm({ initial: { ...emptyForm(2), title: "t", content: "c" } });

    expect(screen.queryByLabelText("足す起点")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.selectOptions(screen.getByLabelText("足す起点"), "screen:SCR-004");
    await userEvent.click(screen.getByRole("button", { name: "起点に足す" }));

    expect(screen.getByText("画面: SCR-004 チャットヒアリング画面")).toBeInTheDocument();
    // 選んだ起点は候補から消える
    expect(screen.queryByRole("option", { name: "画面: SCR-004 チャットヒアリング画面" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "下書きで作る" }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ adds_requirement: true, origins: ["screen:SCR-004"] });
  });

  // Phase-109-2:追記
  it("画面にも API にも出ない処理も起点に選べる", async () => {
    renderForm({ initial: { ...emptyForm(2), title: "t", content: "c", adds_requirement: true } });

    await userEvent.selectOptions(screen.getByLabelText("足す起点"), "fn:F-07");
    await userEvent.click(screen.getByRole("button", { name: "起点に足す" }));

    expect(screen.getByText("処理: F-07 毎朝の集計")).toBeInTheDocument();
  });

  it("起点を外せる", async () => {
    renderForm({ initial: { ...emptyForm(2), adds_requirement: true, origins: ["req:FR-001"] } });

    expect(screen.getByText("要件: FR-001 ログインできる")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "FR-001 ログインできる を起点から外す" }));

    expect(screen.queryByRole("button", { name: "FR-001 ログインできる を起点から外す" })).not.toBeInTheDocument();
    // 外した起点は候補に戻る
    expect(screen.getByRole("option", { name: "要件: FR-001 ログインできる" })).toBeInTheDocument();
  });

  it("基準の束の欄は出さない(作成では遷移元の束に固定、編集では変えない)", () => {
    renderForm({ submitLabel: "直す" });

    expect(screen.queryByLabelText("基準の合意済みの版")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "直す" })).toBeInTheDocument();
  });
});

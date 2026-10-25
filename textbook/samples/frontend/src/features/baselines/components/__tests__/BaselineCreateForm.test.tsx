// 作成：Phase-88-3｜更新：Phase-107-2
// SUT: BaselineCreateForm(束の作成のフォーム)
// ドライバ: Testing Library(描画・入力・クリック)
// スタブ: onSubmit・onCancel(vi.fn)── フォームが組み立てて渡す本文だけを見るため(作成はストアのテスト)
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BaselineCreateForm } from "../BaselineCreateForm";
import { makeChangeRequest } from "@/features/change-requests/test-utils/changeRequestFixtures";
import { renderWithTheme } from "@/features/change-requests/test-utils/renderWithStore";
import type { DesignStageRead } from "@/features/detailed-design/api/types";

const CANDIDATES = [
  makeChangeRequest({
    number: 1,
    label: "CR-1",
    title: "参考資料を5件まで",
    status: "verified",
    // Phase-107-2：更新
    // decision: { counterpart: "山田(発注者)", decided_at: "2026-10-19T01:00:00Z", memo: "定例", reason: "上限を上げる", recorded_by: "u1" },
    // ↓↓
    decision: { counterpart: "山田(発注者)", decided_at: "2026-10-19T01:00:00Z", memo: "定例", reason: "上限を上げる", recorded_by: "u1", option: null, source: null, source_label: null, fingerprint: null },
  }),
  makeChangeRequest({
    number: 3,
    label: "CR-3",
    title: "画面を足す",
    status: "verified",
    // Phase-107-2：更新
    // decision: { counterpart: null, decided_at: "2026-10-19T02:00:00Z", memo: "", reason: "画面を足す", recorded_by: "u1" },
    // ↓↓
    decision: { counterpart: null, decided_at: "2026-10-19T02:00:00Z", memo: "", reason: "画面を足す", recorded_by: "u1", option: null, source: null, source_label: null, fingerprint: null },
  }),
];
const stage = (n: number, overrides: Partial<DesignStageRead> = {}) =>
  ({ stage: n, state: "approved", approved_version: 1, generation_status: null, ...overrides }) as DesignStageRead;

function renderForm(props: Partial<Parameters<typeof BaselineCreateForm>[0]> = {}) {
  const onSubmit = vi.fn();
  renderWithTheme(
    <BaselineCreateForm
      candidates={CANDIDATES}
      stages={[stage(1), stage(2, { state: "draft", approved_version: null })]}
      submitting={false}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      {...props}
    />,
  );
  return { onSubmit };
}

describe("BaselineCreateForm", () => {
  it("CR を選ぶと合意の記録の初期値が入り、選んだ番号と一緒に送る", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByRole("checkbox", { name: /CR-1/ }));
    await user.click(screen.getByRole("checkbox", { name: /CR-3/ }));

    expect(screen.getByLabelText(/相手/)).toHaveValue("山田(発注者)");
    expect(screen.getByLabelText("理由")).toHaveValue("CR-1: 上限を上げる\nCR-3: 画面を足す");
    await user.click(screen.getByRole("button", { name: "合意済みの版を作る" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ counterpart: "山田(発注者)", memo: "CR-1: 定例", change_request_numbers: [1, 3] }),
    );
  });

  it("手で直した欄は、選択を変えても上書きしない", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("理由"), "まとめて合意");
    await user.click(screen.getByRole("checkbox", { name: /CR-1/ }));

    expect(screen.getByLabelText("理由")).toHaveValue("まとめて合意");
    expect(screen.getByLabelText(/相手/)).toHaveValue("山田(発注者)");
  });

  it("入る段階・入らない段階を示し、理由が無い・段階の生成中は作れない", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ stages: [stage(1, { generation_status: "generating" })] });

    expect(screen.getByRole("table", { name: "束に入る段階" })).toHaveTextContent("入る(承認の写し)");
    expect(screen.getByText(/生成している間/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("理由"), "合意");
    expect(screen.getByRole("button", { name: "合意済みの版を作る" })).toHaveAttribute("aria-disabled", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("入れられる CR が無ければその旨を出し、CR なしで作れる", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ candidates: [] });

    expect(screen.getByText(/入れられる変更要求はありません/)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "束に入る段階" })).toHaveTextContent("入らない");
    await user.type(screen.getByLabelText("理由"), "初版");
    await user.click(screen.getByRole("button", { name: "合意済みの版を作る" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ reason: "初版", change_request_numbers: [] }));
  });
});

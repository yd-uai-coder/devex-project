// 作成：Phase-87-3｜更新：Phase-88-4,107-2
// Phase-88-4：更新
// // SUT: ChangeRequestActions(見出しの操作のボタン)と DecisionDialog(合意・却下の記録)
// ↓↓
// SUT: ChangeRequestActions(見出しの操作のボタン)・ExplanationDownloadButton(説明書のダウンロード)と DecisionDialog(合意・却下の記録)
// ドライバ: Testing Library(クリック・入力)
// スタブ: ストアの操作の関数(vi.fn)・next/navigation の router・説明書の API(vi.mock)・saveFile ──
// ボタンの出し分けと、ダイアログから渡す本文だけを見るため
// Phase-107-2:追記 ── ../../test-utils/changeRequestFixtures.makeOptions
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangeRequestActions } from "../ChangeRequestActions";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeChangeRequest, makeOptions } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const downloadExplanation = vi.fn();
vi.mock("@/features/change-requests/api/changeRequestsApi", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadExplanation: (...args: unknown[]) => downloadExplanation(...args),
}));
const saveFile = vi.fn();
vi.mock("@/lib/api/download", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  saveFile: (...args: unknown[]) => saveFile(...args),
}));

const store = () => useChangeRequestsStore.getState();

describe("ChangeRequestActions", () => {
  beforeEach(() => {
    push.mockReset();
    saveFile.mockReset();
    downloadExplanation.mockReset().mockResolvedValue({ filename: "cr-1-explanation.md", content: "# CR-1" });
    resetChangeRequestsStore();
  });

  it("許された操作のうち、見出しの操作だけをボタンにする(直す・反映はここに出さない)", () => {
    renderWithTheme(
      <ChangeRequestActions projectId="p1" cr={makeChangeRequest({ allowed_actions: ["edit", "explain", "withdraw"] })} />,
    );

    expect(screen.getByRole("button", { name: "説明済みにする" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取り下げる" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "合意を記録する" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /直す/ })).not.toBeInTheDocument();
  });

  it("説明済みは確かめてから記録する", async () => {
    renderWithTheme(<ChangeRequestActions projectId="p1" cr={makeChangeRequest()} />);

    await userEvent.click(screen.getByRole("button", { name: "説明済みにする" }));
    // ダイアログの確かめのボタン(aria-label で見分ける)
    await userEvent.click(await screen.findByLabelText("記録する"));

    expect(store().explain).toHaveBeenCalledWith("p1", 1);
  });

  // Phase-107-2:追記
  it("案のある CR の合意は、案を選ばないと記録せず、選んだ案の番号を送る。却下では案を聞かない", async () => {
    const cr = makeChangeRequest({
      status: "explained",
      allowed_actions: ["edit", "agree", "reject", "withdraw"],
      options: makeOptions(),
    });
    renderWithTheme(<ChangeRequestActions projectId="p1" cr={cr} />);

    await userEvent.click(screen.getByRole("button", { name: "合意を記録する" }));
    await userEvent.type(await screen.findByLabelText("理由"), "定例で合意");
    await userEvent.click(screen.getByLabelText("記録する"));
    expect(await screen.findByText("合意した案を選んでください")).toBeInTheDocument();
    expect(store().decide).not.toHaveBeenCalled();

    expect(screen.getByLabelText("案1 5件まで(おすすめ)")).not.toBeChecked();
    await userEvent.click(screen.getByLabelText("案2 上限なし"));
    await userEvent.click(screen.getByLabelText("記録する"));
    expect(store().decide).toHaveBeenCalledWith("p1", 1, expect.objectContaining({ decision: "agreed", option: 2 }));
  });

  it("案のある CR でも、却下では案を聞かずに送る", async () => {
    const cr = makeChangeRequest({ status: "explained", allowed_actions: ["agree", "reject"], options: makeOptions() });
    renderWithTheme(<ChangeRequestActions projectId="p1" cr={cr} />);

    await userEvent.click(screen.getByRole("button", { name: "却下を記録する" }));
    expect(screen.queryByText("合意した案")).toBeNull();
    await userEvent.type(await screen.findByLabelText("理由"), "見送り");
    await userEvent.click(screen.getByLabelText("記録する"));
    const body = vi.mocked(store().decide).mock.calls[0][2];
    expect(body.decision).toBe("rejected");
    expect(body).not.toHaveProperty("option");
  });

  it("合意は理由が無ければ記録せず、入れると相手の空を null にして送る", async () => {
    renderWithTheme(
      <ChangeRequestActions
        projectId="p1"
        cr={makeChangeRequest({ status: "explained", allowed_actions: ["edit", "agree", "reject", "withdraw"] })}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "合意を記録する" }));
    await userEvent.click(await screen.findByLabelText("記録する"));
    expect(await screen.findByText("理由を入れてください")).toBeInTheDocument();
    expect(store().decide).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("理由"), "定例で合意");
    await userEvent.click(screen.getByLabelText("記録する"));

    expect(store().decide).toHaveBeenCalledWith(
      "p1",
      1,
      expect.objectContaining({ decision: "agreed", counterpart: null, reason: "定例で合意", memo: "" }),
    );
    const body = vi.mocked(store().decide).mock.calls[0][2];
    expect(body.decided_at).toMatch(/Z$/);
  });

  it("却下した CR は写して、写しの先へ移る", async () => {
    vi.mocked(store().copy).mockResolvedValue(makeChangeRequest({ number: 5 }));
    renderWithTheme(
      <ChangeRequestActions projectId="p1" cr={makeChangeRequest({ status: "rejected", allowed_actions: ["copy"] })} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "写して出し直す" }));

    expect(store().copy).toHaveBeenCalledWith("p1", 1);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/p1/change-requests/5"));
  });

  it("取り下げは理由を添えて送る", async () => {
    renderWithTheme(<ChangeRequestActions projectId="p1" cr={makeChangeRequest()} />);

    await userEvent.click(screen.getByRole("button", { name: "取り下げる" }));
    await userEvent.type(await screen.findByLabelText("理由(任意)"), "不要になった");
    await userEvent.click(screen.getByLabelText("取り下げを確定する"));

    expect(store().withdraw).toHaveBeenCalledWith("p1", 1, "不要になった");
  });

  it("説明書はどの状態でもダウンロードできる", async () => {
    renderWithTheme(<ChangeRequestActions projectId="p1" cr={makeChangeRequest({ status: "verified", allowed_actions: [] })} />);

    await userEvent.click(screen.getByRole("button", { name: "説明書をダウンロード(.md)" }));

    await waitFor(() => expect(saveFile).toHaveBeenCalledWith("cr-1-explanation.md", "# CR-1", "text/markdown"));
    expect(downloadExplanation).toHaveBeenCalledWith("p1", 1);
  });
});

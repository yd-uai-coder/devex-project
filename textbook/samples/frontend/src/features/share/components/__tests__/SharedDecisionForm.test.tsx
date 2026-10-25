// 作成：Phase-108-3
// SUT: SharedDecisionForm(案の選択・理由・合意 / 却下と記録の前の確かめ)
// ドライバ: React Testing Library
// スタブ: ストアの decide(seedShareStore で差し替え)── 送る中身と確かめの流れだけを見るため
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { SharedDecisionForm } from "../SharedDecisionForm";
import { makeShared, makeSharedWithOptions } from "../../test-utils/sharedFixtures";
import { renderWithTamagui, seedShareStore } from "../../test-utils/renderShare";

describe("SharedDecisionForm", () => {
  let decide: ReturnType<typeof vi.fn<(input: { decision: "agreed" | "rejected"; option: number | null; reason: string }) => Promise<boolean>>>;

  beforeEach(() => {
    decide = vi.fn(async () => true);
    seedShareStore(makeSharedWithOptions(), { name: "山田", decide });
  });

  it("案とおすすめの印・理由を出し、初めはどの案も選ばない", () => {
    renderWithTamagui(<SharedDecisionForm shared={makeSharedWithOptions()} />);

    expect(screen.getByRole("radiogroup", { name: "合意する案" })).toBeInTheDocument();
    expect(screen.getByText("★ 開発者のおすすめ")).toBeInTheDocument();
    expect(screen.getByText(/おすすめの理由: まず期間だけ/)).toBeInTheDocument();
    expect(screen.getByLabelText("案A 全部の項目で絞り込む")).not.toBeChecked();
    expect(screen.getByLabelText("案B 期間だけで絞り込む")).not.toBeChecked();
  });

  it("案を選ばないと合意を記録しない", () => {
    renderWithTamagui(<SharedDecisionForm shared={makeSharedWithOptions()} />);

    fireEvent.click(screen.getByRole("button", { name: "合意する" }));

    expect(screen.getByRole("alert")).toHaveTextContent("合意する案を選んで");
    expect(screen.queryByText("この変更に合意しますか")).not.toBeInTheDocument();
  });

  it("案を選んで合意すると、確かめてから選んだ案で記録する", async () => {
    renderWithTamagui(<SharedDecisionForm shared={makeSharedWithOptions()} />);

    fireEvent.click(screen.getByLabelText("案B 期間だけで絞り込む"));
    fireEvent.click(screen.getByRole("button", { name: "合意する" }));
    expect(await screen.findByText("この変更に合意しますか")).toBeInTheDocument();
    expect(screen.getByText(/選んだ案: 案B 期間だけで絞り込む/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("合意を記録する"));

    await waitFor(() => expect(decide).toHaveBeenCalledWith({ decision: "agreed", option: 2, reason: "" }));
  });

  it("却下は理由が要る", async () => {
    renderWithTamagui(<SharedDecisionForm shared={makeShared()} />);

    fireEvent.click(screen.getByRole("button", { name: "却下する" }));
    expect(screen.getByRole("alert")).toHaveTextContent("却下の理由");

    fireEvent.change(screen.getByLabelText("判断の理由"), { target: { value: "今は要らない" } });
    fireEvent.click(screen.getByRole("button", { name: "却下する" }));
    fireEvent.click(await screen.findByLabelText("却下を記録する"));

    await waitFor(() =>
      expect(decide).toHaveBeenCalledWith({ decision: "rejected", option: null, reason: "今は要らない" }),
    );
  });

  it("確かめでやめると記録しない", async () => {
    renderWithTamagui(<SharedDecisionForm shared={makeShared()} />);

    fireEvent.click(screen.getByRole("button", { name: "合意する" }));
    fireEvent.click(await screen.findByLabelText("キャンセル"));

    expect(decide).not.toHaveBeenCalled();
  });
});

// 作成：Phase-35-3｜更新：Phase-35(完了後の調整)
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ChoiceCards } from "../ChoiceCards";
import type { HearingCard } from "@/features/hearing/api/hearingApi";

const CARD: HearingCard = {
  id: "c1",
  point_key: "availability",
  label: "可用性",
  question: "夜中に止まっていたら、どのくらいで困りますか",
  options: [
    { label: "半日止まってよい", result: "費用は今のまま" },
    { label: "1時間で戻す", result: "監視が要る" },
  ],
  recommended: 0,
  reason: "個人の規模のため",
  selected: null,
};

function renderCards(props: Partial<Parameters<typeof ChoiceCards>[0]> = {}) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ChoiceCards cards={[CARD]} drafts={{}} {...props} />
    </TamaguiProvider>,
  );
}

describe("ChoiceCards", () => {
  it("問い・選択肢と結果・おすすめと理由を出す", () => {
    renderCards({ onSelect: vi.fn() });

    expect(screen.getByRole("group", { name: "選択肢カード: 可用性" })).toBeInTheDocument();
    expect(screen.getByText("夜中に止まっていたら、どのくらいで困りますか")).toBeInTheDocument();
    expect(screen.getByText("監視が要る")).toBeInTheDocument();
    expect(screen.getByText("おすすめ")).toBeInTheDocument();
    expect(screen.getByText("個人の規模のため")).toBeInTheDocument();
  });

  // Phase-35(完了後の調整)：更新(選択肢はラジオボタン)
  // it("選択肢を押すとonSelect(カードのid, 番号)を呼び、選択中を示す", async () => {
  //   const onSelect = vi.fn();
  //   const user = userEvent.setup();
  //   renderCards({ onSelect, drafts: { c1: 1 } });
  //
  //   await user.click(screen.getByRole("button", { name: /半日止まってよい/ }));
  //
  //   expect(onSelect).toHaveBeenCalledWith("c1", 0);
  //   expect(screen.getByRole("button", { name: /1時間で戻す/ })).toHaveAttribute("aria-pressed", "true");
  // });
  // ↓↓
  it("選択肢はカードの問いを名前にしたラジオボタンで、押すとonSelect(カードのid, 番号)を呼び、選択中はchecked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderCards({ onSelect, drafts: { c1: 1 } });

    expect(screen.getByRole("radiogroup", { name: CARD.question })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /半日止まってよい/ }));

    expect(onSelect).toHaveBeenCalledWith("c1", 0);
    expect(screen.getByRole("radio", { name: /1時間で戻す/ })).toBeChecked();
  });

  it("回答済みのカードは選んだ結果を示し、押せない", () => {
    renderCards({ cards: [{ ...CARD, selected: 1 }], onSelect: vi.fn() });

    expect(screen.getByText("可用性 ── 回答済み")).toBeInTheDocument();
    // Phase-35(完了後の調整)：更新
    // expect(screen.getByRole("button", { name: /1時間で戻す/ })).toHaveAttribute("aria-pressed", "true");
    // expect(screen.getByRole("button", { name: /半日止まってよい/ })).toHaveAttribute("aria-disabled", "true");
    // ↓↓
    expect(screen.getByRole("radio", { name: /1時間で戻す/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /半日止まってよい/ })).toBeDisabled();
  });

  it("onSelectが無い(古い発言の)カードは押せず、送信の案内も出さない", () => {
    renderCards();

    // Phase-35(完了後の調整)：更新
    // expect(screen.getByRole("button", { name: /半日止まってよい/ })).toHaveAttribute("aria-disabled", "true");
    // expect(screen.queryByText(/「送信」で送ります/)).not.toBeInTheDocument();
    // ↓↓
    expect(screen.getByRole("radio", { name: /半日止まってよい/ })).toBeDisabled();
    expect(screen.queryByText(/「この回答を送る」で送ります/)).not.toBeInTheDocument();
  });

  // Phase-35(完了後の調整):追記
  it("カードごとの「この回答を送る」は、選択中のときだけ押せ、onSend(カードのid)を呼ぶ", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    const { rerender } = renderCards({ onSelect: vi.fn(), onSend });

    expect(screen.getByRole("button", { name: "この回答を送る" })).toHaveAttribute("aria-disabled", "true");

    rerender(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <ChoiceCards cards={[CARD]} drafts={{ c1: 0 }} onSelect={vi.fn()} onSend={onSend} />
      </TamaguiProvider>,
    );
    await user.click(screen.getByRole("button", { name: "この回答を送る" }));

    expect(onSend).toHaveBeenCalledWith("c1");
  });

  it("回答済み・読むだけのカードには「この回答を送る」を出さない", () => {
    renderCards({ cards: [{ ...CARD, selected: 0 }], onSelect: vi.fn(), onSend: vi.fn() });

    expect(screen.queryByRole("button", { name: "この回答を送る" })).not.toBeInTheDocument();
  });
});

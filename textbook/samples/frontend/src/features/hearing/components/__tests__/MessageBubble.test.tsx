// 作成：Phase-3-5
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { MessageBubble } from "../MessageBubble";
import type { ChatHistoryEntry } from "@/features/hearing/api/hearingApi";

function renderBubble(message: ChatHistoryEntry) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <MessageBubble message={message} />
    </TamaguiProvider>,
  );
}

describe("MessageBubble", () => {
  it("ユーザーのメッセージは生テキストとして表示する", () => {
    renderBubble({ id: "1", sender: "user", message: "こんにちは", created_at: "" });

    expect(screen.getByText("こんにちは")).toBeInTheDocument();
  });

  it("AI/intakeメッセージの単一改行は<br>で区切って描画される(remark-breaks)", () => {
    const { container } = renderBubble({
      id: "2",
      sender: "intake",
      message: "システム概要：トレンド追跡\n実現したい事：効率化",
      created_at: "",
    });

    // remark-breaksが無いと単一の"\n"は段落内の空白として無視され<br>が生成されない
    expect(container.querySelector("p br")).not.toBeNull();
    expect(container.textContent).toContain("システム概要：トレンド追跡");
    expect(container.textContent).toContain("実現したい事：効率化");
  });
});

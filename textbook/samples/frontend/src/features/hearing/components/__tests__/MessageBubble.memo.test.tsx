// 作成：Phase-35(完了後の調整)
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import type { ChatHistoryEntry } from "@/features/hearing/api/hearingApi";

// SUT: MessageBubble(memo) / ドライバ: 親の描き直し / スタブ: react-markdown(解析の回数を数える)
const markdownRenders = vi.fn();
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => {
    markdownRenders(children);
    return <div>{children}</div>;
  },
}));

import { MessageBubble } from "../MessageBubble";

const MESSAGE: ChatHistoryEntry = { id: "a1", sender: "ai", message: "質問です", created_at: "" };

function Parent({ tick }: { tick: number }) {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <span data-tick={tick} />
      <MessageBubble message={MESSAGE} />
    </TamaguiProvider>
  );
}

describe("MessageBubble(memo)", () => {
  it("同じ発言なら、親が描き直されても Markdown を解析し直さない(カードの選択の反応を速くするため)", () => {
    const { rerender } = render(<Parent tick={0} />);
    rerender(<Parent tick={1} />);
    rerender(<Parent tick={2} />);

    expect(markdownRenders).toHaveBeenCalledTimes(1);
  });
});

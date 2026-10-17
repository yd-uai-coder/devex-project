// 作成：Phase-69-3
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { GenerationFailureNotice } from "../GenerationFailureNotice";

// SUT: GenerationFailureNotice / ドライバ: このテスト / スタブ不要 ── 渡した値を出すだけで外部を呼ばないため。

const FAILURE = {
  reason_code: "LLM_UNAVAILABLE",
  message: "使うAIのAPIキーが設定されていないため、設計書を作れませんでした。",
  targets: ["requirements"],
  failed_at: "2026-10-17T06:00:00Z",
};

function renderNotice(props: Parameters<typeof GenerationFailureNotice>[0]) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <GenerationFailureNotice {...props} />
    </TamaguiProvider>,
  );
}

describe("GenerationFailureNotice", () => {
  it("失敗の見出し・理由・添え書きを alert で出す", () => {
    renderNotice({ failure: FAILURE, note: "下のプレビューは前の版を表示しています。" });

    const alert = screen.getByRole("alert", { name: "生成の失敗" });
    expect(alert).toHaveTextContent("前回の生成は失敗しました");
    expect(alert).toHaveTextContent(FAILURE.message);
    expect(alert).toHaveTextContent("下のプレビューは前の版を表示しています。");
  });

  it("失敗が無ければ何も出さない", () => {
    renderNotice({ failure: null });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// 作成：Phase-78-1
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ProjectNotFoundNotice } from "../ProjectNotFoundNotice";

describe("ProjectNotFoundNotice", () => {
  it("見つからない理由とダッシュボードへのリンクを出す", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <ProjectNotFoundNotice />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("heading", { name: "このプロジェクトは見つかりません" })).toBeInTheDocument();
    expect(screen.getByText("削除された可能性があります。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ダッシュボードへ戻る →" })).toHaveAttribute("href", "/dashboard");
  });
});

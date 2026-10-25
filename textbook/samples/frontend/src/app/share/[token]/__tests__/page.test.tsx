// 作成：Phase-108-1
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SharePage, { metadata } from "../page";

vi.mock("@/features/share/components/SharedChangeRequestPageContent", () => ({
  SharedChangeRequestPageContent: ({ token }: { token: string }) => <div>{`shared ${token}`}</div>,
}));

describe("SharePage", () => {
  it("ログインを求めずに、URL のトークンで共有リンクの画面を出す", async () => {
    render(await SharePage({ params: Promise.resolve({ token: "tok-1" }) }));

    expect(screen.getByText("shared tok-1")).toBeInTheDocument();
  });

  it("検索に載せず、参照元を送らない", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });
});

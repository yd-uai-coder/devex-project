// 作成：Phase-3-3
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ProjectList } from "../ProjectList";
import { useDashboardStore } from "@/features/dashboard/dashboard-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

function renderList() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ProjectList />
    </TamaguiProvider>,
  );
}

describe("ProjectList", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    useDashboardStore.setState({ projects: [], status: "idle", error: null, fetchedAt: null });
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("プロジェクトが無ければ空状態メッセージを表示する", async () => {
    stub.queue({ status: 200, body: [] });
    renderList();

    expect(await screen.findByText(/まだプロジェクトがありません/)).toBeInTheDocument();
  });

  it("プロジェクト一覧を表示し、完了済みはドキュメント画面へのリンクになる", async () => {
    stub.queue({
      status: 200,
      body: [
        {
          id: "p1",
          title: "Project 1",
          status: "interviewing",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "p2",
          title: "Project 2",
          status: "completed",
          created_at: "2026-01-02T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        },
      ],
    });
    renderList();

    expect(await screen.findByText("Project 1")).toBeInTheDocument();
    expect(screen.getByText("Project 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Project 1/ })).toHaveAttribute("href", "/projects/p1/chat");
    expect(screen.getByRole("link", { name: /Project 2/ })).toHaveAttribute(
      "href",
      "/projects/p2/documents",
    );
  });

  it("取得失敗時はエラーメッセージを表示する", async () => {
    stub.queue({ status: 500, body: { detail: "Internal Server Error" } });
    renderList();

    expect(await screen.findByText("Internal Server Error")).toBeInTheDocument();
  });
});

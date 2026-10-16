// 作成：Phase-3-3｜更新：24(完了後の調整),64-4,65-3
// Phase-64-4：更新
// import { afterEach, beforeEach, describe, expect, it } from "vitest";
// import { render, screen } from "@testing-library/react";
// ↓↓
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "../../../../../tamagui.config";
import { ProjectList } from "../ProjectList";
// Phase-65-3:追記
import type { ProjectRead } from "@/features/dashboard/api/projects";
import { useDashboardStore } from "@/features/dashboard/dashboard-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

// Phase-64-4:追記
vi.mock("@tamagui/toast", () => ({ useToastController: () => ({ show: vi.fn() }) }));

// Phase-65-3:追記
// URL のクエリはテストごとに差し替える(push・replace は呼ばれた先だけを記録する)。
// useSearchParams は、Next.js と同じく URL が変わらない限り同じオブジェクトを返す
// (描画のたびに作り直すと、条件が変わったとみなして取り直し続けるため)。
const navigation = vi.hoisted(() => {
  const state = {
    search: "",
    params: new URLSearchParams(),
    push: vi.fn(),
    replace: vi.fn(),
    setSearch(search: string) {
      state.search = search;
      state.params = new URLSearchParams(search);
    },
  };
  return state;
});
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  useSearchParams: () => navigation.params,
}));

function project(id: string, title: string, overrides: Partial<ProjectRead> = {}): ProjectRead {
  return {
    id,
    title,
    status: "interviewing",
    mode: "simple",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderList() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ProjectList />
    </TamaguiProvider>,
  );
}

// Phase-65-3:追記
// 送った一覧の取得のパスとクエリ
const listRequests = (stub: ReturnType<typeof stubFetch>) =>
  stub.requests
    .filter((r) => (r.init?.method ?? "GET") === "GET")
    .map((r) => r.url.replace(/^.*(?=\/api\/)/, ""));

describe("ProjectList", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    // Phase-65-3：更新
    // useDashboardStore.setState({ projects: [], status: "idle", error: null, fetchedAt: null });
    // ↓↓
    useDashboardStore.setState({
      items: [],
      total: 0,
      status: "idle",
      error: null,
      key: null,
      fetchedAt: null,
    });
    navigation.setSearch("");
    navigation.push.mockClear();
    navigation.replace.mockClear();
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("プロジェクトが無ければ空状態メッセージを表示する", async () => {
    // Phase-65-3：更新
    // stub.queue({ status: 200, body: [] });
    // ↓↓
    stub.queue({ status: 200, body: { items: [], total: 0 } });
    renderList();

    expect(await screen.findByText(/まだプロジェクトがありません/)).toBeInTheDocument();
    // Phase-65-3:追記
    expect(listRequests(stub)).toEqual(["/api/v1/projects"]);
  });

  it("プロジェクト一覧を表示し、完了済みはドキュメント画面へのリンクになる", async () => {
    stub.queue({
      status: 200,
      // Phase-65-3：更新
      // body: [
      //   {
      //     id: "p1",
      //     title: "Project 1",
      //     status: "interviewing",
      //     mode: "simple",
      //     created_at: "2026-01-01T00:00:00Z",
      //     updated_at: "2026-01-01T00:00:00Z",
      //   },
      //   {
      //     id: "p2",
      //     title: "Project 2",
      //     status: "completed",
      //     mode: "detailed",
      //     created_at: "2026-01-02T00:00:00Z",
      //     updated_at: "2026-01-02T00:00:00Z",
      //   },
      // ],
      // ↓↓
      body: {
        items: [
          project("p1", "Project 1"),
          project("p2", "Project 2", { status: "completed", mode: "detailed" }),
        ],
        total: 2,
      },
    });
    renderList();

    expect(await screen.findByText("Project 1")).toBeInTheDocument();
    expect(screen.getByText("Project 2")).toBeInTheDocument();
    // Phase-24:追記
    // 作成時のモードを短いバッジで見分ける
    expect(screen.getByText("簡易")).toBeInTheDocument();
    expect(screen.getByText("詳細")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Project 1/ })).toHaveAttribute("href", "/projects/p1/chat");
    expect(screen.getByRole("link", { name: /Project 2/ })).toHaveAttribute(
      "href",
      "/projects/p2/documents",
    );
    // Phase-65-3:追記
    // 1ページに収まるときはページ送りを出さない
    expect(screen.queryByText(/ページ\(全/)).not.toBeInTheDocument();
  });

  // Phase-64-4:追記
  // Phase-65-3：更新
  // it("カードの削除ボタンはリンクの外にあり、確認してから削除してカードを外す", async () => {
  // ↓↓
  it("URL の条件で一覧を取り、条件に合うものが無ければその旨を出す", async () => {
    navigation.setSearch("q=予約&status=completed&status=interviewing&page=1");
    stub.queue({ status: 200, body: { items: [], total: 0 } });
    renderList();

    expect(await screen.findByText("条件に合うプロジェクトはありません。")).toBeInTheDocument();
    expect(listRequests(stub)).toEqual([
      "/api/v1/projects?q=%E4%BA%88%E7%B4%84&status=interviewing&status=completed",
    ]);
    expect(screen.getByLabelText("タイトルで検索")).toHaveValue("予約");
  });

  it("条件の変更は URL へ push し、ページを1に戻す", async () => {
    const user = userEvent.setup();
    navigation.setSearch("page=2");
    stub.queue({ status: 200, body: { items: [project("p11", "P11")], total: 11 } });
    renderList();
    await screen.findByText("P11");

    await user.click(screen.getByRole("checkbox", { name: "完了" }));

    expect(navigation.push).toHaveBeenLastCalledWith("/dashboard?status=completed");
  });

  it("11件以上ならページ送りを出し、次へで次のページの URL へ移る", async () => {
    const user = userEvent.setup();
    stub.queue({ status: 200, body: { items: [project("p1", "P1")], total: 11 } });
    renderList();

    expect(await screen.findByText("1 / 2 ページ(全11件)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "次へ" }));

    expect(navigation.push).toHaveBeenLastCalledWith("/dashboard?page=2");
  });

  it("最後のページより後を開いたら、最後のページへ置き換える", async () => {
    navigation.setSearch("page=5");
    stub.queue({ status: 200, body: { items: [], total: 12 } });
    renderList();

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/dashboard?page=2"));
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("カードの削除ボタンはリンクの外にあり、確認してから削除してカードを外し、今のページを取り直す", async () => {
    const user = userEvent.setup();
    stub.queue({
      status: 200,
      // Phase-65-3：更新
      // body: [
      //   {
      //     id: "p1",
      //     title: "Project 1",
      //     status: "generating",
      //     mode: "simple",
      //     created_at: "2026-01-01T00:00:00Z",
      //     updated_at: "2026-01-01T00:00:00Z",
      //   },
      // ],
      // ↓↓
      body: { items: [project("p1", "Project 1", { status: "generating" })], total: 1 },
    });
    renderList();

    const button = await screen.findByRole("button", { name: "「Project 1」を削除" });
    expect(screen.getByRole("link", { name: /Project 1/ })).not.toContainElement(button);

    await user.click(button);
    // 押すと確認のダイアログが開き、まだ削除の API を呼ばない(一覧の取得の1回だけ)
    expect(screen.getByText("プロジェクトを削除しますか")).toBeInTheDocument();
    expect(stub.requests).toHaveLength(1);

    // Phase-65-3:追記
    stub.queue({ status: 200, body: {} }); // DELETE
    stub.queue({ status: 200, body: { items: [], total: 0 } }); // 取り直し
    await user.click(screen.getByLabelText("削除する"));

    await waitFor(() => expect(screen.queryByText("Project 1")).not.toBeInTheDocument());
    // Phase-65-3：更新
    // expect(stub.requests.map((r) => r.init?.method ?? "GET")).toEqual(["GET", "DELETE"]);
    // ↓↓
    await waitFor(() =>
      expect(stub.requests.map((r) => r.init?.method ?? "GET")).toEqual(["GET", "DELETE", "GET"]),
    );
  });

  it("取得失敗時はエラーメッセージを表示する", async () => {
    stub.queue({ status: 500, body: { detail: "Internal Server Error" } });
    renderList();

    expect(await screen.findByText("Internal Server Error")).toBeInTheDocument();
  });
});

// 作成：Phase-64-3｜更新：Phase-65-2
// SUT: DeleteProjectButton(確認のアラートダイアログ → deleteProject → 一覧から外す・トースト・onDeleted)
// ドライバ: 各テスト(ユーザーの操作)
// スタブ: fetch(stubFetch。削除の API の応答)と、トーストの useToastController(vi.mock。表示ではなく
// 呼ばれたことを見る。表示は AppToast.test.tsx)。
// 一覧のストア(useDashboardStore)は本物を使う(外れることそのものが検証対象のため)。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { useDashboardStore } from "@/features/dashboard/dashboard-store";
import { DeleteProjectButton } from "../DeleteProjectButton";

const { toastShow } = vi.hoisted(() => ({ toastShow: vi.fn() }));
vi.mock("@tamagui/toast", () => ({ useToastController: () => ({ show: toastShow }) }));

const PROJECT = {
  id: "p1",
  title: "備品予約",
  status: "generating" as const,
  mode: "simple" as const,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function renderButton(variant: "icon" | "text" = "icon") {
  const onDeleted = vi.fn();
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DeleteProjectButton
        projectId={PROJECT.id}
        title={PROJECT.title}
        variant={variant}
        onDeleted={onDeleted}
      />
    </TamaguiProvider>,
  );
  return { onDeleted };
}

describe("DeleteProjectButton", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
    toastShow.mockClear();
    // Phase-65-2：更新
    // useDashboardStore.setState({ projects: [PROJECT], status: "success" });
    // ↓↓
    useDashboardStore.setState({ items: [PROJECT], total: 1, status: "success" });
  });

  afterEach(() => {
    stub.restore();
  });

  it("ゴミ箱を押すと確認のダイアログを開き、まだ API を呼ばない。キャンセルで閉じる", async () => {
    const user = userEvent.setup();
    renderButton("icon");

    await user.click(screen.getByRole("button", { name: "「備品予約」を削除" }));

    expect(screen.getByText("プロジェクトを削除しますか")).toBeInTheDocument();
    expect(screen.getByText(/「備品予約」と、そのチャット・文書/)).toBeInTheDocument();
    expect(stub.requests).toHaveLength(0);

    await user.click(screen.getByLabelText("キャンセル"));

    await waitFor(() =>
      expect(screen.queryByText("プロジェクトを削除しますか")).not.toBeInTheDocument(),
    );
    expect(stub.requests).toHaveLength(0);
  });

  it("「削除する」で API を呼び、一覧から外してトーストで知らせ、onDeleted を呼ぶ", async () => {
    const user = userEvent.setup();
    const { onDeleted } = renderButton("text");

    await user.click(screen.getByRole("button", { name: "削除" }));
    await user.click(screen.getByLabelText("削除する"));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(stub.requests.map((r) => r.init?.method)).toEqual(["DELETE"]);
    // Phase-65-2：更新
    // expect(useDashboardStore.getState().projects).toEqual([]);
    // ↓↓
    expect(useDashboardStore.getState().items).toEqual([]);
    expect(toastShow).toHaveBeenCalledWith("「備品予約」を削除しました");
  });

  it("すでに消えていた(404)ときも、削除できたときと同じに扱う", async () => {
    const user = userEvent.setup();
    stub.queue({ status: 404, body: { detail: "Project not found", code: "RESOURCE_NOT_FOUND" } });
    const { onDeleted } = renderButton();

    await user.click(screen.getByRole("button", { name: "「備品予約」を削除" }));
    await user.click(screen.getByLabelText("削除する"));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    // Phase-65-2：更新
    // expect(useDashboardStore.getState().projects).toEqual([]);
    // ↓↓
    expect(useDashboardStore.getState().items).toEqual([]);
    expect(toastShow).toHaveBeenCalledTimes(1);
  });

  it("名前を渡さない画面では「このプロジェクト」と書く", async () => {
    const user = userEvent.setup();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <DeleteProjectButton projectId={PROJECT.id} />
      </TamaguiProvider>,
    );

    await user.click(screen.getByRole("button", { name: "削除" }));
    expect(screen.getByText(/^このプロジェクトと、そのチャット・文書/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("削除する"));

    await waitFor(() => expect(toastShow).toHaveBeenCalledWith("このプロジェクトを削除しました"));
  });

  it("それ以外の失敗は、ダイアログを開いたまま中に出す", async () => {
    const user = userEvent.setup();
    stub.queue({ status: 500, body: { detail: "サーバーで問題が起きました" } });
    const { onDeleted } = renderButton();

    await user.click(screen.getByRole("button", { name: "「備品予約」を削除" }));
    await user.click(screen.getByLabelText("削除する"));

    expect(await screen.findByText("サーバーで問題が起きました")).toBeInTheDocument();
    expect(screen.getByText("プロジェクトを削除しますか")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    // Phase-65-2：更新
    // expect(useDashboardStore.getState().projects).toEqual([PROJECT]);
    // ↓↓
    expect(useDashboardStore.getState().items).toEqual([PROJECT]);
    expect(toastShow).not.toHaveBeenCalled();
  });
});

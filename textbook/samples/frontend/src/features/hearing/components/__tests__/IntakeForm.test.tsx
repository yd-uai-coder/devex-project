// 作成：Phase-3-4
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { IntakeForm } from "../IntakeForm";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function renderForm() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <IntakeForm />
    </TamaguiProvider>,
  );
}

describe("IntakeForm", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    push.mockClear();
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("必須項目が空欄だとバリデーションエラーを表示し、APIを呼ばない", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "ヒアリングを始める" }));

    expect(await screen.findByText("システム概要を入力してください")).toBeInTheDocument();
    expect(stub.requests).toHaveLength(0);
  });

  // 複数フィールドの入力・チェックボックス操作・ファイル添付をひとつづきに行うため、
  // フルスイート実行時の負荷次第では既定の5秒タイムアウトを超えることがある。
  it("必須項目+環境設定+添付ファイルを含めて送信し、作成後にチャット画面へ遷移する", async () => {
    stub.queue({
      status: 201,
      body: {
        id: "p1",
        title: "自動生成タイトル",
        status: "interviewing",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("システム概要"), "備品予約を一元管理したい");
    await user.type(screen.getByLabelText("実現したいこと"), "重複予約を防ぎたい");

    // 環境設定は初期状態で折りたたまれているため、開いてから選択する
    await user.click(screen.getByText("環境設定(任意・未入力の場合はAIにおまかせします)"));
    await user.click(screen.getByRole("checkbox", { name: "Python" }));
    await user.click(screen.getByRole("checkbox", { name: "FastAPI" }));

    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    await user.upload(screen.getByLabelText(/参考資料/), file);

    await user.click(screen.getByRole("button", { name: "ヒアリングを始める" }));

    await vi.waitFor(() => expect(stub.requests).toHaveLength(1));
    const body = stub.requests[0].init?.body as FormData;
    expect(body.get("system_overview")).toBe("備品予約を一元管理したい");
    expect(body.get("goals_raw")).toBe("重複予約を防ぎたい");
    expect(JSON.parse(body.get("environment") as string)).toEqual({
      languages: ["python"],
      frameworks: ["fastapi"],
      databases: [],
      deploy_targets: [],
    });
    expect(body.getAll("files")).toHaveLength(1);

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/projects/p1/chat"));
  }, 15000);
});

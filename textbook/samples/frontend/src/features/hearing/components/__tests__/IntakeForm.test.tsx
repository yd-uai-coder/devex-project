// 作成：Phase-3-4｜更新：Phase-6-4,15-7,24(ゴール3後の調整)
// Phase-24:追記 ── @/features/hearing/schemas.PROJECT_NAME_MAX_LENGTH
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { IntakeForm } from "../IntakeForm";
import { PROJECT_NAME_MAX_LENGTH } from "@/features/hearing/schemas";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// Phase-15-7：更新
// function renderForm() {
// ↓↓
function renderForm(mode?: "simple" | "detailed") {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {/* Phase-15-7：更新
      <IntakeForm />
          ↓↓ */}
      <IntakeForm mode={mode} />
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
    stub.queue({ status: 200, body: [] }); // テンプレート一覧(マウント時に取得)
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "ヒアリングを始める" }));

    // Phase-24:追記
    expect(await screen.findByText("プロジェクト名を入力してください")).toBeInTheDocument();
    expect(await screen.findByText("システム概要を入力してください")).toBeInTheDocument();
    // テンプレート一覧取得の1件のみ(プロジェクト作成は呼ばれない)
    expect(stub.requests).toHaveLength(1);
  });

  // 複数フィールドの入力・チェックボックス操作・ファイル添付をひとつづきに行うため、
  // フルスイート実行時の負荷次第では既定の5秒タイムアウトを超えることがある。
  it("必須項目+環境設定+添付ファイルを含めて送信し、作成後にチャット画面へ遷移する", async () => {
    stub.queue({ status: 200, body: [] }); // テンプレート一覧(マウント時に取得)
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

    // Phase-24:追記
    await user.type(screen.getByLabelText("プロジェクト名"), "備品予約");
    await user.type(screen.getByLabelText("システム概要"), "備品予約を一元管理したい");
    await user.type(screen.getByLabelText("実現したいこと"), "重複予約を防ぎたい");

    // 環境設定は初期状態で折りたたまれているため、開いてから選択する
    await user.click(screen.getByText("環境設定(任意・未入力の場合はAIにおまかせします)"));
    await user.click(screen.getByRole("checkbox", { name: "Python" }));
    await user.click(screen.getByRole("checkbox", { name: "FastAPI" }));

    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    await user.upload(screen.getByLabelText(/参考資料/), file);

    await user.click(screen.getByRole("button", { name: "ヒアリングを始める" }));

    await vi.waitFor(() => expect(stub.requests).toHaveLength(2));
    const body = stub.requests[1].init?.body as FormData;
    // Phase-24:追記
    expect(body.get("name")).toBe("備品予約");
    expect(body.get("system_overview")).toBe("備品予約を一元管理したい");
    expect(body.get("goals_raw")).toBe("重複予約を防ぎたい");
    expect(JSON.parse(body.get("environment") as string)).toEqual({
      languages: ["python"],
      frameworks: ["fastapi"],
      databases: [],
      deploy_targets: [],
    });
    expect(body.getAll("files")).toHaveLength(1);
    // Phase-15-7:追記
    // mode を渡さなければ簡易ドキュメントモードで作成する
    expect(body.get("mode")).toBe("simple");

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/projects/p1/chat"));
  // Phase-15-7:追記
  }, 15000);

  // Phase-24:追記
  it("プロジェクト名が40文字を超えるとバリデーションエラーを表示し、APIを呼ばない", async () => {
    stub.queue({ status: 200, body: [] }); // テンプレート一覧(マウント時に取得)
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("プロジェクト名"), "あ".repeat(PROJECT_NAME_MAX_LENGTH + 1));
    await user.type(screen.getByLabelText("システム概要"), "備品予約");
    await user.type(screen.getByLabelText("実現したいこと"), "重複を防ぐ");
    await user.click(screen.getByRole("button", { name: "ヒアリングを始める" }));

    expect(await screen.findByText(/プロジェクト名は40文字/)).toBeInTheDocument();
    expect(stub.requests).toHaveLength(1);
  }, 15000);

  it("mode=detailedを渡すと、詳細設計モードでプロジェクトを作成する", async () => {
    stub.queue({ status: 200, body: [] }); // テンプレート一覧(マウント時に取得)
    stub.queue({ status: 201, body: { id: "p2", title: "t", status: "interviewing", mode: "detailed" } });
    const user = userEvent.setup();
    renderForm("detailed");

    // Phase-24:追記
    await user.type(screen.getByLabelText("プロジェクト名"), "備品予約");
    await user.type(screen.getByLabelText("システム概要"), "備品予約");
    await user.type(screen.getByLabelText("実現したいこと"), "重複を防ぐ");
    await user.click(screen.getByRole("button", { name: "ヒアリングを始める" }));

    await vi.waitFor(() => expect(stub.requests).toHaveLength(2));
    const body = stub.requests[1].init?.body as FormData;
    expect(body.get("mode")).toBe("detailed");
  }, 15000);

  it("テンプレートを選択すると環境設定にプリフィルされ、template_idが送信される", async () => {
    stub.queue({
      status: 200,
      body: [
        {
          id: "t1",
          name: "Webアプリケーション標準",
          target_type: "Web",
          system_prompt: "x",
          default_environment: {
            languages: ["python"],
            frameworks: ["fastapi"],
            databases: ["postgresql"],
            deploy_targets: [],
          },
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
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

    // Phase-24:追記
    await user.type(screen.getByLabelText("プロジェクト名"), "備品予約");
    await user.type(screen.getByLabelText("システム概要"), "備品予約を一元管理したい");
    await user.type(screen.getByLabelText("実現したいこと"), "重複予約を防ぎたい");
    await user.click(await screen.findByRole("radio", { name: /Webアプリケーション標準/ }));

    // テンプレート選択で環境設定セクションが自動展開され、プリフィル済みであることを確認する
    expect(screen.getByRole("checkbox", { name: "Python" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "FastAPI" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "PostgreSQL" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "ヒアリングを始める" }));

    await vi.waitFor(() => expect(stub.requests).toHaveLength(2));
    const body = stub.requests[1].init?.body as FormData;
    expect(body.get("template_id")).toBe("t1");
    expect(JSON.parse(body.get("environment") as string)).toEqual({
      languages: ["python"],
      frameworks: ["fastapi"],
      databases: ["postgresql"],
      deploy_targets: [],
    });
  });
});

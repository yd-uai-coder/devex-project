// 作成：Phase-66-3
// SUT: AccountSection(今の値を読み、3つのフォームを並べる)と UserNameForm(ユーザーネームの変更)
// ドライバ: 各テスト(描画とユーザーの操作)
// スタブ: fetch(stubFetch。GET /users/me と PATCH の応答)と、トーストの useToastController(vi.mock。
// 呼ばれたことを見る)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { AccountSection } from "../AccountSection";

const { toastShow } = vi.hoisted(() => ({ toastShow: vi.fn() }));
vi.mock("@tamagui/toast", () => ({ useToastController: () => ({ show: toastShow }) }));

const ACCOUNT = { id: "u1", email: "gil@example.com", user_name: "Gil" };

function renderSection() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AccountSection />
    </TamaguiProvider>,
  );
}

describe("AccountSection", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
    toastShow.mockClear();
  });

  afterEach(() => {
    stub.restore();
  });

  it("今のユーザーネームとメールを出し、3つのフォームを並べる", async () => {
    stub.queue({ body: ACCOUNT });
    renderSection();

    expect(await screen.findByDisplayValue("Gil")).toBeInTheDocument();
    expect(screen.getByText("今のメールアドレス: gil@example.com")).toBeInTheDocument();
    for (const name of ["ユーザーネームを変える", "メールアドレスを変える", "パスワードを変える"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("ユーザーネームを保存して、トーストで知らせる", async () => {
    stub.queue({ body: ACCOUNT });
    stub.queue({ body: { ...ACCOUNT, user_name: "ギル" } });
    const user = userEvent.setup();
    renderSection();

    const input = await screen.findByDisplayValue("Gil");
    await user.clear(input);
    await user.type(input, "ギル");
    await user.click(screen.getByRole("button", { name: "ユーザーネームを変える" }));

    await vi.waitFor(() => expect(toastShow).toHaveBeenCalledWith("ユーザーネームを変えました"));
    expect(stub.requests[1].init?.method).toBe("PATCH");
    expect(JSON.parse(stub.requests[1].init?.body as string)).toEqual({ user_name: "ギル" });
  });

  it("空のユーザーネームは API を呼ばずに欄のエラーを出す", async () => {
    stub.queue({ body: ACCOUNT });
    const user = userEvent.setup();
    renderSection();

    await user.clear(await screen.findByDisplayValue("Gil"));
    await user.click(screen.getByRole("button", { name: "ユーザーネームを変える" }));

    expect(await screen.findByText("ユーザーネームを入力してください")).toBeInTheDocument();
    expect(stub.requests).toHaveLength(1);
  });

  it("読み込みに失敗したら知らせる", async () => {
    stub.queue({ status: 500, body: { detail: "boom" } });
    renderSection();

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});

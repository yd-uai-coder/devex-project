// 作成：Phase-66-3｜更新：Phase-77-1,77-2
// Phase-77-2：更新
// // SUT: AccountSection(今の値を読み、3つのフォームを並べる)と UserNameForm(ユーザーネームの変更)
// ↓↓
// SUT: AccountSection(今の値を読み、パスワードの有無でフォームを出し分け、Google の連携の枠を置く)と
// UserNameForm(ユーザーネームの変更)。パスワードの設定から表示の切り替え(連携の解除が出る)までは、
// PasswordSetForm と GoogleLinkSection も通して確かめる
// ドライバ: 各テスト(描画とユーザーの操作)
// Phase-77-1：更新
// // スタブ: fetch(stubFetch。GET /users/me と PATCH の応答)と、トーストの useToastController(vi.mock。
// ↓↓
// スタブ: fetch(stubFetch。GET /users/me・PATCH・POST /users/me/password の応答)と、トーストの useToastController(vi.mock。
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

// Phase-77-1：更新
// const ACCOUNT = { id: "u1", email: "gil@example.com", user_name: "Gil" };
// ↓↓
const ACCOUNT = { id: "u1", email: "gil@example.com", user_name: "Gil", has_password: true, google_linked: false };
const GOOGLE_ONLY = { ...ACCOUNT, has_password: false, google_linked: true };

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

  // Phase-77-1:追記
  it("パスワードの無い人には、変更の代わりに設定を出し、メールの変更を出さない", async () => {
    stub.queue({ body: GOOGLE_ONLY });
    renderSection();

    expect(await screen.findByRole("button", { name: "パスワードを設定する" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "パスワードを変える" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "メールアドレスを変える" })).not.toBeInTheDocument();
    // Phase-77-2:追記
    expect(screen.getByText("Google の連携")).toBeInTheDocument();
  });

  it("パスワードを設定したら、読み直さずにメールの変更とパスワードの変更を出す", async () => {
    stub.queue({ body: GOOGLE_ONLY });
    stub.queue({ body: { access_token: "new.token.sig", token_type: "bearer" } });
    const user = userEvent.setup();
    renderSection();

    await user.type(await screen.findByLabelText("新しいパスワード"), "New-pass-02");
    await user.type(screen.getByLabelText("新しいパスワード(確認)"), "New-pass-02");
    await user.click(screen.getByRole("button", { name: "パスワードを設定する" }));

    expect(await screen.findByRole("button", { name: "メールアドレスを変える" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "パスワードを変える" })).toBeInTheDocument();
    // Phase-77-2:追記
    expect(screen.getByRole("button", { name: "連携を解除する" })).toBeInTheDocument();
    expect(stub.requests).toHaveLength(2);
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

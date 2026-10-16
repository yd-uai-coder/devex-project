// 作成：Phase-66-3
// SUT: PasswordForm(パスワードを変え、返った access をストアに入れ直す)
// ドライバ: 各テスト(ユーザーの操作)
// スタブ: fetch(stubFetch。PUT /users/me/password の応答)と、トーストの useToastController(vi.mock)。
// 認証のストア(useAuthStore)は本物を使う(入れ直されることそのものが検証対象のため)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { useAuthStore } from "@/components/auth/auth-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { PasswordForm } from "../PasswordForm";

const { toastShow } = vi.hoisted(() => ({ toastShow: vi.fn() }));
vi.mock("@tamagui/toast", () => ({ useToastController: () => ({ show: toastShow }) }));

function renderForm() {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <PasswordForm />
    </TamaguiProvider>,
  );
}

async function fillAndSubmit(current: string, next: string, confirm = next) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("今のパスワード"), current);
  await user.type(screen.getByLabelText("新しいパスワード"), next);
  await user.type(screen.getByLabelText("新しいパスワード(確認)"), confirm);
  await user.click(screen.getByRole("button", { name: "パスワードを変える" }));
}

describe("PasswordForm", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
    toastShow.mockClear();
    useAuthStore.setState({ accessToken: "old.token.sig", status: "success", error: null });
  });

  afterEach(() => {
    stub.restore();
    useAuthStore.setState({ accessToken: null, status: "idle", error: null });
  });

  it("変えたら返った access をストアに入れ直し、ほかの端末が切れたことを知らせる", async () => {
    stub.queue({ body: { access_token: "new.token.sig", token_type: "bearer" } });
    renderForm();

    await fillAndSubmit("Old-pass-01", "New-pass-02");

    await vi.waitFor(() => expect(useAuthStore.getState().accessToken).toBe("new.token.sig"));
    expect(toastShow).toHaveBeenCalledWith("パスワードを変えました", { message: "ほかの端末のログインは切れました" });
    expect(screen.getByLabelText("今のパスワード")).toHaveValue("");
  });

  it("今のパスワードの不一致(400)は、今のパスワードの欄のエラーにし、ストアは変えない", async () => {
    stub.queue({ status: 400, body: { detail: "mismatch", code: "CURRENT_PASSWORD_MISMATCH" } });
    renderForm();

    await fillAndSubmit("wrong", "New-pass-02");

    expect(await screen.findByText("今のパスワードが正しくありません")).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe("old.token.sig");
  });

  it("確認の欄が一致しなければ API を呼ばない", async () => {
    renderForm();

    await fillAndSubmit("Old-pass-01", "New-pass-02", "New-pass-03");

    expect(await screen.findByText("新しいパスワードと一致しません")).toBeInTheDocument();
    expect(stub.requests).toHaveLength(0);
  });
});

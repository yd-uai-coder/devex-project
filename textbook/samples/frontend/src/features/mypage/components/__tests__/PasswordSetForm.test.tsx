// 作成：Phase-77-1
// SUT: PasswordSetForm(Google だけの人がパスワードを設定し、返った access をストアに入れ直す)
// ドライバ: 各テスト(ユーザーの操作)
// スタブ: fetch(stubFetch。POST /users/me/password の応答)と、トーストの useToastController(vi.mock)。
// 認証のストア(useAuthStore)は本物を使う(入れ直されることそのものが検証対象のため)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { useAuthStore } from "@/components/auth/auth-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { PasswordSetForm } from "../PasswordSetForm";

const { toastShow } = vi.hoisted(() => ({ toastShow: vi.fn() }));
vi.mock("@tamagui/toast", () => ({ useToastController: () => ({ show: toastShow }) }));

function renderForm(onPasswordSet = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <PasswordSetForm onPasswordSet={onPasswordSet} />
    </TamaguiProvider>,
  );
  return onPasswordSet;
}

async function fillAndSubmit(next: string, confirm = next) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("新しいパスワード"), next);
  await user.type(screen.getByLabelText("新しいパスワード(確認)"), confirm);
  await user.click(screen.getByRole("button", { name: "パスワードを設定する" }));
}

describe("PasswordSetForm", () => {
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

  it("今のパスワードの欄を出さない", () => {
    renderForm();

    expect(screen.queryByLabelText("今のパスワード")).not.toBeInTheDocument();
  });

  it("設定したら access を入れ直し、知らせて、呼び出し側に伝える", async () => {
    stub.queue({ body: { access_token: "new.token.sig", token_type: "bearer" } });
    const onPasswordSet = renderForm();

    await fillAndSubmit("New-pass-02");

    await vi.waitFor(() => expect(onPasswordSet).toHaveBeenCalledOnce());
    expect(useAuthStore.getState().accessToken).toBe("new.token.sig");
    expect(toastShow).toHaveBeenCalledWith("パスワードを設定しました", { message: "ほかの端末のログインは切れました" });
    expect(stub.requests[0].init?.method).toBe("POST");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({ new_password: "New-pass-02" });
  });

  it("断られたら(409 PASSWORD_ALREADY_SET)API の文を出し、呼び出し側には伝えない", async () => {
    stub.queue({ status: 409, body: { detail: "パスワードは設定済みです。", code: "PASSWORD_ALREADY_SET" } });
    const onPasswordSet = renderForm();

    await fillAndSubmit("New-pass-02");

    expect(await screen.findByRole("alert")).toHaveTextContent("パスワードは設定済みです。");
    expect(onPasswordSet).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBe("old.token.sig");
  });

  it("確認の欄が一致しなければ API を呼ばない", async () => {
    renderForm();

    await fillAndSubmit("New-pass-02", "New-pass-03");

    expect(await screen.findByText("新しいパスワードと一致しません")).toBeInTheDocument();
    expect(stub.requests).toHaveLength(0);
  });
});

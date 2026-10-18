// 作成：Phase-77-2
// SUT: GoogleLinkSection(Google の連携・解除の出し分けと、連携のダイアログ・解除の確認)
// ドライバ: 各テスト(ユーザーの操作)
// スタブ: fetch(stubFetch。POST・DELETE /users/me/google の応答)、トーストの useToastController(vi.mock)、
// 環境変数(vi.stubEnv。偽のボタンで credential を作る。本物の Google のボタンは外部のスクリプトが要るため)。
// 認証のストア(useAuthStore)は本物を使う(解除でトークンが入れ直されることが検証対象のため)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { useAuthStore } from "@/components/auth/auth-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import type { AccountRead } from "@/features/mypage/api/accountApi";
import { GoogleLinkSection } from "../GoogleLinkSection";

const { toastShow } = vi.hoisted(() => ({ toastShow: vi.fn() }));
vi.mock("@tamagui/toast", () => ({ useToastController: () => ({ show: toastShow }) }));

const ACCOUNT: AccountRead = {
  id: "u1",
  email: "gil@example.com",
  user_name: "Gil",
  has_password: true,
  google_linked: false,
};

function renderSection(account: AccountRead = ACCOUNT) {
  const onUpdated = vi.fn();
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <GoogleLinkSection account={account} onUpdated={onUpdated} />
    </TamaguiProvider>,
  );
  return onUpdated;
}

async function pressGoogle(user: ReturnType<typeof userEvent.setup>, email = "g@example.com") {
  await user.type(screen.getByLabelText("偽の Google アカウント(E2E)"), email);
  await user.click(screen.getByLabelText("Google で続ける(E2E)"));
}

// 文字の入力とダイアログの開閉が続くので、並列の全体テストでは既定の5秒を超えることがある
describe("GoogleLinkSection", { timeout: 20000 }, () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    toastShow.mockClear();
    useAuthStore.setState({ accessToken: "old.token.sig", status: "success", error: null });
    vi.stubEnv("NEXT_PUBLIC_E2E_FAKE_GOOGLE", "true");
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
    vi.unstubAllEnvs();
    useAuthStore.setState({ accessToken: null, status: "idle", error: null });
  });

  it("Google の credential を受けたら今のパスワードを聞き、一緒に送って連携する", async () => {
    stub.queue({ body: { ...ACCOUNT, google_linked: true } });
    const user = userEvent.setup();
    const onUpdated = renderSection();

    await pressGoogle(user);
    expect(screen.getByText(/連携するには、このアカウントのパスワードを入れてください。/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("このアカウントのパスワード"), "Old-pass-01");
    await user.click(screen.getByLabelText("連携する"));

    await vi.waitFor(() => expect(onUpdated).toHaveBeenCalledWith({ ...ACCOUNT, google_linked: true }));
    expect(stub.requests[0].init?.method).toBe("POST");
    expect(new URL(stub.requests[0].url).pathname).toBe("/api/v1/users/me/google");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({
      credential: "fake:g@example.com:g@example.com",
      current_password: "Old-pass-01",
    });
    expect(toastShow).toHaveBeenCalledWith("Google アカウントと連携しました");
  });

  it("今のパスワードが違えば、ダイアログの中に出して打ち直せる", async () => {
    stub.queue({ status: 400, body: { detail: "mismatch", code: "CURRENT_PASSWORD_MISMATCH" } });
    const user = userEvent.setup();
    const onUpdated = renderSection();

    await pressGoogle(user);
    await user.type(screen.getByLabelText("このアカウントのパスワード"), "wrong");
    await user.click(screen.getByLabelText("連携する"));

    expect(await screen.findByText("今のパスワードが正しくありません")).toBeInTheDocument();
    expect(screen.getByLabelText("このアカウントのパスワード")).toBeInTheDocument();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("別の Google と連携済みなどは、ダイアログを閉じて API の文を出す", async () => {
    stub.queue({
      status: 409,
      body: { detail: "このアカウントか Google アカウントが、ほかと連携済みです。", code: "GOOGLE_ACCOUNT_CONFLICT" },
    });
    const user = userEvent.setup();
    renderSection();

    await pressGoogle(user);
    await user.type(screen.getByLabelText("このアカウントのパスワード"), "Old-pass-01");
    await user.click(screen.getByLabelText("連携する"));

    expect(await screen.findByRole("alert")).toHaveTextContent("このアカウントか Google アカウントが、ほかと連携済みです。");
    await vi.waitFor(() => expect(screen.queryByLabelText("このアカウントのパスワード")).not.toBeInTheDocument());

    // 開き直しても前のパスワードは残らない
    await pressGoogle(user, "other@example.com");
    expect(screen.getByLabelText("このアカウントのパスワード")).toHaveValue("");
  });

  it("キャンセルすると送らない", async () => {
    const user = userEvent.setup();
    renderSection();

    await pressGoogle(user);
    await user.click(screen.getByLabelText("キャンセル"));

    await vi.waitFor(() => expect(screen.queryByLabelText("このアカウントのパスワード")).not.toBeInTheDocument());
    expect(stub.requests).toHaveLength(0);
  });

  it("解除は確認してから送り、返った access を入れ直して、連携していない表示にする", async () => {
    stub.queue({ body: { access_token: "new.token.sig", token_type: "bearer" } });
    const user = userEvent.setup();
    const onUpdated = renderSection({ ...ACCOUNT, google_linked: true });

    await user.click(screen.getByRole("button", { name: "連携を解除する" }));
    expect(screen.getByText(/ほかの端末ではログインし直しになります/)).toBeInTheDocument();
    expect(stub.requests).toHaveLength(0);
    await user.click(screen.getByLabelText("解除する"));

    await vi.waitFor(() => expect(onUpdated).toHaveBeenCalledWith({ ...ACCOUNT, google_linked: false }));
    expect(stub.requests[0].init?.method).toBe("DELETE");
    expect(useAuthStore.getState().accessToken).toBe("new.token.sig");
    expect(toastShow).toHaveBeenCalledWith("Google との連携を解除しました", { message: "ほかの端末のログインは切れました" });
  });

  it("パスワードの無い人には解除を出さず、設定すればできると伝える", () => {
    renderSection({ ...ACCOUNT, has_password: false, google_linked: true });

    expect(screen.queryByRole("button", { name: "連携を解除する" })).not.toBeInTheDocument();
    expect(screen.getByText("パスワードを設定すると、連携を解除できます。")).toBeInTheDocument();
  });

  it("クライアント ID が無く偽でもなければ、連携できないことを文で伝える", () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_FAKE_GOOGLE", "");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    renderSection();

    expect(screen.getByText("この環境では Google との連携を使えません。")).toBeInTheDocument();
    expect(screen.queryByLabelText("Google で続ける(E2E)")).not.toBeInTheDocument();
  });
});

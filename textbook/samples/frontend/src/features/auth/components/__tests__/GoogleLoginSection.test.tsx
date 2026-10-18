// 作成：Phase-76-2
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { GoogleLoginSection } from "../GoogleLoginSection";
import { useAuthStore } from "@/components/auth/auth-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

const TOKENS = { access_token: "google-token", token_type: "bearer" };

function renderSection() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <GoogleLoginSection text="signin_with" />
    </TamaguiProvider>,
  );
}

// 偽のボタン(E2E のモード)で credential を作って送る。本物の Google のボタンは外部のスクリプトが
// 要るので、このテストでは使わない(ボタンの部品そのものは GoogleSignInButton.test.tsx)。
async function pressGoogle(user: ReturnType<typeof userEvent.setup>, email = "g@example.com") {
  await user.type(screen.getByLabelText("偽の Google アカウント(E2E)"), email);
  await user.click(screen.getByLabelText("Google で続ける(E2E)"));
}

// 文字の入力とダイアログの開閉が続くので、並列の全体テストでは既定の5秒を超えることがある
describe("GoogleLoginSection", { timeout: 20000 }, () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    push.mockClear();
    searchParams = new URLSearchParams();
    useAuthStore.setState({ accessToken: null, status: "idle", error: null });
    vi.stubEnv("NEXT_PUBLIC_E2E_FAKE_GOOGLE", "true");
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
    vi.unstubAllEnvs();
  });

  it("クライアント ID が無く偽でもなければ、区切りごと出さない", () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_FAKE_GOOGLE", "");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    renderSection();

    expect(screen.queryByText("または")).not.toBeInTheDocument();
  });

  it("成功したら credential を送ってログインし、戻り先へ移る", async () => {
    stub.queue({ status: 200, body: TOKENS });
    searchParams = new URLSearchParams("redirect=/projects/1");
    const user = userEvent.setup();
    renderSection();

    expect(screen.getByText("または")).toBeInTheDocument();
    await pressGoogle(user);

    await vi.waitFor(() => expect(useAuthStore.getState().accessToken).toBe("google-token"));
    expect(push).toHaveBeenCalledWith("/projects/1");
    expect(stub.requests[0].url).toContain("/api/v1/auth/google");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({
      credential: "fake:g@example.com:g@example.com",
    });
  });

  it("同じメールのアカウントがあれば、パスワードを聞いて同じ credential で連携する", async () => {
    stub.queue({
      status: 409,
      body: { detail: "連携の確かめが要ります", code: "GOOGLE_LINK_REQUIRED" },
    });
    stub.queue({ status: 200, body: TOKENS });
    const user = userEvent.setup();
    renderSection();

    await pressGoogle(user);
    await user.type(await screen.findByLabelText("このアカウントのパスワード"), "S3cret-pass");
    await user.click(screen.getByLabelText("連携してログイン"));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(useAuthStore.getState().accessToken).toBe("google-token");
    expect(stub.requests[1].url).toContain("/api/v1/auth/google/link");
    expect(JSON.parse(stub.requests[1].init?.body as string)).toEqual({
      credential: "fake:g@example.com:g@example.com",
      password: "S3cret-pass",
    });
    // 409 の detail は、ダイアログに置き換わるので出さない
    expect(screen.queryByText("連携の確かめが要ります")).not.toBeInTheDocument();
  });

  it("連携でパスワードが違えば、ダイアログの中に理由を出し、ログインしない", async () => {
    stub.queue({ status: 409, body: { detail: "x", code: "GOOGLE_LINK_REQUIRED" } });
    stub.queue({ status: 401, body: { detail: "メールアドレスまたはパスワードが正しくありません" } });
    const user = userEvent.setup();
    renderSection();

    await pressGoogle(user);
    await user.type(await screen.findByLabelText("このアカウントのパスワード"), "wrong-pass");
    await user.click(screen.getByLabelText("連携してログイン"));

    expect(await screen.findByText("メールアドレスまたはパスワードが正しくありません")).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("キャンセルするとダイアログを閉じ、ログインしない", async () => {
    stub.queue({ status: 409, body: { detail: "x", code: "GOOGLE_LINK_REQUIRED" } });
    const user = userEvent.setup();
    renderSection();

    await pressGoogle(user);
    await screen.findByLabelText("このアカウントのパスワード");
    await user.click(screen.getByLabelText("キャンセル"));

    await vi.waitFor(() => expect(screen.queryByLabelText("連携してログイン")).not.toBeInTheDocument());
    expect(stub.requests).toHaveLength(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("別の Google と連携済みなどのエラーは、API の文をそのまま出す", async () => {
    stub.queue({
      status: 409,
      body: {
        detail: "このメールアドレスのアカウントは、別の Google アカウントと連携済みです",
        code: "GOOGLE_ACCOUNT_CONFLICT",
      },
    });
    const user = userEvent.setup();
    renderSection();

    await pressGoogle(user);

    expect(
      await screen.findByText("このメールアドレスのアカウントは、別の Google アカウントと連携済みです"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("連携してログイン")).not.toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

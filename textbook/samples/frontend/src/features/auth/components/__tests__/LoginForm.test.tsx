// 作成：Phase-3-2
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { LoginForm } from "../LoginForm";
import { useAuthStore } from "@/components/auth/auth-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

function renderForm() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <LoginForm />
    </TamaguiProvider>,
  );
}

describe("LoginForm", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    push.mockClear();
    searchParams = new URLSearchParams();
    useAuthStore.setState({ accessToken: null, status: "idle", error: null });
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("空欄のまま送信するとバリデーションエラーを表示し、APIを呼ばない", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByText("メールアドレスを入力してください")).toBeInTheDocument();
    expect(stub.requests).toHaveLength(0);

    // aria-invalid/aria-describedbyがエラーメッセージの要素と紐づいていることを確認する
    // (docs/requirements.md 1.5節の非機能要件、decision-digest.md記載のa11y方針)
    const emailInput = screen.getByLabelText("メールアドレス");
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    const describedBy = emailInput.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "メールアドレスを入力してください",
    );
  });

  it("成功時はauth-store.login()を呼び、redirectパラメータ先へ遷移する", async () => {
    stub.queue({ status: 200, body: { access_token: "new-token", token_type: "bearer" } });
    searchParams = new URLSearchParams("redirect=/dashboard");
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("メールアドレス"), "erin@example.com");
    await user.type(screen.getByLabelText("パスワード"), "s3cret-pass");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    await vi.waitFor(() => expect(useAuthStore.getState().accessToken).toBe("new-token"));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(stub.requests[0].url).toContain("/api/v1/auth/login");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({
      email: "erin@example.com",
      password: "s3cret-pass",
    });
  });

  it("失敗時はエラーメッセージを表示し、ログイン状態にしない", async () => {
    stub.queue({ status: 401, body: { detail: "Incorrect email or password" } });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("メールアドレス"), "erin@example.com");
    await user.type(screen.getByLabelText("パスワード"), "wrong-pass");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByText("Incorrect email or password")).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});

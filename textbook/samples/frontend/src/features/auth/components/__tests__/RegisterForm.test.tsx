// 作成：Phase-3-2
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { RegisterForm } from "../RegisterForm";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function renderForm() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <RegisterForm />
    </TamaguiProvider>,
  );
}

describe("RegisterForm", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    push.mockClear();
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("パスワードが短すぎる場合はバリデーションエラーを表示し、APIを呼ばない", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("氏名"), "Erin");
    await user.type(screen.getByLabelText("メールアドレス"), "erin@example.com");
    await user.type(screen.getByLabelText("パスワード"), "short");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(await screen.findByText("パスワードは8〜128文字で入力してください")).toBeInTheDocument();
    expect(stub.requests).toHaveLength(0);
  });

  it("パスワードが強度要件(大文字・小文字・数字・記号)を満たさない場合はバリデーションエラーを表示する", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("氏名"), "Erin");
    await user.type(screen.getByLabelText("メールアドレス"), "erin@example.com");
    // 8文字以上だが英小文字のみ(大文字・数字・記号を含まない)
    await user.type(screen.getByLabelText("パスワード"), "alllowercase");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(await screen.findByText("パスワードは大文字を含めてください")).toBeInTheDocument();
    expect(stub.requests).toHaveLength(0);
  });

  it("成功時はfull_nameを含めてPOSTし、/loginへ遷移する(自動ログインはしない)", async () => {
    stub.queue({
      status: 201,
      body: { id: "u1", email: "erin@example.com", full_name: "Erin", is_active: true },
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("氏名"), "Erin");
    await user.type(screen.getByLabelText("メールアドレス"), "erin@example.com");
    await user.type(screen.getByLabelText("パスワード"), "S3cret-Pass");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(stub.requests[0].url).toContain("/api/v1/auth/register");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({
      email: "erin@example.com",
      password: "S3cret-Pass",
      full_name: "Erin",
    });
  });

  it("失敗時(メール重複等)はエラーメッセージを表示する", async () => {
    stub.queue({ status: 409, body: { detail: "Email already registered" } });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("氏名"), "Erin");
    await user.type(screen.getByLabelText("メールアドレス"), "erin@example.com");
    await user.type(screen.getByLabelText("パスワード"), "S3cret-Pass");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(await screen.findByText("Email already registered")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

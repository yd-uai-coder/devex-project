// 作成：Phase-66-3
// SUT: EmailForm(今のパスワードで確かめてメールを変える。400・409 を欄のエラーに)
// ドライバ: 各テスト(ユーザーの操作)
// スタブ: fetch(stubFetch。PUT /users/me/email の応答)と、トーストの useToastController(vi.mock)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { EmailForm } from "../EmailForm";

const { toastShow } = vi.hoisted(() => ({ toastShow: vi.fn() }));
vi.mock("@tamagui/toast", () => ({ useToastController: () => ({ show: toastShow }) }));

const ACCOUNT = { id: "u1", email: "gil@example.com", user_name: "Gil" };

function renderForm() {
  const onUpdated = vi.fn();
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <EmailForm account={ACCOUNT} onUpdated={onUpdated} />
    </TamaguiProvider>,
  );
  return { onUpdated };
}

async function fillAndSubmit(newEmail: string, currentPassword: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("新しいメールアドレス"), newEmail);
  await user.type(screen.getByLabelText("今のパスワード"), currentPassword);
  await user.click(screen.getByRole("button", { name: "メールアドレスを変える" }));
}

describe("EmailForm", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
    toastShow.mockClear();
  });

  afterEach(() => {
    stub.restore();
  });

  it("変えたら親へ新しい値を渡し、入力を空にしてトーストで知らせる", async () => {
    const updated = { ...ACCOUNT, email: "new@example.com" };
    stub.queue({ body: updated });
    const { onUpdated } = renderForm();

    await fillAndSubmit("new@example.com", "Old-pass-01");

    await vi.waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(toastShow).toHaveBeenCalledWith("メールアドレスを変えました");
    expect(screen.getByLabelText("新しいメールアドレス")).toHaveValue("");
  });

  it("今のパスワードの不一致(400)は、今のパスワードの欄のエラーにする", async () => {
    stub.queue({ status: 400, body: { detail: "mismatch", code: "CURRENT_PASSWORD_MISMATCH" } });
    const { onUpdated } = renderForm();

    await fillAndSubmit("new@example.com", "wrong");

    expect(await screen.findByText("今のパスワードが正しくありません")).toBeInTheDocument();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("使われているメール(409)は、新しいメールの欄のエラーにする", async () => {
    stub.queue({ status: 409, body: { detail: "exists" } });
    renderForm();

    await fillAndSubmit("taken@example.com", "Old-pass-01");

    expect(await screen.findByText("このメールアドレスは使われています")).toBeInTheDocument();
  });
});

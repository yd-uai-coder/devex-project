// 作成：Phase-67-4｜更新：Phase-67(完了後の調整)
// SUT: ApiKeySection(provider ごとの API キーの登録・削除と、末尾の4文字の表示)
// ドライバ: 各テスト(描画とユーザーの操作)
// スタブ: fetch(stubFetch。キーの一覧・登録・削除の応答)と、トーストの useToastController(vi.mock)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { ApiKeySection } from "../ApiKeySection";

const { toastShow } = vi.hoisted(() => ({ toastShow: vi.fn() }));
vi.mock("@tamagui/toast", () => ({ useToastController: () => ({ show: toastShow }) }));

const NO_KEYS = { encryption_available: true, keys: [] };

// Phase-67(完了後の調整)：更新
// function renderSection(onChanged = vi.fn()) {
// ↓↓
function renderSection() {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      // Phase-67(完了後の調整)：更新
      // <ApiKeySection onChanged={onChanged} />
      // ↓↓
      <ApiKeySection />
    </TamaguiProvider>,
  );
  // Phase-67(完了後の調整)：削除
  // return onChanged;
}

describe("ApiKeySection", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
    toastShow.mockClear();
  });

  afterEach(() => {
    stub.restore();
  });

  it("登録済みは末尾の4文字だけを出し、読めないキーは登録し直しを促す", async () => {
    stub.queue({
      body: {
        encryption_available: true,
        keys: [{ provider: "claude", key_hint: "4321", needs_reregister: true }],
      },
    });
    renderSection();

    expect(await screen.findByText("登録済み(末尾 …4321)")).toBeInTheDocument();
    expect(screen.getByText("未登録")).toBeInTheDocument();
    expect(screen.getByText(/登録し直してください/)).toBeInTheDocument();
  });

  // Phase-67(完了後の調整)：更新
  // it("キーを保存すると、トーストで知らせて onChanged を呼ぶ", async () => {
  // ↓↓
  it("キーを保存すると、トーストで知らせて一覧を読み直す", async () => {
    stub.queue({ body: NO_KEYS });
    stub.queue({ body: { provider: "claude", key_hint: "4321", needs_reregister: false } });
    stub.queue({ body: { encryption_available: true, keys: [{ provider: "claude", key_hint: "4321", needs_reregister: false }] } });
    const user = userEvent.setup();
    // Phase-67(完了後の調整)：更新
    // const onChanged = renderSection();
    // ↓↓
    renderSection();

    await user.type(await screen.findByLabelText("Claude の API キー"), "  sk-ant-4321 ");
    await user.click(screen.getByRole("button", { name: "Claude のキーを保存する" }));

    await vi.waitFor(() => expect(toastShow).toHaveBeenCalledWith("Claude の API キーを登録しました"));
    // Phase-67(完了後の調整)：削除
    // expect(onChanged).toHaveBeenCalledTimes(1);
    expect(stub.requests[1].init?.body).toBe(JSON.stringify({ api_key: "sk-ant-4321" }));
    expect(await screen.findByText("登録済み(末尾 …4321)")).toBeInTheDocument();
  });

  it("無効なキーは欄のエラー、確かめられないときはメッセージで出す", async () => {
    stub.queue({ body: NO_KEYS });
    stub.queue({ status: 422, body: { detail: "APIキーが正しくありません。", code: "API_KEY_INVALID" } });
    stub.queue({
      status: 502,
      body: { detail: "APIキーを確かめられませんでした。時間をおいて試してください。", code: "API_KEY_CHECK_FAILED" },
    });
    const user = userEvent.setup();
    // Phase-67(完了後の調整)：更新
    // const onChanged = renderSection();
    // ↓↓
    renderSection();

    await user.type(await screen.findByLabelText("Gemini の API キー"), "AIza-bad-key");
    await user.click(screen.getByRole("button", { name: "Gemini のキーを保存する" }));
    expect(await screen.findByText("APIキーが正しくありません")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Gemini のキーを保存する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("時間をおいて試してください");
    // Phase-67(完了後の調整)：更新
    // expect(onChanged).not.toHaveBeenCalled();
    // ↓↓
    // 失敗では一覧を読み直さない(最初の読み込みと2回の保存だけ)
    expect(stub.requests).toHaveLength(3);
  });

  it("サーバーに暗号の鍵が無いときは、理由を出して保存させない", async () => {
    stub.queue({ body: { encryption_available: false, keys: [] } });
    renderSection();

    expect(await screen.findByText(/暗号の鍵が設定されていない/)).toBeInTheDocument();
    for (const name of ["Gemini のキーを保存する", "Claude のキーを保存する"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("削除は確かめてから行う", async () => {
    stub.queue({
      body: { encryption_available: true, keys: [{ provider: "gemini", key_hint: "abcd", needs_reregister: false }] },
    });
    stub.queue({ body: {} });
    stub.queue({ body: NO_KEYS });
    const user = userEvent.setup();
    // Phase-67(完了後の調整)：更新
    // const onChanged = renderSection();
    // ↓↓
    renderSection();

    await user.click(await screen.findByRole("button", { name: "削除" }));
    expect(await screen.findByText("Gemini の API キーを削除しますか")).toBeInTheDocument();
    // Tamagui の Dialog は jsdom ではロールのクエリで隠れている扱いになるため、aria-label で取る
    await user.click(screen.getByLabelText("削除する"));

    await vi.waitFor(() => expect(toastShow).toHaveBeenCalledWith("Gemini の API キーを削除しました"));
    expect(stub.requests[1].init?.method).toBe("DELETE");
    // Phase-67(完了後の調整)：更新
    // expect(onChanged).toHaveBeenCalledTimes(1);
    // ↓↓
    expect(await screen.findAllByText("未登録")).toHaveLength(2);
  });
});

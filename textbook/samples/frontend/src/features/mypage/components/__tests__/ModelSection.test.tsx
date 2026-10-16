// 作成：Phase-67-4｜更新：Phase-67(完了後の調整)
// SUT: ModelSection(用途ごとの AI・モデルの選択と保存)
// ドライバ: 各テスト(描画とユーザーの操作)
// スタブ: fetch(stubFetch。カタログ・今の設定・保存の応答)と、トーストの useToastController(vi.mock)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { CATALOG, DEFAULT_SETTINGS, purposeSetting } from "@/features/mypage/test-utils/llmFixtures";
import { ModelSection } from "../ModelSection";

const { toastShow } = vi.hoisted(() => ({ toastShow: vi.fn() }));
vi.mock("@tamagui/toast", () => ({ useToastController: () => ({ show: toastShow }) }));

function renderSection() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ModelSection />
    </TamaguiProvider>,
  );
}

function group(name: string) {
  return screen.getByRole("radiogroup", { name });
}

describe("ModelSection", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
    toastShow.mockClear();
  });

  afterEach(() => {
    stub.restore();
  });

  it("4つの用途を既定で出し、キーの無い AI は選べない理由を出す。判定には低費用の注記", async () => {
    stub.queue({ body: CATALOG });
    stub.queue({ body: { settings: DEFAULT_SETTINGS } });
    renderSection();

    expect(await screen.findByRole("radiogroup", { name: "チャット" })).toBeInTheDocument();
    const chat = within(group("チャット"));
    expect(chat.getByRole("radio", { name: "既定に従う(Gemini / Gemini 3.5 Flash-Lite)" })).toBeChecked();
    expect(chat.getByRole("radio", { name: "Claude" })).toBeDisabled();
    expect(
      // Phase-67(完了後の調整)：更新
      // screen.getAllByText("Claude を選ぶには、下の「API キー」で Claude のキーを登録してください。"),
      // ↓↓
      screen.getAllByText("Claude を選ぶには、「API キー」の節で Claude のキーを登録してください。"),
    ).toHaveLength(2);
    expect(screen.getByText(/費用の低いモデル/)).toBeInTheDocument();
  });

  it("AI を選ぶとモデルを選べ、保存で選んだ用途だけを送る", async () => {
    stub.queue({ body: CATALOG });
    stub.queue({ body: { settings: DEFAULT_SETTINGS } });
    const saved = DEFAULT_SETTINGS.map((s) =>
      s.purpose === "chat" ? { ...s, model: "gemini-3.8-flash", is_default: false } : s,
    );
    stub.queue({ body: { settings: saved } });
    const user = userEvent.setup();
    renderSection();

    await user.click(within(await screen.findByRole("radiogroup", { name: "チャット" })).getByRole("radio", { name: "Gemini" }));
    await user.selectOptions(screen.getByLabelText("モデル"), "gemini-3.8-flash");
    await user.click(screen.getByRole("button", { name: "モデルを保存する" }));

    await vi.waitFor(() => expect(toastShow).toHaveBeenCalledWith("モデルを保存しました"));
    expect(stub.requests[2].init?.body).toBe(
      JSON.stringify({ choices: [{ purpose: "chat", provider: "gemini", model: "gemini-3.8-flash" }] }),
    );
  });

  it("キーを消した用途は、既定に従うと知らせる", async () => {
    stub.queue({ body: CATALOG });
    stub.queue({
      body: {
        settings: [
          purposeSetting("chat", "claude", "claude-sonnet-5-5", {
            is_default: false,
            key_missing: true,
            default_provider: "gemini",
            default_model: "gemini-3.5-flash-lite",
            selectable_providers: ["gemini"],
          }),
          ...DEFAULT_SETTINGS.slice(1),
        ],
      },
    });
    renderSection();

    expect(
      await screen.findByText("Claude のキーが無いので、使うときは既定(Gemini 3.5 Flash-Lite)に従います。"),
    ).toBeInTheDocument();
  });

  it("保存の失敗はメッセージで出す", async () => {
    stub.queue({ body: CATALOG });
    stub.queue({ body: { settings: DEFAULT_SETTINGS } });
    stub.queue({ status: 422, body: { detail: "選べないモデルです", code: "MODEL_NOT_IN_CATALOG" } });
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole("button", { name: "モデルを保存する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("選べないモデルです");
  });
});

// 作成：Phase-97-2
// SUT: AgreementStatusPanel(表示中の版の行の合意の印・戻した要素・行の履歴を開く)、
//      ElementHistoryView(要素1つの履歴。パネルの中で開く)
// ドライバ: vitest のテスト関数(render・userEvent)
// スタブ: fetch(stubFetch)── devex-api の状態・履歴の応答を積み、送った URL を確かめるため
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { AgreementStatusPanel } from "../AgreementStatusPanel";
import { ElementHistoryView } from "../ElementHistoryView";
import { makeHistory, makeStatus } from "../../test-utils/agreementFixtures";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

function renderPanel(refreshKey = "d1") {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AgreementStatusPanel projectId="p1" docType="requirements" refreshKey={refreshKey} />
    </TamaguiProvider>,
  );
}

describe("AgreementStatusPanel", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("件数と行ごとの印・出どころを出す", async () => {
    stub.queue({ body: makeStatus() });
    renderPanel();

    expect(await screen.findByText("合意の状態: 合意済み 2 / 合意と違う 0 / 未合意 1")).toBeInTheDocument();
    expect(screen.getByText("合意 B-1")).toBeInTheDocument();
    expect(screen.getByText("合意 CR-3")).toBeInTheDocument();
    expect(screen.getByText("未合意")).toBeInTheDocument();
    // CR なしの版で、戻した要素も無ければ戻しの見出しは出ない
    expect(screen.queryByLabelText("合意の形に戻した要素")).not.toBeInTheDocument();
    expect(stub.requests[0].url).toContain("/agreements/status?doc_type=requirements");
  });

  it("CR を反映した版の戻しは、予測に無い変更として CR へのリンクつきで出す", async () => {
    stub.queue({
      body: makeStatus({
        version: 7,
        change_request_number: 3,
        restored: [{ key: "req:FR-001", label: "FR-001 予約を登録できる", reason: "changed", reason_label: "書き換えを戻した" }],
      }),
    });
    renderPanel();

    expect(await screen.findByText(/CR-3 の予測に無い変更を合意の形に戻しました: 1件/)).toBeInTheDocument();
    expect(screen.getByText("・FR-001 予約を登録できる: 書き換えを戻した")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CR-3 を開く" })).toHaveAttribute("href", "/projects/p1/change-requests/3");
  });

  it("行の履歴をその場で開き、もう一度押すと閉じる", async () => {
    stub.queue({ body: makeStatus() });
    stub.queue({ body: makeHistory() });
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "req:FR-001 の履歴を開く" }));

    expect(await screen.findByText(/合意\(B-1\)/)).toBeInTheDocument();
    expect(screen.getByText(/要件定義書 v3・CR-2 で反映: 書き換えを戻した/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CR-2 確認メールを送る" })).toHaveAttribute(
      "href",
      "/projects/p1/change-requests/2",
    );
    expect(stub.requests[1].url).toContain("/agreements/history?key=req%3AFR-001");

    await user.click(screen.getByRole("button", { name: "req:FR-001 の履歴を閉じる" }));
    expect(screen.queryByLabelText("req:FR-001 の履歴")).not.toBeInTheDocument();
  });

  it("文書が無い・要素が無いときは何も出さない。取得の失敗は知らせる", async () => {
    stub.queue({ body: makeStatus({ version: null, elements: [] }) });
    const { container, unmount } = renderPanel();
    await vi.waitFor(() => expect(stub.requests).toHaveLength(1));
    expect(container.textContent).toBe("");
    unmount();

    stub.queue({ status: 409, body: { detail: "簡易ドキュメントモードでは使えません" } });
    renderPanel("d2");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("取り直しの鍵が変わったら読み直す", async () => {
    stub.queue({ body: makeStatus() });
    stub.queue({ body: makeStatus() });
    const view = renderPanel("d1:a");
    await screen.findByText(/合意の状態/);

    view.rerender(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AgreementStatusPanel projectId="p1" docType="requirements" refreshKey="d1:b" />
      </TamaguiProvider>,
    );

    await vi.waitFor(() => expect(stub.requests).toHaveLength(2));
  });
});

describe("ElementHistoryView", () => {
  it("合意の記録が無い要素は、まだ無いと出す", async () => {
    const stub = stubFetch();
    stub.queue({ body: makeHistory({ entries: [], change_requests: [] }) });
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <ElementHistoryView projectId="p1" elementKey="req:FR-009" />
      </TamaguiProvider>,
    );

    expect(await screen.findByText(/合意の記録はまだありません/)).toBeInTheDocument();
    stub.restore();
  });
});

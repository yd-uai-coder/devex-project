// 作成：Phase-98-1｜更新：Phase-99(完了後の調整)
// SUT: ConfirmationsPageContent(確認事項の一覧のページ)、ConfirmationTable(行ごとの決める機会・状態・
//      メモ。ページの中で描く)
// ドライバ: vitest のテスト関数(render・userEvent)
// スタブ: fetch(stubFetch)── devex-api の一覧・更新の応答を積み、送った URL・本文を確かめるため
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ConfirmationsPageContent } from "../ConfirmationsPageContent";
import { ConfirmationTable } from "../ConfirmationTable";
import { makeItem, makeList } from "../../test-utils/confirmationFixtures";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

function renderPage() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ConfirmationsPageContent projectId="p1" />
    </TamaguiProvider>,
  );
}

const bodyOf = (stub: ReturnType<typeof stubFetch>, index: number) =>
  JSON.parse(String(stub.requests[index].init?.body));

describe("ConfirmationsPageContent", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  // Phase-99(完了後の調整)：更新
  // it("未確認の件数・採用率・未確認の項目を出し、消えた項目は畳む", async () => {
  // ↓↓
  it("未確認の件数・採用率・未確認の項目を出し、消えた項目は同じ表で状態を変えられない", async () => {
    stub.queue({ body: makeList() });
    renderPage();

    expect(await screen.findByText("未確認: 推測の要件 1 / 推測の利用者 1 / 未決の観点 1")).toBeInTheDocument();
    expect(screen.getByText("推測の採用率: 100%(確認済み 1 / 却下 0・未確認 2)")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "確認事項" });
    expect(within(table).getByText("FR-004 期限の前に通知する")).toBeInTheDocument();
    expect(within(table).getByText("FR-002, 1.2")).toBeInTheDocument();
    expect(screen.queryByText("FR-009 CSV で出力する")).not.toBeInTheDocument();

    // Phase-99(完了後の調整)：更新
    // await userEvent.click(screen.getByRole("button", { name: "▸ 一覧から消えた項目(決めた記録) 1件" }));
    // const gone = screen.getByRole("table", { name: "一覧から消えた項目" });
    // expect(within(gone).getByText("FR-009 CSV で出力する")).toBeInTheDocument();
    // expect(within(gone).getByText("定例で確認")).toBeInTheDocument();
    // // 決めた記録は読むだけ
    // expect(within(gone).queryByRole("button")).not.toBeInTheDocument();
    // ↓↓
    // 確認済みで絞ると、採用して一覧から消えた項目も同じ表に出る。状態のボタンの代わりに理由と変更要求への
    // リンク。メモは書ける
    await userEvent.selectOptions(screen.getByLabelText("状態で絞る"), "confirmed");
    const confirmed = screen.getByRole("table", { name: "確認事項" });
    expect(within(confirmed).getByText("FR-009 CSV で出力する")).toBeInTheDocument();
    expect(within(confirmed).getByText("確認済み(採用して合意)")).toBeInTheDocument();
    expect(within(confirmed).getByRole("link", { name: "変えるときは変更要求(CR)で →" })).toHaveAttribute(
      "href",
      "/projects/p1/change-requests",
    );
    // 状態の文の下の段に出す(2段)
    expect(within(confirmed).getByRole("link", { name: "変えるときは変更要求(CR)で →" })).toHaveStyle({ display: "block" });
    expect(within(confirmed).queryByRole("button", { name: /を未確認に戻す$/ })).not.toBeInTheDocument();
    expect(within(confirmed).queryByLabelText("FR-009 CSV で出力する の決める機会")).not.toBeInTheDocument();
    expect(within(confirmed).getByText("定例で確認")).toBeInTheDocument();
    expect(within(confirmed).getByRole("button", { name: "メモを直す" })).toBeInTheDocument();
  });

  it("種類で絞り込める", async () => {
    stub.queue({ body: makeList() });
    renderPage();

    await screen.findByRole("table", { name: "確認事項" });
    await userEvent.selectOptions(screen.getByLabelText("種類で絞る"), "point");

    const table = screen.getByRole("table", { name: "確認事項" });
    expect(within(table).queryByText("FR-004 期限の前に通知する")).not.toBeInTheDocument();
    expect(within(table).getByText("規模")).toBeInTheDocument();
  });

  it("推測の要件を確認済みにするときは確認のダイアログを挟み、確かめたら PATCH する", async () => {
    stub.queue({ body: makeList() });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "FR-004 期限の前に通知する を確認済みにする" }));
    expect(await screen.findByText(/」を確認済みにすると、採用にして合意を記録します/)).toBeInTheDocument();
    expect(stub.requests).toHaveLength(1);

    stub.queue({ body: makeList({ items: [makeItem({ key: "point:scale", kind: "point", label: "規模" })] }) });
    await userEvent.click(screen.getByLabelText("採用にして合意を記録する"));

    expect(await screen.findByText("未確認: 推測の要件 0 / 推測の利用者 0 / 未決の観点 1")).toBeInTheDocument();
    expect(stub.requests[1].url).toContain(`/confirmations/${encodeURIComponent("req:FR-004")}`);
    expect(bodyOf(stub, 1)).toEqual({ status: "confirmed" });
  });

  it("観点の確認済み・決める機会はダイアログなしですぐ保存する", async () => {
    stub.queue({ body: makeList() });
    renderPage();

    stub.queue({ body: makeList() });
    await userEvent.click(await screen.findByRole("button", { name: "規模 を確認済みにする" }));
    expect(screen.queryByLabelText("採用にして合意を記録する")).not.toBeInTheDocument();
    expect(bodyOf(stub, 1)).toEqual({ status: "confirmed" });

    stub.queue({ body: makeList() });
    await userEvent.selectOptions(screen.getByLabelText("FR-004 期限の前に通知する の決める機会"), "next_meeting");
    expect(bodyOf(stub, 2)).toEqual({ opportunity: "next_meeting" });
  });

  it("メモを書いて保存する", async () => {
    stub.queue({ body: makeList() });
    renderPage();

    const table = await screen.findByRole("table", { name: "確認事項" });
    await userEvent.click(within(table).getAllByRole("button", { name: "メモを書く" })[0]);
    await userEvent.type(screen.getByLabelText("FR-004 期限の前に通知する のメモ"), "次の定例で聞く");
    stub.queue({ body: makeList() });
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(bodyOf(stub, 1)).toEqual({ memo: "次の定例で聞く" });
  });

  it("保存の失敗を出す", async () => {
    stub.queue({ body: makeList() });
    renderPage();

    stub.queue({ status: 404, body: { detail: "Confirmation item point:scale not found" } });
    await userEvent.click(await screen.findByRole("button", { name: "規模 を却下" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Confirmation item point:scale not found");
  });

  it("項目が無ければその旨を出す", async () => {
    stub.queue({ body: makeList({ items: [], adoption: { confirmed: 0, rejected: 0, unconfirmed: 0, rate: null } }) });
    renderPage();

    expect(await screen.findByText(/確認事項はありません/)).toBeInTheDocument();
  });

  it("簡易ドキュメントモード(409)は、本体の代わりに知らせを出す", async () => {
    stub.queue({ status: 409, body: { detail: "not available", code: "DESIGN_STAGES_NOT_AVAILABLE" } });
    renderPage();

    expect(await screen.findByText(/確認事項の一覧は、詳細設計モードのプロジェクトだけで使えます/)).toBeInTheDocument();
  });
});

describe("ConfirmationTable", () => {
  it("今の状態のボタンは出さず、保存中は操作を止める", () => {
    const onUpdate = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <ConfirmationTable
          // Phase-99(完了後の調整):追記
          projectId="p1"
          items={[makeItem({ status: "rejected", status_label: "却下" })]}
          label="確認事項"
          savingKey="req:FR-004"
          onUpdate={onUpdate}
        />
      </TamaguiProvider>,
    );

    expect(screen.getByText("保存中…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /を却下$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FR-004 期限の前に通知する を未確認に戻す" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

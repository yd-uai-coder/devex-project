// 作成：Phase-87-3｜更新：Phase-87-4,88-4,88(完了後の調整),89(完了後の調整),107-4
// SUT: ChangeRequestDetailContent(詳細の見出し・タブの切り替え・反映の完了待ち)
// ドライバ: Testing Library(描画・タブのクリック)
// スタブ: ストアの関数(vi.fn)・useGenerationPolling(vi.mock)・各タブと操作の部品(vi.mock)──
// 詳細自身の配線だけを見る。タブの中身はそれぞれのテストで確かめる
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangeRequestDetailContent } from "../ChangeRequestDetailContent";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeChangeRequest } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const polling = vi.fn();
vi.mock("@/hooks/useGenerationPolling", () => ({
  useGenerationPolling: (...args: unknown[]) => polling(...args),
}));
vi.mock("../ChangeRequestActions", () => ({ ChangeRequestActions: () => <div>操作</div> }));
vi.mock("../ContentTab", () => ({ ContentTab: () => <div>内容のタブ</div> }));
vi.mock("../ImpactTab", () => ({ ImpactTab: () => <div>影響のタブ</div> }));
// Phase-87-4:追記
vi.mock("../VerificationTab", () => ({ VerificationTab: () => <div>検証のタブ</div> }));
// ── ここから Phase-87-3 の作成分 ──
// Phase-88-4:追記
vi.mock("../ExplanationTab", () => ({ ExplanationTab: () => <div>説明書のタブ</div> }));
// Phase-107-4:追記
vi.mock("../ShareTab", () => ({ ShareTab: () => <div>共有のタブ</div> }));
vi.mock("../TraceTab", () => ({ TraceTab: () => <div>記録のタブ</div> }));

describe("ChangeRequestDetailContent", () => {
  beforeEach(() => {
    polling.mockReset().mockReturnValue({ timedOut: false });
    resetChangeRequestsStore();
  });

  it("開くと詳細を読み、見出しに番号・タイトル・状態を出し、内容のタブから始める", () => {
    useChangeRequestsStore.setState({ detail: makeChangeRequest() });

    renderWithTheme(<ChangeRequestDetailContent projectId="p1" number={1} />);

    expect(useChangeRequestsStore.getState().fetchDetail).toHaveBeenCalledWith("p1", 1);
    // Phase-89(完了後の調整):追記
    // 生成中に別の画面へ移って戻ったときも、反映の完了を待ち直す
    expect(useChangeRequestsStore.getState().resumeReflection).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("heading", { name: "CR-1 参考資料を5件まで" })).toBeInTheDocument();
    expect(screen.getByLabelText("状態: 下書き")).toBeInTheDocument();
    expect(screen.getByText("内容のタブ")).toBeInTheDocument();
  });

  it("タブを切り替える。検証は反映の後だけ", async () => {
    useChangeRequestsStore.setState({ detail: makeChangeRequest({ status: "agreed" }) });
    renderWithTheme(<ChangeRequestDetailContent projectId="p1" number={1} />);

    await userEvent.click(screen.getByRole("tab", { name: "影響" }));
    expect(screen.getByText("影響のタブ")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "検証" }));
    expect(screen.getByText("検証は、文書へ反映した後にできます。")).toBeInTheDocument();
    // Phase-88-4:追記
    await userEvent.click(screen.getByRole("tab", { name: "説明書" }));
    expect(screen.getByText("説明書のタブ")).toBeInTheDocument();
    // Phase-107-4:追記
    await userEvent.click(screen.getByRole("tab", { name: "共有" }));
    expect(screen.getByText("共有のタブ")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "たどる記録" }));
    expect(screen.getByText("記録のタブ")).toBeInTheDocument();
    // Phase-88-4:追記
    // Phase-107-4：更新
    // expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["内容", "影響", "検証", "説明書", "たどる記録"]);
    // ↓↓
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["内容", "影響", "検証", "説明書", "共有", "たどる記録"]);

    // Phase-87-4:追記
    useChangeRequestsStore.setState({ detail: makeChangeRequest({ status: "applied" }) });
    await userEvent.click(screen.getByRole("tab", { name: "検証" }));
    expect(screen.getByText("検証のタブ")).toBeInTheDocument();
  });

  // ── ここから Phase-87-3 の作成分 ──
  it("反映の完了待ちは詳細が持ち、終わったらストアに渡す", () => {
    useChangeRequestsStore.setState({ detail: makeChangeRequest({ status: "agreed" }), reflecting: true });
    renderWithTheme(<ChangeRequestDetailContent projectId="p1" number={1} />);

    expect(polling).toHaveBeenCalledWith("p1", true, expect.any(Function));
    const project = { status: "completed" };
    (polling.mock.calls[0][2] as (p: unknown) => void)(project);
    expect(useChangeRequestsStore.getState().onReflectionFinished).toHaveBeenCalledWith("p1", 1, project);
  });

  it("無い CR は見つからないと出し、一覧へ戻るリンクを出す", () => {
    useChangeRequestsStore.setState({ detailNotFound: true });

    renderWithTheme(<ChangeRequestDetailContent projectId="p1" number={9} />);

    expect(screen.getByText("CR-9 は見つかりません")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← 変更要求の一覧" })).toHaveAttribute("href", "/projects/p1/change-requests");
  });

  // Phase-88(完了後の調整):追記
  it("簡易モードのプロジェクトでは、詳細設計モードだけと知らせる", () => {
    useChangeRequestsStore.setState({ unavailable: true });

    renderWithTheme(<ChangeRequestDetailContent projectId="p1" number={1} />);

    expect(screen.getByText(/詳細設計モードのプロジェクトだけで使えます/)).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});

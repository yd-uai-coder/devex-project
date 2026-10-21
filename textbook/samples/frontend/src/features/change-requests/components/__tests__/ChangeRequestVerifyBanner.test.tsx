// 作成：Phase-99(完了後の調整)
// SUT: ChangeRequestVerifyBanner(詳細設計の画面の、反映済みの CR の検証の帯)
// ドライバ: Testing Library(描画・クリック)
// スタブ: ストアの関数(vi.fn。一覧はストアに直接置く)と fetch(stubFetch)── 反映済みの CR だけを出すこと、
//         CR ごとに検証の数を読むこと、「検証する」で番号を渡すことを見るため
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangeRequestVerifyBanner } from "../ChangeRequestVerifyBanner";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeChangeRequest, makeVerification } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

describe("ChangeRequestVerifyBanner", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    resetChangeRequestsStore();
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("反映済みの CR ごとに検証の数と「検証する」を出し、押すと番号を渡す", async () => {
    useChangeRequestsStore.setState({
      list: [
        makeChangeRequest({ number: 4, title: "TOP20 にする", status: "applied" }),
        makeChangeRequest({ number: 5, title: "下書き", status: "draft" }),
      ],
    });
    stub.queue({ body: makeVerification({ number: 4, open_marks: 3, open_documents: 0, pending_stages: [1] }) });
    const onVerify = vi.fn();

    renderWithTheme(<ChangeRequestVerifyBanner projectId="p1" refreshKey="k" onVerify={onVerify} />);

    expect(screen.getByText("CR-4 TOP20 にする(反映済み)")).toBeInTheDocument();
    expect(screen.queryByText(/CR-5/)).not.toBeInTheDocument();
    expect(await screen.findByText("未確認の印 3 / 文書の側 0 / 未承認の段階 1")).toBeInTheDocument();
    expect(stub.requests[0].url).toContain("/projects/p1/change-requests/4/verification");
    await userEvent.click(screen.getByRole("button", { name: "CR-4 を検証する" }));
    expect(onVerify).toHaveBeenCalledWith(4);
  });

  it("反映済みの CR が無ければ何も出さない", () => {
    useChangeRequestsStore.setState({ list: [makeChangeRequest({ status: "verified" })] });

    renderWithTheme(<ChangeRequestVerifyBanner projectId="p1" refreshKey="k" onVerify={vi.fn()} />);

    expect(screen.queryByLabelText("変更要求の検証")).not.toBeInTheDocument();
    expect(stub.requests).toHaveLength(0);
  });
});

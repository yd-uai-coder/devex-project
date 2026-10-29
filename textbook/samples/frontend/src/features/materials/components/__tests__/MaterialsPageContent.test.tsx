// 作成：Phase-116-2｜更新：Phase-116(完了後の調整)
// SUT: MaterialsPageContent(資料の一覧と追加の画面)と、その中の MaterialList・MaterialCreateForm
// ドライバ: Testing Library(描画・入力・クリック)
// スタブ: 資料のストアの取得・追加の関数(vi.fn)と next/navigation の router ── 画面の配線
// (読み込み・フォームの入力から足す入力の組み立て・足した後の移動)だけを見るため
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaterialsPageContent } from "../MaterialsPageContent";
import { useMaterialsStore } from "../../materials-store";
import { makeMaterial, makeMaterialSummary } from "../../test-utils/materialFixtures";
import { resetMaterialsStore } from "../../test-utils/resetMaterialsStore";
import { renderWithTheme } from "@/features/change-requests/test-utils/renderWithStore";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("MaterialsPageContent", () => {
  beforeEach(() => {
    push.mockReset();
    resetMaterialsStore();
    useMaterialsStore.setState({
      list: [
        makeMaterialSummary(),
        makeMaterialSummary({ id: "m2", kind: "document", title: "運用メモ", source: "pdf", filename: "ops.pdf", length: 900 }),
      ],
    });
  });

  it("一覧を読み、題から資料のページへ移れる。種類・出どころ・文字数を出す", () => {
    renderWithTheme(<MaterialsPageContent projectId="p1" />);

    expect(useMaterialsStore.getState().fetchList).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("link", { name: "定例打ち合わせ 議事録" })).toHaveAttribute("href", "/projects/p1/materials/m1");
    expect(screen.getByText("PDF(ops.pdf)・900文字")).toBeInTheDocument();
    expect(screen.getByText("議事録")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "合意済みの版" })).toHaveAttribute("href", "/projects/p1/baselines");
  });

  it("貼り付けで足すと、足した資料のページへ移る。題が無いうちは足せない", async () => {
    useMaterialsStore.setState({ add: vi.fn().mockResolvedValue(makeMaterial({ id: "m9" })) });
    const user = userEvent.setup();
    renderWithTheme(<MaterialsPageContent projectId="p1" />);

    await user.click(screen.getByRole("button", { name: "資料を足す" }));
    // Phase-116(完了後の調整)：更新
    // expect(screen.getByText("題を書いてください。")).toBeInTheDocument();
    // ↓↓
    expect(screen.getByText("タイトルを書いてください。")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("種類"), "email");
    // Phase-116(完了後の調整)：更新
    // await user.type(screen.getByLabelText("題"), "外部向けの API");
    // ↓↓
    await user.type(screen.getByLabelText("タイトル"), "外部向けの API");
    await user.type(screen.getByRole("textbox", { name: /^本文/ }), "API は予定どおり");
    await user.click(screen.getAllByRole("button", { name: "資料を足す" }).at(-1)!);

    const add = useMaterialsStore.getState().add as ReturnType<typeof vi.fn>;
    expect(add).toHaveBeenCalledWith("p1", {
      meta: { kind: "email", title: "外部向けの API", material_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
      body: "API は予定どおり",
    });
    expect(push).toHaveBeenCalledWith("/projects/p1/materials/m9");
  });

  it("ファイルを選んで足す。足せなかったら理由を出す", async () => {
    useMaterialsStore.setState({ addError: "ファイルから本文を取り出せませんでした" });
    const user = userEvent.setup();
    renderWithTheme(<MaterialsPageContent projectId="p1" />);

    await user.click(screen.getByRole("button", { name: "資料を足す" }));
    // Phase-116(完了後の調整)：更新
    // await user.type(screen.getByLabelText("題"), "運用メモ");
    // ↓↓
    await user.type(screen.getByLabelText("タイトル"), "運用メモ");
    await user.click(screen.getByLabelText("ファイルを選ぶ"));
    await user.upload(screen.getByLabelText(/2MB まで/), new File(["# メモ"], "memo.md"));
    await user.click(screen.getAllByRole("button", { name: "資料を足す" }).at(-1)!);

    const add = useMaterialsStore.getState().add as ReturnType<typeof vi.fn>;
    expect((add.mock.calls[0][1] as { file: File }).file.name).toBe("memo.md");
    expect(screen.getByRole("alert")).toHaveTextContent("ファイルから本文を取り出せませんでした");
    expect(push).not.toHaveBeenCalled();
  });

  it("簡易モードのプロジェクトでは本体の代わりに知らせを出す", () => {
    useMaterialsStore.setState({ unavailable: true });
    renderWithTheme(<MaterialsPageContent projectId="p1" />);
    expect(screen.queryByRole("table", { name: "資料の一覧" })).not.toBeInTheDocument();
  });
});

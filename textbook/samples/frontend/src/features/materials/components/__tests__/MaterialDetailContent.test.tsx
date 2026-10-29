// 作成：Phase-116-2｜更新：Phase-116-3
// SUT: MaterialDetailContent(資料1件のページ)
// ドライバ: Testing Library(描画・クリック)
// スタブ: 資料のストアの取得・削除の関数(vi.fn)と next/navigation の router ── 読み込み・本文の表示・
// 確かめてから消して一覧へ戻る配線だけを見るため
// Phase-116-3:追記 ── ../../test-utils/materialFixtures.makeDifferences
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaterialDetailContent } from "../MaterialDetailContent";
import { useMaterialsStore } from "../../materials-store";
import { makeDifferences, makeMaterial } from "../../test-utils/materialFixtures";
import { resetMaterialsStore } from "../../test-utils/resetMaterialsStore";
import { renderWithTheme } from "@/features/change-requests/test-utils/renderWithStore";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("MaterialDetailContent", () => {
  beforeEach(() => {
    push.mockReset();
    resetMaterialsStore();
    useMaterialsStore.setState({ detail: makeMaterial() });
  });

  it("資料を読み、種類・日付・本文を出す", () => {
    renderWithTheme(<MaterialDetailContent projectId="p1" materialId="m1" />);

    expect(useMaterialsStore.getState().fetchDetail).toHaveBeenCalledWith("p1", "m1");
    expect(screen.getByRole("heading", { name: "定例打ち合わせ 議事録" })).toBeInTheDocument();
    expect(screen.getByText("議事録・2026-11-16・貼り付け・120文字")).toBeInTheDocument();
    expect(screen.getByLabelText("資料の本文")).toHaveTextContent("取得の間隔は12時間ごとのまま");
    expect(screen.getByRole("link", { name: "← 資料の一覧" })).toHaveAttribute("href", "/projects/p1/materials");
  });

  // Phase-116-3:追記
  it("違いの一覧を読めていれば、取り出しと違いの表を出す", () => {
    useMaterialsStore.setState({ differences: makeDifferences() });
    renderWithTheme(<MaterialDetailContent projectId="p1" materialId="m1" />);

    expect(screen.getByRole("heading", { name: "違いの一覧" })).toBeInTheDocument();
    expect(screen.getByLabelText("違いの取り出し")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "違い(未確認)" })).toBeInTheDocument();
  });

  it("確かめてから消し、消せたら一覧へ戻る", async () => {
    useMaterialsStore.setState({ remove: vi.fn().mockResolvedValue(true) });
    const user = userEvent.setup();
    renderWithTheme(<MaterialDetailContent projectId="p1" materialId="m1" />);

    await user.click(screen.getByRole("button", { name: "この資料を消す" }));
    expect(screen.getByText(/違いから作った変更要求は残ります/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "消す" }));

    expect(useMaterialsStore.getState().remove).toHaveBeenCalledWith("p1", "m1");
    expect(push).toHaveBeenCalledWith("/projects/p1/materials");
  });

  it("無い資料は見つからないと出す", () => {
    useMaterialsStore.setState({ detail: null, detailNotFound: true });
    renderWithTheme(<MaterialDetailContent projectId="p1" materialId="m1" />);
    expect(screen.getByRole("heading", { name: "資料が見つかりません" })).toBeInTheDocument();
  });
});

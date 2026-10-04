// 作成：Phase-17-8
// 写経レベル: コア ── 保存のたびに段階を取り直すこと、名前の衝突の扱い。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DataDictionaryTable } from "../DataDictionaryTable";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import {
  createDataItem,
  deleteDataItem,
  listDataItems,
  updateDataItem,
} from "@/features/uml/api/umlApi";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";
import { ApiError } from "@/lib/api/client";
import type { DataItemRead } from "@/features/uml/api/types";

vi.mock("@/features/uml/api/umlApi", () => ({
  listDataItems: vi.fn(),
  createDataItem: vi.fn(),
  updateDataItem: vi.fn(),
  deleteDataItem: vi.fn(),
}));

const item = (id: string, name: string, fields: DataItemRead["fields"] = []): DataItemRead => ({
  id,
  name,
  fields,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
});

function renderTable(disabled = false) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DataDictionaryTable projectId="p1" disabled={disabled} />
    </TamaguiProvider>,
  );
}

describe("DataDictionaryTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listDataItems).mockResolvedValue([
      item("i1", "予約", [{ name: "id", type: "UUID", required: true }]),
    ]);
    vi.mocked(createDataItem).mockResolvedValue(item("i2", "備品"));
    vi.mocked(updateDataItem).mockResolvedValue(item("i1", "予約"));
    vi.mocked(deleteDataItem).mockResolvedValue(undefined);
    useDetailedDesignStore.setState({ fetchStages: vi.fn().mockResolvedValue(undefined) });
    useUmlEditorStore.setState({ dataItems: [] });
  });

  it("一覧を表示し、開いている DFD のエディタのデータ項目も差し替える", async () => {
    renderTable();

    expect(
      await screen.findByRole("textbox", { name: "データ項目「予約」のフィールド" }),
    ).toHaveValue("id:UUID");
    expect(useUmlEditorStore.getState().dataItems.map((d) => d.name)).toEqual(["予約"]);
  });

  it("行を直して保存すると更新し(必須の指定は保つ)、段階の一覧を取り直す", async () => {
    const user = userEvent.setup();
    renderTable();
    const fields = await screen.findByRole("textbox", { name: "データ項目「予約」のフィールド" });

    await user.clear(fields);
    await user.type(fields, "id:str, item_id");
    await user.click(screen.getByRole("button", { name: "データ項目「予約」を保存" }));

    expect(updateDataItem).toHaveBeenCalledWith("p1", "i1", {
      name: "予約",
      fields: [
        { name: "id", type: "str", required: true },
        { name: "item_id", type: null, required: null },
      ],
    });
    expect(useDetailedDesignStore.getState().fetchStages).toHaveBeenCalledWith("p1");
  });

  it("追加した行が既存と同じ名前なら、保存の前に止める", async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByRole("textbox", { name: "データ項目「予約」の名前" });

    await user.click(screen.getByRole("button", { name: "データ項目を追加" }));
    const name = screen.getByRole("textbox", { name: "データ項目「新しいデータ項目」の名前" });
    await user.type(name, "予約");
    // 既存の行と同じラベルになるので、2つ目(追加した行)の保存を押す
    await user.click(screen.getAllByRole("button", { name: "データ項目「予約」を保存" })[1]);
    expect(screen.getByRole("alert")).toHaveTextContent("同じ名前");
    expect(createDataItem).not.toHaveBeenCalled();
  });

  it("新しい行の作成と、名前の衝突(409)の表示", async () => {
    const user = userEvent.setup();
    vi.mocked(createDataItem).mockRejectedValueOnce(
      new ApiError(409, "conflict", "DATA_ITEM_NAME_CONFLICT"),
    );
    renderTable();
    await screen.findByRole("textbox", { name: "データ項目「予約」の名前" });

    await user.click(screen.getByRole("button", { name: "データ項目を追加" }));
    await user.type(
      screen.getByRole("textbox", { name: "データ項目「新しいデータ項目」の名前" }),
      "備品",
    );
    await user.click(screen.getByRole("button", { name: "データ項目「備品」を保存" }));

    expect(createDataItem).toHaveBeenCalledWith("p1", { name: "備品", fields: [] });
    expect(await screen.findByRole("alert")).toHaveTextContent("同じ名前のデータ項目があります");
  });

  it("削除は確認してから行う", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderTable();
    const remove = await screen.findByRole("button", { name: "データ項目「予約」を削除" });

    await user.click(remove);
    expect(deleteDataItem).not.toHaveBeenCalled();
    await user.click(remove);
    expect(deleteDataItem).toHaveBeenCalledWith("p1", "i1");
    confirm.mockRestore();
  });

  it("生成中は読み込まず、編集させない", () => {
    renderTable(true);

    expect(screen.getByRole("status")).toHaveTextContent("生成中");
    expect(listDataItems).not.toHaveBeenCalled();
  });
});

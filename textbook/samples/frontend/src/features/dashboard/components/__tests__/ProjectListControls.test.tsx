// 作成：Phase-65-3
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "../../../../../tamagui.config";
import { ProjectListControls } from "../ProjectListControls";
import { DEFAULT_LIST_PARAMS } from "@/features/dashboard/list-params";
import type { ProjectListParams } from "@/features/dashboard/list-params";

function renderControls(value: ProjectListParams = DEFAULT_LIST_PARAMS) {
  const onChange = vi.fn();
  const view = render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ProjectListControls value={value} onChange={onChange} />
    </TamaguiProvider>,
  );
  const rerender = (next: ProjectListParams) =>
    view.rerender(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <ProjectListControls value={next} onChange={onChange} />
      </TamaguiProvider>,
    );
  return { onChange, rerender };
}

describe("ProjectListControls", () => {
  it("入力の途中では呼ばず、Enter で検索語を確定してページを1に戻す", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls({ ...DEFAULT_LIST_PARAMS, page: 3 });

    await user.type(screen.getByLabelText("タイトルで検索"), " 予約 ");
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_LIST_PARAMS, q: "予約", page: 1 });
  });

  it("「検索」ボタンでも確定する。検索語が変わらなければ呼ばない", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls({ ...DEFAULT_LIST_PARAMS, q: "勤怠" });

    await user.click(screen.getByRole("button", { name: "検索" }));
    expect(onChange).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("タイトルで検索"));
    await user.click(screen.getByRole("button", { name: "検索" }));

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_LIST_PARAMS, q: "" });
  });

  it("モードは選んだときにすぐ反映し、「すべて」は絞らない", async () => {
    const user = userEvent.setup();
    const { onChange, rerender } = renderControls();

    await user.click(screen.getByRole("radio", { name: "詳細設計" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_LIST_PARAMS, mode: "detailed" });

    rerender({ ...DEFAULT_LIST_PARAMS, mode: "detailed" });
    await user.click(screen.getByRole("radio", { name: "すべて" }));
    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_LIST_PARAMS);
  });

  it("進行状態は複数を選べ、定めた順に並べて渡す", async () => {
    const user = userEvent.setup();
    const { onChange } = renderControls({ ...DEFAULT_LIST_PARAMS, statuses: ["revising"] });

    await user.click(screen.getByRole("checkbox", { name: "ヒアリング中" }));

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_LIST_PARAMS,
      statuses: ["interviewing", "revising"],
    });
  });

  it("条件があるときだけ「条件をクリア」を出し、押すと既定の条件に戻す", async () => {
    const user = userEvent.setup();
    const { onChange, rerender } = renderControls();
    expect(screen.queryByRole("button", { name: "条件をクリア" })).not.toBeInTheDocument();

    rerender({ q: "予約", mode: "simple", statuses: ["completed"], page: 2 });
    await user.click(screen.getByRole("button", { name: "条件をクリア" }));

    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_LIST_PARAMS);
  });

  it("確定済みの検索語が外から変わったら(戻る・クリア)、入力欄を合わせる", () => {
    const { rerender } = renderControls({ ...DEFAULT_LIST_PARAMS, q: "予約" });
    expect(screen.getByLabelText("タイトルで検索")).toHaveValue("予約");

    rerender(DEFAULT_LIST_PARAMS);

    expect(screen.getByLabelText("タイトルで検索")).toHaveValue("");
  });
});

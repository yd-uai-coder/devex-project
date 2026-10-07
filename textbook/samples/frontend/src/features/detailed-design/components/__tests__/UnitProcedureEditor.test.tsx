// 作成：Phase-28-4
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { UnitProcedureEditor } from "../UnitProcedureEditor";
import { getUnitContext } from "@/features/detailed-design/api/designStagesApi";
import type { ProcedureDocModel, UnitContextRead } from "@/features/detailed-design/api/types";
import { procedureUnits } from "@/features/detailed-design/procedureDocOps";
import { makePlan, makeProcedureDoc } from "../../test-utils/stageFixtures";

// SUT: UnitProcedureEditor / ドライバ: render と操作 /
// スタブ: 参照の API(getUnitContext。サーバーが展開した設計を返す)と、onChange・onFix。

vi.mock("@/features/detailed-design/api/designStagesApi", () => ({
  getUnitContext: vi.fn(),
}));

const CONTEXT: UnitContextRead = {
  unit_id: "M-01-T02",
  refs: [
    {
      kind: "procedure",
      key: "F-01",
      resolved: true,
      via: null,
      label: "段階5 F-01 予約を登録する",
      markdown: "### 段階5 F-01 予約を登録する\n\n| No | ... |",
    },
    {
      kind: "module",
      key: "app/unknown.py",
      resolved: false,
      via: null,
      label: "段階4 `app/unknown.py`",
      markdown: null,
    },
  ],
  crosscutting: "### 07章 横断事項",
  environment: "",
};

function renderEditor(doc: ProcedureDocModel, unitId = "M-01-T02") {
  const onChange = vi.fn();
  const onFix = vi.fn();
  const unit = procedureUnits(makePlan(), doc).find((u) => u.id === unitId)!;
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <UnitProcedureEditor
        projectId="p1"
        unit={unit}
        doc={doc}
        disabled={false}
        onChange={onChange}
        onFix={onFix}
      />
    </TamaguiProvider>,
  );
  return { onChange, onFix };
}

describe("UnitProcedureEditor", () => {
  beforeEach(() => {
    vi.mocked(getUnitContext).mockReset().mockResolvedValue(CONTEXT);
  });

  it("参照する設計を読み、押すと展開する。設計に無い参照は押せない", async () => {
    const user = userEvent.setup();
    renderEditor(makeProcedureDoc());

    await user.click(await screen.findByRole("button", { name: "段階5 F-01 予約を登録する" }));

    expect(getUnitContext).toHaveBeenCalledWith("p1", "M-01-T02");
    expect(screen.getByLabelText("段階5 F-01 予約を登録する の展開")).toHaveTextContent("| No |");
    expect(screen.getByText("段階4 `app/unknown.py`(設計に無い)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "07章 横断事項" })).toBeInTheDocument();
  });

  it("参照の取得に失敗したら理由を出す", async () => {
    vi.mocked(getUnitContext).mockRejectedValue(new Error("段階8が開いていません"));
    renderEditor(makeProcedureDoc());

    expect(await screen.findByRole("alert")).toHaveTextContent("段階8が開いていません");
  });

  it("手順書の無い単位は、生成を促す", async () => {
    renderEditor(makeProcedureDoc(), "M-01-T01");

    expect(screen.getByText(/この単位の手順書はまだありません/)).toBeInTheDocument();
    expect(screen.queryByLabelText("目的")).not.toBeInTheDocument();
    await screen.findByRole("button", { name: "段階5 F-01 予約を登録する" });
  });

  it("欄の編集と行の追加・削除を onChange で返す", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor(makeProcedureDoc());

    await user.type(screen.getByLabelText("確認方法"), "!");
    expect(onChange.mock.calls.at(-1)?.[0].units[0].verify).toEqual(["テストが通る!"]);
    await user.click(screen.getByRole("button", { name: "ファイルを足す" }));
    expect(onChange.mock.calls.at(-1)?.[0].units[0].files).toHaveLength(2);
    await user.click(screen.getByLabelText("指摘 1 を削除"));
    expect(onChange.mock.calls.at(-1)?.[0].units[0].findings).toEqual([]);
    await user.click(screen.getByRole("button", { name: "この単位の手順書を削除" }));
    expect(onChange.mock.calls.at(-1)?.[0].units).toEqual([]);
    await screen.findByRole("button", { name: "段階5 F-01 予約を登録する" });
  });

  it("AI の指摘の「段階Nで直す」で対象の段階へ移る", async () => {
    const user = userEvent.setup();
    const { onFix } = renderEditor(makeProcedureDoc());

    await user.click(screen.getByRole("button", { name: "段階7で直す" }));

    expect(onFix).toHaveBeenCalledWith(7, "07章 例外と HTTP");
    await screen.findByRole("button", { name: "段階5 F-01 予約を登録する" });
  });

  it("段階7とタスク名が合わない手順書には、作り直すか削除するよう出す", async () => {
    const doc = makeProcedureDoc();
    doc.units[0].title = "旧い名前";
    renderEditor(doc);

    expect(screen.getByRole("status")).toHaveTextContent("作ったときのタスク名「旧い名前」");
    await screen.findByRole("button", { name: "段階5 F-01 予約を登録する" });
  });
});

// 作成：Phase-28-4｜更新：Phase-29-5,30-5,31-5
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { UnitProcedureEditor } from "../UnitProcedureEditor";
// Phase-30-5：更新
// import { getUnitContext } from "@/features/detailed-design/api/designStagesApi";
// ↓↓
import { getUnitAiMarkdown, getUnitContext } from "@/features/detailed-design/api/designStagesApi";
// Phase-31-5：更新
// import type { ProcedureDocModel, UnitContextRead } from "@/features/detailed-design/api/types";
// ↓↓
import type {
  ProcedureDocModel,
  ProjectMode,
  UnitContextRead,
} from "@/features/detailed-design/api/types";
import { procedureUnits } from "@/features/detailed-design/procedureDocOps";
import { makePlan, makeProcedureDoc } from "../../test-utils/stageFixtures";

// SUT: UnitProcedureEditor / ドライバ: render と操作 /
// Phase-30-5：更新
// // スタブ: 参照の API(getUnitContext。サーバーが展開した設計を返す)と、onChange・onFix。
// ↓↓
// スタブ: 参照の API(getUnitContext。サーバーが展開した設計を返す)、AI 向けの版の API
// (getUnitAiMarkdown。サーバーが組み立てた md を返す)、クリップボード(navigator.clipboard.writeText)、
// onChange・onFix。

vi.mock("@/features/detailed-design/api/designStagesApi", () => ({
  // Phase-30-5:追記
  getUnitAiMarkdown: vi.fn(),
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
      // Phase-29-5:追記
      svg: '<svg data-testid="unit-sequence"></svg>',
    },
    {
      kind: "module",
      key: "app/unknown.py",
      resolved: false,
      via: null,
      label: "段階4 `app/unknown.py`",
      markdown: null,
      // Phase-29-5:追記
      svg: null,
    },
  ],
  crosscutting: "### 07章 横断事項",
  environment: "",
};

// Phase-30-5：更新
// function renderEditor(doc: ProcedureDocModel, unitId = "M-01-T02") {
// ↓↓
// Phase-31-5：更新
// function renderEditor(doc: ProcedureDocModel, unitId = "M-01-T02", unsaved = false) {
// ↓↓
function renderEditor(
  doc: ProcedureDocModel,
  unitId = "M-01-T02",
  unsaved = false,
  mode: ProjectMode = "detailed",
) {
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
        // Phase-30-5:追記
        unsaved={unsaved}
        // Phase-31-5:追記
        mode={mode}
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

  // Phase-29-5:追記
  it("段階5の手順の参照を展開すると、シーケンス図の SVG も出す(他の参照には出さない)", async () => {
    const user = userEvent.setup();
    renderEditor(makeProcedureDoc());

    await user.click(await screen.findByRole("button", { name: "段階5 F-01 予約を登録する" }));
    expect(
      screen.getByRole("img", { name: "段階5 F-01 予約を登録する のシーケンス図" }),
    ).toContainElement(screen.getByTestId("unit-sequence"));

    await user.click(screen.getByRole("button", { name: "07章 横断事項" }));
    expect(screen.queryByTestId("unit-sequence")).not.toBeInTheDocument();
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

  // Phase-30-5:追記
  it("AI 向けにコピーすると、サーバーの md を写し、未承認と未定義の残りを警告する", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    vi.mocked(getUnitAiMarkdown).mockReset().mockResolvedValue({
      unit_id: "M-01-T02",
      markdown: "あなたは実装担当者です。",
      state: "reviewing",
      finding_total: 2,
      critical: 1,
    });
    renderEditor(makeProcedureDoc());

    await user.click(screen.getByRole("button", { name: "AI 向けにコピー" }));

    const status = await screen.findByText("コピーしました。");
    expect(getUnitAiMarkdown).toHaveBeenCalledWith("p1", "M-01-T02");
    expect(writeText).toHaveBeenCalledWith("あなたは実装担当者です。");
    expect(status.closest('[role="status"]')).toHaveTextContent("段階8は未承認です");
    expect(status.closest('[role="status"]')).toHaveTextContent("2 件残っています(最重要 1 件)");
  });

  it("コピーに失敗したら理由を出す", async () => {
    const user = userEvent.setup();
    vi.mocked(getUnitAiMarkdown).mockReset().mockRejectedValue(new Error("手順書がありません"));
    renderEditor(makeProcedureDoc());

    await user.click(screen.getByRole("button", { name: "AI 向けにコピー" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("手順書がありません");
  });

  it("保存していない編集があるときは、コピーできない", () => {
    renderEditor(makeProcedureDoc(), "M-01-T02", true);
    expect(screen.getByRole("button", { name: "AI 向けにコピー" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/保存してからコピーしてください/)).toBeInTheDocument();
  });

  it("手順書の無い単位には、コピーのボタンを出さない", () => {
    renderEditor(makeProcedureDoc(), "M-01-T01");
    expect(screen.queryByRole("button", { name: "AI 向けにコピー" })).not.toBeInTheDocument();
  });

  // Phase-31-5:追記
  it("簡易モードは直す先を文書で選び、文書の画面へのリンクを出す", async () => {
    const user = userEvent.setup();
    const doc = makeProcedureDoc();
    doc.units[0].findings = [
      { level: "major", target: "DF-1", message: "応答が無い", fix_stage: 8, fix_document: "internal_design" },
    ];
    const { onChange } = renderEditor(doc, "M-01-T02", false, "simple");

    expect(screen.getByRole("link", { name: "内部設計書を直す(再生成)" })).toHaveAttribute(
      "href",
      "/projects/p1/documents",
    );
    await user.selectOptions(screen.getByLabelText("指摘 1 の直す先"), "implementation_plan");
    const changed = onChange.mock.calls.at(-1)?.[0] as ProcedureDocModel;
    expect(changed.units[0].findings[0]).toMatchObject({
      fix_stage: 8,
      fix_document: "implementation_plan",
    });
    expect(await screen.findByRole("button", { name: "内部設計書 3.4" })).toBeInTheDocument();
  });
});

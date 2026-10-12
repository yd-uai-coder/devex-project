// 作成：Phase-18-8｜更新：Phase-44-3
// Phase-44-3:追記 ── ../../test-utils/stageFixtures(impactWith, makeMark), @/features/detailed-design/detailed-design-store.useDetailedDesignStore
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { CrudMatrix } from "../CrudMatrix";
import type { CrudModel, DfdAccess } from "@/features/detailed-design/api/types";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import {
  impactWith,
  makeCrud,
  makeFunctionList,
  makeMark,
} from "../../test-utils/stageFixtures";

// SUT: CrudMatrix / ドライバ: render と入力の操作 / スタブ: onChange(vi.fn)── 編集の結果を受け取る
// 親の代わり。セルの書き換えの規則そのものは crudOps.test.ts で検証する。

const ACCESSES: DfdAccess[] = [{ function_id: "F-01", table: "reservations", kind: "write" }];

function renderMatrix(model: CrudModel, onChange = vi.fn(), disabled = false) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <CrudMatrix
        functions={makeFunctionList().functions}
        tables={["reservations", "users"]}
        model={model}
        accesses={ACCESSES}
        disabled={disabled}
        onChange={onChange}
      />
    </TamaguiProvider>,
  );
  return onChange;
}

describe("CrudMatrix", () => {
  it("処理 × テーブルのセルを出し、下書きと DFD 由来のセルを区別する", () => {
    renderMatrix(makeCrud("C", true));

    const cell = screen.getByLabelText("F-01 × reservations");
    expect(cell).toHaveValue("C");
    expect(cell.closest("td")).toHaveAttribute("data-draft", "true");
    expect(cell.closest("td")).toHaveAttribute("data-dfd", "true");
    expect(cell.closest("td")).toHaveAttribute("title", "DFD: 書き込み");
    expect(screen.getByLabelText("F-01 × users")).toHaveValue("");
    expect(screen.getByLabelText("F-01 × users").closest("td")).not.toHaveAttribute("data-dfd");
    expect(screen.getByText(/下書きのセル: 1個/)).toBeInTheDocument();
  });

  it("セルを書き換えると、下書きの印を外したモデルを渡す", () => {
    const onChange = renderMatrix(makeCrud("C", true));

    fireEvent.change(screen.getByLabelText("F-01 × reservations"), { target: { value: "cu" } });

    expect(onChange).toHaveBeenCalledWith({
      cells: [{ function_id: "F-01", table: "reservations", ops: "CU", draft: false }],
    });
  });

  it("disabled のときは編集させない", () => {
    renderMatrix(makeCrud(), vi.fn(), true);
    expect(screen.getByLabelText("F-01 × reservations")).toBeDisabled();
  });

  // Phase-44-3:追記
  it("変更の影響の印をセルに出し、「表で見る」のセルを強調する", () => {
    useDetailedDesignStore.setState({
      impact: impactWith(makeMark({ key: "crud:F-01×reservations", stage: 3 })),
      highlight: { stage: 3, key: "crud:F-01×reservations" },
    });
    renderMatrix(makeCrud());

    const cell = screen.getByLabelText("F-01 × reservations").closest("td");
    expect(cell).toHaveAttribute("aria-current", "true");
    expect(cell?.querySelector('[aria-label="変更の影響: 見直し"]')).not.toBeNull();
    useDetailedDesignStore.setState({ impact: null, highlight: null });
  });
});

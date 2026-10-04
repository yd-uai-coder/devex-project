// 作成：Phase-18-7
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { TableDefinitionTable } from "../TableDefinitionTable";
import type { ErSemanticModel } from "@/features/uml/api/types";

// SUT: TableDefinitionTable / ドライバ: render / スタブ不要 ── 渡した ER を表にするだけで、
// 外部依存を呼ばないため。

const MODEL: ErSemanticModel = {
  notation: "er",
  elements: [
    {
      id: "t1",
      name: "users",
      kind: "table",
      description: "利用者",
      columns: [
        { name: "id", type: "UUID", is_primary_key: true, is_foreign_key: false, nullable: false },
        {
          name: "email",
          type: "VARCHAR(255)",
          is_primary_key: false,
          is_foreign_key: false,
          nullable: false,
          constraints: "UNIQUE",
          description: "ログイン ID",
        },
      ],
    },
  ],
  relations: [],
};

function renderTable(model: ErSemanticModel | null) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <TableDefinitionTable model={model} />
    </TamaguiProvider>,
  );
}

describe("TableDefinitionTable", () => {
  it("ER のテーブルごとに、列の型・PK・制約・説明を出す", () => {
    renderTable(MODEL);

    const table = screen.getByRole("table", { name: "テーブル定義" });
    expect(within(table).getByText("users")).toBeInTheDocument();
    expect(within(table).getByText(/利用者/)).toBeInTheDocument();
    const email = within(table).getByText("email").closest("tr");
    expect(email).not.toBeNull();
    expect(within(email as HTMLElement).getByText("UNIQUE")).toBeInTheDocument();
    expect(within(email as HTMLElement).getByText("ログイン ID")).toBeInTheDocument();
    // 編集はここでなく ER の属性パネルで行う
    expect(within(table).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("ER が無ければ何も出さない", () => {
    renderTable(null);
    expect(screen.queryByText("テーブル定義")).not.toBeInTheDocument();
  });

  it("テーブルが無い ER は案内を出す", () => {
    renderTable({ notation: "er", elements: [], relations: [] });
    expect(screen.getByText("ER にテーブルがありません。")).toBeInTheDocument();
  });
});

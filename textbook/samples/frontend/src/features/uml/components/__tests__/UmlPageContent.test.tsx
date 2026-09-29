// 作成：Phase-7-3
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { UmlPageContent } from "../UmlPageContent";

// Phase 7の技術検証スパイク用テスト。React Flow自体の描画ロジックは検証せず、
// Tamagui配下でコンポーネントが例外なくマウントできること・受け取ったprojectIdを
// 表示することだけを見る(意味モデル連携はPhase 11以降のテストで検証する)。
describe("UmlPageContent", () => {
  it("プロジェクトIDとスパイクである旨を表示する", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <UmlPageContent projectId="p1" />
      </TamaguiProvider>,
    );

    expect(screen.getByText("UML設計図レビュー(Phase 7 技術検証スパイク)")).toBeInTheDocument();
    expect(screen.getByText(/プロジェクトID: p1/)).toBeInTheDocument();
  });
});

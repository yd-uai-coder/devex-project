// 作成：Phase-118(完了後の調整2)
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderGuide } from "../../test-utils/renderGuide";
import { GuideModeBranch } from "../GuideModeBranch";

describe("GuideModeBranch", () => {
  it("共通の文書 → モードごとの文書 → 共通の文書 → 詳細だけの合意と変更管理の順に並べる", () => {
    renderGuide(<GuideModeBranch />);

    const figure = screen.getByRole("figure", { name: "2つのモードの分かれ目" });
    const text = figure.textContent ?? "";
    const order = ["ヒアリング", "要件定義書・外部設計書", "内部設計書", "詳細設計書・設計図", "実装計画書・テスト仕様書・実装手順書", "変更の説明書"];
    const positions = order.map((part) => text.indexOf(part));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(within(figure).getByLabelText("簡易ドキュメントモード")).toHaveTextContent("内部設計書");
    expect(within(figure).getByLabelText("詳細設計モード")).toHaveTextContent("詳細設計書・設計図");
  });
});

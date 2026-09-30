// 作成：Phase-11-5
import { describe, expect, it } from "vitest";
import { nodeBoxStyle } from "../nodeStyles";

describe("nodeBoxStyle", () => {
  it("選択中は太い青枠にする", () => {
    expect(nodeBoxStyle(true).border).toBe("2px solid var(--blue10)");
    expect(nodeBoxStyle(false).border).toBe("1px solid var(--borderColor)");
  });

  it("追加のスタイルで上書きできる", () => {
    expect(nodeBoxStyle(false, { borderRadius: 16 }).borderRadius).toBe(16);
  });
});

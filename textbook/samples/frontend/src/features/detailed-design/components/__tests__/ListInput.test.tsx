// 作成：Phase-23-6
// 写経レベル: 定型 ── 区切りの入力の確認。
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ListInput } from "../ListInput";

// SUT: ListInput(段階4の ModuleListTable から切り出した「,」区切りの入力欄。Phase 23)
// ドライバ: render と入力 / スタブ不要 ── 外部依存を呼ばず、onChange に配列を返すだけのため。
function Harness({ onChange }: { onChange: (items: string[]) => void }) {
  const [items, setItems] = useState<string[]>(["a"]);
  return (
    <ListInput
      label="一覧"
      items={items}
      disabled={false}
      style={{}}
      onChange={(next) => {
        setItems(next);
        onChange(next);
      }}
    />
  );
}

describe("ListInput", () => {
  it("区切りの「,」を打っても消えず、配列に直した値を返す", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const input = screen.getByLabelText("一覧");
    await user.type(input, ", b");

    expect(input).toHaveValue("a, b");
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
  });
});

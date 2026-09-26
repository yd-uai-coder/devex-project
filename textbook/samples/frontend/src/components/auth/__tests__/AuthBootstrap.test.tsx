// 作成：Phase-3-1
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { AuthBootstrap } from "../AuthBootstrap";
import { useAuthStore } from "../auth-store";

describe("AuthBootstrap", () => {
  const originalBootstrap = useAuthStore.getState().bootstrap;

  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, status: "idle", error: null });
  });

  afterEach(() => {
    useAuthStore.setState({ bootstrap: originalBootstrap });
  });

  it("マウント時にストアのbootstrap()を1回だけ呼ぶ", () => {
    const bootstrap = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ bootstrap });

    render(<AuthBootstrap />);

    expect(bootstrap).toHaveBeenCalledTimes(1);
  });

  it("何もレンダリングしない", () => {
    useAuthStore.setState({ bootstrap: vi.fn().mockResolvedValue(undefined) });

    const { container } = render(<AuthBootstrap />);

    expect(container).toBeEmptyDOMElement();
  });
});

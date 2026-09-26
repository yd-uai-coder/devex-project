// 更新：Phase-3-6
import "@testing-library/jest-dom/vitest";

// Guarded because some test files opt into the "node" environment
// (e.g. via `// @vitest-environment node`), where `window` doesn't exist.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // jsdom does not implement Element.scrollIntoView. Tamagui's Select calls it
  // when opening the listbox (to scroll to the selected item), which otherwise
  // throws "scrollIntoView is not a function" and crashes any test that opens a
  // Select dropdown.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  // Phase-3-6:追記 ── DocumentTabs(Tamagui Tabs)を初めてテストからレンダリングした際、
  // jsdomがResizeObserverを実装していないため落ちた。Select用のscrollIntoViewポリフィル
  // と同じ理由でここに追加する。
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

// 作成：Phase-63-1
import { afterEach, describe, expect, it } from "vitest";
import { clearLoginFlag, LOGIN_FLAG_COOKIE, setLoginFlag } from "../auth-flag";

// SUT = setLoginFlag・clearLoginFlag、ドライバ = このテスト。スタブ不要 ── 書く先の
// document.cookie は jsdom がそのまま持つため、書いた結果を読んで確かめられる。
function flagValue(): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${LOGIN_FLAG_COOKIE}=`))
    ?.slice(LOGIN_FLAG_COOKIE.length + 1);
}

describe("ログインの印の cookie", () => {
  afterEach(() => {
    clearLoginFlag();
  });

  it("setLoginFlag で印が付き、clearLoginFlag で消える", () => {
    setLoginFlag();
    expect(flagValue()).toBe("1");

    clearLoginFlag();
    expect(flagValue()).toBeUndefined();
  });

  it("付け直しても印は1つだけ", () => {
    setLoginFlag();
    setLoginFlag();

    expect(document.cookie.split("; ").filter((c) => c.startsWith(`${LOGIN_FLAG_COOKIE}=`))).toHaveLength(1);
  });

  it("印が無いときに消しても何も起きない", () => {
    clearLoginFlag();
    expect(flagValue()).toBeUndefined();
  });
});

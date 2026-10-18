// 作成：Phase-76-1｜更新：Phase-77-2
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import type { ReactNode } from "react";
import tamaguiConfig from "@/tamagui.config";
import { GoogleSignInButton } from "../GoogleSignInButton";
import type { GoogleButtonText } from "../GoogleSignInButton";
import { googleClientId, isFakeGoogle } from "@/features/auth/google-config";

// Google のスクリプト(accounts.google.com/gsi/client)を読まないよう、ライブラリを差し替える。
// GoogleLogin は受け取った props を記録し、テストから onSuccess を呼べるようにする。
type GoogleLoginProps = {
  text?: string;
  onSuccess: (response: { credential?: string }) => void;
  onError?: () => void;
};
const google = vi.hoisted(() => ({
  lastLoginProps: null as GoogleLoginProps | null,
  providerClientId: null as string | null,
}));

vi.mock("@react-oauth/google", () => ({
  GoogleOAuthProvider: ({ clientId, children }: { clientId: string; children: ReactNode }) => {
    google.providerClientId = clientId;
    return <>{children}</>;
  },
  GoogleLogin: (props: GoogleLoginProps) => {
    google.lastLoginProps = props;
    return <div data-testid="google-login" />;
  },
}));

function renderButton(text: GoogleButtonText = "signin_with") {
  const onCredential = vi.fn();
  const onError = vi.fn();
  const view = render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <GoogleSignInButton text={text} onCredential={onCredential} onError={onError} />
    </TamaguiProvider>,
  );
  return { onCredential, onError, view };
}

describe("google-config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("空のクライアント ID は null、E2E の印は \"true\" のときだけ", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_E2E_FAKE_GOOGLE", "1");
    expect(googleClientId()).toBeNull();
    expect(isFakeGoogle()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "client-123");
    vi.stubEnv("NEXT_PUBLIC_E2E_FAKE_GOOGLE", "true");
    expect(googleClientId()).toBe("client-123");
    expect(isFakeGoogle()).toBe(true);
  });
});

describe("GoogleSignInButton", () => {
  beforeEach(() => {
    google.lastLoginProps = null;
    google.providerClientId = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("クライアント ID が無ければ何も出さない", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_E2E_FAKE_GOOGLE", "");
    renderButton();

    expect(screen.queryByTestId("google-login")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Google で続ける(E2E)")).not.toBeInTheDocument();
  });

  it("クライアント ID があれば Provider で包んだ Google のボタンを出し、文言を渡す", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "client-123");
    renderButton("signup_with");

    expect(screen.getByTestId("google-login")).toBeInTheDocument();
    expect(google.providerClientId).toBe("client-123");
    expect(google.lastLoginProps?.text).toBe("signup_with");
  });

  // Phase-77-2:追記
  it("マイページの連携の文言(continue_with)も渡せる", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "client-123");
    renderButton("continue_with");

    expect(google.lastLoginProps?.text).toBe("continue_with");
  });

  it("Google が返した credential を onCredential に渡し、credential が無ければ onError", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "client-123");
    const { onCredential, onError } = renderButton();

    google.lastLoginProps?.onSuccess({ credential: "id-token" });
    expect(onCredential).toHaveBeenCalledWith("id-token");

    google.lastLoginProps?.onSuccess({});
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("E2E のときは偽のボタンを出し、入れたメールで偽の credential を作る", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_E2E_FAKE_GOOGLE", "true");
    const user = userEvent.setup();
    const { onCredential } = renderButton();

    expect(screen.queryByTestId("google-login")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("偽の Google アカウント(E2E)"), "g@example.com");
    await user.click(screen.getByLabelText("Google で続ける(E2E)"));

    expect(onCredential).toHaveBeenCalledWith("fake:g@example.com:g@example.com");
  });
});

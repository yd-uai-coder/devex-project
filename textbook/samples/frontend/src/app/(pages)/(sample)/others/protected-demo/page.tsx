// 更新：Phase-3-1
"use client";

import { Text, XStack, YStack, H3 } from "tamagui";
import { Breadcrumb } from "@/components/ui/primitives/Breadcrumb";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import { StyledCard } from "@/components/ui/primitives/StyledCard";
import { useAuthStore } from "@/components/auth/auth-store";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { GuardedLink } from "@/components/auth/GuardedLink";
import { useHasMounted } from "@/hooks/useHasMounted";

// 実運用ではバックエンドのログインAPIが返すJWTを使うが、このテンプレートには
// 実バックエンドが無いため、デモ用にheader.payload.signature形式の「見た目だけJWT」を
// その場で生成する(署名は検証されないダミー文字列)。expは10分後にしてあるので、
// auth-storeのサイレントリフレッシュタイマーが約9分後に発火し、バックエンドが無いために
// リフレッシュ失敗→自動ログアウトする様子まで確認できる。
function createMockAccessToken(): string {
  const base64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const header = base64url({ alg: "none", typ: "JWT" });
  const payload = base64url({ sub: "demo-user", exp: Math.floor(Date.now() / 1000) + 600 });
  return `${header}.${payload}.mock-signature`;
}

export default function ProtectedDemoPage() {
  const mounted = useHasMounted();
  const accessToken = useAuthStore((s) => s.accessToken);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);

  return (
    <YStack paddingVertical="$4" gap="$6">
      <Breadcrumb
        pageTitle="認証ガード"
        description="src/lib/api/(client.ts等)とsrc/components/auth/(auth-store, RequireAuth, GuardedLink, LoginRequiredDialog)によるFastAPI(JWT)連携・認証ガードの雛形サンプルです。このテンプレートには実バックエンドが無いため、ここではモックのトークンでログイン状態を再現しています。"
      />

      <YStack gap="$3">
        <H3>ログイン状態</H3>
        <StyledCard>
          <Text fontSize="$4">
            現在の状態: {!mounted ? "確認中..." : accessToken ? "ログイン中(モック)" : "未ログイン"}
          </Text>
          <XStack gap="$3">
            {/* Phase-3-1：更新(login()がaccessTokenの1引数のみを受け取るようになったため) */}
            {/* <StyledButton onPress={() => login(createMockAccessToken(), "mock-refresh-token")}> */}
            {/* ↓↓ */}
            <StyledButton onPress={() => login(createMockAccessToken())}>
              モックでログインする
            </StyledButton>
            <StyledButton theme="red" onPress={logout}>
              ログアウト
            </StyledButton>
          </XStack>
          {/* Phase-3-1：更新(リフレッシュトークンの扱いが変わった旨の説明文を修正) */}
          {/* <Text fontSize="$2" color="$color11"> */}
          {/*   実際のアプリでは、ログインフォームからバックエンドのログインAPIを呼び出して得たトークンを */}
          {/*   login(accessToken, refreshToken)へ渡す。/loginページ自体はアプリごとに異なるためこのテンプレートには含まれていない。 */}
          {/* </Text> */}
          {/* ↓↓ */}
          <Text fontSize="$2" color="$color11">
            実際のアプリでは、ログインフォームからバックエンドのログインAPIを呼び出して得たアクセストークンを
            login(accessToken)へ渡す。リフレッシュトークンはhttpOnly Cookieでサーバーが管理するため
            クライアント側では扱わない。/loginページ自体はアプリごとに異なるためこのテンプレートには含まれていない。
          </Text>
        </StyledCard>
      </YStack>

      <YStack gap="$3">
        <H3>RequireAuthで保護されたコンテンツ</H3>
        <StyledCard>
          <RequireAuth>
            <Text fontSize="$4">ログイン中のみ表示されるコンテンツです。</Text>
          </RequireAuth>
        </StyledCard>
      </YStack>

      <YStack gap="$3">
        <H3>GuardedLink</H3>
        <StyledCard gap="$2">
          <Text fontSize="$4">未ログインで下のリンクを踏むと、遷移前にログイン必須ダイアログが表示されます。</Text>
          <GuardedLink href="/others/count">保護されたページへ移動</GuardedLink>
        </StyledCard>
      </YStack>
    </YStack>
  );
}

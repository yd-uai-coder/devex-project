// 作成：Phase-76-1
"use client";

import { useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { YStack } from "tamagui";
import InputSimpleText from "@/components/ui/form/InputSimpleText";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import { googleClientId, isFakeGoogle } from "@/features/auth/google-config";

// Google のボタンの文言。処理はどちらも同じで、画面に合わせて「ログイン」か「登録」かを変える。
export type GoogleButtonText = "signin_with" | "signup_with";

type GoogleSignInButtonProps = {
  text: GoogleButtonText;
  // Google が返した ID トークン(credential)。API に送って本人を確かめてもらう。
  onCredential: (credential: string) => void;
  // ポップアップを閉じた・読み込めなかったなど、credential を得られなかったとき。
  onError: () => void;
};

// Google でのログインのボタン。GoogleOAuthProvider はボタンのある画面でだけ Google の
// スクリプトを読み込むよう、この部品の中に置く(アプリ全体には置かない)。
// クライアント ID が無い環境では何も出さない。E2E のときは偽のボタンを出す。
export function GoogleSignInButton({ text, onCredential, onError }: GoogleSignInButtonProps) {
  if (isFakeGoogle()) return <FakeGoogleButton onCredential={onCredential} />;

  const clientId = googleClientId();
  if (!clientId) return null;

  return (
    <GoogleOAuthProvider clientId={clientId} locale="ja">
      <GoogleLogin
        text={text}
        width={300}
        onSuccess={(response) => {
          if (response.credential) onCredential(response.credential);
          else onError();
        }}
        onError={onError}
      />
    </GoogleOAuthProvider>
  );
}

// E2E 用の偽のボタン。入れたメールで `fake:<sub>:<email>` を作る(sub もメールにする。同じメールなら
// 同じ Google アカウントとして扱われる)。ラベルとボタンの文言は、E2E が使う「メールアドレス」
// 「ログイン」「登録する」と部分一致しないようにしてある。
function FakeGoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const [email, setEmail] = useState("");

  return (
    <YStack gap="$2" width="100%">
      <InputSimpleText
        label="偽の Google アカウント(E2E)"
        width="100%"
        name="fakeGoogleEmail"
        value={email}
        onChangeText={setEmail}
        placeholder="google-user@example.com"
      />
      <StyledButton
        aria-label="Google で続ける(E2E)"
        disabled={!email}
        onPress={() => onCredential(`fake:${email}:${email}`)}
      >
        Google で続ける(E2E)
      </StyledButton>
    </YStack>
  );
}

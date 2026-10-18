// 作成：Phase-76-1
// Google でのログインの設定。NEXT_PUBLIC_ の値はビルドのときに埋め込まれる(Next.js は
// `process.env.NEXT_PUBLIC_...` と書いた所だけを置き換えるので、分割代入や動的なキーで読まない)。
// 関数にしてあるのは、テストが vi.stubEnv で値を変えられるようにするため。

// OAuth クライアント ID。無い環境(未設定・空)では null を返し、Google のボタンを出さない。
export function googleClientId(): string | null {
  const value = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  return value ? value : null;
}

// E2E のときだけ true。本物の Google のボタンの代わりに、偽の credential(`fake:<sub>:<email>`)を
// 送るボタンを出す。API 側も E2E_FAKE_GOOGLE のときだけ偽の credential を受け付ける。
export function isFakeGoogle(): boolean {
  return process.env.NEXT_PUBLIC_E2E_FAKE_GOOGLE === "true";
}

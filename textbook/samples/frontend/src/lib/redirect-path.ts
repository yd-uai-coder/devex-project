// 作成：Phase-63-2
// ログインの後(LoginForm)・ログイン済みの認証ページ(proxy)で使う戻り先(?redirect=)を確かめる。
// 同じオリジンの相対パスだけを通す。"//evil.com" や "/\evil.com" はブラウザが別のオリジンと
// 読むため断る(開いたリダイレクトを防ぐ)。通らなければ null を返し、呼び出し側が既定の先へ送る。
export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}

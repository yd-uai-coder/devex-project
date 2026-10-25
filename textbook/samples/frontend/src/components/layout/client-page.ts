// 作成：Phase-108-1
// クライアント向けのページ(ログインの要らない共有リンクの画面)か。開発者向けのメニュー・トップへのリンク・
// フッターを出さない外枠にする(クライアントが開発者の画面へ迷い込まないように)
export const CLIENT_PAGE_PREFIX = "/share/";

export function isClientPage(pathname: string | null): boolean {
  return pathname?.startsWith(CLIENT_PAGE_PREFIX) ?? false;
}

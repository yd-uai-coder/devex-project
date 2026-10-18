// 作成：Phase-66-3｜更新：Phase-77-1,77-2
import { apiFetch } from "@/lib/api/client";
import type { AccessTokenResponse } from "@/components/auth/auth-store";

// マイページのアカウントの節が使う項目(GET /users/me の一部)
export type AccountRead = {
  id: string;
  email: string;
  user_name: string | null;
  // Phase-77-1:追記
  // パスワードを持つか(無ければ Google だけの人。変更の代わりに設定を出し、メールの変更を出さない)
  has_password: boolean;
  // Google と連携しているか
  google_linked: boolean;
};

// 今のパスワードが合わないときの code(400)。欄のエラーとして出す
export const CURRENT_PASSWORD_MISMATCH = "CURRENT_PASSWORD_MISMATCH";

export function getAccount(): Promise<AccountRead> {
  return apiFetch<AccountRead>("/api/v1/users/me");
}

export function updateUserName(userName: string): Promise<AccountRead> {
  return apiFetch<AccountRead>("/api/v1/users/me", {
    method: "PATCH",
    body: JSON.stringify({ user_name: userName }),
  });
}

// 今のパスワードで確かめて即時に変える(確認メールは送らない)。使われているメールは 409
export function changeEmail(newEmail: string, currentPassword: string): Promise<AccountRead> {
  return apiFetch<AccountRead>("/api/v1/users/me/email", {
    method: "PUT",
    body: JSON.stringify({ new_email: newEmail, current_password: currentPassword }),
  });
}

// サーバーはその人の refresh を全部失効させ、この端末には新しい access(本文)と refresh
// (httpOnly Cookie)を出し直す。呼び出し側は返った access をストアに入れ直す
export function changePassword(currentPassword: string, newPassword: string): Promise<AccessTokenResponse> {
  return apiFetch<AccessTokenResponse>("/api/v1/users/me/password", {
    method: "PUT",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

// Phase-77-1:追記
// パスワードを持たない(Google だけの)人が、今のパスワードを求められずに設定する。変更と同じく
// ほかの端末のログインを切り、この端末には access と refresh を出し直す
export function setPassword(newPassword: string): Promise<AccessTokenResponse> {
  return apiFetch<AccessTokenResponse>("/api/v1/users/me/password", {
    method: "POST",
    body: JSON.stringify({ new_password: newPassword }),
  });
}

// Phase-77-2:追記
// マイページから Google と連携する。今のパスワードで確かめる(不一致は 400 CURRENT_PASSWORD_MISMATCH)。
// その Google がほかの人と連携済みなどは 409 GOOGLE_ACCOUNT_CONFLICT
export function linkGoogle(credential: string, currentPassword: string): Promise<AccountRead> {
  return apiFetch<AccountRead>("/api/v1/users/me/google", {
    method: "POST",
    body: JSON.stringify({ credential, current_password: currentPassword }),
  });
}

// Google との連携を解く。ほかの端末のログインを切り、この端末には出し直す(呼び出し側は返った
// access をストアに入れ直す)
export function unlinkGoogle(): Promise<AccessTokenResponse> {
  return apiFetch<AccessTokenResponse>("/api/v1/users/me/google", { method: "DELETE" });
}

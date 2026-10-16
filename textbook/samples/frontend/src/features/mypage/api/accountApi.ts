// 作成：Phase-66-3
import { apiFetch } from "@/lib/api/client";
import type { AccessTokenResponse } from "@/components/auth/auth-store";

// マイページのアカウントの節が使う項目(GET /users/me の一部)
export type AccountRead = {
  id: string;
  email: string;
  user_name: string | null;
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

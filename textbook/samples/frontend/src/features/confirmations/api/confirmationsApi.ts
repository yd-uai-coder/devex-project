// 作成：Phase-98-1｜更新：Phase-105-3
import { apiFetch } from "@/lib/api/client";
import type { ConfirmationListRead, ConfirmationUpdate } from "@/features/confirmations/api/types";

// 確認事項の一覧の API(devex-api app/api/routes/confirmations.py)。詳細設計モードのプロジェクトだけ
// (簡易ドキュメントモードは409)。
const base = (projectId: string) => `/api/v1/projects/${projectId}/confirmations`;

export function listConfirmations(projectId: string): Promise<ConfirmationListRead> {
  return apiFetch<ConfirmationListRead>(base(projectId));
}

// Phase-105-3：更新
// // 1件の決める機会・状態・メモを変え、作り直した一覧を受け取る。キーは "user:<名前>" のように空白・
// // 記号を含みうるので符号化する
// ↓↓
// 1件の決める機会・状態・メモを変え、作り直した一覧を受け取る。キーは "user:U-001" のように記号を
// 含み、利用者に ID を振る前の記録は "user:<名前>"(空白を含みうる)なので符号化する
export function updateConfirmation(
  projectId: string,
  key: string,
  body: ConfirmationUpdate,
): Promise<ConfirmationListRead> {
  return apiFetch<ConfirmationListRead>(`${base(projectId)}/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

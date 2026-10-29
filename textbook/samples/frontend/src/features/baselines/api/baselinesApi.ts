// 作成：Phase-88-2｜更新：Phase-98-2,116-1
// Phase-98-2:追記 ── @/features/baselines/api/types.BaselineOriginRead
// Phase-116-1:追記 ── @/features/baselines/api/types.BaselineFreshnessRead
import { apiFetch } from "@/lib/api/client";
import type {
  BaselineCreate,
  BaselineFreshnessRead,
  BaselineOriginRead,
  BaselineRead,
  BaselineRequirementRead,
  BaselineSummaryRead,
} from "@/features/baselines/api/types";

// 合意済みの版(束)の API(devex-api app/api/routes/baselines.py)。詳細設計モードのプロジェクトだけ。
// 束は作った後に直せず、消せない。
const base = (projectId: string) => `/api/v1/projects/${projectId}/baselines`;

// 新しい順
export function listBaselines(projectId: string): Promise<BaselineSummaryRead[]> {
  return apiFetch<BaselineSummaryRead[]>(base(projectId));
}

export function getBaseline(projectId: string, number: number): Promise<BaselineRead> {
  return apiFetch<BaselineRead>(`${base(projectId)}/${number}`);
}

// 要件定義書・外部設計書が無い・生成中は409。入れる CR が検証済みでない・入れ済みは409(CR_NOT_INCLUDABLE)
export function createBaseline(projectId: string, body: BaselineCreate): Promise<BaselineRead> {
  return apiFetch<BaselineRead>(base(projectId), { method: "POST", body: JSON.stringify(body) });
}

export function listBaselineRequirements(projectId: string, number: number): Promise<BaselineRequirementRead[]> {
  return apiFetch<BaselineRequirementRead[]>(`${base(projectId)}/${number}/requirements`);
}

// Phase-98-2:追記
// 新しい要件の予測の起点に選べる要素(束の要件・画面・API)
export function listBaselineOrigins(projectId: string, number: number): Promise<BaselineOriginRead[]> {
  return apiFetch<BaselineOriginRead[]>(`${base(projectId)}/${number}/origins`);
}

// Phase-116-1:追記
// 束の鮮度(後の束・束の後に反映した CR・束を作った時点で古かった段階)
export function getBaselineFreshness(projectId: string, number: number): Promise<BaselineFreshnessRead> {
  return apiFetch<BaselineFreshnessRead>(`${base(projectId)}/${number}/freshness`);
}

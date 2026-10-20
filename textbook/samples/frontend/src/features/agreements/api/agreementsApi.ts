// 作成：Phase-97-2
import { apiFetch } from "@/lib/api/client";
import type {
  AgreementDocType,
  AgreementHistoryRead,
  AgreementStatusRead,
} from "@/features/agreements/api/types";

// 行の合意の API(devex-api app/api/routes/agreements.py)。詳細設計モードのプロジェクトだけ
// (簡易ドキュメントモードは409)。
const base = (projectId: string) => `/api/v1/projects/${projectId}/agreements`;

// 表示中の版の要素ごとの合意の状態と、その版で合意の形へ戻した要素
export function getAgreementStatus(projectId: string, docType: AgreementDocType): Promise<AgreementStatusRead> {
  return apiFetch<AgreementStatusRead>(`${base(projectId)}/status?doc_type=${docType}`);
}

// 要素1つの履歴。キーに空白・"/"・"{}" を含む(api:GET /x/{id})ので、クエリに符号化して渡す
export function getAgreementHistory(projectId: string, key: string): Promise<AgreementHistoryRead> {
  return apiFetch<AgreementHistoryRead>(`${base(projectId)}/history?key=${encodeURIComponent(key)}`);
}

// 作成：Phase-65-2
import type { ProjectMode, ProjectStatus } from "@/features/dashboard/api/projects";

// 一覧の1ページの件数(devex-api の PROJECT_PAGE_SIZE と同じ)
export const PROJECT_PAGE_SIZE = 10;

// 絞込みに出す順。URL・cache の鍵も、選んだ順でなくこの順に並べる(同じ条件を同じ鍵にするため)
export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  "interviewing",
  "generating",
  "completed",
  "revising",
];

// 一覧の条件。URL(?q=&mode=&status=&status=&page=)と同じ中身を持つ。
// mode は1つ(null は絞らない)、statuses は複数のどれか(空は絞らない)。
export type ProjectListParams = {
  q: string;
  mode: ProjectMode | null;
  statuses: ProjectStatus[];
  page: number;
};

export const DEFAULT_LIST_PARAMS: ProjectListParams = { q: "", mode: null, statuses: [], page: 1 };

type SearchParamsLike = Pick<URLSearchParams, "get" | "getAll">;

// URL のクエリを条件にする。不正な値は捨てる(直打ち・古いブックマークでも画面が壊れない)。
export function parseListParams(search: SearchParamsLike): ProjectListParams {
  const mode = search.get("mode");
  const statuses = search.getAll("status");
  const page = Number(search.get("page"));
  return {
    q: (search.get("q") ?? "").trim(),
    mode: mode === "simple" || mode === "detailed" ? mode : null,
    statuses: PROJECT_STATUSES.filter((s) => statuses.includes(s)),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

// 条件をクエリにする。既定値(空の q・絞らない・1ページ目)は省く。API と URL の両方で使う。
export function toSearchParams(params: ProjectListParams): URLSearchParams {
  const search = new URLSearchParams();
  const q = params.q.trim();
  if (q) search.set("q", q);
  if (params.mode) search.set("mode", params.mode);
  for (const status of PROJECT_STATUSES) {
    if (params.statuses.includes(status)) search.append("status", status);
  }
  if (params.page > 1) search.set("page", String(params.page));
  return search;
}

// cache の鍵。条件が同じなら、選んだ順によらず同じ文字列になる
export function listParamsKey(params: ProjectListParams): string {
  return toSearchParams(params).toString();
}

// 検索語か絞込みがあるか(0件のときの表示と「条件をクリア」の出し分けに使う)
export function hasConditions(params: ProjectListParams): boolean {
  return params.q.trim() !== "" || params.mode !== null || params.statuses.length > 0;
}

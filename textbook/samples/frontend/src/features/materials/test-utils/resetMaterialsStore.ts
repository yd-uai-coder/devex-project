// 作成：Phase-116-2
import { vi } from "vitest";
import { useMaterialsStore } from "@/features/materials/materials-store";

// 資料の画面の部品のテストの共通の準備。ストアを「p1 のプロジェクト」の空の状態にし、API を呼ぶ関数を
// vi.fn に差し替える(部品の配線だけを見る。ストア自体は materials-store.test.ts で確かめる)。
export function resetMaterialsStore(): void {
  useMaterialsStore.setState({
    projectId: "p1",
    list: [],
    status: "success",
    error: null,
    notFound: false,
    unavailable: false,
    fetchedAt: null,
    detail: null,
    detailStatus: "success",
    detailError: null,
    detailNotFound: false,
    differences: null,
    differencesError: null,
    latestFreshness: null,
    adding: false,
    addError: null,
    extracting: false,
    acting: false,
    actionError: null,
    fetchList: vi.fn().mockResolvedValue(undefined),
    fetchDetail: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(false),
    extract: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(false),
    restore: vi.fn().mockResolvedValue(undefined),
    createChangeRequest: vi.fn().mockResolvedValue(null),
    clearErrors: vi.fn(),
  });
}

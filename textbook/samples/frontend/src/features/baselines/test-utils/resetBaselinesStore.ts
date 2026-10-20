// 作成：Phase-88-3｜更新：Phase-88(完了後の調整)
import { vi } from "vitest";
import { useBaselinesStore } from "@/features/baselines/baselines-store";

// 束の画面の部品のテストの共通の準備。ストアを「p1 のプロジェクト」の空の状態にし、API を呼ぶ関数を
// vi.fn に差し替える(部品の配線だけを見る。ストア自体は baselines-store.test.ts で確かめる)。
export function resetBaselinesStore(): void {
  useBaselinesStore.setState({
    projectId: "p1",
    list: [],
    status: "success",
    error: null,
    notFound: false,
    // Phase-88(完了後の調整):追記
    unavailable: false,
    fetchedAt: null,
    detail: null,
    detailStatus: "success",
    detailError: null,
    detailNotFound: false,
    stages: null,
    stagesError: null,
    creating: false,
    createError: null,
    fetchList: vi.fn().mockResolvedValue(undefined),
    fetchDetail: vi.fn().mockResolvedValue(undefined),
    fetchStages: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(null),
    clearCreateError: vi.fn(),
  });
}

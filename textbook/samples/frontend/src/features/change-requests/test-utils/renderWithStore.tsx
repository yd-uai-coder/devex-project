// 作成：Phase-87-3｜更新：Phase-88-2,88(完了後の調整),89(完了後の調整),98-2,107-2,107-3,107-4,107-5,112-4
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";

// CR の画面の部品のテストの共通の準備。ストアを「p1 のプロジェクト」の空の状態にし、API を呼ぶ関数を
// vi.fn に差し替える(部品の配線だけを見る。ストア自体は change-requests-store.test.ts で確かめる)。
export function resetChangeRequestsStore(): void {
  useChangeRequestsStore.setState({
    projectId: "p1",
    list: [],
    status: "success",
    error: null,
    notFound: false,
    // Phase-88(完了後の調整):追記
    unavailable: false,
    fetchedAt: null,
    baselines: [],
    requirements: {},
    // Phase-98-2:追記
    origins: {},
    detail: null,
    detailStatus: "success",
    detailError: null,
    detailNotFound: false,
    // Phase-88-2：更新
    // views: { impact: null, comparison: null, verification: null, trace: null, candidates: null },
    // ↓↓
    // Phase-107-3：更新
    // views: { impact: null, comparison: null, verification: null, trace: null, candidates: null, explanation: null },
    // ↓↓
    views: {
      impact: null,
      comparison: null,
      verification: null,
      trace: null,
      candidates: null,
      explanation: null,
      optionDraft: null,
      // Phase-107-4:追記
      shareLinks: null,
      // Phase-107-5:追記
      comments: null,
    },
    viewErrors: {},
    acting: false,
    actionError: null,
    reflecting: false,
    reflectError: null,
    reflectFailure: null,
    // Phase-88-2:追記
    summaryActing: null,
    summaryError: null,
    // Phase-107-3:追記
    draftActing: null,
    draftError: null,
    // Phase-107-4:追記
    createdLink: null,
    shareActing: null,
    shareError: null,
    // Phase-107-5:追記
    replying: null,
    replyError: null,
    fetchList: vi.fn().mockResolvedValue(undefined),
    fetchBaselines: vi.fn().mockResolvedValue(undefined),
    fetchRequirements: vi.fn().mockResolvedValue(undefined),
    // Phase-98-2:追記
    fetchOrigins: vi.fn().mockResolvedValue(undefined),
    fetchDetail: vi.fn().mockResolvedValue(undefined),
    fetchView: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(true),
    // Phase-107-2:追記
    updateOptions: vi.fn().mockResolvedValue(true),
    explain: vi.fn().mockResolvedValue(true),
    // Phase-112-4:追記
    checkConflicts: vi.fn().mockResolvedValue(true),
    decide: vi.fn().mockResolvedValue(true),
    withdraw: vi.fn().mockResolvedValue(true),
    copy: vi.fn().mockResolvedValue(null),
    verify: vi.fn().mockResolvedValue(true),
    linkReview: vi.fn().mockResolvedValue(true),
    checkDocuments: vi.fn().mockResolvedValue(undefined),
    reflectDocuments: vi.fn().mockResolvedValue(undefined),
    onReflectionFinished: vi.fn(),
    // Phase-89(完了後の調整):追記
    resumeReflection: vi.fn().mockResolvedValue(undefined),
    // Phase-88-2:追記
    summarize: vi.fn().mockResolvedValue(true),
    editSummary: vi.fn().mockResolvedValue(true),
    confirmSummary: vi.fn().mockResolvedValue(true),
    // Phase-107-3:追記
    draftOptions: vi.fn().mockResolvedValue(true),
    adoptDraft: vi.fn().mockResolvedValue(true),
    // Phase-107-4:追記
    createShare: vi.fn().mockResolvedValue(true),
    revokeShare: vi.fn().mockResolvedValue(true),
    extendShare: vi.fn().mockResolvedValue(true),
    dismissCreatedLink: vi.fn(),
    // Phase-107-5:追記
    reply: vi.fn().mockResolvedValue(true),
  });
}

export function renderWithTheme(ui: ReactElement) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {ui}
    </TamaguiProvider>,
  );
}

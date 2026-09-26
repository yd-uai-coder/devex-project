// 作成：Phase-3-3
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useDashboardStore } from "../dashboard-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

function resetStore() {
  useDashboardStore.setState({ projects: [], status: "idle", error: null, fetchedAt: null });
}

const SAMPLE_PROJECT = {
  id: "p1",
  title: "Project 1",
  status: "interviewing" as const,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("useDashboardStore", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    resetStore();
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("fetchProjects()は成功時にprojects・status・fetchedAtを更新する", async () => {
    stub.queue({ status: 200, body: [SAMPLE_PROJECT] });

    await useDashboardStore.getState().fetchProjects();

    expect(useDashboardStore.getState().projects).toEqual([SAMPLE_PROJECT]);
    expect(useDashboardStore.getState().status).toBe("success");
    expect(useDashboardStore.getState().fetchedAt).not.toBeNull();
  });

  it("TTL以内であればforce指定なしの再フェッチをスキップする", async () => {
    stub.queue({ status: 200, body: [] });
    await useDashboardStore.getState().fetchProjects();
    expect(stub.requests).toHaveLength(1);

    await useDashboardStore.getState().fetchProjects();

    expect(stub.requests).toHaveLength(1);
  });

  it("force指定時はTTL以内でも再フェッチする", async () => {
    stub.queue({ status: 200, body: [] });
    await useDashboardStore.getState().fetchProjects();
    stub.queue({ status: 200, body: [] });

    await useDashboardStore.getState().fetchProjects({ force: true });

    expect(stub.requests).toHaveLength(2);
  });

  it("invalidate()後は次回のfetchProjects()がTTLを無視して再取得する", async () => {
    stub.queue({ status: 200, body: [] });
    await useDashboardStore.getState().fetchProjects();
    useDashboardStore.getState().invalidate();
    stub.queue({ status: 200, body: [] });

    await useDashboardStore.getState().fetchProjects();

    expect(stub.requests).toHaveLength(2);
  });

  it("失敗時はstatusをerrorにしメッセージを保持する", async () => {
    stub.queue({ status: 500, body: { detail: "Internal Server Error" } });

    await useDashboardStore.getState().fetchProjects();

    expect(useDashboardStore.getState().status).toBe("error");
    expect(useDashboardStore.getState().error).toBeTruthy();
  });
});

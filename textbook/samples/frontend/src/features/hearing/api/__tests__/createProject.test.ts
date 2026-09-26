// 作成：Phase-3-4
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProject } from "../createProject";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const SAMPLE_PROJECT_RESPONSE = {
  id: "p1",
  title: "自動生成タイトル",
  status: "interviewing",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("createProject", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("multipart/form-dataでヒアリング入力・environment・filesを送信する", async () => {
    stub.queue({ status: 201, body: SAMPLE_PROJECT_RESPONSE });
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    const project = await createProject({
      systemOverview: "備品予約を一元管理したい",
      goalsRaw: "重複予約を防ぎたい",
      notesRaw: "",
      environment: { languages: ["python"], frameworks: [], databases: [], deployTargets: [] },
      files: [file],
    });

    expect(project.id).toBe("p1");
    const request = stub.requests[0];
    expect(request.url).toContain("/api/v1/projects");
    expect(request.init?.method).toBe("POST");

    const body = request.init?.body as FormData;
    expect(body.get("system_overview")).toBe("備品予約を一元管理したい");
    expect(body.get("goals_raw")).toBe("重複予約を防ぎたい");
    // 空文字のnotes_rawはフィールド自体を送らない
    expect(body.has("notes_raw")).toBe(false);
    expect(JSON.parse(body.get("environment") as string)).toEqual({
      languages: ["python"],
      frameworks: [],
      databases: [],
      deploy_targets: [],
    });
    expect(body.getAll("files")).toHaveLength(1);
  });

  it("environmentが全て空ならenvironmentフィールド自体を送らない", async () => {
    stub.queue({ status: 201, body: SAMPLE_PROJECT_RESPONSE });

    await createProject({
      systemOverview: "x",
      goalsRaw: "y",
      notesRaw: "",
      environment: { languages: [], frameworks: [], databases: [], deployTargets: [] },
      files: [],
    });

    const body = stub.requests[0].init?.body as FormData;
    expect(body.has("environment")).toBe(false);
  });
});

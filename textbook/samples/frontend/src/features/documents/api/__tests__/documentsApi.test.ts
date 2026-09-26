// 作成：Phase-3-6
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DownloadError, downloadDocument, listDocuments } from "../documentsApi";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { useAuthStore } from "@/components/auth/auth-store";

describe("listDocuments", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("GET /api/v1/projects/{id}/documentsを呼ぶ", async () => {
    stub.queue({ status: 200, body: [] });

    await listDocuments("p1");

    expect(stub.requests[0].url).toContain("/api/v1/projects/p1/documents");
  });
});

describe("downloadDocument", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: "token", status: "success", error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Content-Dispositionのfilename*(UTF-8)を優先して取り出す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("# 要件定義\n本文", {
          status: 200,
          headers: {
            "Content-Disposition":
              "attachment; filename=\"project_requirements_20260101.md\"; filename*=UTF-8''%E5%82%99%E5%93%81%E4%BA%88%E7%B4%84_requirements_20260101.md",
          },
        }),
      ),
    );

    const result = await downloadDocument("p1", "d1");

    expect(result.content).toBe("# 要件定義\n本文");
    expect(result.filename).toBe("備品予約_requirements_20260101.md");
  });

  it("filename*が無ければfilenameにフォールバックする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("content", {
          status: 200,
          headers: { "Content-Disposition": 'attachment; filename="doc.md"' },
        }),
      ),
    );

    const result = await downloadDocument("p1", "d1");

    expect(result.filename).toBe("doc.md");
  });

  it("失敗時はDownloadErrorを投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(downloadDocument("p1", "missing")).rejects.toThrow(DownloadError);
  });
});

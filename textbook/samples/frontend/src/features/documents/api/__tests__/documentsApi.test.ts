// 作成：Phase-3-6｜更新：Phase-6-2,6-6,36-3,57-2
// Phase-36-3:追記 ── ../documentsApi.adoptRequirement
// Phase-57-2:追記 ── ../documentsApi.getTestSpec
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adoptRequirement,
  DownloadError,
  downloadDocument,
  getTestSpec,
  listDocuments,
  listDocumentVersions,
  restoreDocumentVersion,
} from "../documentsApi";
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

// Phase-57-2:追記
describe("getTestSpec", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("GET /api/v1/projects/{id}/test-specを呼び、まだ無ければ(404)nullを返す", async () => {
    stub.queue({ status: 404, body: { detail: "test_spec not found", code: "DOCUMENT_NOT_FOUND" } });

    await expect(getTestSpec("p1")).resolves.toBeNull();
    expect(stub.requests[0].url).toContain("/api/v1/projects/p1/test-spec");
  });

  it("404以外の失敗はそのまま投げる", async () => {
    stub.queue({ status: 500, body: { detail: "boom" } });

    await expect(getTestSpec("p1")).rejects.toThrow();
  });
});

// Phase-6-2:追記
describe("listDocumentVersions", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("GET /api/v1/projects/{id}/documents/{doc_type}/versionsを呼ぶ", async () => {
    stub.queue({ status: 200, body: [] });

    await listDocumentVersions("p1", "requirements");

    expect(stub.requests[0].url).toContain(
      "/api/v1/projects/p1/documents/requirements/versions",
    );
  });
});

describe("restoreDocumentVersion", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("POST .../versions/{version}/restoreを呼ぶ", async () => {
    stub.queue({ status: 200, body: { id: "d2", doc_type: "requirements", content: "v1", version: 1, created_at: "", is_current: true } });

    await restoreDocumentVersion("p1", "requirements", 1);

    expect(stub.requests[0].url).toContain(
      "/api/v1/projects/p1/documents/requirements/versions/1/restore",
    );
    expect(stub.requests[0].init?.method).toBe("POST");
  });
});

// Phase-36-3:追記
describe("adoptRequirement", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("POST .../documents/requirements/rows/{id}/adoptを呼ぶ", async () => {
    stub.queue({ status: 200, body: { id: "d1", doc_type: "requirements", content: "md", version: 1, created_at: "", is_current: true } });

    await adoptRequirement("p1", "NFR-001");

    expect(stub.requests[0].url).toContain(
      "/api/v1/projects/p1/documents/requirements/rows/NFR-001/adopt",
    );
    expect(stub.requests[0].init?.method).toBe("POST");
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

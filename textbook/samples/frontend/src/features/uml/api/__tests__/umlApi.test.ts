// 作成：Phase-11-2｜更新：Phase-12-5,13-5
// Phase-12-5:追記 ── vitest.vi, umlApi(approveDiagram, exportDiagram), client.ApiError
// Phase-13-5:追記 ── umlApi(downloadBundle, listEmbeds, reflectDiagrams)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveDiagram,
  computeLayout,
  downloadBundle,
  exportDiagram,
  generateDiagrams,
  getCandidates,
  getDiagram,
  listDataItems,
  listDiagrams,
  listEmbeds,
  listGenerationRuns,
  reflectDiagrams,
  updateDiagram,
  validateDiagram,
} from "../umlApi";
import { ApiError } from "@/lib/api/client";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { COMPONENT_LAYOUT, COMPONENT_MODEL, makeCandidates } from "@/features/uml/test-utils/umlFixtures";

const BASE = "/api/v1/projects/p1/uml";

describe("umlApi", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it.each([
    ["listDiagrams", () => listDiagrams("p1"), `${BASE}/diagrams`],
    ["getDiagram", () => getDiagram("p1", "d1"), `${BASE}/diagrams/d1`],
    ["getCandidates", () => getCandidates("p1"), `${BASE}/candidates`],
    ["listGenerationRuns", () => listGenerationRuns("p1"), `${BASE}/generation-runs`],
    ["listDataItems", () => listDataItems("p1"), `${BASE}/data-items`],
  ])("%s は GET %s を呼ぶ", async (_name, call, path) => {
    await call();

    expect(stub.requests[0].url).toMatch(new RegExp(`${path}$`));
    expect(stub.requests[0].init?.method).toBeUndefined();
  });

  it.each([
    ["validateDiagram", () => validateDiagram("p1", "d1"), `${BASE}/diagrams/d1/validate`],
    ["computeLayout", () => computeLayout("p1", "d1"), `${BASE}/diagrams/d1/layout`],
  ])("%s は本文なしで POST する", async (_name, call, path) => {
    await call();

    expect(stub.requests[0].url).toMatch(new RegExp(`${path}$`));
    expect(stub.requests[0].init?.method).toBe("POST");
    expect(stub.requests[0].init?.body).toBeUndefined();
  });

  it("updateDiagram は version・semantic_model・layout_model を PUT する", async () => {
    await updateDiagram("p1", "d1", {
      version: 3,
      semantic_model: COMPONENT_MODEL,
      layout_model: COMPONENT_LAYOUT,
    });

    expect(stub.requests[0].init?.method).toBe("PUT");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({
      version: 3,
      semantic_model: COMPONENT_MODEL,
      layout_model: COMPONENT_LAYOUT,
    });
  });

  it("generateDiagrams は notation と subjects を POST し、202 の生成履歴を返す", async () => {
    stub.queue({ status: 202, body: { id: "run1", results: [] } });

    const run = await generateDiagrams("p1", {
      notation: "dfd",
      subjects: [{ subject: "ログイン" }],
    });

    expect(stub.requests[0].url).toMatch(new RegExp(`${BASE}/diagrams$`));
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({
      notation: "dfd",
      subjects: [{ subject: "ログイン" }],
    });
    expect(run.id).toBe("run1");
  });

  it("getCandidates の応答をそのまま返す", async () => {
    stub.queue({ status: 200, body: makeCandidates() });

    const candidates = await getCandidates("p1");

    expect(candidates.dfd_subjects).toHaveLength(2);
  });
});

// Phase-12-5:追記 ── 承認・出力
describe("approveDiagram", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("POST .../approve に見ていた version を送る", async () => {
    await approveDiagram("p1", "d1", 3);

    expect(stub.requests[0].url).toMatch(new RegExp(`${BASE}/diagrams/d1/approve$`));
    expect(stub.requests[0].init?.method).toBe("POST");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({ version: 3 });
  });
});

describe("exportDiagram", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ファイルの本文と Content-Disposition のファイル名を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<mxfile/>", {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="component.drawio"' },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const file = await exportDiagram("p1", "d1", "drawio");

    expect(fetchMock.mock.calls[0][0]).toMatch(new RegExp(`${BASE}/diagrams/d1/export/drawio$`));
    expect(file).toEqual({
      filename: "component.drawio",
      content: "<mxfile/>",
      mimeType: "application/xml",
    });
  });

  it("失敗は code 付きの ApiError にする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "承認されていません", code: "UML_DIAGRAM_NOT_APPROVED" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const error = await exportDiagram("p1", "d1", "svg").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("UML_DIAGRAM_NOT_APPROVED");
  });
});

// Phase-13-5:追記
describe("内部設計書への反映", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("listEmbeds は GET .../embeds を呼ぶ", async () => {
    stub.queue({ body: [] });

    await listEmbeds("p1");

    expect(stub.requests[0].url).toMatch(new RegExp(`${BASE}/embeds$`));
    expect(stub.requests[0].init?.method).toBeUndefined();
  });

  it("reflectDiagrams は本文なしで POST .../reflect し、反映した数を返す", async () => {
    stub.queue({ body: { reflected: 2 } });

    const result = await reflectDiagrams("p1");

    expect(stub.requests[0].url).toMatch(new RegExp(`${BASE}/reflect$`));
    expect(stub.requests[0].init?.method).toBe("POST");
    expect(result).toEqual({ reflected: 2 });
  });
});

describe("downloadBundle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("zip を Blob のまま受け取り、Content-Disposition のファイル名を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="internal_design.zip"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const bundle = await downloadBundle("p1");

    expect(fetchMock.mock.calls[0][0]).toMatch(new RegExp(`${BASE}/bundle$`));
    expect(bundle.filename).toBe("internal_design.zip");
    expect(bundle.content).toBeInstanceOf(Blob);
    expect(bundle.content.size).toBe(4);
  });
});

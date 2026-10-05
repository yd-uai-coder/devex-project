// 作成：Phase-11-2｜更新：Phase-12-5,13-5,17-5,18-5,24(完了後の調整)
// Phase-12-5:追記 ── vitest.vi, umlApi(approveDiagram, exportDiagram), client.ApiError
// Phase-13-5:追記 ── umlApi(downloadBundle, listEmbeds, reflectDiagrams)
// Phase-17-5:追記 ── umlApi(createDataItem, deleteDataItem, updateDataItem)
// Phase-18-5:追記 ── ../types.ErSemanticModel
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveDiagram,
  computeLayout,
  createDataItem,
  deleteDataItem,
  // Phase-24：削除
  // downloadBundle,
  exportDiagram,
  // Phase-24：削除
  // generateDiagrams,
  // getCandidates,
  getDiagram,
  listDataItems,
  listDiagrams,
  // Phase-24：削除
  // listEmbeds,
  // listGenerationRuns,
  // reflectDiagrams,
  updateDataItem,
  updateDiagram,
  validateDiagram,
} from "../umlApi";
import type { ErSemanticModel } from "../types";
import { ApiError } from "@/lib/api/client";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
// Phase-24：更新
// import { COMPONENT_LAYOUT, COMPONENT_MODEL, makeCandidates } from "@/features/uml/test-utils/umlFixtures";
// ↓↓
import { COMPONENT_LAYOUT, COMPONENT_MODEL } from "@/features/uml/test-utils/umlFixtures";

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
    // Phase-24：削除
    // ["getCandidates", () => getCandidates("p1"), `${BASE}/candidates`],
    // ["listGenerationRuns", () => listGenerationRuns("p1"), `${BASE}/generation-runs`],
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

  // Phase-17-5:追記
  // Phase-18-5:追記
  it("updateDiagram は ER の列・テーブルの制約と説明もそのまま送る(Phase 18)", async () => {
    const model: ErSemanticModel = {
      notation: "er",
      elements: [
        {
          id: "t1",
          name: "users",
          kind: "table",
          description: "利用者",
          columns: [
            {
              name: "email",
              type: "VARCHAR(255)",
              is_primary_key: false,
              is_foreign_key: false,
              nullable: false,
              constraints: "UNIQUE",
              description: "ログイン ID",
            },
          ],
        },
      ],
      relations: [],
    };

    await updateDiagram("p1", "d1", { version: 1, semantic_model: model, layout_model: null });

    const sent = JSON.parse(stub.requests[0].init?.body as string);
    expect(sent.semantic_model.elements[0].description).toBe("利用者");
    expect(sent.semantic_model.elements[0].columns[0]).toMatchObject({
      constraints: "UNIQUE",
      description: "ログイン ID",
    });
  });

  it("データ辞書の作成・更新・削除は POST・PUT・DELETE を呼ぶ", async () => {
    const payload = { name: "予約", fields: [{ name: "id", type: "UUID" }] };
    stub.queue({ status: 201, body: { id: "i1", ...payload } });
    stub.queue({ body: { id: "i1", ...payload } });
    // fetch のスタブは本文なしの 204 を作れない(Response が本文付きの 204 を拒む)ので、
    // 削除は呼び出し先とメソッドだけを確かめる(204 の扱いは apiFetch 側のテストの範囲)

    const created = await createDataItem("p1", payload);
    await updateDataItem("p1", "i1", payload);
    await deleteDataItem("p1", "i1");

    expect(created.id).toBe("i1");
    expect(stub.requests.map((r) => [r.init?.method, r.url.replace(/^.*(?=\/api\/)/, "")])).toEqual([
      ["POST", `${BASE}/data-items`],
      ["PUT", `${BASE}/data-items/i1`],
      ["DELETE", `${BASE}/data-items/i1`],
    ]);
    expect(JSON.parse(stub.requests[1].init?.body as string)).toEqual(payload);
  });
  // Phase-24：削除
  //
  // it("generateDiagrams は notation と subjects を POST し、202 の生成履歴を返す", async () => {
  //   stub.queue({ status: 202, body: { id: "run1", results: [] } });
  //
  //   const run = await generateDiagrams("p1", {
  //     notation: "dfd",
  //     subjects: [{ subject: "ログイン" }],
  //   });
  //
  //   expect(stub.requests[0].url).toMatch(new RegExp(`${BASE}/diagrams$`));
  //   expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({
  //     notation: "dfd",
  //     subjects: [{ subject: "ログイン" }],
  //   });
  //   expect(run.id).toBe("run1");
  // });
  //
  // it("getCandidates の応答をそのまま返す", async () => {
  //   stub.queue({ status: 200, body: makeCandidates() });
  //
  //   const candidates = await getCandidates("p1");
  //
  //   expect(candidates.dfd_subjects).toHaveLength(2);
  // });
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
// Phase-24：削除
//
// describe("内部設計書への反映", () => {
//   let stub: ReturnType<typeof stubFetch>;
//
//   beforeEach(() => {
//     stub = stubFetch();
//   });
//
//   afterEach(() => {
//     stub.restore();
//   });
//
//   it("listEmbeds は GET .../embeds を呼ぶ", async () => {
//     stub.queue({ body: [] });
//
//     await listEmbeds("p1");
//
//     expect(stub.requests[0].url).toMatch(new RegExp(`${BASE}/embeds$`));
//     expect(stub.requests[0].init?.method).toBeUndefined();
//   });
//
//   it("reflectDiagrams は本文なしで POST .../reflect し、反映した数を返す", async () => {
//     stub.queue({ body: { reflected: 2 } });
//
//     const result = await reflectDiagrams("p1");
//
//     expect(stub.requests[0].url).toMatch(new RegExp(`${BASE}/reflect$`));
//     expect(stub.requests[0].init?.method).toBe("POST");
//     expect(result).toEqual({ reflected: 2 });
//   });
// });
//
// describe("downloadBundle", () => {
//   afterEach(() => {
//     vi.unstubAllGlobals();
//   });
//
//   it("zip を Blob のまま受け取り、Content-Disposition のファイル名を返す", async () => {
//     const fetchMock = vi.fn().mockResolvedValue(
//       new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
//         status: 200,
//         headers: {
//           "Content-Type": "application/zip",
//           "Content-Disposition": 'attachment; filename="internal_design.zip"',
//         },
//       }),
//     );
//     vi.stubGlobal("fetch", fetchMock);
//
//     const bundle = await downloadBundle("p1");
//
//     expect(fetchMock.mock.calls[0][0]).toMatch(new RegExp(`${BASE}/bundle$`));
//     expect(bundle.filename).toBe("internal_design.zip");
//     expect(bundle.content).toBeInstanceOf(Blob);
//     expect(bundle.content.size).toBe(4);
//   });
// });

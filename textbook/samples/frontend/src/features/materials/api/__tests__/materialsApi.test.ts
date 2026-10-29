// 作成：Phase-116-1
// SUT: materialsApi(資料の API の薄い包み)
// ドライバ: vitest のテスト関数
// スタブ: fetch(stubFetch)── 送ったメソッド・URL・本文と、応答の受け渡しを確かめるため
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createChangeRequestFromDifferences,
  createMaterial,
  deleteMaterial,
  extractDifferences,
  getMaterial,
  listDifferences,
  listMaterials,
  updateDifference,
  uploadMaterial,
} from "../materialsApi";
import { makeDifference, makeDifferences, makeMaterial, makeMaterialSummary } from "../../test-utils/materialFixtures";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const BASE = "/api/v1/projects/p1/materials";
const META = { kind: "email" as const, title: "外部向けの API", material_date: "2026-11-18" };

describe("materialsApi", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("一覧・資料・違いの一覧を読む", async () => {
    stub.queue({ body: [makeMaterialSummary()] });
    stub.queue({ body: makeMaterial() });
    stub.queue({ body: makeDifferences() });

    const list = await listMaterials("p1");
    const material = await getMaterial("p1", "m1");
    const view = await listDifferences("p1", "m1");

    expect(stub.requests.map((r) => r.url.replace(/^.*\/materials/, ""))).toEqual(["", "/m1", "/m1/differences"]);
    expect(stub.requests[0].url).toContain(BASE);
    expect(list[0].title).toBe("定例打ち合わせ 議事録");
    expect(material.body).toContain("議事録");
    expect(view.differences).toHaveLength(1);
  });

  it("貼り付けは JSON、ファイルは multipart で送る", async () => {
    stub.queue({ status: 201, body: makeMaterial() });
    stub.queue({ status: 201, body: makeMaterial({ source: "md", filename: "memo.md" }) });

    await createMaterial("p1", { ...META, body: "本文" });
    await uploadMaterial("p1", META, new File(["# メモ"], "memo.md"));

    expect(stub.requests[0].init?.method).toBe("POST");
    expect(JSON.parse(String(stub.requests[0].init?.body))).toEqual({ ...META, body: "本文" });
    expect(stub.requests[1].url).toContain(`${BASE}/upload`);
    const form = stub.requests[1].init?.body as FormData;
    expect(form.get("kind")).toBe("email");
    expect(form.get("title")).toBe("外部向けの API");
    expect(form.get("material_date")).toBe("2026-11-18");
    expect((form.get("file") as File).name).toBe("memo.md");
  });

  it("消す・取り出す・捨てる・戻す・CR の下書きを作る", async () => {
    // fetch のスタブは本文なしの 204 を作れないので、削除は呼び出し先とメソッドだけを確かめる
    stub.queue({});
    stub.queue({ body: makeDifferences() });
    stub.queue({ body: makeDifference({ status: "dismissed", dismiss_reason: "次回に決まった" }) });
    stub.queue({ body: makeDifference() });
    stub.queue({ status: 201, body: { number: 8 } });

    await deleteMaterial("p1", "m1");
    await extractDifferences("p1", "m1");
    await updateDifference("p1", "m1", "d1", { action: "dismiss", reason: "次回に決まった" });
    await updateDifference("p1", "m1", "d1", { action: "restore" });
    const cr = await createChangeRequestFromDifferences("p1", "m1", { difference_ids: ["d1"], requirement_ids: ["FR-003"] });

    expect(stub.requests.map((r) => [r.init?.method, r.url.replace(/^.*\/materials/, "")])).toEqual([
      ["DELETE", "/m1"],
      ["POST", "/m1/differences"],
      ["PATCH", "/m1/differences/d1"],
      ["PATCH", "/m1/differences/d1"],
      ["POST", "/m1/change-requests"],
    ]);
    expect(JSON.parse(String(stub.requests[2].init?.body))).toEqual({ action: "dismiss", reason: "次回に決まった" });
    expect(JSON.parse(String(stub.requests[4].init?.body))).toEqual({ difference_ids: ["d1"], requirement_ids: ["FR-003"] });
    expect(cr.number).toBe(8);
  });
});

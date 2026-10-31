// 作成：Phase-118(完了後の調整2)
import { describe, expect, it } from "vitest";
import { DETAILED_ONLY_FEATURES, GUIDE_DOCUMENTS, MODE_QUESTIONS, documentsAt, documentsFor } from "../documents";
import { GUIDE_PAGES } from "../guide-flow";

const names = (list: { name: string }[]) => list.map((item) => item.name);

describe("GUIDE_DOCUMENTS", () => {
  it("どちらのモードでも作る文書・片方だけの文書に分かれる", () => {
    expect(names(documentsFor("both"))).toEqual(["要件定義書", "外部設計書", "実装計画書", "テスト仕様書", "実装手順書"]);
    expect(names(documentsFor("simple"))).toEqual(["内部設計書"]);
    expect(names(documentsFor("detailed"))).toEqual(["詳細設計書", "設計図", "変更の説明書"]);
  });

  it("分岐図の置き場: 分岐の段はモードで絞り、共通の段は両方のモードで作る文書", () => {
    expect(names(documentsAt("before"))).toEqual(["要件定義書", "外部設計書"]);
    expect(names(documentsAt("branch", "simple"))).toEqual(["内部設計書"]);
    expect(names(documentsAt("branch", "detailed"))).toEqual(["詳細設計書", "設計図"]);
    for (const document of [...documentsAt("before"), ...documentsAt("after")]) {
      expect(document.made.simple).not.toBeNull();
      expect(document.made.detailed).not.toBeNull();
    }
  });

  it("ID は重ならず、使い方のページはどれも定義にある", () => {
    expect(new Set(GUIDE_DOCUMENTS.map((document) => document.id)).size).toBe(GUIDE_DOCUMENTS.length);
    const guides = [...GUIDE_DOCUMENTS.map((d) => d.guide), ...DETAILED_ONLY_FEATURES.map((f) => f.guide)];
    for (const guide of guides) expect(GUIDE_PAGES[guide]).toBeDefined();
    expect(new Set(MODE_QUESTIONS.map((q) => q.mode))).toEqual(new Set(["simple", "detailed"]));
  });
});

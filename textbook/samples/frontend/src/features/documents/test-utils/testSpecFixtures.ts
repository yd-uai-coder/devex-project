// 作成：Phase-57-2｜更新：Phase-57(完了後の調整)
// テスト仕様書の画面のテストに使う、GET /test-spec の応答の見本。
import type { TestSpecRead } from "@/features/documents/api/documentsApi";

export function makeTestSpec(patch: Partial<TestSpecRead> = {}): TestSpecRead {
  return {
    document: {
      id: "ts1",
      doc_type: "test_spec",
      // Phase-57(完了後の調整)：更新
      // content: "# テスト仕様書\n\n## 1 テストの方針\n",
      // ↓↓
      content: "# テスト仕様書(結合・総合)\n\n※単体テストのテスト観点は実装手順書で個別に確認\n\n## 1 テストの方針\n",
      version: 1,
      created_at: "",
      is_current: true,
    },
    counts: { integration: 12, system: 5 },
    issues: [
      {
        level: "major",
        code: "MUST_REQUIREMENT_UNTESTED",
        message: "テストの無い Must の機能要件: FR-007",
        targets: ["FR-007"],
      },
      {
        level: "minor",
        code: "API_WITHOUT_ERROR_TEST",
        message: "異常系のテストが無い API: GET /api/v1/items・DELETE /api/v1/items/{id}",
        targets: ["GET /api/v1/items", "DELETE /api/v1/items/{id}"],
      },
    ],
    outdated: false,
    design_gaps: 0,
    ...patch,
  };
}

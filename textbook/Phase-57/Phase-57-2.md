# Phase-57-2: テスト仕様書のパネルとプレビューのタブ(簡易モード)

## この章の目的

テスト仕様書を画面に出す部品を作り、簡易モードのプレビュー(SCR-005)に5つ目のタブ「テスト仕様」として置く。パネルは件数・「古い」の注記・作る / 作り直すボタン・検証の結果・本文を持ち、詳細設計画面([57-3](./Phase-57-3.md))でも同じものを使う。検証の結果は、実装手順書の「未定義・要決定」と同じ形(重要度の絞り込み + 表。着手時の相談の決定3)にするため、手順書のパネルから絞り込みのボタンを部品に切り出す。API には「設計に無い」の件数(`design_gaps`)を足す。

自動実装モード: on([introduction](./Phase-57-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは devex-api は `devex-api/backend/` から、devex-ui は `devex-ui/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/documents/test_spec/validation.py`](../samples/backend/app/documents/test_spec/validation.py) | 更新 | `design_gap_count`(「設計に無い」のテストの件数) |
| [`app/documents/test_spec/__init__.py`](../samples/backend/app/documents/test_spec/__init__.py) | 更新 | `design_gap_count` の re-export |
| [`app/schemas/document.py`](../samples/backend/app/schemas/document.py) | 更新 | `TestSpecRead.design_gaps` |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | `get_test_spec` が `design_gaps` を返す |
| [`src/features/documents/api/documentsApi.ts`](../samples/frontend/src/features/documents/api/documentsApi.ts) | 更新 | `TestSpecRead` 型・`getTestSpec`(404 → null) |
| [`src/features/detailed-design/labels.ts`](../samples/frontend/src/features/detailed-design/labels.ts) | 更新 | `FINDING_LEVEL_COLORS`(手順書のパネルから移した) |
| [`src/features/detailed-design/components/FindingLevelFilter.tsx`](../samples/frontend/src/features/detailed-design/components/FindingLevelFilter.tsx) | 新規 | 重要度の絞り込み(「すべて(n)」「最重要(n)」…)。`FindingFilter` 型 |
| [`src/features/detailed-design/components/ProcedureDocPanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureDocPanel.tsx) | 更新 | 絞り込みと色を、切り出した部品と定数に置き換え(挙動は変えない) |
| [`src/features/documents/testSpecOps.ts`](../samples/frontend/src/features/documents/testSpecOps.ts) | 新規 | 状態(未作成・古い・作成済み)・件数の文・詳細で作れるか・zip の注記・指摘の行・数え・絞り込み(純粋関数) |
| [`src/features/documents/test-spec-store.ts`](../samples/frontend/src/features/documents/test-spec-store.ts) | 新規 | テスト仕様書の取得と、詳細設計画面からの生成(`start_from: "test_spec"`) |
| [`src/features/documents/regenerationOps.ts`](../samples/frontend/src/features/documents/regenerationOps.ts) | 更新 | `progressDocTypes`(簡易の進み具合にテスト仕様を並べる) |
| [`src/features/documents/components/VersionHistoryPanel.tsx`](../samples/frontend/src/features/documents/components/VersionHistoryPanel.tsx) | 更新 | テスト仕様書を復元したら、テスト仕様書を取り直す |
| [`src/features/documents/components/TestSpecIssuePanel.tsx`](../samples/frontend/src/features/documents/components/TestSpecIssuePanel.tsx) | 新規 | 検証の結果(絞り込み + 重要度・対象・内容の表) |
| [`src/features/documents/components/TestSpecPanel.tsx`](../samples/frontend/src/features/documents/components/TestSpecPanel.tsx) | 新規 | テスト仕様書のパネル(件数・古い・ボタン・検証の結果・本文) |
| [`src/features/documents/components/DocumentTabs.tsx`](../samples/frontend/src/features/documents/components/DocumentTabs.tsx) | 更新 | `testSpecTab` を渡すと4文書の後ろに「テスト仕様」のタブ |
| [`src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | 簡易モードでテスト仕様書を取り、タブを渡す・作り直しは文書の再生成の流れ・進み具合 |
| ── ここからテスト ── | | |
| [`src/features/documents/test-utils/testSpecFixtures.ts`](../samples/frontend/src/features/documents/test-utils/testSpecFixtures.ts) | 新規 | `makeTestSpec`(`GET /test-spec` の応答の見本) |
| [`tests/unit/test_test_spec_validation.py`](../samples/backend/tests/unit/test_test_spec_validation.py) | 更新 | `design_gap_count` |
| [`tests/unit/test_test_spec_generation.py`](../samples/backend/tests/unit/test_test_spec_generation.py) | 更新 | `design_gaps` が返る |
| [`src/features/documents/api/__tests__/documentsApi.test.ts`](../samples/frontend/src/features/documents/api/__tests__/documentsApi.test.ts) | 更新 | `getTestSpec` の 404 → null |
| [`src/features/documents/__tests__/testSpecOps.test.ts`](../samples/frontend/src/features/documents/__tests__/testSpecOps.test.ts) | 新規 | 純粋関数 |
| [`src/features/documents/__tests__/test-spec-store.test.ts`](../samples/frontend/src/features/documents/__tests__/test-spec-store.test.ts) | 新規 | 取得・生成・409 |
| [`src/features/documents/__tests__/regenerationOps.test.ts`](../samples/frontend/src/features/documents/__tests__/regenerationOps.test.ts) | 更新 | `progressDocTypes` |
| [`src/features/detailed-design/components/__tests__/FindingLevelFilter.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/FindingLevelFilter.test.tsx) | 新規 | 件数と押した絞り込み |
| [`src/features/documents/components/__tests__/TestSpecIssuePanel.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/TestSpecIssuePanel.test.tsx) | 新規 | 表と絞り込み |
| [`src/features/documents/components/__tests__/TestSpecPanel.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/TestSpecPanel.test.tsx) | 新規 | 件数・古い・未作成・作っている間 |
| [`src/features/documents/components/__tests__/VersionHistoryPanel.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/VersionHistoryPanel.test.tsx) | 更新 | テスト仕様書の復元 |
| [`src/features/documents/components/__tests__/DocumentTabs.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentTabs.test.tsx) | 更新 | テスト仕様のタブ |
| [`src/features/documents/components/__tests__/DocumentsPageContent.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx) | 更新 | 簡易のタブと作り直し・詳細は出さない・進み具合 |

`ProcedureDocPanel.tsx` は既存の `ProcedureDocPanel.test.tsx`(変更なし)が import して、切り出しで挙動が変わっていないことを確かめる。

## 要点の抜粋

### 1. 「設計に無い」の件数(API)

```python
# app/documents/test_spec/validation.py
def design_gap_count(model: TestSpecModel) -> int:
    return sum(1 for case in model.cases if case.design_gap)
```

`counts`(テストの件数)には混ぜず、別の欄 `TestSpecRead.design_gaps: int = 0` にした。`counts` は結合・総合の行数で、「設計に無い」はその一部に付く印のため。

### 2. 型と取得(devex-ui)

```ts
// src/features/documents/api/documentsApi.ts
export type TestSpecRead = {
  document: GeneratedDocumentRead;
  counts: { integration: number; system: number };
  issues: DocumentIssueRead[];
  outdated: boolean;
  design_gaps: number;
};
export async function getTestSpec(projectId: string): Promise<TestSpecRead | null>; // 404 → null
```

```ts
// src/features/documents/test-spec-store.ts
type TestSpecStore = {
  projectId: string | null; testSpec: TestSpecRead | null; status: AsyncStatus; error: string | null;
  generating: boolean; generateError: string | null;
  fetchTestSpec(projectId): Promise<void>;   // 別のプロジェクトに移ったら前のものを捨てる
  generate(projectId): Promise<void>;        // POST /generate {start_from: "test_spec"}。409 生成中は待つ
  onGenerated(projectId): void;              // 完了したら取り直す
};
```

簡易モードの作り直しは、このストアの `generate` ではなく、文書の再生成の流れ(`documents-store` の `regenerate(projectId, "test_spec")`)を使う。プレビューの「再生成中」・進み具合・完了の検知(`useGenerationPolling`)をそのまま使え、再生成のボタンも一緒に押せなくなるため。`generate` は詳細設計画面([57-3](./Phase-57-3.md))だけが使う。

### 3. 純粋関数

```ts
// src/features/documents/testSpecOps.ts
export const TEST_SPEC_STAGES = [1, 7];                    // devex-api の TEST_SPEC_STAGES
export function testSpecStatus(spec): "none" | "outdated" | "ready";
export function countText(spec): string;                   // 「結合 12 件・総合 5 件(「設計に無い」2 件)」
export function testSpecReadiness(stages): Readiness;      // 段階1・7 が approved か + 理由
export function zipTestSpecNote(spec): string;             // まだ無い / 古いため入らない / 入る
export function issueRows(issues): IssueRow[];             // 内容から末尾の「: 対象」を除き、対象は別の列
export function countIssues(rows); export function filterIssues(rows, level);
```

- 指摘の `message` は「テストの無い Must の機能要件: FR-007」の形(サーバーが対象を後ろに付ける)。表では対象を別の列に出すので、末尾が `: <対象>` と完全に一致するときだけ除く(形の違う指摘はそのまま)。
- `testSpecReadiness`・`zipTestSpecNote` の消費者は [57-3](./Phase-57-3.md)。同じファイルに置くのは、テスト仕様書の表示の判断を1か所にまとめるため(このファイル自体は以前の Phase の型だけを import するので前方 import にならない)。

### 4. 絞り込みの部品の切り出し

```tsx
// src/features/detailed-design/components/FindingLevelFilter.tsx
export type FindingFilter = FindingLevel | "all";
export function FindingLevelFilter({ filter, counts, onChange }: {
  filter: FindingFilter; counts: Record<FindingLevel, number>; onChange: (f: FindingFilter) => void;
}) // 「すべて(合計)」+ 重要度ごとのボタン(aria-pressed)
```

手順書のパネルの絞り込みのボタンと重要度の色(`LEVEL_COLOR` → `labels.ts` の `FINDING_LEVEL_COLORS`)を、テスト仕様書の検証の結果と共有するために切り出した(#17: 消費者 = `TestSpecIssuePanel`)。「すべて」の件数は、手順書では指摘の数、部品では重要度ごとの件数の合計で、同じ値になる。

### 5. パネルとタブ

```tsx
// src/features/documents/components/TestSpecPanel.tsx
type TestSpecPanelProps = {
  projectId: string; testSpec: TestSpecRead | null; loading: boolean;
  generating: boolean; generateError: string | null;
  readiness: Readiness;        // 簡易は常に作れる、詳細は段階1・7
  emptyNotice: string;         // 未作成のときの案内(モードで違う)
  onGenerate: () => void;      // 親が生成の流れを決める(簡易 = 文書の再生成、詳細 = test-spec-store)
};
```

- パネルは表示だけを持ち、取得と生成は親が渡す。置き場がモードで違っても(着手時の相談の決定2)同じ部品にできる。
- 本文は `DocumentMarkdownView` をそのまま使う(コピー・.md のダウンロード・版の履歴)。ダウンロードは既存の `GET /documents/{doc_id}/download`(ファイル名 `test_spec.md`)。版の履歴から復元したときは、文書の一覧ではなくテスト仕様書を取り直す(`VersionHistoryPanel`)。

```tsx
// src/features/documents/components/DocumentTabs.tsx
testSpecTab?: ComponentType;   // 渡したときだけ4文書の後ろに「テスト仕様」(文書が1つも無ければ出さない)

// src/features/documents/components/DocumentsPageContent.tsx(簡易モードだけ)
useEffect(() => {
  if (simple && !regenerating) void fetchTestSpec(projectId);
}, [simple, regenerating, versionsKey, projectId, fetchTestSpec]);
```

取り直すきっかけは「文書の版が変わったとき」と「再生成が終わったとき」。テスト仕様書だけの再生成では4文書の版が変わらないので、`regenerating` が下りたことでも取り直す。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `design_gap_count`・`get_test_spec` の `design_gaps` | pytest(`test_test_spec_validation.py`・`test_test_spec_generation.py`) | スタブ不要(純粋関数)/ 既存の FakeLLM と SQLite | 見本の model に1件・生成した版に0件 |
| `getTestSpec` | vitest(`documentsApi.test.ts`) | fetch(サーバーの代わり) | 404 は null、それ以外は投げる |
| `testSpecOps` | vitest(`testSpecOps.test.ts`) | スタブ不要 ── 対象が純粋で、応答の値だけから決まるため | 状態・件数の文・段階1・7・zip の注記・指摘の行・数え・絞り込み |
| `useTestSpecStore` | vitest(`test-spec-store.test.ts`) | fetch | プロジェクトの切り替え・`start_from: "test_spec"`・409 の前提エラーと生成中 |
| `progressDocTypes` | vitest(`regenerationOps.test.ts`) | スタブ不要(純粋関数) | 簡易だけテスト仕様を並べる |
| `FindingLevelFilter` | vitest | `onChange`(親の状態の代わり) | 合計と押した絞り込み |
| `TestSpecIssuePanel` | vitest | スタブ不要 ── props を表にするだけ | 表・絞り込み・指摘0 |
| `TestSpecPanel` | vitest | `onGenerate`(生成の受け付けの代わり) | 件数・古い・未作成で押せない理由・作っている間 |
| `VersionHistoryPanel` | vitest | fetch | テスト仕様書の復元で `/test-spec` を取り直す |
| `DocumentTabs` | vitest | スタブ不要(中身は小さな関数で渡す) | 4文書の後ろにテスト仕様 |
| `DocumentsPageContent` | vitest | ストアの操作・`DocumentTabs`・`ReviewPanel`・`useGenerationPolling` を差し替え | 簡易でタブを渡し、作るとテスト仕様書を起点に再生成・詳細は取らない・進み具合 |
| `ProcedureDocPanel`(リファクタの番人) | 既存の `ProcedureDocPanel.test.tsx` | 既存のまま | 絞り込みのボタンと表が今までどおり |

```sh
cd devex-api/backend && uv run pytest tests/unit -k "test_spec"
cd devex-ui && npx vitest run src/features/documents src/features/detailed-design/components/__tests__/FindingLevelFilter.test.tsx src/features/detailed-design/components/__tests__/ProcedureDocPanel.test.tsx
```

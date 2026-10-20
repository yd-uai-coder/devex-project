# Phase-87-4: 検証と SCR-008 からの反映

## この章の目的

CR の詳細に検証のタブを足す(Phase 86 の申し送り「検証の画面」「レビューを結ぶ画面」)。検証のタブには、次のものを置く。
- 反映で付いた印の今の状態(段階へのリンク付き)
- 文書の側の確認の項目
- レビューを結ぶ操作
- 検証済みにする操作

もう一つ、詳細設計画面(SCR-008)の「変更の影響」に、反映済みの CR を選んで段階の生成に渡す欄を置く(着手時の相談のユーザー決定)。詳細設計画面は `?stage=N` で段階を選んで開けるようにする(検証のタブから段階の印を確かめに行くリンク)。

自動実装モード: on([introduction](./Phase-87-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`frontend/src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | `defaultReflectionCr`・`PARTIAL_STAGES` |
| [`frontend/src/features/detailed-design/labels.ts`](../samples/frontend/src/features/detailed-design/labels.ts) | 更新 | `stageParam`(`?stage=N` を段階の番号に) |
| [`frontend/src/features/detailed-design/detailed-design-store.ts`](../samples/frontend/src/features/detailed-design/detailed-design-store.ts) | 更新 | `generate`・`regenerate` に `crNumber` |
| [`frontend/src/features/change-requests/hooks/useAppliedChangeRequests.ts`](../samples/frontend/src/features/change-requests/hooks/useAppliedChangeRequests.ts) | 新規 | プロジェクトの反映済みの CR |
| [`frontend/src/features/detailed-design/components/RegenerationTargets.tsx`](../samples/frontend/src/features/detailed-design/components/RegenerationTargets.tsx) | 更新 | `crNumber` を部分再生成に渡す |
| [`frontend/src/features/change-requests/components/CrReflectionSection.tsx`](../samples/frontend/src/features/change-requests/components/CrReflectionSection.tsx) | 新規 | 段階の生成に渡す CR を選ぶ欄と、段階の作り直しのボタン |
| [`frontend/src/features/detailed-design/components/ChangeImpactPanel.tsx`](../samples/frontend/src/features/detailed-design/components/ChangeImpactPanel.tsx) | 更新 | 上の欄を置き、選んだ CR を再生成の候補に渡す |
| [`frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | `initialStage`(段階を読んだ後に選ぶ) |
| [`frontend/src/app/projects/[id]/detailed-design/page.tsx`](../samples/frontend/src/app/projects/[id]/detailed-design/page.tsx) | 更新 | `searchParams` の `stage` を `initialStage` に |
| [`frontend/src/features/change-requests/components/VerificationTab.tsx`](../samples/frontend/src/features/change-requests/components/VerificationTab.tsx) | 新規 | 検証のタブ |
| [`frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx) | 更新 | 検証のタブ(反映の後だけ) |
| [`frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts`](../samples/frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts) | 更新 | `defaultReflectionCr` |
| [`frontend/src/features/detailed-design/__tests__/labels.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/labels.test.ts) | 更新 | `stageParam` |
| [`frontend/src/features/detailed-design/__tests__/detailed-design-store.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/detailed-design-store.test.ts) | 更新 | `regenerate` の `cr_number` |
| [`frontend/src/features/detailed-design/components/__tests__/ChangeImpactPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ChangeImpactPanel.test.tsx) | 更新 | CR を選ぶ欄(`CrReflectionSection`・`useAppliedChangeRequests` もここで通す) |
| [`frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | `?stage=N` で段階を選ぶ |
| [`frontend/src/app/projects/[id]/detailed-design/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/detailed-design/__tests__/page.test.tsx) | 更新 | `searchParams` の受け渡し |
| [`frontend/src/features/change-requests/components/__tests__/VerificationTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/VerificationTab.test.tsx) | 新規 | 検証のタブ |
| [`frontend/src/features/change-requests/components/__tests__/ChangeRequestDetailContent.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestDetailContent.test.tsx) | 更新 | 反映済みで検証のタブ |

依存の向き: 詳細設計の `ChangeImpactPanel` → change-requests の `CrReflectionSection`・`useAppliedChangeRequests`・`defaultReflectionCr`。change-requests の純粋関数は詳細設計のラベルと型を読む(87-1)が、モジュールの循環は無い(`changeRequestOps.ts` は部品を import しない)。

## 1. 検証のタブ(`VerificationTab`)

- タブは反映済み・検証済みのときだけ出す(その前は「文書へ反映した後にできます」)。開いたときに検証の確かめ([86-2](../Phase-86/Phase-86-2.md))を読み、反映済みならレビューの候補([86-3](../Phase-86/Phase-86-3.md))も読む。
- **印**: 段階・要素・理由・確認の状態(未確認 / 確認済み / 承認で済んだ)の表。段階の名前は詳細設計画面へのリンク(`designStageHref` → `?stage=N`)。印を確かめるのは段階の画面(印の仕組みは変えない。[86-1](../Phase-86/Phase-86-1.md))。
- **文書の側**: 保存した予測の画面・API を、チェックボックスで確認済みにする(`PUT .../document-checks`)。反映済みの間だけ変えられる。
- **レビュー**: 結んだ回(区切り・モデル・日時・指摘と採用の数)と、反映済みのときは候補の一覧と「結ぶ」。外す操作は無い(Phase 86 の決定。要るかは画面確認で確かめる)。
- **検証済みにする**: `can_verify` のときだけ押せる。メモ(任意)を入れて確かめる。

## 2. 段階の生成に CR を渡す(`CrReflectionSection`・`ChangeImpactPanel`)

```ts
// ChangeImpactPanel(抜粋)
const detailed = useDetailedDesignStore((s) => s.stages[0]?.mode === "detailed");
const applied = useAppliedChangeRequests(projectId, detailed);          // 反映済みの CR
const [chosenCr, setChosenCr] = useState<number | null | undefined>(undefined);
const crNumber = chosenCr !== undefined ? chosenCr : defaultReflectionCr(applied.map((cr) => cr.number), impact);
```

- **置き場所**(ユーザー決定): 設計レビューの指摘と同じく、段階の側から渡す。印はこのパネルに出るので、どの段階を作り直すかを印を見ながら決められる。
- **初期値**: 反映済みの CR のうち、未確認の印の出どころ(`cr:<番号>`)にある最初のもの。人が「渡さない」を選ぶと `null`(選ぶまでは `undefined` で初期値を使う)。選べるのは反映済みの CR だけ(段階は文書へ反映した後。[Phase 85](../Phase-85/Phase-85-introduction.md))。
- **渡し先**:
  - 再生成の候補(`RegenerationTargets`。段階5・6・8 の部分再生成): 選んだ CR を `regenerate(projectId, stage, keys, crNumber)` に渡し、ボタンの名前にも CR を出す。
  - そのほかの段階: その CR の未確認の印がある段階ごとに「段階N を CR-M で作り直す」を出す。確かめてから `generate(..., [], crNumber)` を呼ぶ。段階5・6・8 の全体の作り直しは出さない(対象を選ばないと、まだ下書きの無いものだけを作るため)。
- 反映済みの CR が無い・簡易ドキュメントモードでは、欄を出さない(一覧も読まない)。

## 3. `?stage=N`(`stageParam`・`initialStage`)

- ページの `searchParams` から読み、`DetailedDesignPageContent` に `initialStage` で渡す。`useSearchParams` を使わないので、Suspense の境界が要らない。
- 段階を選ぶのは `fetchStages` の後。別のプロジェクトを開くと、`fetchStages` は最初の未承認の段階を選び直すため。
- 段階で無い値(9・数で無いもの)は無視する。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `VerificationTab.test.tsx`(新規) | `VerificationTab` | Testing Library(描画・クリック) | ストアの関数(`vi.fn`)── タブを開いたときの読み込み・操作で渡す引数・ボタンの出し分けを見る |
| `ChangeImpactPanel.test.tsx`(更新) | `ChangeImpactPanel`・`CrReflectionSection`・`useAppliedChangeRequests`・`RegenerationTargets` の `crNumber` | Testing Library | 詳細設計のストアの関数(`vi.fn`)と、CR のストアの一覧・`fetchList`(`setState`)── 初期値・渡し先・「渡さない」を見る |
| `detailed-design-store.test.ts`(更新) | `regenerate`・`generate` の `crNumber` | vitest のテスト関数 | `fetch`(`stubFetch`)── 本文の `cr_number` を見る |
| `labels.test.ts`・`changeRequestOps.test.ts`(更新) | `stageParam`・`defaultReflectionCr` | vitest のテスト関数 | スタブ不要 ── 対象が純粋 |
| `DetailedDesignPageContent.test.tsx`・`detailed-design/__tests__/page.test.tsx`(更新) | `initialStage` と `searchParams` の受け渡し | Testing Library・vitest のテスト関数 | 既存のスタブのまま。CR のストアの `fetchList` を `vi.fn` に(「変更の影響」が読むため) |
| `ChangeRequestDetailContent.test.tsx`(更新) | 反映済みで検証のタブ | Testing Library | 87-3 と同じ |

- 検証: 読み込み(検証済みは候補を読まない)・3つの状態と段階のリンク・未確認があれば押せない・文書の側の確認・レビューを結ぶ・確かめて検証済み・検証済みでは変えられない。
- 段階への反映: 初期値は印の出どころの反映済みの CR・合意だけの CR は出ない・部分再生成に CR を渡す・部分再生成の段階に作り直しのボタンを出さない・確かめて作り直す・「渡さない」・CR が無いと欄を出さない。
- `?stage=N`: 段階を読んだ後に選ぶ・段階で無い値は渡さない。

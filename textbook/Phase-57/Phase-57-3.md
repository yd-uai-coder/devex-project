# Phase-57-3: 詳細設計画面のテスト仕様書(詳細設計モード)

## この章の目的

詳細設計モードのテスト仕様書を、詳細設計画面(SCR-008)に置く(着手時の相談の決定2)。ステッパーの段階8の下に「テスト仕様書」の行を足し、選ぶと作業領域に [57-2](./Phase-57-2.md) のパネルを出す。段階1・段階7 を承認していれば「テスト仕様書を作る」で作れ(Phase 56 の `POST /generate {start_from: "test_spec"}`)、段階7 を承認したダイアログからも移れる。詳細設計書の zip のボタンの横には、テスト仕様書が zip に入るかを出す([57-1](./Phase-57-1.md))。

自動実装モード: on([introduction](./Phase-57-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-ui/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/features/detailed-design/components/StageStepper.tsx`](../samples/frontend/src/features/detailed-design/components/StageStepper.tsx) | 更新 | `TestSpecStep`・段階8の下の「テスト仕様書」の行(状態つき。選んでいる間は段階を選んでいない表示) |
| [`src/features/detailed-design/components/DesignDocumentBar.tsx`](../samples/frontend/src/features/detailed-design/components/DesignDocumentBar.tsx) | 更新 | `testSpecNote`(詳細設計書の zip の行にだけ出す)・`DownloadItem.includesTestSpec` |
| [`src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 段階かテスト仕様書かの切り替え・テスト仕様書の取得と生成の完了の検知・段階7 の承認のダイアログからの案内・zip の注記 |
| ── ここからテスト ── | | |
| [`src/features/detailed-design/components/__tests__/StageStepper.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageStepper.test.tsx) | 更新 | テスト仕様書の行 |
| [`src/features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx) | 更新 | 注記は詳細設計書の zip の行にだけ |
| [`src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | 行で切り替え・作れない理由・作る・段階7 のダイアログ・簡易は出さない |

## 要点の抜粋

### 1. ステッパーの行

```tsx
// src/features/detailed-design/components/StageStepper.tsx
export type TestSpecStep = { status: TestSpecStatus; selected: boolean; onSelect: () => void };
// props に testSpec?: TestSpecStep。渡したときだけ段階8の下に点線の行
// 「テスト仕様書(未作成|古い|作成済み)」。選んでいる間は段階の行に aria-current を付けない
```

段階ではないので承認のボタンも「見直し」の印も無い。行の状態は `GET /test-spec` だけから決める(`testSpecStatus`)。点線にして段階と見分ける(簡易モードの「詳細設計モードのみ」の行と同じ線)。

### 2. 画面の切り替え

```tsx
// src/features/detailed-design/components/DetailedDesignPageContent.tsx
const [showTestSpec, setShowTestSpec] = useState(false);   // 画面のローカルな状態(ストアの selectedStage は変えない)
const choose = (stage: number) => { setShowTestSpec(false); selectStage(stage); };
useEffect(() => { if (detailed) void fetchTestSpec(projectId); }, [detailed, stagesKey, projectId, fetchTestSpec]);
useGenerationPolling(projectId, generatingTestSpec, () => onTestSpecGenerated(projectId));
```

- **なぜストアの `selectedStage` に「9」のような値を足さないか**: `selectedStage` は段階の番号として、承認・作り直し・`jumpTo`(レビューや変更の影響から段階へ飛ぶ)が使う。段階でないものを混ぜると、それらすべてに例外が要る。画面のローカルな状態にし、段階を選ぶ操作(ステッパー・「次の段階へ進む」・指摘から飛ぶ)で段階に戻す。
- 段階の承認が変わると「古い」も変わりうる(入力は段階1・7 の承認した版)ので、`stagesKey` が変わったら取り直す。
- 作業領域は `detailed && showTestSpec` のとき、見出し「テスト仕様書」と `TestSpecPanel`(`readiness = testSpecReadiness(stages)`、`onGenerate = generate`)。生成の完了は文書の生成と同じ `useGenerationPolling`(プロジェクトの状態)で待つ。

### 3. 段階7 の承認のダイアログ

承認のダイアログで、段階7 を承認したときに「テスト仕様書を作れます。」と「テスト仕様書へ」(押すと作業領域をテスト仕様書にする)を出す。自動では作らない(Phase 56 の決定 ── 詳細は API で作る。画面ではボタン)。段階1が未承認なら、移った先で作れない理由が出る。

### 4. zip の注記

```tsx
// src/features/detailed-design/components/DesignDocumentBar.tsx
type DownloadItem = { ...; includesTestSpec?: boolean };   // 詳細設計書・実装計画の zip だけ true
export function DesignDocumentBar({ projectId, stages, testSpecNote = null }: {...})
// 画面は testSpecNote={detailed ? zipTestSpecNote(testSpec) : null}
```

注記は「テスト仕様書はまだ無いため、zip には入りません。」「…古いため、zip には入りません(作り直すと入ります)。」「テスト仕様書(test_spec.md)も zip に入ります。」の3通り。ボタンの押せる・押せないは変えない(テスト仕様書は zip を断る理由にしない)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `StageStepper` | vitest | `onSelect`(親の操作の代わり) | 行の名前と状態・最後の行・選んでいる間は段階に `aria-current` が無い・押すと伝える |
| `DesignDocumentBar` | vitest | fetch・`saveFile`(既存) | 注記は詳細設計書の zip の行にだけ |
| `DetailedDesignPageContent` | vitest | 詳細設計・レビュー・テスト仕様書のストアの操作(`fetchTestSpec`・`generate` など)を差し替え | 行で作業領域が替わる・段階1・7 が未承認なら押せず理由・承認済みなら作れ、できると件数・検証の結果・注記が変わる・段階7 のダイアログから移る・段階を選ぶと戻る・簡易は行も取得も無い |

```sh
cd devex-ui && npx vitest run src/features/detailed-design/components/__tests__/StageStepper.test.tsx src/features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx
```

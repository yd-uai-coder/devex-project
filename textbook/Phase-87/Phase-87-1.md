# Phase-87-1: API・型・純粋関数・ストア

## この章の目的

CR の画面(SCR-010)の土台を作る。Phase 82〜86 の CR の API を呼ぶ関数と型、画面だけが持つ変換(ボタン・フォーム・比較の並べ方・印の出どころの読み方)を純粋関数にまとめ、一覧・詳細・タブの中身・操作の状態を持つストアを作る。作成のフォームで対象の要件を選ぶため、devex-api に束の要件の行だけを返す小さな API を足す。文書・段階の生成の API には、反映する CR の番号(`cr_number`)を渡す引数を足す。

自動実装モード: on([introduction](./Phase-87-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`backend/app/schemas/baseline.py`](../samples/backend/app/schemas/baseline.py) | 更新 | `BaselineRequirementRead`(要件1行。`id`・`kind`・`priority`・`category`・`text`) |
| [`backend/app/services/baseline_service.py`](../samples/backend/app/services/baseline_service.py) | 更新 | `BaselineService.requirements`、純粋関数 `baseline_requirement_rows` |
| [`backend/app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `baseline_requirement_ids` が `baseline_requirement_rows` を使う(読み方を1つに。#17) |
| [`backend/app/api/routes/baselines.py`](../samples/backend/app/api/routes/baselines.py) | 更新 | `GET /projects/{id}/baselines/{number}/requirements` |
| [`frontend/src/features/change-requests/api/types.ts`](../samples/frontend/src/features/change-requests/api/types.ts) | 新規 | CR・予測・比較・検証・たどる記録・束の型 |
| [`frontend/src/features/change-requests/api/changeRequestsApi.ts`](../samples/frontend/src/features/change-requests/api/changeRequestsApi.ts) | 新規 | CR の API と束の一覧・要件の行、説明書のダウンロード |
| [`frontend/src/features/hearing/api/hearingApi.ts`](../samples/frontend/src/features/hearing/api/hearingApi.ts) | 更新 | `triggerGeneration` に `crNumber`(本文 `cr_number`) |
| [`frontend/src/features/detailed-design/api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | `generateDesignStage` に `crNumber` |
| [`frontend/src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 新規 | 選択肢・ボタン・フォームの変換と確かめ・日時・比較の並べ方・印の出どころの CR(87-3・87-4 で追記) |
| [`frontend/src/features/change-requests/change-requests-store.ts`](../samples/frontend/src/features/change-requests/change-requests-store.ts) | 新規 | `useChangeRequestsStore`(一覧・束・詳細・タブの中身・操作・文書への反映) |
| [`backend/tests/unit/test_baseline_service.py`](../samples/backend/tests/unit/test_baseline_service.py) | 更新 | 要件の行のルート |
| [`frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts`](../samples/frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts) | 新規 | テスト用の応答(CR・予測・比較・検証・たどる記録) |
| [`frontend/src/features/change-requests/api/__tests__/changeRequestsApi.test.ts`](../samples/frontend/src/features/change-requests/api/__tests__/changeRequestsApi.test.ts) | 新規 | メソッド・パス・本文 |
| [`frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 更新 | `cr_number` を渡す |
| [`frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts`](../samples/frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts) | 新規 | 純粋関数 |
| [`frontend/src/features/change-requests/__tests__/change-requests-store.test.ts`](../samples/frontend/src/features/change-requests/__tests__/change-requests-store.test.ts) | 新規 | ストア(`triggerGeneration` の `cr_number` もここで確かめる) |

依存の向き: `changeRequestOps.ts` → `api/types.ts`・`detailed-design/api/types.ts`・`detailed-design/labels.ts`(既存)。ストア → API・`hearingApi.triggerGeneration`・`lib/api`。部品(87-2〜87-4)はストアと純粋関数を使い、API を直接は呼ばない(説明書のダウンロードだけは部品が呼ぶ。ファイルを保存するだけで、ストアの状態を変えないため)。

## 1. 束の要件の行の API(devex-api)

```python
# app/services/baseline_service.py(抜粋)
def baseline_requirement_rows(baseline: Baseline) -> list[dict[str, Any]]
    # 束の要件定義書の写し(key "requirements")の model.rows のうち ID のある行(行の順)

# app/api/routes/baselines.py
@router.get("/{number}/requirements", response_model=list[BaselineRequirementRead])
```

- **なぜ足すか**: 作成のフォームは、基準の束の要件(ID と合意済みの文)から対象を選ぶ。束の詳細(`GET .../baselines/{n}`)は全段階の model を含んで重い(申し送り「応答の大きさ」)。
- **読み方を1つにする**(#17): CR の対象の確かめ(`change_request_service.baseline_requirement_ids`、Phase 82)と同じ写しを読むので、`baseline_requirement_rows` に寄せた。写しのキー `REQUIREMENTS_KEY` は、説明書([84-2](../Phase-84/Phase-84-2.md))の定数を使う(CR のサービスにあった同じ定数は消した)。`BaselineService` は CR のサービスを import しない向きのまま([86-4](../Phase-86/Phase-86-4.md))。
- 返すのは画面に要る項目だけ(根拠の観点などは返さない)。

## 2. API の関数と型(devex-ui)

```ts
// src/features/change-requests/api/changeRequestsApi.ts(抜粋)
export function createChangeRequest(projectId: string, body: ChangeRequestCreate): Promise<ChangeRequestRead>
export function decideChangeRequest(projectId: string, number: number, body: ChangeRequestDecision): Promise<ChangeRequestRead>
export function checkChangeRequestDocuments(projectId, number, keys: string[], reviewed: boolean): Promise<ChangeRequestVerificationRead>
export async function downloadExplanation(projectId, number): Promise<{ filename: string; content: string }>
export function listBaselineRequirements(projectId: string, number: number): Promise<BaselineRequirementRead[]>
```

- 既存の機能と同じく、`apiFetch` を薄く包むだけ。型は devex-api のスキーマの同じ名前のクラスに合わせる(画面で使う項目だけ)。時系列の生の `events` は型に入れていない(時系列はたどる記録で出す。着手時の相談の決定)。
- 説明書は md なので、`fetchAttachment`(既存。JSON でない応答)で読み、ファイル名は `Content-Disposition` から取る。

```ts
// src/features/hearing/api/hearingApi.ts・designStagesApi.ts(抜粋)
triggerGeneration(projectId, startFrom?, findingIds = [], crNumber?: number)   // 本文に cr_number
generateDesignStage(projectId, stage, functionIds?, logics?, unitIds?, findingIds = [], crNumber?: number)
```

- 既存の引数の後ろに足した(呼び出し側を変えずに済む)。省くと本文に入れない(指摘の `finding_ids` と同じ形)。
- 文書への反映は `start_from` を渡さない(要件定義書から。[Phase 85](../Phase-85/Phase-85-introduction.md) の受け付けの条件)。

## 3. 純粋関数(`changeRequestOps.ts`)

| 関数・定数 | 役割 |
|---|---|
| `HEADER_ACTIONS`・`headerActions(allowed)` | 見出しのボタンにする操作(説明済み・合意・却下・取り下げ・写し)。`edit` は内容のタブ、`verify` は検証のタブに置き、`apply` はボタンにしない(再生成で起きる) |
| `canReflectDocuments`・`canReflectStages`・`isApplied` | 文書へ反映できる(合意・反映済み)/段階へ渡せる(反映済み)/比較と検証を出す(反映済み・検証済み) |
| `emptyForm`・`formFromChangeRequest`・`toCreateBody`・`toUpdateBody` | フォームの状態と送る本文。日付の空は `null`、削除の案は空。基準の束は作成のときだけ送る |
| `addTarget`・`removeTarget`・`setTargetKind`・`setTargetProposal` | 対象の行の操作。同じ要件は2回足さない。削除にすると案を消す(削除には案を書けない。[84-1](../Phase-84/Phase-84-1.md)) |
| `formProblems` | 送る前の確かめ(タイトル・内容・対象か新しい要件)。サーバーの 422 と同じ条件を先に示す |
| `nowLocalInput`・`localInputToIso` | 合意の日時の入力(`datetime-local`、手元の時刻)とタイムゾーン付きの ISO(サーバーは `AwareDatetime`) |
| `stageLabel`・`groupByStage`・`comparisonGroups` | 予測を段階ごとに、比較を「予測の外 → 予測だけ → 一致」の順に(見落としを先に見せる) |
| `designStageHref`・`changeRequestHref` | 段階(`?stage=N`。87-4)・CR の詳細へのリンク |
| `crNumberOfSource`・`crNumbersInImpact`・`stagesMarkedBy` | 印の出どころ `cr:<番号>`([85-2](../Phase-85/Phase-85-2.md))から、CR の番号と、その CR の未確認の印のある段階を読む(87-4 で使う) |

状態の色(`STATUS_TONE`)だけは画面が持つ。状態の名前・種類の名前はサーバーの `*_label` を出す(たどる記録の前後の状態の名前 `statusLabel` は 87-3 で足した)。

## 4. ストア(`change-requests-store.ts`)

```ts
type DetailViews = { impact; comparison; verification; trace; candidates }   // タブの中身
fetchList(projectId, { force })   fetchBaselines(projectId)   fetchRequirements(projectId, baselineNumber)
fetchDetail(projectId, number)    fetchView(projectId, number, view)
create / update / explain / decide / withdraw / copy / verify / linkReview / checkDocuments
reflectDocuments(projectId, number)   onReflectionFinished(projectId, number, project)
```

- **既存のストアと同じ型**(documents-store・detailed-design-store): `projectId` を持ち、別のプロジェクトを開いたら捨てる(`switchProject`)。一覧は `isCacheFresh` で読み直しを省く。待っている間に別のプロジェクトへ移ったら、古い結果で上書きしない。
- **タブの中身は開いたときに読む**(申し送り「予測・説明書の応答の大きさ」): 予測・比較・検証・たどる記録・レビューの候補は `views` に持ち、タブの部品が空のときに `fetchView` を呼ぶ。比較は反映の前に 409 になるので、失敗はタブごとの `viewErrors` に残す。
- **操作の後は詳細を置き換え、タブの中身を捨てる**(`replaceDetail`): 状態が変わると、予測(判断で保存)・比較・検証・記録も変わるため。一覧の鮮度も落とす。作成と写しは、作った CR を返すだけ(画面がその番号へ移る)。
- **文書への反映**: `triggerGeneration(projectId, undefined, [], number)`。生成中の 409 `DOC_GENERATION_IN_PROGRESS` は失敗にせず完了を待つ(documents-store と同じ)。完了は詳細の画面が `useGenerationPolling` で待ち(87-3)、`onReflectionFinished` が失敗の記録を持ち、詳細を読み直す(成功なら反映済みになっている)。
- 文書の側の確認は、返った検証の内容でタブの中身だけを置き換える(CR の状態は変わらない)。

## テスト観点

SUT は試験対象、ドライバは SUT を呼ぶもの、スタブは SUT が呼ぶ外部の代わり。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_baseline_service.py`(更新) | ルート `list_baseline_requirements`・`BaselineService.requirements`・`baseline_requirement_rows` | pytest のテスト関数(ルートの関数を直接呼ぶ) | スタブ不要 ── テスト用の SQLite のセッションと、段階を承認済みにした既存の fixture を使う(永続化した写しを読むのが検証対象) |
| `changeRequestsApi.test.ts`(新規) | `changeRequestsApi` の各関数 | vitest のテスト関数 | `fetch`(`stubFetch`)── 送ったメソッド・URL・本文と、応答・失敗の受け渡しを確かめるため |
| `designStagesApi.test.ts`(更新) | `generateDesignStage` の `crNumber` | vitest のテスト関数 | `fetch`(`stubFetch`) |
| `changeRequestOps.test.ts`(新規) | `changeRequestOps` の関数 | vitest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |
| `change-requests-store.test.ts`(新規) | `useChangeRequestsStore`(と、文書への反映で呼ぶ `triggerGeneration` の `cr_number`) | vitest のテスト関数(ストアの関数を直接呼ぶ) | `fetch`(`stubFetch`)── API を呼ぶ順と本文、応答の後の状態を見るため |

- 束の要件: 写しの行の順・ID だけ・根拠の観点を返さない・無い束は 404。
- API: 作成の本文・GET のパス・PATCH と PUT・状態の操作は本文の要るものだけ・失敗の `code`・説明書のファイル名・束の要件。
- 純粋関数: 見出しのボタンの絞り込み・反映できる状態・対象の重複と削除の案・送る前の確かめ・本文の整え・日時・段階の並べ・比較の順・印の出どころの CR。
- ストア: 一覧の鮮度・404・束の要件は1回だけ・タブの 409 の残し方・操作の後にタブを捨てる・操作の失敗・写しは詳細を変えない・文書の側の確認・文書への反映と完了・生成中の 409。

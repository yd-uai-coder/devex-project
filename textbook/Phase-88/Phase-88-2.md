# Phase-88-2: 束と説明書の API・型・純粋関数・ストア

## この章の目的

束の画面(88-3)と説明書のタブ(88-4)の土台を作る。束の API を包む関数と型を新しい feature `features/baselines/` にまとめ、束の作成のフォームが使う変換(入れられる CR の絞り込み・合意の記録の初期値・作れない理由・入る段階)を純粋関数にし、束の一覧・中身・作成・段階の状態を持つストアを作る。CR の側には、説明書のプレビューと要約の操作の API・照合の印の区切り・要約の状態の文を足し、ストアのタブの中身に説明書を足す。devex-api では、CR の一覧の応答に合意の記録と入れた束を移す。

自動実装モード: on([introduction](./Phase-88-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`backend/app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `ChangeRequestSummaryRead` に `decision`・`included_baseline_number`(詳細から移す。`summary_fields` が作る) |
| [`frontend/src/features/baselines/api/types.ts`](../samples/frontend/src/features/baselines/api/types.ts) | 新規 | 束の型(一覧・中身・写し・要件の行・作成の本文)。CR の型から移した |
| [`frontend/src/features/baselines/api/baselinesApi.ts`](../samples/frontend/src/features/baselines/api/baselinesApi.ts) | 新規 | `listBaselines`・`getBaseline`・`createBaseline`・`listBaselineRequirements` |
| [`frontend/src/features/change-requests/api/types.ts`](../samples/frontend/src/features/change-requests/api/types.ts) | 更新 | 一覧の型に `decision`・`included_baseline_number`。説明書と要約の型。束の型を外す |
| [`frontend/src/features/change-requests/api/changeRequestsApi.ts`](../samples/frontend/src/features/change-requests/api/changeRequestsApi.ts) | 更新 | 説明書のプレビュー・要約の作成・直し・確認。束の API を外す |
| [`frontend/src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | `SUMMARY_TONE`・`summaryOutputNote`・`markSegments` |
| [`frontend/src/features/baselines/baselineOps.ts`](../samples/frontend/src/features/baselines/baselineOps.ts) | 新規 | 写しの表示名と状態、リンク、入れられる CR・入れた CR、合意の記録の初期値と選択の変え方、作成の本文、作れない理由、入る段階 |
| [`frontend/src/features/change-requests/change-requests-store.ts`](../samples/frontend/src/features/change-requests/change-requests-store.ts) | 更新 | `views.explanation`、`summarize`・`editSummary`・`confirmSummary`、束の API の import 先 |
| [`frontend/src/features/baselines/baselines-store.ts`](../samples/frontend/src/features/baselines/baselines-store.ts) | 新規 | `useBaselinesStore`(一覧・中身・段階の状態・作成) |
| [`frontend/src/features/change-requests/components/ChangeRequestForm.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestForm.tsx) | 更新 | 束の型の import 先 |
| [`backend/tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 更新 | 一覧の合意の記録 |
| [`backend/tests/unit/test_change_request_trace.py`](../samples/backend/tests/unit/test_change_request_trace.py) | 更新 | 一覧の入れた束 |
| [`frontend/src/features/baselines/test-utils/baselineFixtures.ts`](../samples/frontend/src/features/baselines/test-utils/baselineFixtures.ts) | 新規 | `makeBaseline`・`makeBaselineSummary` |
| [`frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts`](../samples/frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts) | 更新 | `makeSummary`・`makeExplanation` |
| [`frontend/src/features/change-requests/test-utils/renderWithStore.tsx`](../samples/frontend/src/features/change-requests/test-utils/renderWithStore.tsx) | 更新 | 説明書のタブと要約の操作の差し替え |
| [`frontend/src/features/baselines/api/__tests__/baselinesApi.test.ts`](../samples/frontend/src/features/baselines/api/__tests__/baselinesApi.test.ts) | 新規 | パスと作成の本文(CR の API のテストから束の分を移した) |
| [`frontend/src/features/baselines/__tests__/baselineOps.test.ts`](../samples/frontend/src/features/baselines/__tests__/baselineOps.test.ts) | 新規 | 純粋関数 |
| [`frontend/src/features/baselines/__tests__/baselines-store.test.ts`](../samples/frontend/src/features/baselines/__tests__/baselines-store.test.ts) | 新規 | ストア |
| [`frontend/src/features/change-requests/api/__tests__/changeRequestsApi.test.ts`](../samples/frontend/src/features/change-requests/api/__tests__/changeRequestsApi.test.ts) | 更新 | 説明書と要約の API |
| [`frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts`](../samples/frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts) | 更新 | 印と状態の文 |
| [`frontend/src/features/change-requests/__tests__/change-requests-store.test.ts`](../samples/frontend/src/features/change-requests/__tests__/change-requests-store.test.ts) | 更新 | 説明書のタブと要約の操作 |
| [`frontend/src/features/change-requests/components/__tests__/ChangeRequestForm.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestForm.test.tsx) | 更新 | 束の型を fixture で作る |
| [`frontend/src/features/change-requests/components/__tests__/ChangeRequestsPageContent.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestsPageContent.test.tsx) | 更新 | 同上(88-3 でも追記) |

依存の向き: `features/baselines/` → `features/change-requests/`(CR の型・`localInputToIso`・CR のストア)と `features/detailed-design/`(段階の型・ラベル・`listDesignStages`)。CR の側は束の API と型(`features/baselines/api/`)と、88-3 からはリンクの関数(`baselineOps`)を読む。モジュールの循環は無い(`baselineOps` は `changeRequestOps` を読むが、逆は読まない。CR のストアは束のストアを読まない)。

## 1. CR の一覧に合意の記録と入れた束を出す(devex-api)

```python
# app/schemas/change_request.py(抜粋)
class ChangeRequestSummaryRead(BaseModel):
    ...
    decision: ChangeRequestDecisionRead | None
    included_baseline_number: int | None
```

- **なぜ**: 束の作成のフォームは「検証済みで、まだどの束にも入れていない CR」を選ばせ、選んだ CR の合意の記録(相手・メモ・理由)を初期値にする。どちらも今まで詳細(`ChangeRequestRead`)だけが持っていた。検証済みの CR は増え続けるので、CR ごとに詳細を読むより、一覧に移すほうが軽い(列は CR の行にあり、入れた束は一覧でも読み込み済み)。
- 作るのは `summary_fields`(一覧と詳細で共通)。詳細は継承で同じ項目を持つ。応答の項目を足しただけで、合意した振る舞いは変えていない(#40 の CR にはしていない。[q_a](../q_a.md)「Phase 88 開始時」)。

## 2. 束の API と型(`features/baselines/api/`)

```ts
// src/features/baselines/api/baselinesApi.ts
export function listBaselines(projectId): Promise<BaselineSummaryRead[]>      // 新しい順
export function getBaseline(projectId, number): Promise<BaselineRead>         // 写しの中身つき
export function createBaseline(projectId, body: BaselineCreate): Promise<BaselineRead>
export function listBaselineRequirements(projectId, number): Promise<BaselineRequirementRead[]>
```

- **CR の feature から移した**(#17): 一覧と要件の行は、Phase 87 で CR の作成のフォームのために CR の API に置いた。この Phase で束の画面という2つ目の消費者ができたので、束の持ち物として `features/baselines/` へ移し、CR の側(ストア・作成のフォーム)はここから読む。
- 型は devex-api の `app/schemas/baseline.py` に合わせた(一覧の1件にも写しの要約 `items` と `recorded_by` がある。Phase 87 の型には無かった)。

## 3. 説明書と要約の API と型(CR の側)

```ts
// src/features/change-requests/api/changeRequestsApi.ts(抜粋)
getExplanation(projectId, number)                // GET  .../explanation
createExplanationSummary(projectId, number)      // POST .../explanation/summary(LLM。作り直すと上書き)
editExplanationSummary(projectId, number, text)  // PATCH .../explanation/summary
confirmExplanationSummary(projectId, number)     // POST .../explanation/summary/confirm
```

- どれも説明書の全体(`ChangeRequestExplanationRead`: 5節・出力・数・要約)を返す([84-3](../Phase-84/Phase-84-3.md))。画面は応答でタブの中身を置き換えるだけでよい。
- 要約の型 `ExplanationSummaryRead` の `unknown_requirement_ids`・`unknown_numbers` は、今の文(`text`)の照合の結果(サーバーが応答のたびに求める)。

## 4. 純粋関数

`changeRequestOps.ts` に足したもの:

| 関数・定数 | 役割 |
|---|---|
| `SUMMARY_TONE` | 要約の札の色(未確認 = 黄・確認済み = 緑・古い = 赤) |
| `summaryOutputNote(summary)` | 要約が出力に載るかの文。載るのは確認済みで古くないときだけ(サーバーの `output` と同じ条件) |
| `markSegments(text, ids, numbers)` | 文を「要件 ID・数字」とそれ以外に区切り、照合で合わないものに印(`id`/`number`)を付ける。印の無い区切りはつなげる |

- **区切りの規則は devex-api の照合と同じ**(`app/change_requests/explanation.py` の `_REQUIREMENT_ID`・`_NUMBER`): 要件 ID の中の数字は数字にしない(1つの正規表現で、ID を先に当てる)。英字に続く・英字が続く数字(`E2E`・`S3`)は名前の一部とみなす。違うのは全角の数字で、サーバーは NFKC で半角にして照合するが、画面の区切りは半角だけを当てる(全角の数字は、上の一覧には出るが、文の中の印は付かない)。

`baselineOps.ts`(新規):

| 関数 | 役割 |
|---|---|
| `stageOfKey`・`itemLabel`・`itemStateLabel` | 写しのキー(`requirements`・`stage:N`)の表示名と状態(文書は「写した / 無い」、段階は作った時点の段階の状態) |
| `baselineHref`・`baselinesHref` | 束の中身・一覧へのリンク |
| `includableChangeRequests`・`includedChangeRequests` | 入れられる CR(検証済みで `included_baseline_number` が無い。番号の順)・その束に入れた CR |
| `prefillAgreement(selected)` | 選んだ CR の判断の記録からの初期値。相手は最初に相手を持つ CR の相手、理由・メモは「CR-N: …」の行を並べる |
| `applySelection(form, numbers, list, touched)` | 選択を変えたときの入力。手で直した欄(`touched`)は残し、ほかを初期値で埋め直す |
| `toCreateBody(form)` | 作成の本文(相手の空は `null`、日時はタイムゾーン付き。読めなければ `null`) |
| `createBlocker(stages, form)` | 作れない理由(段階の生成中・理由が無い・日時が無い) |
| `stagePreview(stages)` | 今の段階から、束に入る(承認の写しがある)段階・入らない段階 |

- **初期値は手で直していない欄だけ**: CR を選び直すたびに初期値で上書きすると、利用者が書いた理由が消える。逆に、一度も触っていない欄は、選択に合わせて変わるほうが分かりやすい。どの欄を触ったかはフォームが持ち、ここは純粋に組み立てる。
- **入る段階は今の段階から示す**: サーバーは作る時点の `approved_model` の有無で決める(`stage_snapshots`)。画面は段階の一覧の `approved_version` で同じことを先に見せる。

## 5. ストア

```ts
// src/features/baselines/baselines-store.ts(抜粋)
fetchList(projectId, { force })   fetchDetail(projectId, number)   fetchStages(projectId)
create(projectId, body): Promise<BaselineRead | null>   clearCreateError()

// src/features/change-requests/change-requests-store.ts(足した分)
type DetailViews = { ...; explanation: ChangeRequestExplanationRead | null }
summarize / editSummary / confirmSummary(projectId, number[, text]): Promise<boolean>
summaryActing: "create" | "edit" | "confirm" | null    summaryError: string | null
```

- **束のストアは既存のストアと同じ型**: `projectId` を持ち、別のプロジェクトで捨てる。一覧は `isCacheFresh`。
- **段階の一覧を読む**(申し送り「止まった段階の生成と束」、Phase 81): 束の作成は段階の生成中だと 409。止まった生成(15分超)の回収は段階の一覧の GET が行うので、作成のフォームを開いたときに `listDesignStages` を読む。回収と、入る段階の表示を一度に済ませる。
- **作った後**: 束の一覧を読み直す。CR のストアが同じプロジェクトを持っていれば、一覧の鮮度(入れた CR の `included_baseline_number` が変わる)と基準の束の一覧(CR の作成の選択肢に新しい束が増える)を落とす。束のストアが CR のストアを読む向きだけにした(逆は読まない)。
- **要約の操作は説明書のタブだけを置き換える**: CR の状態は変わらないので、`replaceDetail` は使わない(ほかのタブと一覧の鮮度を落とさない)。LLM の呼び出しは長いことがあるので、どの操作の途中かを `summaryActing` に持つ(ボタンの文言と無効化に使う)。失敗は `summaryError` に残す。ほかの CR の操作(状態が変わる)の後は、ほかのタブと同じく説明書も捨てる(要約の「古い」も変わりうるため)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_requests_api.py`(更新) | ルート `list_change_requests`(`summary_fields` の合意の記録) | pytest のテスト関数 | 既存のとおり(SQLite のセッション。LLM は呼ばない) |
| `test_change_request_trace.py`(更新) | ルート `list_change_requests`(入れた束) | pytest のテスト関数 | `tests/fixtures/change_requests.py`(反映から検証・束まで) |
| `baselinesApi.test.ts`(新規) | `baselinesApi` の各関数 | vitest のテスト関数 | `fetch`(`stubFetch`)── パスと作成の本文を見るため |
| `baselineOps.test.ts`(新規) | `baselineOps` の関数 | vitest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |
| `baselines-store.test.ts`(新規) | `useBaselinesStore`(と、作成の後の CR のストアの鮮度) | vitest のテスト関数(ストアの関数を直接呼ぶ) | `fetch`(`stubFetch`)── 呼ぶ順と本文、応答・失敗の後の状態を見るため |
| `changeRequestsApi.test.ts`(更新) | 説明書と要約の関数 | vitest のテスト関数 | `fetch`(`stubFetch`) |
| `changeRequestOps.test.ts`(更新) | `markSegments`・`summaryOutputNote` | vitest のテスト関数 | スタブ不要 ── 純粋 |
| `change-requests-store.test.ts`(更新) | `useChangeRequestsStore` の説明書のタブと要約の操作 | vitest のテスト関数 | `fetch`(`stubFetch`) |
| `ChangeRequestForm.test.tsx`・`ChangeRequestsPageContent.test.tsx`(更新) | (型の移動の追従) | Testing Library | 既存のとおり |

- 一覧: 却下した CR の合意の記録が一覧にもある・下書きは記録も束も無い・束に入れた CR は束の番号を持つ。
- 束の API: 一覧・中身・要件の行のパス、作成の本文。
- 束の純粋関数: 表示名と状態・入れられる CR の絞り込みと順・初期値(相手・理由・メモ)・手で直した欄を残す・本文の整えと読めない日時・作れない理由(生成中・理由が無い)・入る段階。
- 束のストア: 一覧の鮮度と 404・中身と段階の状態・作成の後に一覧を読み直し、CR のストアの鮮度と基準の束を落とす・作成の失敗。
- 印: 合わない ID と数字だけに印・文はつなげて元に戻る・ID の中の数字と `E2E7` は印を付けない。状態の文: 無い・確認済み・未確認・古い。
- CR のストア: 説明書をタブとして読み、作る・直す(PATCH の本文)・確かめるの後はタブだけが変わり、詳細は変わらない・失敗の残し方。

# Phase-44-1: 型・API・ストア(影響の取得・確認済み・強調・直す先の推定)

## この章の目的

[Phase 43](../Phase-43/Phase-43-introduction.md) で作った変更の影響の API(`GET /design-stages/impact`・`POST /{stage}/impact/review`)を devex-ui から呼べるようにし、画面が使う状態(影響・強調する行)と操作(確認済み・部分再生成・「表で見る」・「段階Nで直す」の推定)を詳細設計画面のストアに足す。44-2〜44-4 の画面は、この章の型・純粋関数・ストアだけを読む。

自動実装モード: on([introduction](./Phase-44-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/frontend/src/features/detailed-design/` 配下(表は依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `ElementChangeRead`・`ImpactMarkRead`・`StageImpactRead`・`RegenerationTargetRead`・`DesignImpactRead`、`DesignStageRead.impact_open?`・`impact_reviewed?` |
| [`api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | `getDesignImpact`・`reviewImpactMarks` |
| [`impactOps.ts`](../samples/frontend/src/features/detailed-design/impactOps.ts) | 新規 | 要素のキー(`elementKey`)・印の引き方と状態・影響を取りに行くかの判定・部分再生成の引数・「段階Nで直す」の直す先の推定(純粋関数) |
| [`detailed-design-store.ts`](../samples/frontend/src/features/detailed-design/detailed-design-store.ts) | 更新 | `impact`・`impactError`・`reviewing`・`highlight`、`fetchStages` で影響も取る、`reviewMarks`・`regenerate`・`showInTable`、`jumpTo` で強調、409 `DESIGN_STAGE_UNREVIEWED_IMPACT` の文言 |
| ── ここからテスト ── | | |
| [`test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | `makeMark`・`makeElementChange`・`makeImpact`(段階4の変更から届いた印。記録した印・確認済み・pending・再生成の候補) |
| [`__tests__/impactOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/impactOps.test.ts) | 新規 | キーの形・表示・取りに行く判定・印の引き方・部分再生成の引数・直す先の推定 |
| [`__tests__/detailed-design-store.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/detailed-design-store.test.ts) | 更新 | 影響の取得(取る時・取らない時・失敗)・確認済み・409 の文言・部分再生成・「表で見る」・「段階Nで直す」 |

依存の向き: `impactOps` → `api/types`・既存の `*Ops`(`crudOps`・`functionListOps`・`logicOps`・`moduleListOps`・`planOps`)・`labels`。ストア → `impactOps`・`designStagesApi`。逆向きの import は無い(`impactOps` はストアを読まない)。

## 要点の抜粋

### 1. 型

```ts
// src/features/detailed-design/api/types.ts
export type ImpactMarkRead = {
  key: string; label: string; stage: number;
  path: string[];      // 変わった要素からこの要素までの道(先頭が変わった要素)
  reason: string; sources: string[];
  reviewed: boolean;
  pending: boolean;    // まだ承認していない編集から届く印(記録していない)
};
export type DesignImpactRead = { stages: StageImpactRead[]; regeneration_targets: RegenerationTargetRead[] };
```

devex-api の `app/schemas/design_stage.py` と同じ形。`DesignStageRead` の `impact_open`・`impact_reviewed` は、古いバックエンドの応答に無くてもよいよう省略可にした(`unit_req_ids` と同じ扱い)。

### 2. 要素のキー

```ts
// src/features/detailed-design/impactOps.ts
export const elementKey = {
  fn: (id) => `fn:${id}`, summary: ..., table: (name) => `table:${name.trim().toLowerCase()}`,
  crud: (fid, table) => `crud:${fid}×${小文字のテーブル}`, module: ..., proc: ...,
  logic: (module, fn) => `logic:${logicKey(module, fn)}`, task: (unitKey) => ..., cc: ..., unit: (unitKey) => ...,
};
```

devex-api の `app/detailed_design/impact/elements.py` と同じ形にする。各段階の表は、この関数で行のキーを作って印を引く(44-3)。テーブルは devex-api の `table_key` と同じく小文字にする。作業単位(段階7のタスク・段階8の手順書)は表示の ID(`M-01-T02`)でなく安定キー(`U-002`。[Phase 42](../Phase-42/Phase-42-introduction.md))で引く。

### 3. 影響をいつ取るか

```ts
export function mayHaveImpact(stages: DesignStageRead[]): boolean
```

詳細設計モードで、記録した印がある段階(`impact_open + impact_reviewed > 0`)か、承認の後に編集した段階(`approved_version` があり状態が承認済みでない。pending の印がありうる)があるときだけ `GET /impact` を呼ぶ。ストアの `fetchStages` は段階の一覧を取った後にこれで判定し、取得に失敗しても段階の一覧は出す(`impactError` に分ける)。

### 4. ストアの操作

```ts
// src/features/detailed-design/detailed-design-store.ts
reviewMarks: (projectId, stage, keys, reviewed) => Promise<boolean>; // 確認済み → 全段階を取り直す
regenerate: (projectId, stage, keys) => Promise<void>;               // 候補のキー → generate の引数
showInTable: (stage, key) => void;                                   // 段階へ移り highlight を立てる
jumpTo: (stage, target) => void;                                     // 直す先の文字列から highlight を推定
```

- `highlight: {stage, key}` は段階を移る(`selectStage`)まで残す。既存の `focus`(05↔06 のタブ移動)はパネルが開いたときに消えるので、行の強調は別に持つ。
- `showInTable` は段階5・6 では既存の `focus` も立て、その処理・関数のタブを開く(`focusTargetFor`)。
- `regenerate` は `regenerationArgs` で候補のキーを生成の引数にする(段階5 `proc:F-01` → `function_ids`、段階6 `logic:<モジュール>::<関数>` → `logics`、段階8 `unit:<キー>` → 段階8の作業単位 `plan` から今の表示の ID)。バックエンドは変えない。

### 5. 「段階Nで直す」の直す先の推定

```ts
export function resolveFixTarget(stage: number, text: string, stages: DesignStageRead[]): string | null
```

段階8の未定義・要決定の直す先(`target`)は LLM が書く文字列(「段階3 reservations」「F-01」「M-01-T02」など)。段階ごとに、処理ID(`F-\d+`)・テーブル名・モジュールのパス・関数名・単位の ID・横断事項の項目を、その段階の model と照合して行のキーにする。名前は長い順に照合し、短い名前が長い名前の一部に当たらないようにする。当たらなければ `null`(今どおり段階を開くだけ)。

## 設計判断

### 影響は「ありうる時」だけ取る

段階の一覧のたびに影響を取ると、印の無いプロジェクト(ほとんどの時間)でも要求が1つ増える。段階の一覧の `impact_open`・`impact_reviewed`(43-4 で足した件数)と承認後の編集の有無で足りるので、それで判定する。テストのフェッチのスタブは要求の順に応答を返す形なので、要求を増やさないことは既存のテストを壊さないことでもある。

### 部分再生成の引数は画面で導く

候補のキーから生成の引数への変換は、キーの形が決まっているので画面で足りる。段階8だけは安定キー → 表示の ID の対応が要るが、段階8の `plan`(作業単位)が画面にあるので、`planOps.taskId` で導ける。バックエンドの応答に生成の引数を足すことはしなかった(使う画面が1つで、#17 の「駆動する消費者」が API の側に無い)。

## テスト観点

用語(SUT / ドライバ / スタブ)は Phase 1 で定義済み。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `impactOps` の各関数 | vitest(`impactOps.test.ts`) | スタブ不要 ── どれも純粋関数(副作用なし)で、API もストアも呼ばないため。段階の model は `stageFixtures` で作る | キーの形(テーブルは小文字)、変わった場所と道の文、取りに行く判定(詳細設計モード・印・承認後の編集)、記録した印を pending より優先、印の状態と件数、部分再生成の引数(段階8は表示の ID を引き、引けないキーは捨てる)、直す先の推定(段階1〜8・当たらない)、タブの移動先 |
| ストアの `fetchStages`・`reviewMarks`・`approve`(409)・`regenerate`・`showInTable`・`jumpTo` | vitest(`detailed-design-store.test.ts`。ストアの操作を直接呼ぶ) | `global.fetch` のスタブ(`stubFetch`。積んだ応答を順に返し、送った要求を記録する) | 印が無ければ影響を取らない(スモーク: 要求は1つ)・あれば取る、影響の取得の失敗で段階の一覧は残る、確認済みの要求の本文、409 の案内、段階8の再生成で単位の ID を送る、強調とタブの移動先、段階を移ると強調が消える、直す先の推定と当たらないとき |

```sh
cd devex-ui && npx vitest run src/features/detailed-design/__tests__/impactOps.test.ts src/features/detailed-design/__tests__/detailed-design-store.test.ts
```

# Phase-116-1: 資料の型・API・純粋関数・ストア

## この章の目的

Phase 113〜115 の資料の API(資料・違いの取り出し・捨てる / 戻す・違いから CR の下書き)と、束の鮮度の API を、画面から呼べるようにする。画面の部品(116-2・116-3)が使う型・API の包み・純粋な変換(群分け・選べる違い・候補の要件・失敗の文)・ストアを先にそろえる。

自動実装モード: on([introduction](./Phase-116-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`features/baselines/api/types.ts`](../samples/frontend/src/features/baselines/api/types.ts) | 更新 | `BaselineAppliedAfterRead`・`BaselineFreshnessRead` |
| [`features/baselines/api/baselinesApi.ts`](../samples/frontend/src/features/baselines/api/baselinesApi.ts) | 更新 | `getBaselineFreshness`(`GET .../baselines/{n}/freshness`) |
| [`features/materials/api/types.ts`](../samples/frontend/src/features/materials/api/types.ts) | 新規 | 資料・違い・取り出しの回・違いの一覧・捨てる / 戻す・CR の下書きの本文、画面の入力 `MaterialInput` |
| [`features/materials/api/materialsApi.ts`](../samples/frontend/src/features/materials/api/materialsApi.ts) | 新規 | 資料の API 9つの包み(ファイルは multipart) |
| [`features/materials/materialOps.ts`](../samples/frontend/src/features/materials/materialOps.ts) | 新規 | 表示名・リンク・群分け・選べる違い・候補の要件・取り出し後の束の作り直し・失敗の文 |
| [`features/materials/materials-store.ts`](../samples/frontend/src/features/materials/materials-store.ts) | 新規 | 一覧・資料と違い・最新の束の鮮度・足す・消す・取り出す・捨てる / 戻す・CR の下書き |
| [`features/materials/test-utils/materialFixtures.ts`](../samples/frontend/src/features/materials/test-utils/materialFixtures.ts) | 新規 | 資料・違い・違いの一覧・束の鮮度の応答 |
| [`features/baselines/api/__tests__/baselinesApi.test.ts`](../samples/frontend/src/features/baselines/api/__tests__/baselinesApi.test.ts) | 更新 | 鮮度を読む |
| [`features/materials/api/__tests__/materialsApi.test.ts`](../samples/frontend/src/features/materials/api/__tests__/materialsApi.test.ts) | 新規 | 送るメソッド・URL・本文 |
| [`features/materials/__tests__/materialOps.test.ts`](../samples/frontend/src/features/materials/__tests__/materialOps.test.ts) | 新規 | 純粋な変換 |
| [`features/materials/__tests__/materials-store.test.ts`](../samples/frontend/src/features/materials/__tests__/materials-store.test.ts) | 新規 | API を呼ぶ順と、応答・失敗の後の状態 |

## 1. 型(`materials/api/types.ts`)

```ts
// src/features/materials/api/types.ts(抜粋)
export type DifferenceKind = "add" | "change" | "delete" | "question";
export type DifferenceStatus = "unconfirmed" | "rejected" | "converted" | "dismissed";
export type MaterialDifferencesRead = {
  material_id: string;
  extraction: MaterialExtractionRead | null;   // まだ取り出していなければ null
  latest_baseline_number: number | null;       // 今の最新の束(取り出した後に作り直したかを見る)
  differences: MaterialDifferenceRead[];
};
export type MaterialInput = { meta: MaterialMeta; body: string; file?: undefined } | { meta: MaterialMeta; file: File };
```

- devex-api の `schemas/material.py`・`material_difference.py` の形(画面で使う項目だけ)。違いの表示名(種類・状態のラベル)は API が返さないので、`materialOps.ts` が持つ。
- 束の鮮度 `BaselineFreshnessRead` は束の型(`baselines/api/types.ts`)に置き、資料の取り出しの回・CR・共有リンク(116-4)が同じ型を使う。
- `MaterialInput` は API の本文ではなく画面の入力(貼り付けかファイル)。フォーム(116-2)とストアの間で使うので型のファイルに置いた。

## 2. API の包み(`materialsApi.ts`)

| 関数 | メソッドとパス | 失敗 |
|---|---|---|
| `listMaterials`・`getMaterial` | GET `/materials`・`/materials/{mid}` | 簡易モードは 409 `DESIGN_STAGES_NOT_AVAILABLE` |
| `createMaterial` | POST `/materials`(JSON) | 409 `TOO_MANY_MATERIALS`・422 `MATERIAL_TOO_LONG` |
| `uploadMaterial` | POST `/materials/upload`(multipart: kind・title・material_date・file) | 400(形式・大きさ)・422 `MATERIAL_UNREADABLE` |
| `deleteMaterial` | DELETE `/materials/{mid}` | 404 |
| `extractDifferences`・`listDifferences` | POST・GET `/materials/{mid}/differences` | 409 `MATERIAL_BASELINE_MISSING` |
| `updateDifference` | PATCH `/materials/{mid}/differences/{did}` | 409 `MATERIAL_DIFFERENCE_STATE` |
| `createChangeRequestFromDifferences` | POST `/materials/{mid}/change-requests` | 409 `MATERIAL_DIFFERENCE_OUTDATED`・422 `MATERIAL_DRAFT_INVALID` |

- multipart は `createProject` と同じく `FormData` を `apiFetch` に渡す(`Content-Type` はブラウザが付ける)。

## 3. 純粋な変換(`materialOps.ts`)

```ts
// src/features/materials/materialOps.ts(抜粋)
export function groupDifferences(differences): DifferenceGroup[]      // 未確認 → CR にした → 捨てた → 弾いた(群の中は API の順)
export function isDraftable(d): boolean                              // 未確認の追加・変更・削除
export function choosesRequirements(d): boolean                      // 要件でない対象で、つながる要件の候補がある
export function requirementIdsFor(selected, unchecked): string[] | undefined
export function withoutRequirement(selected, unchecked): MaterialDifferenceRead[]
export function isExtractionOutdated(view): boolean
export function materialErrorMessage(err, fallback): string
```

- **並び**(着手時の決定2): 状態で群に分け、判断する違い(未確認)を上に置く。群の中は取り出しの順(≒ 資料の順)のまま。種類で分けると議題の流れが崩れるため。
- **候補の要件**(Phase 115 の決定2): 外した要件を「違いの id → 外した要件 ID」で持つ(既定は空 = 全部を選んだ形)。1つも外していなければ `requirement_ids` を省き、サーバーが候補すべてを対象にする。外していれば、選んだ違いの残った候補を合わせて送る。サーバーは `requirement_ids` を選んだ違い全体の集合として扱うので、ある違いの候補を全部外すと、その違いは対象を持たずに落ちる。そこで `withoutRequirement` で先に止める(Claude の判断)。
- **失敗の文**: サーバーの文(日本語)をそのまま出し、取り出し直し(`MATERIAL_DIFFERENCE_OUTDATED`)と束が無い(`MATERIAL_BASELINE_MISSING`)だけ、次にすることを足す。

## 4. ストア(`materials-store.ts`)

- 形は `baselines-store.ts` と同じ(プロジェクトが変われば捨てる・一覧は `fetchedAt` で20秒の鮮度・簡易モードは `unavailable`)。
- `fetchDetail` は資料と違いの一覧を並べて読み、違いの一覧の最新の束の番号で、**その束の鮮度**を読む(`latestFreshness`。取り出しの前に知らせるため)。鮮度は知らせのためだけなので、読めなくても画面は出す。
- 取り出し・捨てる・戻す・CR の下書きの後は、違いの一覧を置き換え、鮮度も読み直す。CR の下書きを作ったら、CR のストアの一覧の鮮度を落とす(CR の一覧に下書きが増える)。
- 読む間に別の資料へ移ったら、古い応答は捨てる(`isOpen`)。

## テスト観点

用語: SUT = テストの対象、ドライバ = SUT を呼ぶもの、スタブ = SUT が呼ぶ外部の代わり(テストダブル)。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `materialsApi.test.ts`・`baselinesApi.test.ts`(鮮度) | API の包み | vitest のテスト関数 | fetch(`stubFetch`)── 送ったメソッド・URL・本文と応答の受け渡しを見るため |
| `materialOps.test.ts` | 純粋な変換 | vitest のテスト関数 | スタブ不要 ── 純粋(副作用なし)で外部依存を呼ばないため |
| `materials-store.test.ts` | `useMaterialsStore` | ストアの関数を直接呼ぶ | fetch(`stubFetch`)── 呼ぶ順と、応答・失敗の後の状態を見るため |

- 純粋: 群の順と群の中の順、確かめる点・捨てたは選べない、要件の対象は候補を選ばない、外さなければ省き・外せば残り・全部外した違いを見つける、取り出し後の束の作り直し、失敗の文。
- ストア: 一覧の鮮度、簡易モード、資料と違いと鮮度を読む、貼り付けとファイルで足す・失敗、取り出し・捨てる・戻すの後の読み直し、CR の下書きの後に CR の一覧の鮮度を落とす・取り出し直しの案内、消すと閉じる。
- fetch のスタブは本文なしの 204 を作れないので、削除は 200 の空で代えて、呼び出し先とメソッドだけを確かめる(既存の `umlApi.test.ts` と同じ)。

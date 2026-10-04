# Phase-19-5: 型と承認時に出す指摘(FE)

## この章の目的

バックエンドの 19-1〜19-4 に合わせて、フロントエンドの型を足す。段階4の意味モデル(モジュール一覧)の型と、構成図を識別するキーができる。あわせて、構成図の未承認(`COMPONENT_NOT_APPROVED`)を、DFD・ER と同じく「検証の結果の一覧に出さず、段階の承認を押したときに理由として出す」指摘に登録する。

納期モード([introduction](./Phase-19-introduction.md) 参照)。SUT/ドライバ/スタブの言語化は省略し、型は `tsc` で確かめる。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | 定型 | `ModuleRow`・`ModuleListModel`・`STRUCTURE_SUBJECT` |
| [`labels.ts`](../samples/frontend/src/features/detailed-design/labels.ts) | 更新 | 定型 | `APPROVAL_TIME_CODES` に `COMPONENT_NOT_APPROVED` |
| ── ここからテスト ── | | | |
| [`test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | 定型 | `makeModuleList(layer?)`(F-01 に関わる行1つ) |
| [`__tests__/labels.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/labels.test.ts) | 更新 | 定型 | 構成図の未承認も承認時に出す指摘であること |

## 要点の抜粋

```ts
// api/types.ts
export type ModuleRow = {
  path: string;            // 段階5の関与表の列の鍵
  layer: string;           // 構成図の層(要素の layer)の名前
  responsibility: string;
  depends_on: string[];
  functions: string[];     // 関わる処理の処理ID
  all_functions: boolean;  // 全処理が通る横断のモジュール
};
export type ModuleListModel = { modules: ModuleRow[] };
export const STRUCTURE_SUBJECT = "";   // devex-api の STRUCTURE_SUBJECT と同じ
```

```ts
// labels.ts
export const APPROVAL_TIME_CODES = new Set(["DFD_NOT_APPROVED", "ER_NOT_APPROVED", "COMPONENT_NOT_APPROVED"]);
```

段階4の保存・承認・生成は、Phase 15・16 の API(`designStagesApi.ts`)をそのまま使う(段階番号が違うだけ)ので、API クライアントは変えない。段階4は `dfd_accesses` のような追加の応答も持たない。

構成図の未承認を承認時に出す理由は、Phase 18 の画面確認後の修正と同じである。図のエディタで承認すれば消える指摘なので、最初から一覧に出すと「まだ何もしていないのにエラー」に見える。バックエンドは検証のエラーのまま残し、承認を 409 で断る。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/__tests__/labels.test.ts
# 5 passed
npx tsc --noEmit
```

# Phase-15-6: API・型 ── モード、段階の API、SSE の失敗イベント(FE)

## この章の目的

15-1〜15-3 でバックエンドに足したものを、画面から使えるようにする。

- プロジェクトの型に `mode` を足し、作成の API で送る。
- 段階の API(一覧・保存・承認)のクライアントと型を作る。
- チャットの SSE が `event: error` を受け取ったら、`code` と `detail` を持つ `StreamChatError` にする。

納期モード([introduction](./Phase-15-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`src/features/dashboard/api/projects.ts`](../samples/frontend/src/features/dashboard/api/projects.ts) | 更新 | 定型 | `ProjectMode`、`ProjectRead.mode` |
| [`src/features/hearing/api/createProject.ts`](../samples/frontend/src/features/hearing/api/createProject.ts) | 更新 | 定型 | `mode` 欄を送る(省略時は送らない) |
| [`src/features/hearing/api/streamChat.ts`](../samples/frontend/src/features/hearing/api/streamChat.ts) | 更新 | 定型 | `StreamChatError.code`、`parseEvent`(`delta`/`done`/`error`/`ignored`) |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 新規 | 定型 | `StageState`、`DesignStageRead` |
| [`src/features/detailed-design/api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 新規 | 定型 | `listDesignStages`、`saveDesignStage`、`approveDesignStage` |
| ── ここからテスト ── | | | |
| [`src/features/hearing/api/__tests__/createProject.test.ts`](../samples/frontend/src/features/hearing/api/__tests__/createProject.test.ts) | 更新 | 定型 | `mode` の有無 |
| [`src/features/hearing/api/__tests__/streamChat.test.ts`](../samples/frontend/src/features/hearing/api/__tests__/streamChat.test.ts) | 更新 | 定型 | `event: error` で `code` 付きの例外、壊れたイベント |
| [`src/features/detailed-design/api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 新規 | 定型 | URL・メソッド・本文 |

## 要点の抜粋

```ts
// src/features/hearing/api/streamChat.ts
export class StreamChatError extends Error {
  code?: string;                     // バックエンドの共通エラー形式の code。HTTPの失敗では持たない
  ...
}

const event = parseEvent(rawEvent);
if (event.kind === "done") return;
if (event.kind === "error") throw new StreamChatError(event.detail, event.code);
if (event.kind === "delta") yield event.delta;
```

`parseEvent` は、`event:` 行が `error` なら `data:` の JSON から `code` と `detail` を取る。JSON として読めなければ、既定の文言にする。種類つきの結果(判別共用体)を返すので、呼び出し側は文字列の目印(以前の `"__DONE__"`)に頼らない。

## 設計判断

- **SSE の失敗は `code` の有無で見分ける**: HTTP が失敗したとき(401 以外のステータスなど)の `StreamChatError` は `code` を持たない。`event: error` のときだけ `code` を持つ。画面(15-8)は、`code` があれば「バックエンドが失敗を伝えた(発話は保存されていない)」と判断する。
- **`mode` は省略可能にした**: 省略すればバックエンドの既定(`simple`)になる。作成画面以外から `createProject` を呼ぶコードや既存のテストを、変えずに済む。

## テスト観点

納期モードのため、SUT・ドライバ・スタブの言語化は省略する(#21)。`stubFetch` と、`ReadableStream` で SSE を返す `sseResponse` を使った(既存のテストと同じ)。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/hearing/api src/features/detailed-design/api
# 15 passed
```

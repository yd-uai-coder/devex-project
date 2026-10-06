# Phase-15-8: 確認ダイアログと、チャットの失敗の表示(FE)

## この章の目的

出力見本の気づきのうち、画面の側の3件を直す。

- **#4**: 設計書の生成・再生成のボタンを押す前に、確認ダイアログを出す。押したらボタンを無効にする(二度押しの防止)。受け付けが 409 などで失敗したら、理由を出してボタンを戻す。
- **#6**: 承認済みの UML 図を再生成するときに、「承認がやり直しになります」と確認する。
- **#2**: チャットの SSE が `event: error` で失敗を伝えたら、理由を表示し、表示していた発話を取り消す(バックエンドは発話を保存していない)。

あわせて、文書画面の再生成で、受け付けの失敗が放置されていた(`regenerating` が立ったままになり、Promise の失敗も拾われない)のを直した。

自動実装モード: on([introduction](./Phase-15-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`src/components/ui/layout-blocks/ConfirmDialog.tsx`](../samples/frontend/src/components/ui/layout-blocks/ConfirmDialog.tsx) | 新規 | 定型 | 汎用の確認ダイアログ(題名・説明・確定のボタン名) |
| [`src/features/uml/api/types.ts`](../samples/frontend/src/features/uml/api/types.ts) | 更新 | 定型 | 理由コード `STALE_GENERATION` |
| [`src/features/uml/labels.ts`](../samples/frontend/src/features/uml/labels.ts) | 更新 | 定型 | `STALE_GENERATION` の言葉 |
| `src/features/uml/components/GenerationPanel.tsx` | 更新 | **コア** | `approvedTargets`、承認済みの図の再生成の確認 |
| [`src/features/documents/documents-store.ts`](../samples/frontend/src/features/documents/documents-store.ts) | 更新 | 定型 | `regenerateError`、受け付けの失敗で `regenerating` を下ろす |
| [`src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | 定型 | 再生成の確認、失敗の表示 |
| [`src/features/hearing/hearing-store.ts`](../samples/frontend/src/features/hearing/hearing-store.ts) | 更新 | **コア** | `streamError`、`event: error` で発話の表示を取り消す |
| [`src/features/hearing/components/HearingCompletionBanner.tsx`](../samples/frontend/src/features/hearing/components/HearingCompletionBanner.tsx) | 更新 | 定型 | 生成の確認 |
| [`src/features/hearing/components/ChatPanel.tsx`](../samples/frontend/src/features/hearing/components/ChatPanel.tsx) | 更新 | 定型 | 二度押しの防止、`streamError` の表示 |
| ── ここからテスト ── | | | |
| [`src/components/ui/layout-blocks/__tests__/ConfirmDialog.test.tsx`](../samples/frontend/src/components/ui/layout-blocks/__tests__/ConfirmDialog.test.tsx) | 新規 | 定型 | 開閉、確定・キャンセル |
| `src/features/uml/__tests__/labels.test.ts` | 新規 | 定型 | `STALE_GENERATION` の言葉 |
| `src/features/uml/components/__tests__/GenerationPanel.test.tsx` | 更新 | **コア** | 承認済みの図の確認、`approvedTargets` |
| [`src/features/documents/__tests__/documents-store.test.ts`](../samples/frontend/src/features/documents/__tests__/documents-store.test.ts) | 更新 | 定型 | 受け付けの失敗 |
| [`src/features/documents/components/__tests__/DocumentsPageContent.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx) | 更新 | 定型 | 確認を経た再生成、失敗の表示 |
| [`src/features/hearing/__tests__/hearing-store.test.ts`](../samples/frontend/src/features/hearing/__tests__/hearing-store.test.ts) | 更新 | **コア** | `event: error` と切断の区別 |
| [`src/features/hearing/components/__tests__/HearingCompletionBanner.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/HearingCompletionBanner.test.tsx) | 更新 | 定型 | 確認を経た生成、キャンセル |
| [`src/features/hearing/components/__tests__/ChatPanel.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/ChatPanel.test.tsx) | 更新 | 定型 | 確認を経た生成の失敗、`streamError` の表示 |

## 要点の抜粋

```ts
// src/features/uml/components/GenerationPanel.tsx
export function approvedTargets(diagrams: UmlDiagramRead[], request: UmlGenerateRequest): UmlDiagramRead[] {
  const subjects = request.subjects?.length ? request.subjects.map((s) => s.subject) : [""];
  return diagrams.filter(
    (d) => d.notation === request.notation && subjects.includes(d.subject)
      && (d.status === "approved" || d.status === "exported"),
  );
}

const requestGenerate = (request: UmlGenerateRequest) => {
  if (approvedTargets(diagrams, request).length > 0) {
    setPending(request);           // 確認ダイアログを開く。確定したら generate(projectId, pending)
    return;
  }
  void generate(projectId, request);
};
```

```ts
// src/features/hearing/hearing-store.ts(sendMessage の catch)
if (err instanceof StreamChatError && err.code) {
  // バックエンドが失敗を伝えた(発話は保存されていない)。表示した発話を取り消し、理由を見せる
  set((state) => ({
    messages: state.messages.filter((m) => m.id !== optimisticUserMessage.id),
    sending: false, streamingReply: "", streamError: err.message,
  }));
  return;
}
set({ sending: false, connectionLost: true, streamingReply: "" });   // 切断(保存されたか分からない)
```

## 設計判断

### `window.confirm` ではなく、共通の確認ダイアログにした

既存の画面には、再レイアウトの前の `window.confirm` が1つだけあった。生成の確認は文言が長く(何が起きるか・どれくらいかかるか)、ボタンの名前も操作に合わせたい(「生成する」「再生成する」)。そこで、`LoginRequiredDialog` と同じ形の `ConfirmDialog` を `src/components/ui/layout-blocks/` に作った。特定の機能に依存しない部品なので、`features/` ではなくデザインシステムの層に置いた。

### 承認済みの図の再生成は、承認がやり直しになることを先に伝える

再生成すると、AI の出力で意味モデルを置き換えるので、前の承認は今の図に対するものではなくなる。下書きに戻るのは正しい挙動である([Phase-14-5](../Phase-14/Phase-14-5.md) #6 の判断)。足りなかったのは、それを押す前に知る手段だけなので、確認ダイアログで補った。確認するのは、対象に承認済み(`approved`・`exported`)の図が含まれるときだけである。下書きの図の再生成は、今までどおりすぐ受け付ける。

### 「発話を取り消す」のは、バックエンドが失敗を伝えたときだけ

| 何が起きたか | バックエンドの発話 | 画面 |
|---|---|---|
| `event: error` を受け取った | 保存されていない(rollback) | 発話を取り消し、理由を出す |
| 接続が切れた(`code` の無い失敗) | 保存されたか分からない | 発話を残し、「接続が切れました」を出す(今までどおり) |

以前の `sendMessage` のコメントは「発話はストリームの前に保存される」としていた。実際には、AI の応答と一緒に最後に保存されていたので、コメントも直した。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ConfirmDialog` | vitest + Testing Library | スタブ不要。props だけで描くため | ボタンは aria-label で取る(Dialog の中は jsdom でロールのクエリから隠れる) |
| `approvedTargets` | vitest | スタブ不要。純粋関数のため | 出力済みも承認済みとして扱う |
| `GenerationPanel`・`HearingCompletionBanner`・`ChatPanel`・`DocumentsPageContent` | vitest + Testing Library | ストアのアクションを `vi.fn()` に差し替える | 確認を経ないと生成が呼ばれないこと |
| `useHearingStore.sendMessage` | vitest | `streamChat` をモック(`StreamChatError` は本物を使う。ストアが `instanceof` で見分けるため) | `event: error` と切断の区別 |
| `useDocumentsStore.regenerate` | vitest | `stubFetch`(409 を返す) | `regenerating` が下り、理由が残る |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/components/ui/layout-blocks src/features/hearing src/features/uml/components/__tests__/GenerationPanel.test.tsx \
  src/features/uml/__tests__/labels.test.ts src/features/documents
# 132 passed
```

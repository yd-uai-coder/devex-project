# Phase-6-2: バージョン履歴UI(SCR-006)

## この章の目的

[`Phase-6-1.md`](./Phase-6-1.md)で実装したバージョン履歴API(`GET .../versions`・`POST .../versions/{version}/restore`)を使い、SCR-006(バージョン履歴管理画面、Should have)のUIを実装する。ドキュメントプレビュー画面([`Phase-3-6.md`](../Phase-3/Phase-3-6.md)の`DocumentMarkdownView.tsx`)に、開閉式のバージョン履歴パネルを追加し、一覧表示・最新版以外への復元操作を提供する。

自動実装モード: off([introduction](./Phase-6-introduction.md) 参照)。#14のとおりSUT/ドライバ/スタブを言語化する。

サンプルは [`textbook/samples/frontend/`](../samples/frontend/) に追加した。写経前提として[`Phase-3-6.md`](../Phase-3/Phase-3-6.md)(`documentsApi.ts`・`documents-store.ts`・`DocumentMarkdownView.tsx`の既存設計)と[`Phase-6-1.md`](./Phase-6-1.md)(本章が呼ぶ2エンドポイント)の写経が完了していること。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): テストはまとめて表の末尾に置いている。

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
|---|---|---|---|
| [`src/features/documents/api/documentsApi.ts`](../samples/frontend/src/features/documents/api/documentsApi.ts) | 更新 | 定型 | `listDocumentVersions`・`restoreDocumentVersion`を追加(Phase 6-1の2エンドポイントへの薄いラッパー)。既存の`listDocuments`・`downloadDocument`は変更なし |
| [`src/features/documents/components/VersionHistoryPanel.tsx`](../samples/frontend/src/features/documents/components/VersionHistoryPanel.tsx) | 新規 | **コア** | 開閉トグル+遅延取得+新しい順一覧表示+最新版以外への復元操作 |
| [`src/features/documents/components/DocumentMarkdownView.tsx`](../samples/frontend/src/features/documents/components/DocumentMarkdownView.tsx) | 更新 | 定型 | `VersionHistoryPanel`を`downloadError`表示とMarkdown本文の間に配線するのみ。既存のコピー・ダウンロード処理は変更なし |
| ── ここからテスト(まとめて末尾) ── | | | |
| [`src/features/documents/api/__tests__/documentsApi.test.ts`](../samples/frontend/src/features/documents/api/__tests__/documentsApi.test.ts) | 更新 | 定型 | `listDocumentVersions`・`restoreDocumentVersion`のURL・メソッドを確認するテストを追加 |
| [`src/features/documents/components/__tests__/VersionHistoryPanel.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/VersionHistoryPanel.test.tsx) | 新規 | 定型 | 下記テスト観点参照 |

## 主要な設計判断

### なぜ`documents-store.ts`(Zustand)ではなくコンポーネントローカルの`useState`に置いたか

バージョン一覧は「パネルを開いた瞬間にだけ必要で、パネルを閉じれば忘れてよい」表示専用の状態であり、`documents-store.ts`が管理する「4文書の最新版」のようにページ内の複数箇所から参照される状態ではない。CLAUDE.md #17の判定基準(「この共通化を今駆動している実在の消費者は何か」)に照らすと、`VersionHistoryPanel`以外にバージョン一覧を必要とする消費者は現時点で存在しないため、Zustandストアへの格上げは見送り、`VersionHistoryPanel`内の`useState`(`open`/`status`/`versions`/`error`/`restoringVersion`)に閉じた。既存の`documents-store.ts`の責務(TTLキャッシュ付き最新版取得)には一切手を加えていない。

### 遅延取得(`open`トグル時のみ`listDocumentVersions`を呼ぶ)にした理由

`DocumentMarkdownView`は4タブ全てが初期表示時にマウントされうる([`Phase-3-6.md`](../Phase-3/Phase-3-6.md)の`DocumentTabs`参照)。パネルをマウント時に即座に取得する設計だと、ユーザーが履歴を1件も見ないタブについても`GET .../versions`が常時4回走ってしまう。「開く」操作を起点にする遅延取得にすることで、実際に履歴を確認したいタブでのみAPIを呼ぶ。`status === "idle"`のときのみ取得する実装のため、一度開いて閉じても再度開いた際に再取得はしない(同一パネルを開き直すだけで内容が変わることは想定していないため、キャッシュの鮮度管理は不要と判断した)。

### 復元後、ローカル状態への反映と`documents-store`のforce再取得の両方を行う理由

> **[Phase 6-6 で確定 ── 復元で履歴が増えない]** 当初〈復元の応答(新バージョン)を一覧先頭に追加〉→ 変更。復元はバージョンを増やさないため、一覧の件数は変えず`is_current`(「表示中」バッジ)のみ付け替える。`documents-store`のforce再取得は従来どおり(ダウンロードは`documents-store`の表示中ドキュメントの`id`を使う)。詳細は[`Phase-6-6.md`](./Phase-6-6.md)。以下は当初案の記録。

復元操作(`restoreDocumentVersion`)は新バージョンをサーバーに作成するが、その結果は2箇所に影響する。

1. **パネル自身の履歴一覧**: 復元で増えた新バージョンをパネルの一覧に反映する必要がある。ここはAPIレスポンス(`restored`)をそのまま`versions`の先頭に追加するだけで済み、再取得は不要。
2. **ドキュメントプレビュー本体(タブの表示内容)**: `DocumentMarkdownView`が表示している「最新版」は`documents-store.ts`が保持しており、復元で新バージョンができた以上ここも更新しないと、パネルでは新バージョンが見えるのにプレビュー本体は古い内容のままという不整合が起きる。`documents-store.ts`の`fetchDocuments`は既存のTTLキャッシュ(`isCacheFresh`)判定を持つため、`{ force: true }`を渡して確実に再取得させる。

両方を1回のAPI呼び出しの結果から行っており、`documents-store`側の再取得を待たずにパネルの一覧はAPIレスポンスで即時反映される(`void`で結果を待たずに投げているのはこのため)。

### 復元前の確認ダイアログを設けなかった理由(既知の残課題)

復元は「新バージョンとして追加」(仕様診断#28決定2、既存版の上書きではない)であり、誤操作をしても復元前の版は消えない。この非破壊性を根拠に、本章では確認ダイアログ(モーダル)を追加していない。ただし「本当に復元してよいか」というユーザー体験上の摩擦は仕様診断で「軽微」寄りの論点として保留していた部分であり、実際に写経後の使用感で問題になれば追加を検討する(下記「既知の残課題」参照)。

## テスト観点(#14)

| ケース | 期待結果 | SUT / ドライバ / スタブ |
|---|---|---|
| `documentsApi.listDocumentVersions`/`restoreDocumentVersion` | 正しいURL(`.../documents/{doc_type}/versions`)・`restoreDocumentVersion`は`method: "POST"`で呼ぶ | SUT: `documentsApi.ts` / ドライバ: 直接呼び出し / スタブ: `stubFetch`(`fetch-stub.ts`) |
| `VersionHistoryPanel`: 開閉トグル | 「開く」操作で`listDocumentVersions`を呼び、新しい順の一覧を表示する(先頭に「(最新)」表示) | SUT: コンポーネント / ドライバ: `render`+`userEvent` / スタブ: `stubFetch` |
| `VersionHistoryPanel`: 最新版には復元ボタンを出さない | 一覧の先頭(index 0)にのみ復元ボタンが無い | 同上 |
| `VersionHistoryPanel`: 復元操作 | 非最新版の復元ボタン押下で`restoreDocumentVersion`を呼び、結果を一覧先頭に追加し、`documents-store.fetchDocuments`を`{ force: true }`で呼ぶ(list→restore→force再取得の計3リクエスト) | SUT: コンポーネント / ドライバ: `render`+`userEvent` / スタブ: `stubFetch`+`useDocumentsStore`の`fetchDocuments`をスパイ |
| `VersionHistoryPanel`: 取得失敗 | `role="alert"`のエラー表示 | SUT: コンポーネント / ドライバ: `render`+`userEvent` / スタブ: `stubFetch`が失敗レスポンスを返す |

## 動作確認(実施済み)

samples反映後、devex-uiの実環境へ一時的に適用して以下を確認した(検証後は元の状態に復元済み、実プロジェクトへの反映は各自の写経による)。

```bash
npx vitest run src/features/documents
# 26 passed
npx vitest run
# 38 files / 196 tests passed(1回目は無関係な既存コンポーネントで3件flakyな失敗が出たが、直後の再実行で全件green。本章の変更とは無関係と判断)
npm run lint
# エラーなし
npx tsc --noEmit
# エラーなし
npm run build
# 成功(既存の全ルートが問題なくコンパイル)
```

### 写経時の注意点(このセッションで踏んだハマりどころ)

復元操作のテストで、キューに積むバージョンを1件(`[V1]`)だけにすると、そのV1がindex 0=最新版として扱われて復元ボタン自体が出ず、`getByRole("button", {name: "この内容で復元する"})`が要素を見つけられず失敗した。テスト対象のバグではなく、テスト側が「最新版以外を復元する」というシナリオを満たしていなかったのが原因。2件(`[V2, V1]`)をキューに積み、非最新のV1を復元対象にすることで解消した。

## 既知の残課題

- 復元前の確認ダイアログは未実装(前述の設計判断参照)。
- バージョン間の差分(diff)表示は本章でも見送り(Phase 6-1に続き仕様診断#28で「中程度」に分類、UIが実際に使われてから優先度を再検討する)。
- 一覧の件数は既存のバージョン保持ポリシー(直近3件)にそのまま従うため、ページネーションは実装していない。

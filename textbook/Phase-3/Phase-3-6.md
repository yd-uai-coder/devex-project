# Phase-3-6: ドキュメントプレビューUI(SCR-005)

## この章の目的

`docs/external_design.md` 2.3節SCR-005(ドキュメントプレビュー・編集画面)を実装する。`GET /api/v1/projects/{id}/documents`で取得した4種の設計書を4タブで切り替え表示し、クリップボードコピー・ダウンロード・チャットへの導線・再生成を提供する。Phase 3の最終章であり、SCR-004(チャット)→SCR-005(プレビュー)への遷移でMVPコアループの画面一式が完成する。

納期モード([`Phase-3-introduction.md`](./Phase-3-introduction.md)参照)。ドキュメント自体を生成する知性はサーバー側にあり、本画面はレンダリング+タブ切替+ボタン配線のみのため。#14のSUT/ドライバ/スタブの言語化は省略する。

サンプルは [`textbook/samples/frontend/`](../samples/frontend/) に追加した。写経前提として[`Phase-3-1.md`](./Phase-3-1.md)〜[`Phase-3-5.md`](./Phase-3-5.md)の写経が完了していること。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): `useGenerationPolling.ts`(Phase 3-5の`ChatPageContent.tsx`から切り出す共通フック、他のドキュメント系ファイルより先)→`ChatPageContent.tsx`(切り出し後の書き換え)→`documentsApi.ts`→`documents-store.ts`→`DocumentMarkdownView.tsx`→`DocumentTabs.tsx`→`DocumentsPageContent.tsx`(前述すべてに依存)→`app/projects/[id]/documents/page.tsx`。テストは末尾。

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
|---|---|---|---|
| [`vitest.setup.ts`](../samples/frontend/vitest.setup.ts) | 更新 | 定型 | jsdomに`ResizeObserver`ポリフィルを追加(Tamagui `Tabs`が内部で使用するため) |
| [`src/hooks/useGenerationPolling.ts`](../samples/frontend/src/hooks/useGenerationPolling.ts) | 新規 | **コア** | 生成完了ポーリングの共通ロジック(Phase 3-5の`ChatPageContent.tsx`から切り出し) |
| [`src/features/hearing/components/ChatPageContent.tsx`](../samples/frontend/src/features/hearing/components/ChatPageContent.tsx) | 更新 | 定型 | `useGenerationPolling`を使うよう書き換え(表示内容は変更なし) |
| [`src/features/documents/api/documentsApi.ts`](../samples/frontend/src/features/documents/api/documentsApi.ts) | 新規 | **コア** | `listDocuments`(`apiFetch`経由)+`downloadDocument`(生`fetch`、`Content-Disposition`解析) |
| [`src/features/documents/documents-store.ts`](../samples/frontend/src/features/documents/documents-store.ts) | 新規 | **コア** | ドキュメント一覧の状態管理(TTLキャッシュ)+再生成トリガー+完了時の再取得 |
| [`src/features/documents/components/DocumentMarkdownView.tsx`](../samples/frontend/src/features/documents/components/DocumentMarkdownView.tsx) | 新規 | **コア** | 1ドキュメントの表示+コピー+ダウンロード |
| [`src/features/documents/components/DocumentTabs.tsx`](../samples/frontend/src/features/documents/components/DocumentTabs.tsx) | 新規 | **コア** | 既存`LayoutTabs`を4文書種別に対して組み立てる |
| [`src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 新規 | **コア** | 取得+再生成+状態表示(読込中/エラー/空/一覧)の統合 |
| [`src/app/projects/[id]/documents/page.tsx`](../samples/frontend/src/app/projects/[id]/documents/page.tsx) | 新規 | 定型 | 動的ルートの`params`を解決し`DocumentsPageContent`へ渡す。`RequireAuth`でガード |
| ── ここからテスト(まとめて末尾) ── | | | |
| [`src/hooks/__tests__/useGenerationPolling.test.ts`](../samples/frontend/src/hooks/__tests__/useGenerationPolling.test.ts) | 新規 | 定型 | ポーリングの発火条件・完了検知・タイムアウトの確認(`renderHook`) |
| [`src/features/hearing/components/__tests__/ChatPageContent.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/ChatPageContent.test.tsx) | 更新 | 定型 | 切り出し後の配線のみを見る形に書き換え(詳細な挙動は上記フックのテストへ移動) |
| [`src/features/documents/api/__tests__/documentsApi.test.ts`](../samples/frontend/src/features/documents/api/__tests__/documentsApi.test.ts) | 新規 | 定型 | `listDocuments`呼び出し+ファイル名解析の各ケース |
| [`src/features/documents/__tests__/documents-store.test.ts`](../samples/frontend/src/features/documents/__tests__/documents-store.test.ts) | 新規 | 定型 | 取得・TTL・force・再生成・再生成完了時の再取得の各ケース |
| [`src/features/documents/components/__tests__/DocumentMarkdownView.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentMarkdownView.test.tsx) | 新規 | 定型 | Markdown描画・コピー・ダウンロード成功/失敗の各ケース |
| [`src/features/documents/components/__tests__/DocumentTabs.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentTabs.test.tsx) | 新規 | 定型 | タブ表示・切り替えの確認 |
| [`src/features/documents/components/__tests__/DocumentsPageContent.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx) | 新規 | 定型 | 取得・再生成・ポーリング配線・空状態の確認 |
| [`src/app/projects/[id]/documents/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/documents/__tests__/page.test.tsx) | 新規 | 定型 | `params`解決+`RequireAuth`配線のスモークテスト |

## 主要な設計判断

### `useGenerationPolling`への切り出し(rule #17: 2つ目の実消費者)

Phase 3-5の`ChatPageContent.tsx`に直接書かれていた「`GET /projects/{id}`のstatusを5秒間隔でポーリングし、`completed`になったらコールバックを呼ぶ」というロジックを、本章のドキュメントプレビュー画面の再生成でもそのまま必要とした。CLAUDE.md #17の判定基準(「この共通化を今駆動している実在の消費者は何か」)に照らし、`app/projects/[id]/documents/page.tsx`という具体名の消費者が実在するため、`src/hooks/useGenerationPolling.ts`へ切り出した。`ChatPageContent.tsx`はこのフックを使うよう書き換えたが、表示内容(見出し・状態メッセージ)自体は変更していない。

### ダウンロードだけ`apiFetch`を使わずAPI呼び出しを分けた理由

`GET /documents/{id}/download`はJSONではなくMarkdown本文をレスポンスボディにそのまま返し、ファイル名は`Content-Disposition`ヘッダに含まれる。JSON専用の`apiFetch`(常に`res.json()`を呼ぶ)では扱えないため、`documentsApi.ts`の`downloadDocument`だけ生の`fetch`を使い、`res.text()`でMarkdown本文を、レスポンスヘッダから`filename*=UTF-8''...`(RFC 5987)を解析してファイル名を取り出す設計にした。一覧表示・クリップボードコピーは`GET /documents`が返す`content`フィールドをそのまま使い、この専用処理を必要としない。

> **後続の改訂**: サーバー側(`app/api/routes/projects.py`)が付与するダウンロードファイル名が`{project_name}_{document_type}_{YYYYMMDD}.md`形式で、本プロジェクトリポジトリ`docs/`配下の実ファイル名(`requirements.md`等)と一致していないという指摘を受け、`{document_type}.md`形式に変更した。`downloadDocument`自体(`Content-Disposition`からファイル名を取り出すロジック)は変更不要。あわせて、Markdownプレビューの見出し間の行間が詰まる・テーブルに罫線が無いという指摘を受け、`ReactMarkdown`に`components`propを追加し、見出し・段落はTamaguiコンポーネント(明示的margin付き)、リスト・テーブルは素のHTML要素+インラインstyle(`var(--borderColor)`でテーマ追従)にマッピングした(Tamaguiの`YStack`/`Text`はネイティブの`ul`/`table`等へのtag上書きに対応していないため)。詳細は[`decision-digest.md`](../decision-digest.md)「プロジェクトステータス「修正中(revising)」の導入 + ドキュメントへの常設リンク + ドキュメントプレビュー画面の2件の修正」節参照。

> **さらに後続の改訂**: 上記のファイル名修正後も、実際にダウンロードするとファイル名がドキュメントのUUID(`{docId}.md`)になる不具合が報告された。原因は`downloadDocument`側ではなく、`Content-Disposition`ヘッダーがCORSセーフリスト対象外のレスポンスヘッダーであるにもかかわらず、devex-api側(`app/main.py`)の`CORSMiddleware`に`expose_headers`が設定されておらず、クロスオリジンの`fetch()`からJSでこのヘッダーを読めなかったこと(`res.headers.get(...)`が`null`になり、`downloadDocument`のフォールバック`\`${docId}.md\``が発火していた)。`app/main.py`に`expose_headers=["Content-Disposition"]`を追加して解決した(devex-ui側の変更は無し)。詳細は[`decision-digest.md`](../decision-digest.md)「ドキュメントダウンロードのファイル名がUUIDになる不具合の修正(CORS `expose_headers`未設定)」節参照。

### 「クリップボードにコピー」がダウンロードAPIを呼ばない理由

コピー対象のMarkdown本文は`GET /documents`のレスポンス(`GeneratedDocumentRead.content`)に既に含まれているため、`navigator.clipboard.writeText(document.content)`をその場で呼ぶだけで完結する。ダウンロード専用のAPIを追加で呼ぶ必要はない。

### `DocumentTabs`が既存`LayoutTabs`をそのまま再利用できた理由

`LayoutTabs`は`tabLabel: string[]`+`content: ComponentType[]`(props無し関数コンポーネント配列)という汎用APIを持つ。`DocumentTabs`は取得した4文書をdoc_type→ラベル(要件定義/外部設計/内部設計/実装計画)に変換し、各ドキュメントをクロージャで束縛した無引数コンポーネントを生成して渡すだけで済んだ。存在しないdoc_type(生成前や一部失敗)はタブ自体を出さない設計にしている。

### 再生成ボタンが`hearingApi.ts`の`triggerGeneration`をそのまま使う理由

「設計書生成をトリガーする」という操作自体は`POST /api/v1/projects/{id}/generate`という1エンドポイントであり、ヒアリング画面の承認ボタンとドキュメント画面の再生成ボタンとで挙動に差が無い。Phase 3-5で作った`hearingApi.ts`の`triggerGeneration`/`getProject`をそのままドキュメント機能からも呼び出しており、機能名(hearing)と実体(プロジェクト全般のAPI)がややずれている点は認識しつつ、rule #17(実在の消費者が無い先回りのリネーム・移動は見送る)によりモジュールの再配置はしていない。

## テスト観点

| ケース | 期待結果 | SUT / ドライバ / スタブ |
|---|---|---|
| `useGenerationPolling`: `active=false` | ポーリングしない | SUT: フック / ドライバ: `renderHook`+`vi.useFakeTimers` / スタブ: `fetch-stub.ts` |
| `useGenerationPolling`: `active=true` | 5秒ごとに`GET /projects/{id}`を呼び、`completed`で`onCompleted`を呼ぶ | 同上 |
| `useGenerationPolling`: タイムアウト | 3分経過で`timedOut=true`になりポーリングを止める | 同上 |
| `documentsApi.downloadDocument` | `filename*`(UTF-8)を優先、無ければ`filename`にフォールバック、失敗時`DownloadError` | SUT: `documentsApi.ts` / ドライバ: 直接呼び出し / スタブ: `Content-Disposition`付き`Response`を返す`fetch`モック |
| `documents-store`: 取得・TTL・force・再生成 | [`Phase-3-3.md`](./Phase-3-3.md)の`dashboard-store`と同型のケース | SUT: `documents-store.ts` / ドライバ: 直接呼び出し / スタブ: `fetch-stub.ts` |
| `documents-store`: `onRegenerationCompleted` | `regenerating`を下ろし一覧をforce再取得する | 同上 |
| `DocumentMarkdownView`: コピー | `navigator.clipboard.writeText`を呼びボタン文言が変わる | SUT: コンポーネント / ドライバ: `render`+`userEvent` / スタブ: `userEvent.setup()`のClipboard APIポリフィルを`vi.spyOn`で捕捉(後述の注意点参照) |
| `DocumentMarkdownView`: ダウンロード成功/失敗 | Blob URL生成+`<a download>`クリック/エラー表示 | 同上(`URL.createObjectURL`は手動でスタブ) |
| `DocumentTabs`: 表示・切り替え | 存在するdoc_typeのみタブ表示、切り替えで内容が変わる | SUT: コンポーネント / ドライバ: `render`+`userEvent` / スタブ不要 |
| `DocumentsPageContent`: 統合確認 | 取得・再生成・ポーリング配線・空状態 | SUT: コンポーネント / ドライバ: `render`+`userEvent` / スタブ: `documents-store`のアクションをフェイク関数に、`useGenerationPolling`を`vi.mock`に差し替え |
| `ProjectDocumentsPage` | `params`を解決し`DocumentsPageContent`へ渡す | SUT: `page.tsx` / ドライバ: 直接呼び出し(Server Component関数として) / スタブ: `DocumentsPageContent`を`vi.mock` |

`npx vitest run src/features/documents "src/app/projects/[id]/documents" src/hooks/__tests__/useGenerationPolling.test.ts src/features/hearing/components/__tests__/ChatPageContent.test.tsx`で27件green、`npx tsc --noEmit`で0エラー、既存テスト全体は191件中190件green(残る1件`Menu.test.tsx`は[`Phase-3-1.md`](./Phase-3-1.md)で確認済みの本Phaseと無関係な既存不具合)を確認した(このセッション内で一時的に`devex-ui`へ反映して検証し、検証後は元の状態に戻した。写経後は各自の環境で再確認すること)。

### 写経時の注意点(このセッションで踏んだハマりどころ)

- **`navigator.clipboard`はgetterのみのプロパティ**のため`Object.assign(navigator, {clipboard: ...})`では上書きできない。加えて`@testing-library/user-event`の`userEvent.setup()`がjsdom用のClipboard APIポリフィルを内部で用意するため、それより先に`navigator.clipboard`を差し替えても`setup()`で上書きされてしまう。`userEvent.setup()`実行後に`vi.spyOn(navigator.clipboard, "writeText")`で捕まえること。
- **jsdomは`ResizeObserver`を実装していない**。Tamaguiの`Tabs`が内部で使用するため、`DocumentTabs`を初めてテストからレンダリングした際に落ちた。`vitest.setup.ts`にポリフィルを追加した(既存の`scrollIntoView`ポリフィルと同じ理由・同じ場所)。

## Phase 3全体としての既知の残課題

- SCR-005が定義する「AIによる精査結果を見る」ボタン(自己診断メッセージへのスクロール、指摘件数バッジ)・SCR-006(バージョン履歴、Should要件)は未実装。MVPのMust要件([`docs/requirements.md`](../../docs/requirements.md) 1.4節)には含まれないため本Phaseのスコープ外とした。
- [`Phase-3-5.md`](./Phase-3-5.md)の残課題(SSE再接続時の履歴再取得、ポーリングタイムアウト後の手動再試行手段)は本章でも未解消のまま。
- 実際のGemini APIによる4文書生成を経由した動作確認は行っていない(`GOOGLE_API_KEY`未設定、Phase 2から継続する既知の限界)。

## 次のフェーズ

**Phase 4**: 統合テスト・QA。詳細は[`Phase-0-2.md`](../Phase-0/Phase-0-2.md)のロードマップを参照。ユーザーが「Phase 4を開始する」と発話するまでは着手しない(#5)。

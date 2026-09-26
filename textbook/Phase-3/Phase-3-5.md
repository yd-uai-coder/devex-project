# Phase-3-5: チャット+SSEストリーミング+完了承認+自己診断表示(SCR-004後段)

## この章の目的

`docs/external_design.md` 2.3節SCR-004の後段(チャット画面)を実装する。`POST /api/v1/projects/{id}/chat`のSSEストリーミング応答をリアルタイムに描画し、AI応答のたびにヒアリング完了条件を確認して十分なら構造化サマリを提示、ユーザーの明示的な承認を得てから`POST /generate`を呼ぶ。生成完了は`GET /api/v1/projects/{id}`の`status`をポーリングして検知し、ドキュメントプレビュー([`Phase-3-6.md`](./Phase-3-6.md))へ遷移する。

**学習モード(固定)**([`Phase-3-introduction.md`](./Phase-3-introduction.md)参照)。CLAUDE.md #21によりMVPコアループ(チャット↔4文書生成)そのものであるため。#14のとおりSUT/ドライバ/スタブを言語化する。

サンプルは [`textbook/samples/frontend/`](../samples/frontend/) に追加した。写経前提として[`Phase-3-1.md`](./Phase-3-1.md)〜[`Phase-3-4.md`](./Phase-3-4.md)の写経が完了していること。本章から`react-markdown`・`remark-gfm`を新規依存として追加する(`npm install react-markdown remark-gfm`)。

## この章で作成したファイル

写経順序は依存順(CLAUDE.md #30): `streamChat.ts`(SSE解釈)→`hearingApi.ts`(REST呼び出し)→`hearing-store.ts`(両方に依存)→`MessageBubble.tsx`→`HearingCompletionBanner.tsx`→`ChatPanel.tsx`(前述すべてに依存)→`ChatPageContent.tsx`(ポーリング+ページ全体の組み立て)→`app/projects/[id]/chat/page.tsx`。テストは末尾。

| ファイル(`devex-ui/`基準)                                                                                                                                                            | 写経レベル  | 責務                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------- |
| [`src/features/hearing/api/streamChat.ts`](../samples/frontend/src/features/hearing/api/streamChat.ts)                                                                         | **コア** | `fetch`+`ReadableStream`による手組みSSEパーサ。401時に1回だけリフレッシュ→リトライ                              |
| [`src/features/hearing/api/hearingApi.ts`](../samples/frontend/src/features/hearing/api/hearingApi.ts)                                                                         | 定型     | `getChatHistory`/`getHearingCompletion`/`triggerGeneration`/`getProject`(`apiFetch`経由) |
| [`src/features/hearing/hearing-store.ts`](../samples/frontend/src/features/hearing/hearing-store.ts)                                                                           | **コア** | チャット状態(履歴・ストリーミング中の返信・接続切断・完了判定・生成トリガー済みフラグ)の管理                                        |
| [`src/features/hearing/components/MessageBubble.tsx`](../samples/frontend/src/features/hearing/components/MessageBubble.tsx)                                                   | 定型     | 1メッセージの表示(AI/自己診断は`react-markdown`でレンダリング)                                             |
| [`src/features/hearing/components/HearingCompletionBanner.tsx`](../samples/frontend/src/features/hearing/components/HearingCompletionBanner.tsx)                               | **コア** | 完了サマリの提示+明示的な承認ボタン                                                                     |
| [`src/features/hearing/components/ChatPanel.tsx`](../samples/frontend/src/features/hearing/components/ChatPanel.tsx)                                                           | **コア** | メッセージ一覧+入力欄+接続切断バナー+完了バナーの統合                                                           |
| [`src/features/hearing/components/ChatPageContent.tsx`](../samples/frontend/src/features/hearing/components/ChatPageContent.tsx)                                               | **コア** | 生成トリガー後のポーリング(5秒間隔・3分タイムアウト)+完了時のドキュメント画面遷移                                            |
| [`src/app/projects/[id]/chat/page.tsx`](../samples/frontend/src/app/projects/[id]/chat/page.tsx)                                                                               | 定型     | 動的ルートの`params`(Promise)を解決し`ChatPageContent`へ渡す。`RequireAuth`でガード                      |
| ── ここからテスト(まとめて末尾) ──                                                                                                                                                          |        |                                                                                        |
| [`src/features/hearing/api/__tests__/streamChat.test.ts`](../samples/frontend/src/features/hearing/api/__tests__/streamChat.test.ts)                                           | 定型     | フレーム分割・`[DONE]`終端・401リトライ・エラーの各ケース                                                     |
| [`src/features/hearing/__tests__/hearing-store.test.ts`](../samples/frontend/src/features/hearing/__tests__/hearing-store.test.ts)                                             | 定型     | 履歴取得・送信成功・接続切断・生成トリガーの各ケース                                                             |
| [`src/features/hearing/components/__tests__/HearingCompletionBanner.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/HearingCompletionBanner.test.tsx) | 定型     | 表示条件・承認ボタンの確認                                                                          |
| [`src/features/hearing/components/__tests__/ChatPanel.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/ChatPanel.test.tsx)                             | 定型     | 一覧表示・送信・接続切断バナー・完了バナーの統合確認                                                             |
| [`src/features/hearing/components/__tests__/ChatPageContent.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/ChatPageContent.test.tsx)                 | 定型     | ポーリングの発火条件・完了時遷移の確認                                                                    |
| [`src/app/projects/[id]/chat/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/chat/__tests__/page.test.tsx)                                                 | 定型     | `params`解決+`RequireAuth`配線のスモークテスト                                                     |

## ## 主要な設計判断

### SSEを手組みでパースし、ライブラリを導入しなかった理由

バックエンドの`POST /api/v1/projects/{id}/chat`は`data: {"delta": "..."}\n\n`を`data: [DONE]\n\n`まで繰り返すだけの単純な形式で、`event:`/`id:`/`retry:`等の他のSSEフィールドは使わない。ネイティブの`EventSource`はGETしか使えずカスタムヘッダー(`Authorization`)を付与できないため使えず、`@microsoft/fetch-event-source`等の汎用ライブラリを導入する選択肢もあったが、この単純な形式には過剰と判断した(#17)。`fetch`+`ReadableStream`+`TextDecoder`で数十行の自前実装にとどめている。

### `apiFetch`の401リトライを`streamChat`で使わず、自前で1回だけ実装した理由

`apiFetch`の401リトライは同じ`init`(bodyを含む)で再度`fetch`を呼び直す設計だが、`streamChat`はレスポンスボディを`ReadableStream`として消費するストリーミング呼び出しであり、`apiFetch`のJSON専用の実装をそのまま共有できない。`streamChat`自身に同じ「401かつaccessToken有りなら1回だけリフレッシュしてリトライ」というロジックを実装した(rule #17: 実質的なコードの重複だが、ストリーミング呼び出しの消費者は現時点でこの1箇所のみであり、無理に共通化するとJSON/ストリームの両対応で抽象が複雑になるため見送り)。

### AI応答完了のたびに`getHearingCompletion`を呼ぶ設計にした理由

`docs/external_design.md` 2.3節は「AIが十分と判断した際、構造化サマリを提示する」と定めているが、判定タイミング自体はサーバー側の対話ロジックに委ねられていない(判定はいつでも呼び出せる独立したAPI)。フロントエンド側でAI応答完了ごとに判定を呼び直すことで、ユーザーが対話を進めるたびに完了状態が最新化される設計にした。判定の失敗はチャット自体をブロックしない(致命的ではないため無視する)。

> **後続の改訂**: `completion`/`generationTriggered`はどちらも`persist`未使用の非永続状態のため、バナー表示後に画面を更新/再遷移するとストアが初期化され、`loadHistory`が再取得していなかったため`HearingCompletionBanner`が消えてしまう不具合が見つかった。`loadHistory`で`getChatHistory`と`getProject`(`status`)を並行取得し、`status==="interviewing"`のときのみ`getHearingCompletion`を再問い合わせして`completion`/`generationTriggered`をマウント時に復元するよう修正した。詳細は[`decision-digest.md`](../decision-digest.md)「HearingCompletionBannerが画面更新・再遷移で消える不具合の修正」節参照。
>
> **さらに後続の改訂**: 上記の修正は`generationTriggered = status !== "interviewing"`としていたため、`completed`(過去に生成済み)のプロジェクトを開くと即座に`generationTriggered=true`となり、ポーリングが`completed`を検知して`/documents`へ強制リダイレクトされ、チャットをやり直せない不具合が新たに生じた。新ステータス`revising`(修正中)を導入し、`generationTriggered`は`status === "generating"`のときのみtrueにし、`completed`/`revising`では自動遷移させず`ChatPageContent.tsx`に常設リンクを表示する設計に改めた。`getHearingCompletion`の再問い合わせは`interviewing`/`revising`の両方で行う。ストアに`projectStatus`フィールドを追加し、常設リンクの表示判定に使う(新規フェッチは増やさない)。詳細は[`decision-digest.md`](../decision-digest.md)「プロジェクトステータス「修正中(revising)」の導入 + ドキュメントへの常設リンク + ドキュメントプレビュー画面の2件の修正」節参照。

> **後続の改訂(`ChatPanel.tsx`/`MessageBubble.tsx`)**: `ChatPanel.tsx`のメッセージフィルタは、その後`sender='attachment'`(添付ファイル抽出結果)を除外するよう拡張され、さらに今回`sender='others'`(生成後の自己診断結果)も除外するよう拡張した ── チャットに戻るたびに生の自己診断結果がバブルとして再表示されるのを防ぐため(データ保存・LLMコンテキストとしての利用自体は変更なし)。これに伴い`MessageBubble.tsx`の`isDiagnosis`(黄色背景)分岐は到達不能になったため削除した。詳細は[`decision-digest.md`](../decision-digest.md)「チャットに戻った際、自己診断結果(レビュー結果)が再表示される不具合の修正」節参照。

### SSE切断時の方針(接続切断バナー、自動再送はしない)

[`Phase-2-5.md`](../Phase-2/Phase-2-5.md)の既知の簡略化(SSE切断時、AI応答が`chat_histories`に保存されない)を踏まえ、`hearing-store.ts`の`sendMessage`は例外発生時に`connectionLost`フラグを立てて`role="alert"`のバナーを表示するに留め、自動再送はしない(冪等性キーが無く、二重送信のリスクがあるため)。ユーザー発話自体はサーバー側で先に永続化されているため、ローカル表示からは消さない。

### `GET /generate`完了検知をポーリングにした理由

`POST /generate`はプッシュ通知の無い202 Acceptedのみを返す。`Phase-3-introduction.md`の共通方針どおり、既存の`useInterval`フックで`GET /projects/{id}`の`status`を5秒間隔でポーリングし、`completed`になった時点でドキュメントプレビュー画面へ遷移する。3分経過してもポーリングし続ける状態が続いた場合はタイムアウトメッセージを表示し、ポーリング自体を止める(#17: 無限ポーリングを避ける)。

### 動的ルートの`params`をServer Componentで解決した理由

Next.js 16の`app/projects/[id]/chat/page.tsx`では`params`が`Promise<{id: string}>`になる(`devex-ui/AGENTS.md`が警告する破壊的変更点の1つ、`node_modules/next/dist/docs/`で確認済み)。`useState`/`useRouter`等のフックを使う実処理はClient Componentでしか書けないため、ページ自体は非同期のServer Componentのまま`params`をawaitし、解決済みの`id`文字列だけをClient Component(`ChatPageContent`)へpropsとして渡す設計にした。

## テスト観点

| ケース                                   | 期待結果                                                                    | SUT / ドライバ / スタブ                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `streamChat`: 正常系                     | `data:`フレームを順にyieldし`[DONE]`で終了                                         | SUT: `streamChat.ts` / ドライバ: 直接呼び出し(`for await`) / スタブ: 疑似`ReadableStream`を返す`fetch`モック                                   |
| `streamChat`: フレーム分割                  | 複数回の`read()`にまたがるフレームも正しく結合される                                          | 同上                                                                                                                        |
| `streamChat`: 401→リトライ                | `refreshTokens`成功後、1回だけ再送してストリームを継続する                                   | 同上(`refreshTokens`は`vi.mock`でフェイク)                                                                                        |
| `streamChat`: 401以外のエラー               | `StreamChatError`を送出する                                                  | 同上                                                                                                                        |
| `hearing-store`: `loadHistory`        | 履歴取得成功で`messages`/`historyStatus`を更新                                    | SUT: `hearing-store.ts` / ドライバ: 直接呼び出し / スタブ: `fetch-stub.ts`                                                             |
| `hearing-store`: `sendMessage`成功      | ユーザー発話+AI応答を確定し、完了判定も取得する                                               | 同上(`streamChat`は`vi.mock`でフェイクジェネレータに差し替え)                                                                                |
| `hearing-store`: `sendMessage`失敗      | `connectionLost`を立て、ユーザー発話は残す                                           | 同上                                                                                                                        |
| `hearing-store`: `approveAndGenerate` | `triggerGeneration`呼び出し+`generationTriggered`を立てる                       | 同上                                                                                                                        |
| `HearingCompletionBanner`: 表示条件       | `is_sufficient`に応じた表示/非表示、承認ボタンの押下                                      | SUT: コンポーネント / ドライバ: `render`+`userEvent` / スタブ不要                                                                         |
| `ChatPanel`: 統合確認                     | 一覧表示・送信・接続切断バナー・完了バナー                                                   | SUT: `ChatPanel.tsx` / ドライバ: `render`+`userEvent` / スタブ: `hearing-store`のアクションをフェイク関数に差し替え(ストア自体はPhase 3-5内の他テストで検証済みのため) |
| `ChatPageContent`: ポーリング              | 生成トリガー前は発火せず、トリガー後は5秒間隔で`GET /projects/{id}`を呼び、`completed`でドキュメント画面へ遷移 | SUT: `ChatPageContent.tsx` / ドライバ: `render`+`vi.useFakeTimers` / スタブ: `fetch-stub.ts`、`ChatPanel`は`vi.mock`で無効化           |
| `ProjectChatPage`                     | `params`を解決し`ChatPageContent`へ渡す                                        | SUT: `page.tsx` / ドライバ: 直接呼び出し(Server Component関数として) / スタブ: `ChatPageContent`を`vi.mock`                                  |

`npx vitest run src/features/hearing "src/app/projects/[id]"`で32件green、`npx tsc --noEmit`で0エラー、既存テスト全体は166件中165件green(残る1件`Menu.test.tsx`は[`Phase-3-1.md`](./Phase-3-1.md)で確認済みの本Phaseと無関係な既存不具合)を確認した(このセッション内で一時的に`devex-ui`へ反映して検証し、検証後は元の状態に戻した。写経後は各自の環境で再確認すること)。`react-markdown`・`remark-gfm`はReact 19.2.4/Next.js 16.2.12との互換性を`npm view`のpeer dependencies確認済み(`react-markdown@10.1.0`は`react >=18`のみを要求)。

## Phase 3-5全体としての既知の残課題

- SSE切断時の再接続時、`GET .../chat`で履歴を再取得して整合させる処理は未実装(現状は`connectionLost`バナーを表示するのみ)。次回のページ読み込み(`loadHistory`)で結果的に整合するが、同一セッション内での自動再取得は行っていない(#17: 現時点でこれを要求する実消費者が無い)。
- ポーリングのタイムアウト(3分)後、ユーザーが手動で再試行する手段(再ポーリングボタン等)は用意していない。ダッシュボードへ戻って再度プロジェクトを開く導線([`Phase-3-3.md`](./Phase-3-3.md)の`projectHref`)で代替する設計。
- 実際のGemini APIによる動作確認は本章では行っていない(`GOOGLE_API_KEY`未設定、Phase 2-3からの既知の限界を継承)。フロントエンドのテストは`streamChat`のフレーム形式を固定した疑似ストリームで検証している。

# Phase-35-3: カードの UI(FE)

## この章の目的

チャット画面で、AI の発言の下に選択肢カードを出す。利用者は選択肢を選び(選び直せる)、必要なら文を足して「送信」する。選んだ内容は文と一緒に1つの発言として送られ、サーバーがその観点を「AI の提案を採用」と記録する([35-2](./Phase-35-2.md))。古い発言のカードは、選んだ結果を読むだけにする。

自動実装モード: on([introduction](./Phase-35-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/features/hearing/api/hearingApi.ts`](../samples/frontend/src/features/hearing/api/hearingApi.ts) | 更新 | カードの型(`HearingCard`・`CardAnswer`)と `ChatHistoryEntry.cards` |
| [`src/features/hearing/api/streamChat.ts`](../samples/frontend/src/features/hearing/api/streamChat.ts) | 更新 | イベントの和(`delta`/`cards`)を返す。本文に `card_answers` |
| [`src/features/hearing/cards.ts`](../samples/frontend/src/features/hearing/cards.ts) | 新規 | 選べるカード・送る回答・楽観表示の本文・選択の書き込み(純粋関数) |
| [`src/features/hearing/hearing-store.ts`](../samples/frontend/src/features/hearing/hearing-store.ts) | 更新 | `cardDrafts`・`selectCardOption`、回答つきの `sendMessage` |
| [`src/features/hearing/components/MessageBubble.tsx`](../samples/frontend/src/features/hearing/components/MessageBubble.tsx) | 更新 | 利用者の発言の改行をそのまま見せる |
| [`src/features/hearing/components/ChoiceCards.tsx`](../samples/frontend/src/features/hearing/components/ChoiceCards.tsx) | 新規 | カード(問い・選択肢と結果・おすすめと理由・選択中・回答済み) |
| [`src/features/hearing/components/ChoiceCards.module.css`](../samples/frontend/src/features/hearing/components/ChoiceCards.module.css) | 新規(完了後の調整) | 選択肢のラジオボタンの見た目(選択中の青は `:has(input:checked)`) |
| [`src/features/hearing/components/ChatPanel.tsx`](../samples/frontend/src/features/hearing/components/ChatPanel.tsx) | 更新 | 発言の下にカード、最新だけ選べる、選んでいれば文が空でも送れる |
| [`src/features/hearing/components/HearingCompletionBanner.tsx`](../samples/frontend/src/features/hearing/components/HearingCompletionBanner.tsx) | 更新(完了後の調整) | 必須項目の回答完了・任意の確認事項・「任意項目についてヒアリングを続ける」 |
| [`src/features/hearing/components/HearingPointsPanel.tsx`](../samples/frontend/src/features/hearing/components/HearingPointsPanel.tsx) | 更新(完了後の調整) | 未決(必須)/(任意)の書き分け、見出しの名前、「対象外にする」 |
| [`src/features/hearing/components/ChatPageContent.tsx`](../samples/frontend/src/features/hearing/components/ChatPageContent.tsx) | 更新(完了後の調整) | 表の追従、`skipPoint` の呼び出しと失敗の表示 |
| ── ここからテスト ── | | |
| [`src/features/hearing/api/__tests__/streamChat.test.ts`](../samples/frontend/src/features/hearing/api/__tests__/streamChat.test.ts) | 更新 | `event: cards`、送信の本文、`parseEvent` |
| [`src/features/hearing/__tests__/cards.test.ts`](../samples/frontend/src/features/hearing/__tests__/cards.test.ts) | 新規 | `cards.ts` の純粋関数 |
| [`src/features/hearing/__tests__/hearing-store.test.ts`](../samples/frontend/src/features/hearing/__tests__/hearing-store.test.ts) | 更新 | カードの確定・選択・送る回答と表示・失敗で戻す |
| [`src/features/hearing/components/__tests__/ChoiceCards.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/ChoiceCards.test.tsx) | 新規 | 表示・選択・回答済み・読むだけ |
| [`src/features/hearing/components/__tests__/ChatPanel.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/ChatPanel.test.tsx) | 更新 | 最新だけ選べる、選択で送信できる |
| [`src/features/hearing/components/__tests__/MessageBubble.memo.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/MessageBubble.memo.test.tsx) | 新規(完了後の調整) | 選択の変更で発言の Markdown を解析し直さない |
| [`src/features/hearing/components/__tests__/HearingCompletionBanner.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/HearingCompletionBanner.test.tsx) | 更新(完了後の調整) | 文言・任意の一覧・続けるボタン |
| [`src/features/hearing/components/__tests__/HearingPointsPanel.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/HearingPointsPanel.test.tsx) | 更新(完了後の調整) | 書き分け・見出し・対象外のボタン |
| [`src/features/hearing/components/__tests__/ChatPageContent.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/ChatPageContent.test.tsx) | 更新(完了後の調整) | `skipPoint` の呼び出しと失敗の表示 |

FE のパスは `devex-ui/` 基準。

## 要点の抜粋

```ts
// src/features/hearing/api/streamChat.ts
export type ChatStreamEvent =
  | { kind: "delta"; delta: string }
  | { kind: "cards"; cards: HearingCard[] };

export async function* streamChat(
  projectId: string,
  message: string,
  options?: { signal?: AbortSignal; cardAnswers?: CardAnswer[] },
): AsyncGenerator<ChatStreamEvent, void, void> { ... }
```

```ts
// src/features/hearing/hearing-store.ts(sendMessage の前半)
const latest = latestAiMessage(previousMessages);
const cards = latest?.cards ?? [];
const answers = pendingAnswers(cards, previousDrafts);  // 未回答で選択中のものを、カードの順に
const optimisticUserMessage = { ..., message: composeAnswerText(cards, answers, text) };
// 最新の AI の発言のカードに選択を書き、選択中を空にしてから送る。
// バックエンドが失敗を伝えたら、messages と cardDrafts を送信の前に戻す
for await (const event of streamChat(projectId, text, { cardAnswers: answers })) { ... }
```

依存の向き: `cards.ts` → `hearingApi.ts` の型だけ。`hearing-store.ts` → `cards.ts`・`streamChat.ts`。`ChatPanel.tsx` → `ChoiceCards.tsx`・`cards.ts`・ストア。`ChoiceCards.tsx` は型だけを読み、ストアを読まない(選択は props で受ける)。

## 設計判断

### 選択は送信まで手元に置く

カードを選んでもすぐには送らない(着手時の決定)。選び直しや文の追記ができ、押し間違えても直せる。選択はストアの `cardDrafts`(カードの id → 選択肢の番号)に置き、同じ選択肢をもう一度押すと外れる。「送信」で、未回答で選択中のカードだけを回答にする(`pendingAnswers`)。途中まで選んで送ってもよい。カードを選んでいれば、文が空でも送れる(ボタンに「カード N 件の選択を含む」と出す)。

### 選べるのは最新の AI の発言のカードだけ

サーバーが受け付けるのは最新の AI の発言のカードだけなので([35-2](./Phase-35-2.md))、画面も同じ規則にする(`latestAiMessage`)。古い発言のカードと回答済みのカードは、選んだ結果を示すだけで押せない。

### 楽観表示はサーバーの本文と同じ形

送信した発言は、サーバーが保存する本文と同じ形(「【可用性】半日止まってよい」+ 空行 + 文)で、すぐに表示する(`composeAnswerText`。サーバーの `compose_answer_message` と同じ規則)。最新の AI の発言のカードにも選択を書いて「回答済み」に見せる。バックエンドが `event: error` で失敗を伝えたら(古いカードなど)、メッセージの一覧と選択中を送信の前に戻す。今までは楽観表示の発言だけを消していたが、カードの選択も戻す必要があるので、送信の前の一覧ごと戻す形にした。接続の切断では今までどおり何も戻さない(保存されたかどうか分からないため)。

### カードの見た目

カードは AI の吹き出しの下に、吹き出しと同じ幅の上限(80%)で並べる。各選択肢はボタンで、名前・結果(コスト・手間)を出し、おすすめの選択肢には「おすすめ」の印と理由の1文を出す。選択中・回答済みの選択肢は枠を太く、色を変える。選べるカードの下には「選んだ内容は「送信」で送ります。選ばずに、チャットに自分の言葉で答えてもかまいません」と出す(自分の言葉で答えると「ユーザーが決定」になる)。利用者の発言は改行を保って表示する(カードの選択が複数行になるため)。

### SSE の受け方

`streamChat` は、今までの文字列でなくイベントの和を返す。本文は今は1回の `delta` で届くが、形は断片の連続のまま受ける(ストリーミングに戻しても画面は変わらない)。`event: cards` が壊れていれば無視する(カードが出ないだけで、チャットは続けられる)。

### Phase 完了後の調整

- **カードごとの送信**: `ChoiceCards` に `onSend`(「この回答を送る」。そのカードで選択中のときだけ押せる)。`ChatPanel` が入力欄の文と一緒に `sendMessage(projectId, text, { cardIds: [cardId] })` を呼ぶ。ストアは `cardIds` で送る回答を絞る。1枚送ると次の返信が最新になり、同じ発言の残りのカードは読むだけになるので、選択中はすべて捨てる。
- **観点の表**: `HearingPointsPanel` が、未決を「未決(必須)」(赤)と「未決(任意)」(灰色)に書き分け、見出しに未決の必須の名前を並べる(`openRequiredLabels`)。`onSkip` があれば未決の必須の行に「対象外にする」を出す(以前の判定のプロジェクトでは出さない)。`ChatPageContent` がストアの `skipPoint` を呼び、失敗の理由を表の下に出す。生成中は出さない。
- **追従**: 広い画面で、表の枠を `position: sticky`(`top` はヘッダーの高さ + 16。前例は `StageStepper`)にし、高さを画面に収めて表の中でスクロールさせる。

- **(2回目)生成のバナー**: `HearingCompletionBanner` の見出しを「必須項目の回答完了」、本文を「チャットの内容から設計書を生成できます。」にし、`optionalPoints`(観点の表の未決の任意)を「任意の確認事項」に並べる。未決の任意があれば [任意項目についてヒアリングを続ける] を出し、`ChatPanel` が `sendMessage(projectId, "任意の項目についてもヒアリングを続けてください", { continueOptional: true })` を送る(`streamChat` が本文に `continue_optional`)。

- **(3回目)選択の反応**: `MessageBubble` を `memo` にした。`ChatPanel` は `cardDrafts` を購読せず、最新の AI の発言のカードを描く `LatestChoiceCards` だけが選択中の状態を読む。送信ボタンの件数は件数だけを購読する。
- **(3回目)任意を続ける**: 文を送らず `sendMessage(projectId, "", { continueOptional: true })`。楽観表示はサーバーと同じ決まった文(`CONTINUE_OPTIONAL_MESSAGE`)。

- **(4回目)選択肢はラジオボタン**: 選択肢を `<label>` の中の `<input type="radio" name={カードのid}>` にし、カードごとに `role="radiogroup"`(名前は問い)。選択中の色は `ChoiceCards.module.css` の `:has(input:checked)` で付ける(Tamagui の `Button` のホバーの色が選択中の青を隠していたため)。ストアの `selectCardOption` は外さない(選び直すと置き換える)。

テスト: `ChoiceCards.test.tsx`(送るボタン)、`ChatPanel.test.tsx`(カードだけを文と一緒に送る)、`hearing-store.test.ts`(絞った回答・`skipPoint`)、`HearingPointsPanel.test.tsx`(書き分け・見出し・対象外のボタン)、`ChatPageContent.test.tsx`(`skipPoint` の呼び出しと失敗の表示、生成中は出さない)。2回目: `HearingCompletionBanner.test.tsx`(文言・任意の一覧・続けるボタン・送信中)、`ChatPanel.test.tsx`(続けるで `continueOptional` 付きの送信)、`hearing-store.test.ts`・`streamChat.test.ts`(`continue_optional` の受け渡し)。4回目: `ChoiceCards.test.tsx`(ラジオボタンの役割と名前・checked・disabled)、`ChatPanel.test.tsx`(ラジオボタンで選ぶ)、`hearing-store.test.ts`(外さない)。3回目: `MessageBubble.memo.test.tsx`(親が描き直されても Markdown を解析し直さない)、`ChatPanel.test.tsx`・`hearing-store.test.ts`(続けるは文を送らず、決まった文を楽観表示)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `streamChat`・`parseEvent` | vitest(`streamChat.test.ts`) | `fetch` を `vi.stubGlobal` で差し替える ── ネットワークは外部依存 | 本文の後のカードのイベント、送信の本文の `card_answers`(無ければ空の配列)、壊れた `cards` は無視 |
| `cards.ts` | vitest(`cards.test.ts`) | スタブ不要 ── 純粋関数 | 最新の AI の発言、未回答で選択中だけをカードの順に、サーバーと同じ本文、選択の書き込み |
| `useHearingStore`(`sendMessage`・`selectCardOption`) | vitest(`hearing-store.test.ts`) | `streamChat` を `vi.mock` で差し替え、`fetch` は `stubFetch` | 第一テスト(統合スモーク): 返信のカードを確定した発言に持たせる。選択の置き方と外し方、送る回答(古い発言・回答済みを除く)と楽観表示の本文と `selected`、失敗で一覧と選択中を戻す |
| `ChoiceCards` | vitest + Testing Library(`ChoiceCards.test.tsx`) | スタブ不要 ── `onSelect` はモック関数で受ける | 問い・結果・おすすめと理由、押すと `onSelect`、選択中の `aria-pressed`、回答済みと読むだけは押せない |
| `ChatPanel` | vitest + Testing Library(`ChatPanel.test.tsx`) | ストアの操作を `vi.fn()` に差し替える | 古いカードは押せない、最新のカードを押すと `selectCardOption`、選んでいれば文が空でも「送信(カード 1 件の選択を含む)」で送れる |

```sh
cd devex-ui && npx vitest run src/features/hearing
```

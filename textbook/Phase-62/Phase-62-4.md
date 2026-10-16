# Phase-62-4: チャットを専用の領域で最下部から出す

## この章の目的

作成済みのプロジェクトのチャット(SCR-004)を開くと、ページの先頭(最初の発言)から表示され、送信ボタンまでページ全体をスクロールする必要があった。この章では、会話を高さに上限のある**専用のスクロールの領域**に入れ、入力欄と送信ボタンを領域の下に常に見せる。履歴を読み込んだら、領域を最下部へ移して出す。着手時の相談で、推奨(ページ全体を送信欄までスクロールする)と違い、ユーザーがこの形を選んだ。

自動実装モード: on([introduction](./Phase-62-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/hearing/components/ChatPanel.tsx`](../samples/frontend/src/features/hearing/components/ChatPanel.tsx) | 更新 | 会話の領域(`role="log"`)・読み込み後の最下部・追従・完了のバナーを領域の末尾へ |
| [`src/features/hearing/components/__tests__/ChatPanel.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/ChatPanel.test.tsx) | 更新 | スクロールの4件 |

## 1. 会話の領域

責務(`ChatPanel`): ヒアリングの会話・カード・完了のバナー・入力欄。

```tsx
// src/features/hearing/components/ChatPanel.tsx
const HISTORY_STYLE: CSSProperties = {
  maxHeight: "max(240px, calc(100vh - 380px))",
  overflowY: "auto",
};
const INPUT_STYLE: CSSProperties = { scrollMarginBottom: FOOTER_HEIGHT + 16 };

<div ref={historyRef} role="log" aria-label="チャットの履歴" style={HISTORY_STYLE} onScroll={handleHistoryScroll}>
  <YStack gap="$3">
    {/* 発言・カード・ストリーミング中の返信 */}
    {/* 完了のバナー・承認のエラー(会話の末尾) */}
  </YStack>
</div>
<div ref={inputRef} style={INPUT_STYLE}>{/* 入力欄・送信ボタン */}</div>
```

- 高さの上限は、ヘッダー・見出し・入力欄の分を画面の高さから引いた値(最低 240px)。中身が短ければ領域も縮む(`height` でなく `maxHeight`)。
- 領域は素の `div` にした。`ref` で `scrollTop`・`scrollHeight` を読み書きし、`onScroll` を受けるため。Tamagui の `YStack` の `ref` は `TamaguiElement` 型で、`HTMLDivElement` として扱えない。`role="log"` は「新しい行が末尾に足される領域」を表す ARIA のロールで、テストもこれで取る。
- **完了のバナーを領域の中(会話の末尾)へ移した**: ブラウザで確かめると、任意の観点を並べるバナーは長く、領域の外に置くと送信ボタンを画面の外へ押し出した。バナーは「AI からの最後の知らせ」として会話の流れに置くのが自然なので、領域の末尾に入れた。
- `INPUT_STYLE` の `scroll-margin-bottom` は、入力欄を画面に入れるとき(`scrollIntoView`)に固定のフッターの下に隠れないための余白。狭い画面の確認で、送信ボタンがフッターの下にちょうど隠れたため足した。

## 2. 読み込み後に最下部へ

```tsx
// src/features/hearing/components/ChatPanel.tsx
useEffect(() => {
  if (historyStatus === "loading") {
    settling.current = true;
    return;
  }
  if (historyStatus !== "success" || !settling.current) return;
  atBottom.current = true;
  scrollToBottom();
  inputRef.current?.scrollIntoView({ block: "nearest" });
  if (points !== null) settling.current = false;
}, [historyStatus, completion, points]);
```

- **読み込みの開始(`loading`)を見てから待つ**: ストアの `historyStatus` は、前に開いたプロジェクトの `success` のまま残っていることがある。`loadHistory` は呼ばれるとすぐ `loading` にするので、`loading` を見た後の `success` だけを「この読み込みの完了」とみなす。
- **後から届くものにも合わせ直す**: `loadHistory` は、会話を `success` で置いた後に、完了の判定(バナー)と観点の表を順に取る。広い画面では観点の表がチャットの右に入り、会話の幅が狭まって高さが伸びる。ブラウザで確かめると、最初に移した最下部から最後の発言がはみ出した。そこで `completion`・`points` が変わったときにも合わせ直し、観点の表が届いたところで終える(`settling`)。それ以降に観点の表が変わっても(「対象外にする」など)、引き戻さない。
- `scrollIntoView({ block: "nearest" })` は、ページの側を必要な分だけ動かし、入力欄を画面に入れる(狭い画面では、観点の表が会話の上に畳まれて置かれるため)。

## 3. 新しい発言への追従

```tsx
// src/features/hearing/components/ChatPanel.tsx
useEffect(() => {
  if (atBottom.current) scrollToBottom();
}, [messages, streamingReply]);

useEffect(() => {
  const content = historyRef.current?.firstElementChild;
  if (!content) return;
  const observer = new ResizeObserver(() => { if (atBottom.current) scrollToBottom(); });
  observer.observe(content);
  return () => observer.disconnect();
}, []);

function handleHistoryScroll() {
  const el = historyRef.current;
  if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_THRESHOLD;
}
```

- 専用の領域にしたので、追従しないと、送信した後の返信(ストリーミング)が領域の下に隠れる。そこで、利用者が最下部の近く(80px 以内)にいるときだけ追従する。遡って読んでいるときに引き戻さないため。
- 発言の Markdown の描画や幅の変化で、発言の数が同じでも高さが変わる。`ResizeObserver` で中身の高さを見て、最下部にいれば合わせ直す。

## Phase 62 完了後の調整: 領域の高さを配置から決める

Phase の直後のユーザーの画面確認で、高さの上限と観点の表との並びは OK だった。ただ、生成済みのプロジェクト(completed・revising)で「生成済みのドキュメントを見る →」のリンクがヘッダーに隠れた。

- **原因**: 固定の見積もり `calc(100vh - 380px)` は、見出しの下に増える行(生成済みのドキュメントへのリンク・狭い画面で会話の上に畳まれる観点の表)を数えていない。その分だけ入力欄が画面の下にはみ出す。読み込み後の `scrollIntoView` がページをその分だけ動かすので、見出しとリンクがヘッダーの下に入った。調べると、狭い画面(390×800)ではリンクの上端が 11px(ヘッダーは 64px まで)だった。広い画面でも、完了のバナーのある修正中のプロジェクトでは見出しが半分隠れていた。
- **直し方**: 読み込んだときの配置を測り、入力欄がページを動かさずに収まる高さを領域に当てる(下限 240px)。固定の見積もりは、測るまでの仮の値として残した。

```tsx
// src/features/hearing/components/ChatPanel.tsx
export function fittedHistoryHeight(viewportHeight: number, historyTop: number, inputHeight: number): number {
  const fitted = viewportHeight - historyTop - STACK_GAP - inputHeight - (FOOTER_HEIGHT + 16);
  return Math.max(MIN_HISTORY_HEIGHT, Math.floor(fitted));
}

function fitHistoryHeight() {
  const top = history.getBoundingClientRect().top + window.scrollY;   // 文書上の位置
  const height = fittedHistoryHeight(window.innerHeight, top, input.offsetHeight);
  history.style.maxHeight = `${height}px`;   // 続けて最下部へ移すので、DOM にもすぐ当てる
  setHistoryMaxHeight(height);
}
```

- 測るのは、読み込み後の合わせ直し(settling)の中と、画面の大きさが変わったとき。狭い画面で観点の表を開閉したときは測り直さない。開いた表の分だけ会話が縮みすぎるのを避け、そのときはページのスクロールに任せる。
- 下限の 240px に当たる低い画面(1366×650)では、入力欄を入れるためにページが少し動く。それでもリンクはヘッダーの下に入らない(上端 133px)。
- state(`historyMaxHeight`)に加えて DOM の `style` にもすぐ当てる。state だけだと、描き直しの前に最下部へ移すため、古い高さでスクロールの位置を決めてしまう。
- 確認(Playwright。completed と revising。API の応答を差し替え): リンクの上端と送信ボタンの下端は次のとおり。どの画面でも会話の領域は最下部だった。

  | 画面 | リンクの上端 | 送信ボタンの下端 |
  |---|---|---|
  | 1400×900 | 155px | 828px(フッター 844px) |
  | 1366×650 | 133px | 578px(フッター 594px) |
  | 390×800 | 155px | 728px(フッター 744px) |

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `ChatPanel.test.tsx` の「会話の領域のスクロール」(新規4件) | `ChatPanel` | Testing Library(`act` でストアを変える) | ストアのアクション(`loadHistory` など。既存の形で `vi.fn()` に差し替える)と、領域の寸法(jsdom はレイアウトを計算せず `scrollHeight` などが 0 のため、`Object.defineProperty` で `scrollHeight`・`clientHeight`・`scrollTop` を与える) |

- 完了後の調整で2つ足した: `fittedHistoryHeight` の純粋なテスト(スタブ不要。通常のときと下限)と、読み込み後に領域の `style.maxHeight` が計算した値になること(画面の高さ・領域の上端・入力欄の高さを差し替える)。
- 確かめること: 読み込みが終わったら最下部へ / 前のプロジェクトの `success` のままでは動かない / 最下部にいればストリーミングに追従し、遡ったら(scroll のイベント)引き戻さない / 完了のバナーが領域の中に出て、バナーと観点の表が届いたら合わせ直し、観点の表で終える。
- `ResizeObserver` は vitest の setup で何もしない偽物になっているので、高さの変化への追従はブラウザで確かめた([introduction](./Phase-62-introduction.md)「検証結果」)。
- 更新したファイルは、この章のテストが import する。import に前方 import は無い(`FOOTER_HEIGHT` は既存の `layout-constants.ts`)。

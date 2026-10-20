# Phase-88-4: 説明書のタブ(要約の確認とプレビュー)

## この章の目的

変更の説明書([Phase 84](../Phase-84/Phase-84-introduction.md))を画面で見て、任意の要約を確かめられるようにする。今までの CR の詳細には、説明書のダウンロードのボタンしかなかった。CR の詳細に5つ目のタブ「説明書」を足し、上に要約(LLM の元の文と直す欄を並べ、照合で合わない所に印)、下に出力のプレビューとダウンロードを置く。

自動実装モード: on([introduction](./Phase-88-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`frontend/src/features/change-requests/components/ExplanationDownloadButton.tsx`](../samples/frontend/src/features/change-requests/components/ExplanationDownloadButton.tsx) | 新規 | 説明書のダウンロードのボタン(見出しから出した) |
| [`frontend/src/features/change-requests/components/SummaryReview.tsx`](../samples/frontend/src/features/change-requests/components/SummaryReview.tsx) | 新規 | 要約の確認(札・合わない所の一覧・元の文と直す欄・保存と確認) |
| [`frontend/src/features/change-requests/components/ExplanationTab.tsx`](../samples/frontend/src/features/change-requests/components/ExplanationTab.tsx) | 新規 | 説明書のタブ(要約を作る・要約の確認・出力のプレビュー) |
| [`frontend/src/features/change-requests/components/ChangeRequestActions.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestActions.tsx) | 更新 | ダウンロードを `ExplanationDownloadButton` に |
| [`frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx) | 更新 | タブ「説明書」 |
| [`frontend/src/features/change-requests/components/__tests__/ExplanationTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ExplanationTab.test.tsx) | 新規 | タブ・要約の確認・プレビュー・ダウンロード |
| [`frontend/src/features/change-requests/components/__tests__/ChangeRequestDetailContent.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestDetailContent.test.tsx) | 更新 | タブの並び |
| [`frontend/src/features/change-requests/components/__tests__/ChangeRequestActions.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestActions.test.tsx) | 更新 | SUT の見出し(ダウンロードのボタンの部品) |

## 1. 画面の形(着手時の相談で決めた)

```
[内容][影響][検証][■説明書][たどる記録]
要約(クライアント向け・任意)  [要約を作り直す]
  未確認の間は、出力に要約は載りません(このプレビューだけ)。
  [未確認] gemini-3.5-flash-lite ・… に作成
  ⚠ 5節に無い: FR-099 / 7
  ┌ LLM の元の文 ──────┐ ┌ 直す欄 ────────────┐
  │ …[FR-099]…[7]件…   │ │ (textarea)          │
  └────────────────────┘ └────────────────────┘
  [保存] [確認した]
出力のプレビュー                         [説明書をダウンロード(.md)]
  ファイル名・作業単位 N 件・結合テスト N 件・総合テスト N 件
  (md)
```

- ユーザーは3案(タブで左右に並べる / タブで切り替え / 見出しのダイアログ)を画面のイメージで比べて、左右に並べる形を選んだ。並べると、どこを直したかを目で追いやすい。狭い画面では2つの列を上下に積む(列は `flexBasis: 320` で折り返す)。
- タブはほかと同じく、開いたときに説明書を読む(`fetchView(..., "explanation")`)。

## 2. 要約の確認(`SummaryReview`)

- **札**: 未確認(黄)・確認済み(緑)・古い(赤)。作ったモデルと日時、直した・確かめた日時も出す。
- **照合で合わない所**: 上に一覧(「⚠ 5節に無い: …」)、文の中に印(`<mark>`。`markSegments`、88-2)。照合はサーバーが今の文(直した文)に対して求めるので、元の文にも同じ ID・数字に印を付け、直した後は「保存した文(照合の対象)」も印付きで出す。合う文なら「すべて5節にあります」。
- **直す欄**: 初期値は今の文。保存すると未確認に戻る(Phase 84)。文が変わったら(作り直し・保存)、親が `key` で部品を作り直し、直す欄を新しい文にする(古い入力が残らないように)。上限(4000字)を超えたら保存できない。
- **確認した**: 照合で合わない所があっても押せる(人が判断する。Phase 84 の決定)。ただし、直す欄に保存していない直しがある間は押せない(確かめた文と保存した文が食い違わないように)。確認済みの間も押せない。
- 要約を直した人は記録していない(確かめた人だけ)。画面確認で要ると分かったら決める(申し送り)。

## 3. タブの残り(`ExplanationTab`)

- **要約を作る・作り直す**: どの状態でも押せる。生成の用途のモデルで LLM を呼ぶ(サーバー)。作っている間はボタンを「要約を作成中...」にし、要約の操作をすべて止める。失敗は赤い文で出す。
- **出力に載るかの文**(`summaryOutputNote`): 要約が無い・未確認・確認済み・古い、で文を変える。古いは「CR の内容か影響が変わりました。確かめ直すまで、出力に要約は載りません」。
- **出力のプレビュー**: サーバーの `output`(確認済みで古くない要約を頭に載せた md)を `MarkdownBody` で描く。ダウンロードの中身と同じものが見える。数(作業単位・結合・総合)と、テスト仕様書が束に無いときはその旨も出す。

## 4. ダウンロードのボタンを部品にする(#17)

- 見出しのダウンロードのボタンと失敗の文を、`ExplanationDownloadButton` に出した。駆動する消費者は、見出しと説明書のタブの2つ。見出しのボタンは残す(どのタブを開いていても、すぐ出力できるように)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `ExplanationTab.test.tsx`(新規) | `ExplanationTab`・`SummaryReview`・`ExplanationDownloadButton`・`MarkdownBody` | Testing Library(描画・入力・クリック) | ストアの取得・要約の操作(`vi.fn`)、説明書の API と `saveFile`(`vi.mock`)── タブの配線だけを見るため(操作の後に説明書を置き換えるのはストアのテスト) |
| `ChangeRequestDetailContent.test.tsx`(更新) | タブの並びと切り替え | Testing Library | 各タブの部品(`vi.mock`) |
| `ChangeRequestActions.test.tsx`(更新) | 見出しのダウンロード(`ExplanationDownloadButton` を通る) | Testing Library | 既存のとおり(説明書の API と `saveFile` を `vi.mock`) |

- 開くと説明書を読む・読み込み中。
- 要約が無い: 「要約を作る」だけ・出力は5節だけの文・プレビュー・数・ダウンロード。
- 要約がある: 札・合わない所の一覧・元の文の中の印・直す欄の初期値・未確認の文・「作り直す」。
- 保存: 直していなければ押せない・直した後は確認を押せず理由を出す・保存は直した文を渡す。
- 確認: 確認の操作を呼ぶ・確認済みは札と「載ります」の文で、もう押せない・古いは札と文。
- 失敗: 要約の失敗・説明書の読み込みの失敗。
- タブ: 内容・影響・検証・説明書・たどる記録の順。

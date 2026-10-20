# Phase-87-3: 詳細(内容・操作・影響・たどる記録)

## この章の目的

CR の詳細のページ(`/projects/{id}/change-requests/{番号}`)を作る。見出しに状態と操作のボタン(説明済み・合意/却下の記録・取り下げ・写し・説明書のダウンロード)を置く。本文はタブに分ける。

- 内容: 対象・合意の記録・重なり・写しの元と先。下書き・説明済みの間は直せる。
- 影響: 予測と、反映の後の比較。合意・反映済みの CR は、ここから文書へ反映する。
- たどる記録

検証のタブは 87-4 で足す。

自動実装モード: on([introduction](./Phase-87-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`frontend/src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | `STATUS_LABEL`・`statusLabel`(たどる記録の前後の状態の名前) |
| [`frontend/src/features/change-requests/components/DecisionDialog.tsx`](../samples/frontend/src/features/change-requests/components/DecisionDialog.tsx) | 新規 | 合意・却下の記録のダイアログ |
| [`frontend/src/features/change-requests/components/ChangeRequestActions.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestActions.tsx) | 新規 | 見出しの操作のボタンと説明書のダウンロード |
| [`frontend/src/features/change-requests/components/ContentTab.tsx`](../samples/frontend/src/features/change-requests/components/ContentTab.tsx) | 新規 | 内容のタブ(直すフォームは 87-2 の `ChangeRequestForm`) |
| [`frontend/src/features/change-requests/components/ImpactTab.tsx`](../samples/frontend/src/features/change-requests/components/ImpactTab.tsx) | 新規 | 影響のタブ(予測・比較・文書への反映) |
| [`frontend/src/features/change-requests/components/TraceTab.tsx`](../samples/frontend/src/features/change-requests/components/TraceTab.tsx) | 新規 | たどる記録のタブ |
| [`frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx) | 新規 | 詳細のページの本体(見出し・タブ・反映の完了待ち。87-4 で検証のタブ) |
| [`frontend/src/app/projects/[id]/change-requests/[number]/page.tsx`](../samples/frontend/src/app/projects/[id]/change-requests/[number]/page.tsx) | 新規 | ルート(番号を数にして渡す) |
| [`frontend/src/features/change-requests/test-utils/renderWithStore.tsx`](../samples/frontend/src/features/change-requests/test-utils/renderWithStore.tsx) | 新規 | 部品のテストの共通の準備(ストアを空にし、API を呼ぶ関数を `vi.fn` に) |
| [`frontend/src/features/change-requests/components/__tests__/ChangeRequestActions.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestActions.test.tsx) | 新規 | ボタンの出し分けとダイアログ |
| [`frontend/src/features/change-requests/components/__tests__/ContentTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ContentTab.test.tsx) | 新規 | 内容と直す |
| [`frontend/src/features/change-requests/components/__tests__/ImpactTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ImpactTab.test.tsx) | 新規 | 予測・比較・反映のボタン |
| [`frontend/src/features/change-requests/components/__tests__/TraceTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/TraceTab.test.tsx) | 新規 | たどる記録 |
| [`frontend/src/features/change-requests/components/__tests__/ChangeRequestDetailContent.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestDetailContent.test.tsx) | 新規 | 見出し・タブ・完了待ち(87-4 で検証のタブ) |
| [`frontend/src/app/projects/[id]/change-requests/[number]/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/change-requests/[number]/__tests__/page.test.tsx) | 新規 | ルート |

依存の向き: `ChangeRequestDetailContent` → `ChangeRequestActions`(→ `DecisionDialog`・API の `downloadExplanation`)・`ContentTab`(→ `ChangeRequestForm`。87-2)・`ImpactTab`・`TraceTab`・`StatusBadge`(87-2)・`useGenerationPolling`(既存)。各タブはストア(87-1)を読む。

## 1. 見出しと操作(`ChangeRequestActions`・`DecisionDialog`)

- ボタンは `headerActions(cr.allowed_actions)` から作る(87-1)。今できない操作は出さない(サーバーの遷移の表が正。[82-1](../Phase-82/Phase-82-1.md))。
- **説明済み**: 確かめてから記録する(説明の後に直すと下書きに戻ることを示す)。説明書の出力は条件にしない([Phase 84](../Phase-84/Phase-84-introduction.md) の決定)。
- **合意・却下**: `DecisionDialog` で、相手(空でもよい)・日時(既定は今、手元の時刻)・メモ・理由(必須)を入れる。合意では、その時点の予測が CR に保存されることを示す([83-3](../Phase-83/Phase-83-3.md))。理由が空なら記録しない。
- **取り下げ**: 理由(任意)を入れて確かめる。
- **写し**: 却下した CR だけ。写したら写しの先の詳細へ移る(元は却下のまま。[Phase 82](../Phase-82/Phase-82-introduction.md) の決定)。
- **説明書のダウンロード**: どの状態でもできる。プレビューと要約の確認は Phase 88。
- ダイアログの確かめのボタンの名前は、見出しのボタンやダイアログの題と違う名前にした(「記録する」「取り下げを確定する」)。同じ名前だと、画面の読み上げとテストで見分けられないため。

## 2. タブ(`ChangeRequestDetailContent`)

- **既存の `LayoutTabs` を使わなかった**(作業中の判断): `LayoutTabs` は中身を「props を取らない関数の部品」の配列で受け取る。そのため呼ぶ側は、描くたびに `cr` を閉じ込めた部品を作り直すことになり、親が描き直すと部品が作り直されて、編集中のフォームの入力が消える。そこで、選んだタブだけを描く、ボタンの列(`role="tab"`)にした。
- **文書への反映の完了待ちはここで持つ**: `useGenerationPolling(projectId, reflecting, ...)`。影響のタブから別のタブへ移っても待ち続ける。時間切れは知らせだけ出す。
- 無い CR は「見つかりません」と一覧へのリンクを出す。

## 3. 内容のタブ(`ContentTab`)

- 対象は「要件 / 種類 / 合意済みの文 / 変更後の案」の表(説明書の2節と同じ並び。[84-2](../Phase-84/Phase-84-2.md))。合意済みの文は、基準の束の要件(87-1 の API)から引く。削除は「(削除)」、案が空なら「(内容を参照)」。
- 合意の記録(相手が空なら「記録なし」)・重なり(同じ要件を対象にする進行中の CR へのリンク)・写しの元と先・入れた合意済みの版。
- 直せるのは `allowed_actions` に `edit` があるとき。説明済みで直すと下書きに戻るので、ボタンの名前で示す(「直す(下書きに戻る)」)。

## 4. 影響のタブ(`ImpactTab`)

- **予測**: 判断の前は基準の束から求めたもの、判断の後は保存したもの(`saved` で文を変える)。段階ごとにまとめ、段階0は「文書の側(画面・API)」と呼ぶ。新しい要件を足す分が予測に入らないこと、束に入っていない段階を示す([83-3](../Phase-83/Phase-83-3.md))。
- **比較**(反映済み・検証済み): 予測の外 → 予測だけ → 一致の順に、件数と表で出す。予測だけには理由(文書の側・一度も承認していない段階・差分が届かなかった)を添え、確認の状態は今の状態([86-1](../Phase-86/Phase-86-1.md))。
- **文書への反映のボタン**(合意・反映済み): 確かめてから `reflectDocuments`。合意では「作り直しが終わると反映済みになる」、反映済みでは「やり直せる。段階は詳細設計画面で」と示す。反映済みのときは、詳細設計画面へのリンクを添える(段階への反映は 87-4)。受け付けの失敗と、生成の失敗の記録を出す。

## 5. たどる記録のタブ(`TraceTab`)

- 時系列は、生の `events` でなく、たどる記録([86-4](../Phase-86/Phase-86-4.md))だけで出す(ユーザー決定。たどる記録は時系列の行を全部含み、指す先を読み解いてある)。
- 行ごとに日時・操作・状態の移り(名前は `statusLabel`)・指す先(作った文書の版と、もう残っていないか・段階の版・モデル名・結んだレビューの区切りと指摘と採用の数・入れた版)・メモ。上に基準の束と入れた束。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `ChangeRequestActions.test.tsx`(新規) | `ChangeRequestActions`・`DecisionDialog` | Testing Library(クリック・入力) | ストアの操作の関数(`vi.fn`)・router・説明書の API と `saveFile`(`vi.mock`)── ボタンの出し分けと、ダイアログから渡す本文だけを見る |
| `ContentTab.test.tsx`(新規) | `ContentTab` | Testing Library | ストアの関数(`vi.fn`)── 束の要件の読み込みと、直したときの本文だけを見る |
| `ImpactTab.test.tsx`(新規) | `ImpactTab` | Testing Library | ストアの関数(`vi.fn`)── タブを開いたときの読み込みと、反映のボタンの出し分けを見る |
| `TraceTab.test.tsx`(新規) | `TraceTab`(と `statusLabel`) | Testing Library | ストアの `fetchView`(`vi.fn`) |
| `ChangeRequestDetailContent.test.tsx`(新規) | `ChangeRequestDetailContent` | Testing Library | ストアの関数・`useGenerationPolling`・各タブと操作の部品(`vi.mock`)── 詳細自身の配線だけを見る。タブの中身はそれぞれのテストで確かめる |
| `[number]/__tests__/page.test.tsx`(新規) | ルート `ChangeRequestDetailPage` | vitest のテスト関数 | `ChangeRequestDetailContent`(`vi.mock`)── 番号を数にして渡すことを見る |

部品のテストは `renderWithStore.tsx` の `resetChangeRequestsStore` でストアを空にし、API を呼ぶ関数を `vi.fn` に差し替える。

- 操作: 見出しのボタンの絞り込み・説明済みの確かめ・合意は理由が要り相手の空を `null` に・日時はタイムゾーン付き・写しの先へ移る・取り下げの理由・説明書の保存。
- 内容: 合意済みの文と案の表・合意の記録・重なりと写しのリンク・入れた版・直せない状態・直した本文。
- 影響: 判断の前の予測・新しい要件と束に無い段階の知らせ・開いたときの読み込み・確かめてから反映・比較の順と理由・反映中のボタン・比較の失敗。
- 記録: 開いたときの読み込み・前後の状態の名前・残っていない版・モデル・レビュー・版・失敗。
- 詳細: 見出しと状態・タブの切り替え・検証は反映の後だけ(87-4)・完了待ちの受け渡し・無い CR。

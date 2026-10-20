# Phase-88-3: 合意済みの版(束)の画面

## この章の目的

束を画面で作り、見られるようにする。今までの束は API でしか作れず、CR の作成は「束が無ければ止める」だけだった。一覧と作成のページ(`/projects/{id}/baselines`)では、検証済みの CR を選ぶと、その CR の合意の記録が初期値に入る。中身のページ(`/projects/{id}/baselines/{番号}`)では、合意の記録・入れた CR・写した文書・段階を見る。CR の一覧・詳細、SCR-005・SCR-008 から束へ移れるリンクも足す。md の描き方は、文書の画面と共通の部品にする。

自動実装モード: on([introduction](./Phase-88-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`frontend/src/features/documents/components/MarkdownBody.tsx`](../samples/frontend/src/features/documents/components/MarkdownBody.tsx) | 新規 | md の本文を枠の中に描く(`DocumentMarkdownView` から出した `markdownComponents` と `skipHtml`) |
| [`frontend/src/features/documents/components/DocumentMarkdownView.tsx`](../samples/frontend/src/features/documents/components/DocumentMarkdownView.tsx) | 更新 | 本文を `MarkdownBody` で描く |
| [`frontend/src/features/baselines/components/BaselineList.tsx`](../samples/frontend/src/features/baselines/components/BaselineList.tsx) | 新規 | 束の一覧の表(番号・合意の日時・相手・理由・入れた CR・入った段階の数) |
| [`frontend/src/features/baselines/components/BaselineCreateForm.tsx`](../samples/frontend/src/features/baselines/components/BaselineCreateForm.tsx) | 新規 | 作成のフォーム(入れる CR・合意の記録・束に入る段階・作れない理由) |
| [`frontend/src/features/baselines/components/BaselinesPageContent.tsx`](../samples/frontend/src/features/baselines/components/BaselinesPageContent.tsx) | 新規 | 一覧と作成のページの本体 |
| [`frontend/src/features/baselines/components/BaselineDetailContent.tsx`](../samples/frontend/src/features/baselines/components/BaselineDetailContent.tsx) | 新規 | 中身のページの本体 |
| [`frontend/src/app/projects/[id]/baselines/page.tsx`](../samples/frontend/src/app/projects/[id]/baselines/page.tsx) | 新規 | ルート(一覧と作成) |
| [`frontend/src/app/projects/[id]/baselines/[number]/page.tsx`](../samples/frontend/src/app/projects/[id]/baselines/[number]/page.tsx) | 新規 | ルート(中身。番号を数にして渡す) |
| [`frontend/src/features/change-requests/components/ChangeRequestList.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestList.tsx) | 更新 | 基準の版から束の中身へ |
| [`frontend/src/features/change-requests/components/ChangeRequestsPageContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestsPageContent.tsx) | 更新 | 見出しと「束が無い」の文から束の一覧へ |
| [`frontend/src/features/change-requests/components/ContentTab.tsx`](../samples/frontend/src/features/change-requests/components/ContentTab.tsx) | 更新 | 「入れた版」から束の中身へ |
| [`frontend/src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | 見出しに「合意済みの版」(詳細設計モードだけ) |
| [`frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 見出しに「合意済みの版 →」(詳細設計モードだけ) |
| [`frontend/src/features/baselines/test-utils/resetBaselinesStore.ts`](../samples/frontend/src/features/baselines/test-utils/resetBaselinesStore.ts) | 新規 | 部品のテストの共通の準備(束のストアを空にし、取得・作成を `vi.fn` に) |
| [`frontend/src/features/baselines/components/__tests__/BaselineCreateForm.test.tsx`](../samples/frontend/src/features/baselines/components/__tests__/BaselineCreateForm.test.tsx) | 新規 | フォーム |
| [`frontend/src/features/baselines/components/__tests__/BaselinesPageContent.test.tsx`](../samples/frontend/src/features/baselines/components/__tests__/BaselinesPageContent.test.tsx) | 新規 | 一覧と作成のページ(`BaselineList` も) |
| [`frontend/src/features/baselines/components/__tests__/BaselineDetailContent.test.tsx`](../samples/frontend/src/features/baselines/components/__tests__/BaselineDetailContent.test.tsx) | 新規 | 中身のページ(`MarkdownBody` も) |
| [`frontend/src/app/projects/[id]/baselines/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/baselines/__tests__/page.test.tsx) | 新規 | ルート |
| [`frontend/src/app/projects/[id]/baselines/[number]/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/baselines/[number]/__tests__/page.test.tsx) | 新規 | ルート |
| [`frontend/src/features/change-requests/components/__tests__/ChangeRequestsPageContent.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestsPageContent.test.tsx) | 更新 | 束へのリンク |
| [`frontend/src/features/change-requests/components/__tests__/ContentTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ContentTab.test.tsx) | 更新 | 入れた版のリンク |
| [`frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx) | 更新 | 束へのリンクの出し分け |
| [`frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | 束へのリンク |

本体のルートは `src/app/(pages)/(protected)/projects/[id]/baselines/...`(samples では `src/app/projects/[id]/baselines/...`)。

## 1. md の描き方を共通にする(#17)

```tsx
// src/features/documents/components/MarkdownBody.tsx
export function MarkdownBody({ content, label }: { content: string; label?: string })
```

- **駆動する消費者**: 束の中身(写した文書の md)と、説明書のタブの出力のプレビュー(88-4)。文書の画面(`DocumentMarkdownView`)と同じ見出しの余白・表の罫線で描きたいが、`markdownComponents` は `DocumentMarkdownView` の中に閉じていた。コピーせず、描く部分ごと部品に出した。
- `label` を渡すと `role="region"` と名前を付ける(どの md かを読み上げとテストで見分けるため)。生の HTML を描かない(`skipHtml`)のは元のまま。

## 2. 一覧と作成のページ

```
/projects/{id}/baselines
  見出し「合意済みの版」  ← 変更要求(CR) / ドキュメント / 詳細設計
  [合意済みの版を作る] → フォーム: 入れる CR(検証済み・未収録)/ 合意の記録 / 束に入る段階 / [作る][やめる]
  一覧: 番号(→中身)・合意の日時・相手・理由・入れた CR(→CR の詳細)・「6 / 8 入った」
```

- **ページは束のストアと CR のストアの両方を読む**: 束の一覧と、入れた CR(CR の一覧の `included_baseline_number`)。CR の一覧は、CR の画面と同じストアを使う(読み直しの鮮度も共有する)。
- **フォームを開くと**、段階の一覧(止まった生成の回収と、入る段階の表示)と、CR の一覧を強制で読み直す(別の画面で検証した CR を拾うため)。
- **作ったら中身へ移る**(CR の作成と同じ形)。束は直せず消せないので、作った後に見えるのが確かめになる。

`BaselineCreateForm` の要点:

- 入れる CR はチェックボックス。0件でも作れる(最初の束は CR を入れない)。
- 合意の記録の欄は `DecisionDialog`(Phase 87)と同じ素の入力(相手・日時・メモ・理由)。どの欄を手で直したかを `touched` に持ち、選択を変えるたびに `applySelection` で、直していない欄だけを初期値で埋め直す。日時の既定は今。
- 束に入る段階の表(段階・今の状態・「入る(承認の写し)/入らない」)。読み込み中はその旨を出す。
- 作れない理由(`createBlocker`)があれば文で示し、ボタンを無効にする。理由が空のときも示す(最初に開いたときから、何を入れれば作れるかが分かる)。

## 3. 中身のページ

- **合意の記録**(合意の日時・相手・理由・メモ・記録した日時)と、**入れた CR**(番号・タイトル・状態の札)。
- **写した文書**: 要件定義書・外部設計書・テスト仕様書。md は「〜を見る」を押したときだけ描く(3つとも長く、一度に描くと重いため)。版とモデル名も出す。作った時点に無かった文書(テスト仕様書)は「無い(作った時点で無かった)」。
- **段階の表**: 入ったか・作った時点の状態(承認の後に直した・古い、も含む。Phase 81 の決定)・承認した版。段階の写し(model)の中身は出さない。段階の中身を見るのは詳細設計画面で、束の段階を読む画面は、要るとわかってから作る(申し送り)。

> **完了後の調整**: CR の作成は、この章の後に、束の中身の「この版を基準に変更要求を作る →」から移る作成のページだけにした(基準の版は固定)。番号のリンクの見え方と、簡易モードの知らせも足した。[introduction の「Phase 完了後の調整」](./Phase-88-introduction.md#phase-完了後の調整)。

## 4. リンク

- CR の一覧の見出し「合意済みの版」、CR の作成の「合意済みの版がまだありません。先に〔合意済みの版〕を作ってください」、一覧の「基準の版」列(B-N → 中身)、CR の詳細の内容のタブの「合意済みの版 B-N に入れました。」(→ 中身)。
- SCR-005・SCR-008 の見出しは、「変更要求(CR)」の隣に「合意済みの版」(詳細設計モードだけ)。
- これで「どの合意を基準にした CR か・どの版に入れたか」を、CR と束の双方から行き来できる(マイルストーン12 の「後からたどれる」)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `BaselineCreateForm.test.tsx`(新規) | `BaselineCreateForm` | Testing Library(描画・入力・クリック) | `onSubmit`・`onCancel`(`vi.fn`)── フォームが組み立てる本文だけを見るため(作成はストアのテスト) |
| `BaselinesPageContent.test.tsx`(新規) | `BaselinesPageContent`・`BaselineList` | Testing Library | 束と CR のストアの取得・作成(`vi.fn`)と `next/navigation` の router ── 画面の配線だけを見るため |
| `BaselineDetailContent.test.tsx`(新規) | `BaselineDetailContent`・`MarkdownBody` | Testing Library | 束と CR のストアの取得(`vi.fn`) |
| `baselines/__tests__/page.test.tsx`・`[number]/__tests__/page.test.tsx`(新規) | ルートのページ | Testing Library(`await Page({ params })`) | 本体の部品(`vi.mock`)── `params` の受け渡しと `RequireAuth` だけを見るため |
| `ChangeRequestsPageContent.test.tsx`・`ContentTab.test.tsx`・`DocumentsPageContent.test.tsx`・`DetailedDesignPageContent.test.tsx`(更新) | 足したリンク | Testing Library | 既存のとおり |

- フォーム: CR を選ぶと相手・理由・メモが入り、選んだ番号と一緒に送る・手で直した理由は選択を変えても残る・入る段階と入らない段階・生成中は作れない・入れられる CR が無くても作れる。
- 一覧と作成: 束と CR を読む・入れた CR と段階の数・作成を開くと段階と CR を読み直す・入れられる CR だけを選ばせる・作ったら中身へ移る。
- 中身: 読み込み中・合意の記録・入れた CR のリンク・無い文書・段階の表・md は開いたときに描く・取得の失敗。
- リンク: 見出し・理由の文・基準の版・入れた版。簡易モードでは出さない。

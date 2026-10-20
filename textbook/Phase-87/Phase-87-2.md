# Phase-87-2: 一覧と作成

## この章の目的

CR の一覧と作成のページ(`/projects/{id}/change-requests`)を作る。作成のフォームでは、基準の合意済みの版(束)を選び、その束の要件から対象を選んで、要件ごとに変更の種類と変更後の案を入れる(Phase 85・86 の申し送り「変更の種類と案の画面の入力」)。束が無ければ作成を止める。SCR-005 と SCR-008 の見出しから、このページへのリンクを出す(詳細設計モードだけ)。

自動実装モード: on([introduction](./Phase-87-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`frontend/src/features/change-requests/components/StatusBadge.tsx`](../samples/frontend/src/features/change-requests/components/StatusBadge.tsx) | 新規 | 状態のバッジ(一覧の行と詳細の見出し) |
| [`frontend/src/features/change-requests/components/ChangeRequestList.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestList.tsx) | 新規 | 一覧の表(番号から詳細へ) |
| [`frontend/src/features/change-requests/components/ChangeRequestForm.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestForm.tsx) | 新規 | 作成・編集のフォーム(87-3 の編集でも使う) |
| [`frontend/src/features/change-requests/components/ChangeRequestsPageContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestsPageContent.tsx) | 新規 | 一覧と作成のページの本体 |
| [`frontend/src/app/projects/[id]/change-requests/page.tsx`](../samples/frontend/src/app/projects/[id]/change-requests/page.tsx) | 新規 | ルート(本体は `src/app/(pages)/(protected)/projects/[id]/change-requests/page.tsx`) |
| [`frontend/src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | 見出しに「変更要求(CR)」のリンク(詳細設計モードだけ) |
| [`frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 見出しに「変更要求(CR) →」のリンク(詳細設計モードだけ。87-4 でも更新) |
| [`frontend/src/features/change-requests/components/__tests__/ChangeRequestForm.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestForm.test.tsx) | 新規 | フォーム |
| [`frontend/src/features/change-requests/components/__tests__/ChangeRequestsPageContent.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestsPageContent.test.tsx) | 新規 | ページの配線・一覧・バッジ |
| [`frontend/src/app/projects/[id]/change-requests/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/change-requests/__tests__/page.test.tsx) | 新規 | ルート |
| [`frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx) | 更新 | リンクの出し分け |
| [`frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | リンク(87-4 でも更新) |

依存の向き: ページ → `ChangeRequestsPageContent` → ストア・純粋関数(87-1)・`ChangeRequestForm`・`ChangeRequestList` → `StatusBadge`。表と入力の見た目は詳細設計の `tableStyles.ts`(既存)を使う。

## 1. 置き場所とナビゲーション(着手時の相談)

- **新しいページにした**(ユーザー決定): SCR-008 は段階のステッパー・作業領域・変更の影響・レビュー・差し戻しで既に密である。また CR は、文書(要件定義書からの再生成)と段階の両方にまたがる。
- 一覧と作成は `/projects/{id}/change-requests`、詳細は `/projects/{id}/change-requests/{番号}`(87-3)。ルートは他の動的ページと同じく、`params` を解いて Client Component に渡すだけ。
- SCR-005 の見出しは「変更要求(CR)」、SCR-008 は「変更要求(CR) →」。簡易ドキュメントモードには出さない(CR は詳細設計モードだけ。2.14節)。

## 2. 作成のフォーム(`ChangeRequestForm`)

```tsx
<ChangeRequestForm
  initial={emptyForm(baselineNumber)}       // 編集は formFromChangeRequest(cr)
  baselines={baselines}                     // 渡すと基準の束を選べる(作成だけ)
  requirements={requirements[baselineNumber] ?? null}
  onBaselineChange={setBaselineNumber}
  submitting={acting} submitLabel="下書きで作る" onSubmit={...} onCancel={...} />
```

- **対象**: 束の要件(87-1 の API)から選び、「対象に足す」で表に行を足す。行ごとに、合意済みの文・種類(内容の変更 / 削除)・案を出す。削除にすると案の欄を消して「(削除)」と出す(削除には案を書けない。[84-1](../Phase-84/Phase-84-1.md))。足した要件は選択肢から消える(同じ要件を2回指定できない。[83-1](../Phase-83/Phase-83-1.md))。
- **基準の束を変えると対象を空にする**: 対象は基準の束の要件にあるものだけ(422 `CR_TARGET_UNKNOWN`)。
- **新しい要件を足す**の印と背景(出どころの種類・日付・メモ)。日付は `<input type="date">`。
- **送る前の確かめ**(`formProblems`): 足りなければ送らずに理由を出す。
- 入力は既存の画面と同じく素の `input`・`select`・`textarea`(`tableStyles.ts` の `INPUT`・`OPTION`。ダークモードの選択肢の色)。

## 3. 一覧と作成のページ(`ChangeRequestsPageContent`)

- 開くと一覧と束の一覧を読む。基準の束の既定は最新(束の一覧は新しい順)。フォームを開いたら、その束の要件を読む。
- **束が無ければ作成を止める**: ボタンを押せなくし、「合意済みの版がまだありません」と出す(束の画面は Phase 88。それまでは API で作る)。
- 作れたら、作った CR の詳細へ移る(`router.push`)。失敗はストアの `actionError` をフォームの上に出す。
- 一覧は番号・タイトル・状態のバッジ・対象(要件 ID と種類の名前、新しい要件を足す)・基準の束・更新の日時。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `ChangeRequestForm.test.tsx`(新規) | `ChangeRequestForm` | Testing Library(入力・クリック) | スタブ不要 ── 部品は props の関数を呼ぶだけで外部を呼ばない(`onSubmit` などは `vi.fn` で受ける) |
| `ChangeRequestsPageContent.test.tsx`(新規) | `ChangeRequestsPageContent`(と、中の `ChangeRequestList`・`StatusBadge`) | Testing Library(描画・クリック) | ストアの取得・作成の関数(`vi.fn`)と `next/navigation` の router ── 画面の配線だけを見る。ストアは 87-1 で確かめた |
| `change-requests/__tests__/page.test.tsx`(新規) | ルート `ChangeRequestsPage` | vitest のテスト関数(async の Server Component を呼ぶ) | `ChangeRequestsPageContent`(`vi.mock`)── 渡す `projectId` と `RequireAuth` だけを見る |
| `DocumentsPageContent.test.tsx`・`DetailedDesignPageContent.test.tsx`(更新) | 見出しのリンク | Testing Library | 既存のテストのスタブのまま(ストアの関数・子のパネル) |

- フォーム: 足りない項目で送らない・要件を足して種類と案を送る・削除で案の欄を消す・足した要件は候補から消える・束を変えると知らせる・編集では束を選べない。
- ページ: 開いたときの読み込み・行から詳細へのリンク・状態のバッジ・束が無いときの止め方・作った後の移動・プロジェクトが無いとき。
- リンク: 詳細設計モードだけに出る。

# Phase-78-2: 新規作成の後のダッシュボードの cache

## この章の目的

プロジェクトを作ってから20秒以内に同じ条件のダッシュボードへ戻ると、作ったプロジェクトが一覧に出なかった(一覧の cache が残るため)。作成の成功で `dashboard-store` の `invalidate()` を呼び、次にダッシュボードを開いたときに取り直させる。Phase 65 から申し送ってきた項目である。

自動実装モード: on([introduction](./Phase-78-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/hearing/components/IntakeForm.tsx`](../samples/frontend/src/features/hearing/components/IntakeForm.tsx) | 更新 | 作成の成功で `useDashboardStore.getState().invalidate()` |
| [`src/features/hearing/components/__tests__/IntakeForm.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/IntakeForm.test.tsx) | 更新 | 成功で cache が切れ、失敗では切れない |

## 1. 作成の成功で cache を切る

```tsx
// src/features/hearing/components/IntakeForm.tsx(抜粋)
const project = await createProject({ ...values, mode });
// ダッシュボードの一覧の cache を切る(20秒以内に戻っても、作ったプロジェクトが出るように)
useDashboardStore.getState().invalidate();
createdProjectIdRef.current = project.id;
```

- **cache の仕組み**: ダッシュボードの一覧は、検索の条件とページ(鍵)が同じで、取得から20秒(`lib/api/cache.ts` の TTL)以内なら取り直さない。`invalidate()` は `fetchedAt` を消して、次の `fetchProjects` を必ず取りに行かせる(Phase 3 からあり、テスト済み。呼ぶ所が無かった)。
- **変えた所で切る**: 削除(`DeleteProjectButton`)が `removeProject` で cache を切るのと同じ考え方。作成の API の関数(`createProject.ts`)は通信だけにして、ストアを触らせない。
- **失敗では切らない**: 一覧は変わっていないので、取り直す理由が無い。
- **機能をまたぐ import**: `features/hearing` から `features/dashboard` のストアを読む。文書の画面が `DeleteProjectButton` を読むのと同じく、すでにある向きである。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `IntakeForm.test.tsx`(更新) | `IntakeForm` | React Testing Library + userEvent | `stubFetch`(テンプレートの一覧・500・201)・`next/navigation` の `vi.mock`。`useDashboardStore` は本物(切れることが検証の対象) |

- 送る前に `fetchedAt` を入れておく / 作成が 500 なら文を出し、`fetchedAt` は残る / 送り直して 201 ならチャットへ移り、`fetchedAt` が null になる。
- 更新したファイルは、この章のテストが import する。前方 import は無い。

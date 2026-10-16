# Phase-65-2: 一覧の条件と取得(devex-ui の api・ストア)

## この章の目的

一覧の条件(検索語・モード・進行状態・ページ)を1つの型にまとめ、URL のクエリと行き来できるようにする。API の呼び出しとストアを、[65-1](./Phase-65-1.md) の `{items, total}` に合わせる。20秒の cache は「同じ条件のときだけ」効くようにし、削除の後は今のページを取り直せるようにする。画面の部品は [65-3](./Phase-65-3.md) で作る。

自動実装モード: on([introduction](./Phase-65-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/dashboard/list-params.ts`](../samples/frontend/src/features/dashboard/list-params.ts) | 新規 | 条件の型・URL との変換・cache の鍵 |
| [`src/features/dashboard/api/projects.ts`](../samples/frontend/src/features/dashboard/api/projects.ts) | 更新 | `ProjectListPage`・`listProjects(params)` |
| [`src/features/dashboard/dashboard-store.ts`](../samples/frontend/src/features/dashboard/dashboard-store.ts) | 更新 | `items`・`total`・`key`・`fetchProjects(params)`・`removeProject` |
| [`src/features/dashboard/__tests__/list-params.test.ts`](../samples/frontend/src/features/dashboard/__tests__/list-params.test.ts) | 新規 | 読み取り・書き出し・鍵 |
| [`src/features/dashboard/api/__tests__/projects.test.ts`](../samples/frontend/src/features/dashboard/api/__tests__/projects.test.ts) | 更新 | `listProjects` のクエリ |
| [`src/features/dashboard/__tests__/dashboard-store.test.ts`](../samples/frontend/src/features/dashboard/__tests__/dashboard-store.test.ts) | 更新 | 鍵ごとの cache・古い応答を捨てる・削除 |
| [`src/features/dashboard/components/__tests__/DeleteProjectButton.test.tsx`](../samples/frontend/src/features/dashboard/components/__tests__/DeleteProjectButton.test.tsx) | 更新 | ストアの `projects` → `items` |

ストアの形が変わるので、この章だけを写すと `ProjectList.tsx` の型が合わない。[65-3](./Phase-65-3.md) まで写してから `tsc` を通す(introduction の「写経順序」)。

## 1. 条件の型と URL(`list-params.ts`)

責務: 一覧の条件を、URL のクエリ・API のクエリ・cache の鍵の3つに同じ規則で直す(純粋な関数だけ)。

```ts
// src/features/dashboard/list-params.ts
export type ProjectListParams = {
  q: string;
  mode: ProjectMode | null;      // null は絞らない
  statuses: ProjectStatus[];     // 空は絞らない。複数はどれかに一致
  page: number;
};
export const DEFAULT_LIST_PARAMS: ProjectListParams = { q: "", mode: null, statuses: [], page: 1 };
export function parseListParams(search: Pick<URLSearchParams, "get" | "getAll">): ProjectListParams;
export function toSearchParams(params: ProjectListParams): URLSearchParams;
export function listParamsKey(params: ProjectListParams): string;   // = toSearchParams(...).toString()
export function hasConditions(params: ProjectListParams): boolean;  // 検索語・モード・状態のどれか
```

- **不正な値は捨てる**(`parseListParams`): 直打ちや古いブックマークでも画面が壊れないように、知らないモード・状態は無視し、ページは1以上の整数でなければ1にする。
- **状態は定めた順に並べる**(`PROJECT_STATUSES`): 「完了 → ヒアリング中」と選んでも「ヒアリング中 → 完了」と選んでも、URL と cache の鍵が同じになる。
- **既定値は書かない**(`toSearchParams`): 条件が無い1ページ目は `/dashboard` のまま。
- URL と API のクエリは同じ形にした(`?q=&mode=&status=&status=&page=`)。同じ関数で両方を作る。
- `PROJECT_PAGE_SIZE = 10` も置いた(API の定数と同じ値。画面はページの数を出すのに使う)。
- 型だけを `api/projects.ts` から import する。`api/projects.ts` は実行時に `toSearchParams` を import するので、向きは「api → list-params」の1つになる(型だけの import は実行時に残らない)。

## 2. API の関数(`listProjects`)

```ts
// src/features/dashboard/api/projects.ts
export type ProjectListPage = { items: ProjectRead[]; total: number };

export function listProjects(params: ProjectListParams): Promise<ProjectListPage> {
  const query = toSearchParams(params).toString();
  return apiFetch<ProjectListPage>(`/api/v1/projects${query ? `?${query}` : ""}`);
}
```

## 3. ストア(`dashboard-store.ts`)

| 状態 | 意味 |
|---|---|
| `items`・`total` | 今の条件の1ページ分と、条件に合う全件数(`projects` から改名) |
| `key` | 取得した条件の鍵(`listParamsKey`)。cache は最後の条件の1つだけ持つ |
| `fetchedAt` | 取得した時刻。`null` は「取り直しが要る」 |

```ts
// src/features/dashboard/dashboard-store.ts(要点)
fetchProjects: async (params, { force = false } = {}) => {
  const key = listParamsKey(params);
  if (!force && get().key === key && isCacheFresh(get().fetchedAt)) return;
  set((state) => ({ status: "loading", error: null, key,
                    fetchedAt: state.key === key ? state.fetchedAt : null }));
  const page = await listProjects(params);
  if (get().key !== key) return;            // 待つ間に条件が変わった(古い応答)
  set({ items: page.items, total: page.total, status: "success", fetchedAt: Date.now() });
},
removeProject: (projectId) => set((state) => {
  const items = state.items.filter((p) => p.id !== projectId);
  return { items, total: items.length < state.items.length ? Math.max(0, state.total - 1) : state.total,
           fetchedAt: null };
}),
```

- **cache の鍵**(着手時の未確定事項): 条件の文字列。ストアは最後の条件だけを持つ(条件ごとに貯めない)。ダッシュボードから別の画面へ行って20秒以内に戻ったときだけ効けばよく、条件を変えたら取り直すため。
- **条件が変わったら `fetchedAt` を消す**: 消さないと、取得中にもう一度同じ条件で呼ばれたとき、前の条件の取得時刻を見て「新しい」と判断し、前の条件の結果を出したままになる。
- **古い応答を捨てる**: 状態のチェックボックスを続けて押すと、要求が2つ走る。後の要求が先に返っても、前の要求の応答で上書きしない。
- **表示は応答が届くまで前の結果のまま**: 条件を変えるたびに「読み込み中...」に替わると、一覧がちらつく。
- **削除(`removeProject`)**: カードをその場で外し、`total` を1減らし、`fetchedAt` を消す。一覧が開いていれば、[65-3](./Phase-65-3.md) の `ProjectList` が `fetchedAt` の変化で今のページを取り直し、次のページの先頭が繰り上がる。Phase 64 では「取り直さずに外す」だったが、ページで区切ると、外すだけでは10件に足りなくなる。文書の画面から削除したとき(このページに無いプロジェクト)は `total` を変えない。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `list-params.test.ts`(新規) | `parseListParams`・`toSearchParams`・`listParamsKey`・`hasConditions` | このテスト | スタブ不要 ── 純粋な関数で、外部に依存しないため |
| `projects.test.ts`(更新) | `listProjects` | このテスト | `fetch`(`stubFetch`。送ったパスとクエリを見る) |
| `dashboard-store.test.ts`(更新) | `useDashboardStore` | ストアの関数を直接呼ぶ | `fetch`(`stubFetch`) |
| `DeleteProjectButton.test.tsx`(更新) | `DeleteProjectButton` | ユーザーの操作 | 既存のまま(ストアの状態の名前だけ変えた) |

- `list-params`: URL を読む(前後の空白を落とす・状態を定めた順に)/ 不正な値は既定値 / 既定値は書かない / 選んだ順によらず同じ鍵 / 書いて読み直すと戻る / ページは条件に含めない。
- `listProjects`: 条件が無ければクエリを付けない / 複数の状態を繰り返す。
- ストア: 成功で `items`・`total`・`key` / 同じ条件で20秒以内は取り直さない / 条件が変われば取り直す / `force`・`invalidate` / 古い応答を捨てる / 削除で外して `total` を減らし `fetchedAt` を消す(その場では取り直さない)/ このページに無いものを外しても `total` は変えない / 失敗。
- 作成・更新したファイルは、この章のテストがすべて import する。前方 import は無い。

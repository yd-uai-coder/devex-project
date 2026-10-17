# Phase-65-3: 検索・絞込み・ページの画面

## この章の目的

ダッシュボード(SCR-002)の一覧の上に、タイトルの検索・モードの絞込み・進行状態の絞込み(複数)を置き、下にページ送りを置く。条件とページは URL に持つ。読み込み直し・ブラウザの戻る・ブックマークで、同じ一覧に戻れるようにするため。[65-2](./Phase-65-2.md) の条件の型とストアの上に作る。

自動実装モード: on([introduction](./Phase-65-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/dashboard/components/ProjectListItem.tsx`](../samples/frontend/src/features/dashboard/components/ProjectListItem.tsx) | 更新 | `STATUS_LABEL` を export(絞込みの文言と共有) |
| [`src/features/dashboard/components/ProjectListControls.tsx`](../samples/frontend/src/features/dashboard/components/ProjectListControls.tsx) | 新規 | 検索・モード・進行状態・条件のクリア |
| [`src/features/dashboard/components/ProjectList.tsx`](../samples/frontend/src/features/dashboard/components/ProjectList.tsx) | 更新 | URL の条件で取る・ページ送り・0件の表示・範囲外のページ |
| [`src/app/dashboard/page.tsx`](../samples/frontend/src/app/dashboard/page.tsx) | 更新 | `ProjectList` を `Suspense` で包む |
| [`src/features/dashboard/components/__tests__/ProjectListControls.test.tsx`](../samples/frontend/src/features/dashboard/components/__tests__/ProjectListControls.test.tsx) | 新規 | 確定のしかた・選んだときの反映・クリア |
| [`src/features/dashboard/components/__tests__/ProjectList.test.tsx`](../samples/frontend/src/features/dashboard/components/__tests__/ProjectList.test.tsx) | 更新 | URL の条件・push・ページ送り・置き換え・削除の後の取り直し |
| [`src/app/dashboard/__tests__/page.test.tsx`](../samples/frontend/src/app/dashboard/__tests__/page.test.tsx) | 更新 | `useSearchParams` のモックと応答の形 |

(本体のページは `src/app/(pages)/(protected)/dashboard/` にある。samples は route group を省いた置き場。)

## 1. 検索・絞込みの部品(`ProjectListControls`)

責務: 条件の入力だけを持つ。値(`value`)と `onChange(next)` を受け、URL を知らない(テストしやすく、URL 以外にも使えるように)。

| 入力 | 確定のしかた |
|---|---|
| タイトルの検索 | **Enter か「検索」ボタン**(着手時の相談のユーザーの決定。推奨は入力ごと300ms)。入力の途中では一覧を変えない |
| モード | ラジオ(すべて / 簡易ドキュメント / 詳細設計)。選んだらすぐ |
| 進行状態 | チェックボックス4つ(**複数を選べる**。着手時の相談のユーザーの決定)。押したらすぐ |
| 条件をクリア | 条件があるときだけ出す。既定の条件(1ページ目)へ |

```tsx
// src/features/dashboard/components/ProjectListControls.tsx(要点)
const [draft, setDraft] = useState(value.q);
const [syncedQ, setSyncedQ] = useState(value.q);
if (syncedQ !== value.q) { setSyncedQ(value.q); setDraft(value.q); }   // 戻る・クリアで合わせる

function change(patch: Partial<ProjectListParams>) { onChange({ ...value, ...patch, page: 1 }); }
function submitSearch() { const q = draft.trim(); if (q !== value.q) change({ q }); }

<form role="search" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
  <Input aria-label="タイトルで検索" value={draft} onChangeText={setDraft} />
</form>
<StyledButton onPress={submitSearch}>検索</StyledButton>
```

- **入力欄は下書き(`draft`)を持つ**: 確定するまで URL を変えない。ブラウザの戻る・「条件をクリア」で確定済みの検索語が変わったら、入力欄を合わせる。effect で合わせると描画が1回余計に走るので、React の「props の変化で state を調整する」形(描画の中で前の値と比べる)にした。
- **Enter は HTML のフォームの暗黙の送信**: 入力欄が1つだけのフォームでは、Enter で送信される。「検索」ボタンはフォームの外に置き、`onPress` で同じ関数を呼ぶ(フォームの中に置くと、ボタンの既定の種類(submit)で2回呼ばれるおそれがある)。
- **条件を変えたらページを1に戻す**: 絞った結果が前のページの数より少ないことが多いため。
- **同じ検索語なら呼ばない**: 履歴に同じ URL を積まない。
- **モードは `RadioGroupWithLabel` を使わずに組んだ**: 部品の幅が固定(既定300)で、3つの選択肢が2行に折り返した。進行状態の行と同じ「見出し + 選択肢を横に」をこの部品の中で組んだ。狭い画面で折り返すよう、各段に `flexShrink`・`minWidth` を付け、`RadioGroup` の中の要素には `RadioGroupWithLabel.module.css` の `radioGroupWrap`(Tamagui の View の既定の `flex-shrink: 0` を外す)を当てた(ブラウザで 375px の幅を確かめて直した)。
- **既存の部品のうち使わなかったもの**: `useFilterSortPagination` は、全件を持ってクライアントで絞って切る仕組み(サーバーで切る今回と合わない)。`DataFilter` は1つのキーの条件しか持てず、適用ボタンの付いたポップオーバー(モードと状態を同時に、すぐ反映するのと合わない)。`DataPagination` はそのまま使えた。
- **並び(完了後のユーザーの調整)**: 検索欄と「検索」ボタンを左に寄せて1行、その下にモードの行・進行状態の行・「条件をクリア」を縦に積む(`YStack`)。検索欄は `width="100%"`(幅の上限は付けない。ステージ9の振り返りで本体に合わせた)。「条件をクリア」は緑のボタン(`StyledButton`・`size="$2"`)にした。調整で入った `alignItems="left"` は Tamagui の型に無い値で `tsc` が通らなかったため、同じ意味の `flex-start` にした。
- 進行状態の文言は、カードと同じ `STATUS_LABEL`(`ProjectListItem.tsx` から export)を使う。

## 2. 一覧(`ProjectList`)

責務: URL から条件を読み、ストアで取り、部品に配る。条件の変更を URL に書く。

```tsx
// src/features/dashboard/components/ProjectList.tsx(要点)
const searchParams = useSearchParams();
const params = useMemo(() => parseListParams(searchParams), [searchParams]);

useEffect(() => { void fetchProjects(params); }, [params, fetchedAt, fetchProjects]);

function navigate(next, { replace = false } = {}) {
  const query = toSearchParams(next).toString();
  const href = query ? `${pathname}?${query}` : pathname;
  replace ? router.replace(href) : router.push(href);
}
```

- **URL が条件の置き場**(着手時の相談で決定): 条件の変更・ページ送りは `router.push`(戻るで前の条件へ)。ストアには条件を持たせない(二重に持たない)。
- **取り直す時**: 条件(`params`)が変わったとき・`fetchedAt` が `null` になったとき(削除の後)。`fetchedAt` が数に変わったときも effect は走るが、cache が新しいので取りに行かない。
- **最後のページより後**: 取得できて、`items` が空で、`total` が 0 より大きく、`page` がページの数より大きいとき、最後のページへ `router.replace` する(戻るの履歴に残さない)。2ページ目の最後の1件を削除した・古い URL を開いた、のどちらも同じ道を通る。
- **0件の表示を分ける**: 条件が無ければ今までの「まだプロジェクトがありません。…」、条件があれば「条件に合うプロジェクトはありません。」。
- **ページ送り**(`DataPagination`)は、ページが2つ以上のときだけ出す(「1 / 2 ページ(全13件)」と前へ・次へ)。
- 検索・絞込みの部品は、プロジェクトが0件でも出す(条件で0件になったとき、戻せるように)。

## 3. ページ(`dashboard/page.tsx`)

```tsx
<Suspense fallback={null}>
  <ProjectList />
</Suspense>
```

- `useSearchParams` を使う部品は、Next.js の規約で `Suspense` の中に置く(静的に描くときに、URL が決まるまで待つため)。ログインのページ(`?redirect=`)と同じ形。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `ProjectListControls.test.tsx`(新規) | `ProjectListControls` | ユーザーの操作と、`value` を替えた再描画 | `onChange`(`vi.fn`。渡した条件を見る)。URL も API も知らない部品なので、ほかは要らない |
| `ProjectList.test.tsx`(更新) | `ProjectList` | ユーザーの操作 | `next/navigation`(URL のクエリを差し替え、`push`・`replace` の先を記録)・`fetch`(`stubFetch`)・`useToastController`。ストアは本物 |
| `page.test.tsx`(更新) | `DashboardPage` | ユーザーの操作 | `next/navigation`(`useSearchParams` を足した)・`fetch` |

- `ProjectListControls`: 入力の途中では呼ばず、Enter で確定してページを1に / 「検索」ボタンでも確定し、同じ検索語なら呼ばない / モードはすぐ反映し「すべて」は絞らない / 状態は複数を定めた順に / 条件があるときだけ「条件をクリア」/ 外から検索語が変わったら入力欄を合わせる。
- `ProjectList`: 条件が無ければクエリなしで取り、空の表示 / カード・リンク・バッジ(1ページならページ送りを出さない)/ URL の条件で取り、条件ありの0件の表示と入力欄の値 / 条件の変更は push でページを1に / 11件でページ送り、次へで `?page=2` / 範囲外のページは replace / 削除で外し、今のページを取り直す(GET → DELETE → GET)/ 取得の失敗。
- **`useSearchParams` のモックは同じオブジェクトを返す**: 描画のたびに `new URLSearchParams()` を返すと、`params` が毎回変わったとみなされ、取り直しが止まらない(テストを書いていて当たった)。Next.js 本体は URL が変わらない限り同じオブジェクトを返す。
- 作成・更新したファイルは、この章のテストがすべて import する。前方 import は無い(`ProjectListControls` は 65-2 の `list-params` と、この章で export した `STATUS_LABEL` を import する。表では `ProjectListItem.tsx` を先に置いた)。

# Phase-34-3: チャット画面の観点の表(FE)

## この章の目的

チャット画面に観点の表を出す。利用者は、どの観点が決まり、どれが未決の必須かを、チャットの横で見ながら答えられる。広い画面ではチャットの右に開いて置き、狭い画面ではチャットの上に畳んで置く(着手時の決定)。表は [34-2](./Phase-34-2.md) の `GET /projects/{id}/hearing-points` から読み、発言のたびに取り直す。

自動実装モード: on([introduction](./Phase-34-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/features/hearing/api/hearingApi.ts`](../samples/frontend/src/features/hearing/api/hearingApi.ts) | 更新 | 観点の表の型(`HearingPointsView`)と `getHearingPoints` |
| [`src/features/hearing/hearing-store.ts`](../samples/frontend/src/features/hearing/hearing-store.ts) | 更新 | `points` を、履歴の読み込みと返信の後に取り直す |
| [`src/features/hearing/components/HearingPointsPanel.tsx`](../samples/frontend/src/features/hearing/components/HearingPointsPanel.tsx) | 新規 | 観点の表のパネル(未決の必須の件数・規模・注記・表) |
| [`src/features/hearing/components/ChatPageContent.tsx`](../samples/frontend/src/features/hearing/components/ChatPageContent.tsx) | 更新 | パネルの置き場(広い画面は右、狭い画面は上) |
| ── ここからテスト ── | | |
| [`src/features/hearing/__tests__/hearing-store.test.ts`](../samples/frontend/src/features/hearing/__tests__/hearing-store.test.ts) | 更新 | 観点の表を取る順・失敗・別のプロジェクト |
| [`src/features/hearing/components/__tests__/HearingPointsPanel.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/HearingPointsPanel.test.tsx) | 新規 | 件数・表の中身・規模・注記・畳む |
| [`src/features/hearing/components/__tests__/ChatPageContent.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/ChatPageContent.test.tsx) | 更新 | 表が無いとき・狭い画面・広い画面 |

FE のパスは `devex-ui/` 基準。

## 要点の抜粋

```ts
// src/features/hearing/hearing-store.ts
// 観点の表を取り直す。失敗はチャット自体をブロックしない(完了判定と同じ方針)。
async function loadPoints(projectId: string, get: StoreGet, set: StoreSet): Promise<void> {
  try {
    const points = await getHearingPoints(projectId);
    if (get().projectId === projectId) set({ points });
  } catch {
    // 表が出ないだけで、チャットは続けられる
  }
}
```

```tsx
// src/features/hearing/components/ChatPageContent.tsx
const wide = useMedia().lg;
...
<YStack gap="$4" $lg={{ flexDirection: "row-reverse", alignItems: "flex-start" }}>
  {points ? (
    <YStack $lg={{ width: 460, flexShrink: 0 }}>
      <HearingPointsPanel key={wide ? "wide" : "narrow"} view={points} defaultOpen={wide} />
    </YStack>
  ) : null}
  <YStack minWidth={0} $lg={{ flex: 1 }}>
    <ChatPanel projectId={projectId} />
  </YStack>
</YStack>
```

依存の向き: `ChatPageContent.tsx` → `HearingPointsPanel.tsx` → `hearingApi.ts`(型)・`@/features/detailed-design/components/tableStyles`(既存の表のスタイル)。`hearing-store.ts` → `hearingApi.ts`。

## 設計判断

### 置き場所は1つの並びを向きで切り替える

パネルを先、チャットを後に並べ、狭い画面は縦(パネルが上)、広い画面(Tamagui の `lg`、1024px 以上)は `row-reverse`(パネルが右)にした。同じ要素を2か所に描かずに済む。開閉の初期値は `useMedia().lg` で決め、幅が変わったら `key` で作り直して合わせる(`<details>` の開閉は、作った後は利用者の操作に任せる)。

### 表は `<details>` で畳む

既存の `CollapsibleSection` と同じく、ブラウザの `<details>` を使う(開閉の状態を JS で持たず、キーボード操作もブラウザに任せる)。見出しに未決の必須の件数(必須がそろったら「必須はすべて決まりました」)を出すので、畳んでいても進み具合が分かる。

### 観点の名前と必須はサーバーから

観点の名前・問いの例・必須は API が返す([34-1](./Phase-34-1.md) の定義から)。画面は状態の表示名と色だけを持つ。デモ(`/hearing-points-demo`)のモデルは読まない(デモは仮データの見本で、本体の定義と二重にしないため)。未決の観点には、決めたことの代わりに問いの例を薄く出す(何を聞かれるかが分かるように)。

### 取る順を決める

履歴の読み込みでは、完了判定の後に観点の表を `await` で取る。送信の後も同じ順。テストのフェッチのスタブは呼び出し順に応答を返すので、順が決まっている方が確かめやすい。観点の表は、生成の後(`completed`)も見られるよう、状態によらず取る。

### 注記

- `legacy`(以前の5条件で進んだプロジェクト): 「次の発言から観点の表で判定します」。
- `stale`(直近の発言の判定に失敗): 「直近の発言は表に反映できていません」。生成のボタンは出ない([34-2](./Phase-34-2.md))。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `useHearingStore`(`loadHistory`・`sendMessage` の観点の表) | vitest(`hearing-store.test.ts`) | `stubFetch`(フェッチを呼び出し順の応答に差し替える)・`streamChat` のモック ── API とストリームは外部との通信なので差し替える | 完了判定の後に観点の表を取る、取得に失敗しても読み込みは成功、送信の後に完了判定 → 観点の表、別のプロジェクトへ移った後の結果は置かない。`generating`・`completed` で呼ぶ URL の並び |
| `HearingPointsPanel`・`openRequiredCount` | vitest(`HearingPointsPanel.test.tsx`) | スタブ不要 ── props だけで描く部品(副作用なし)のため | 第一テスト: 未決の必須だけを数える。表の行(状態・決めたこと・問いの例・根拠)、規模の表示、必須がそろったときの見出し、注記、`defaultOpen` |
| `ChatPageContent` のパネルの置き場 | vitest(`ChatPageContent.test.tsx`) | `ChatPanel`・`useGenerationPolling`・`next/navigation` のモックと、`tamagui` の `useMedia` だけの差し替え ── 画面幅を作れないため | 表が無ければ出さない、狭い画面は畳む、広い画面は開く |

```sh
cd devex-ui && npx vitest run src/features/hearing
```

画面での確認(実際の幅でのレイアウト)は、未消化の申し送りに積む([introduction](./Phase-34-introduction.md))。

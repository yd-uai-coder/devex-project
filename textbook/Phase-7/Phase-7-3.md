# Phase-7-3: React Flow×Tamaguiスパイク(使い捨て技術検証)

## この章の目的

`@xyflow/react`(React Flow)が、devex-uiの実行環境(Next.js 16 + React 19.2.4 + Tamagui 2.6)で問題なく動作するかを検証する。Phase 11(FE: Adapter・React Flowプレビュー/編集の本実装)に先立つ技術検証であり、成果物は使い捨て(本実装時に置き換える)。

自動実装モード: on([introduction](./Phase-7-introduction.md) 参照)。

## この章で作成・更新するファイル

写経順序は依存順([CLAUDE.md](../../CLAUDE.md) #30)。テストは表の末尾に置く。

| ファイル | 新規/更新 | 写経レベル | 責務・要点 |
|---|---|---|---|
| `package.json`(devex-ui。samples未収録) | 更新 | 定型 | `@xyflow/react`を`dependencies`へ追加(`npm install @xyflow/react`で`^12.12.0`が入る) |
| `src/features/uml/components/UmlPageContent.tsx` | 新規 | 定型 | `"use client"`。ダミーノード2個・エッジ1本を固定表示する`ReactFlow`キャンバス。意味モデルとの連携は持たない |
| `src/app/projects/[id]/uml/page.tsx` | 新規 | 定型 | `documents/page.tsx`と同じ非同期Server Component + `RequireAuth`パターン。Tamagui/React Flowを使う実処理は`UmlPageContent`(Client Component)に委譲する |
| `src/features/uml/components/__tests__/UmlPageContent.test.tsx` | 新規 | 定型 | マウント確認・`projectId`表示の確認(React Flow自体の描画ロジックは検証対象外) |
| `src/app/projects/[id]/uml/__tests__/page.test.tsx` | 新規 | 定型 | `params`解決・`RequireAuth`配線・`UmlPageContent`への委譲の確認 |

## 設計判断

### なぜ本番同様のルート/コンポーネント配置で検証するか

「使い捨て」の技術検証だが、意味のある検証にするため、Phase 11で実際に使う予定の配置(`app/.../projects/[id]/uml/page.tsx` + `src/features/uml/components/`)をそのまま使う。特に、Tamaguiを使うコンポーネントをServer Componentから直接importすると`TypeError: createReactContext is not a function`になるという`devex-ui/CLAUDE.md`記載の既知の制約が、React Flow(それ自体もクライアント専用ライブラリ)と組み合わさったときに新しい問題を起こさないかを、実際に踏む地雷の場所で確認する。

### 検証結果

- `npm install @xyflow/react`は追加の依存衝突なくインストールできた(`^12.12.0`)。
- `npx tsc --noEmit`・`npm run lint`・`npm run test`(既存220件+新規1件、計221件)・`npm run build`のいずれも成功した。
- `npm run build`のルート一覧に`ƒ /projects/[id]/uml`が`documents`・`chat`と同じ`ƒ`(dynamic)として表示され、既存パターンと同じ扱いで動作することを確認した。
- jsdomの`ResizeObserver`未実装によりReact Flowのテストが落ちる可能性を懸念したが、`vitest.setup.ts`に既存のポリフィル(Tamaguiの`Select`向けに追加済み)がありテストは無修正で通った。

### なぜ`devex-ui`本体に直接コードを置くか

本Phaseの特例([introduction](./Phase-7-introduction.md)「本Phase固有の進行上の特例」参照)により、コードは`devex-ui`本体へ直接反映する。ただし`textbook/samples/`側にのみ[CLAUDE.md](../../CLAUDE.md) #29のPhaseタグ(`// 作成：Phase-7-3`)を付け、`devex-ui`本体のソースには一切タグを書かない(コメントは「Phase 7の技術検証スパイク」という平文のみ)。

## テスト観点

用語(初出): SUT(テスト対象)・ドライバ(テストコード自身)・スタブ(テストダブル)。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `UmlPageContent.test.tsx` | `UmlPageContent` | Vitest + React Testing Library | スタブ不要 ── 外部依存(API呼び出し等)を持たない純粋な表示コンポーネントのため |
| `page.test.tsx`(uml) | `ProjectUmlPage` | Vitest + React Testing Library | `UmlPageContent`を`vi.mock`でスタブ化(`documents`のページテストと同じ理由: ページ自身の`params`解決・`RequireAuth`配線だけを見る) |

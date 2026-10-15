# Phase-60-3: 「開発用」メニューを外す

## この章の目的

Phase 51-3 で、AI 設計レビューの見せ方のデモ(`/design-review-demo`)のために、devex-ui のメニューに「開発用」を足し直した。ステージ8の完了にあたり、ステージ6・7 の完了時と同じくメニューから外す(着手時の決定4)。デモのページとコードは残し、URL を直接開けば見られるようにする([Phase 50-3](../Phase-50/Phase-50-3.md) と同じ)。

自動実装モード: on([introduction](./Phase-60-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/lib/menu-tree.ts`](../samples/frontend/src/lib/menu-tree.ts) | 更新 | メニューの「開発用」のグループ(「AI 設計レビューデモ」)を削除する |
| ── ここからテスト ── | | |
| [`src/components/layout/__tests__/Menu.test.tsx`](../samples/frontend/src/components/layout/__tests__/Menu.test.tsx) | 更新 | 「開発用のグループにデモへのリンクを置く」を「開発用のグループを置かない」に替える |

## 要点

- 削除だけ。サイドメニュー・トップページのリンクカード・404 ページのリンクカラムの3か所が同じ `MENU_TREE` を読むので、3か所とも消える。
- ページ(`src/app/(pages)/design-review-demo/`)と `src/features/design-review/demo/` は残す。本物の画面の意味モデル(`src/features/design-review/model.ts`)は、デモで決めた見せ方を書いたもので、デモには依存しない。
- Phase 50 のときは、メニューのテストが「開発用」を見ていなかったので変えずに通った。Phase 51-3 でデモへのリンクを確かめるテストを足していたので、今回はそれを「置かない」に替えた。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
| --- | --- | --- | --- |
| `Menu.test.tsx`「開発用のグループを置かない」 | `MENU_TREE` を読むメニュー | テスト関数(描画して、「開発用」の見出しとデモのリンクが無いことを見る) | スタブ不要 ── 対象は表示だけで、外部依存を呼ばないため |

```sh
cd devex-ui && npx vitest run src/components/layout
```

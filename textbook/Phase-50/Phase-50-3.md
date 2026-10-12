# Phase-50-3: 「開発用」メニューを外す

## この章の目的

Phase 41 で、変更の影響の見せ方のデモ(`/change-impact-demo`)のために、devex-ui のメニューに「開発用」を足し直した([Phase 41 の申し送り](../Phase-41/Phase-41-introduction.md))。ステージ7の完了にあたり、ステージ6の完了時と同じくメニューから外す(着手時の決定4)。デモのページとコードは残し、URL を直接開けば見られるようにする。

自動実装モード: on([introduction](./Phase-50-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/lib/menu-tree.ts`](../samples/frontend/src/lib/menu-tree.ts) | 更新 | メニューの「開発用」のグループ(「変更の影響デモ」)を削除する |

## 要点

- 削除だけ。サイドメニュー・トップページのリンクカード・404 ページのリンクカラムの3か所が同じ `MENU_TREE` を読むので、3か所とも消える。
- ステージ6の完了時は、デモのページ・コードもまとめて消した。今回は決定どおりページ(`src/app/(pages)/change-impact-demo/`)と `src/features/change-impact/demo/` を残す。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
| --- | --- | --- | --- |
| `src/components/layout/__tests__/Menu.test.tsx`(既存) | `MENU_TREE` を読むメニュー | テスト関数(描画して見出しとリンクを見る) | スタブ不要 ── 対象は表示だけで、外部依存を呼ばないため |

既存のテストは「開発用」を見ていないので、変えずに通る。

```sh
cd devex-ui && npx vitest run src/components/layout
```
